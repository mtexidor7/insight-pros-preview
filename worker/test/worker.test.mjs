// Run: node --test worker/test/   (no network, no real calls: Retell and CRM are mocked)
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { runScheduled } from "../src/index.js";
import { toE164, inCallingWindow, verifyRetellSignature, hmacHex, validateLead } from "../src/lib.js";

// ---------- mocks
function kv() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; },
  };
}
let calls = [], crm = [], retellStatus = 201;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/v2/create-phone-call")) { calls.push(JSON.parse(init.body)); return new Response(JSON.stringify(retellStatus < 300 ? { call_id: "call_" + calls.length } : { message: "boom" }), { status: retellStatus }); }
  if (url.startsWith("https://crm.test")) { crm.push(JSON.parse(init.body)); return new Response("ok", { status: 200 }); }
  throw new Error("unexpected fetch " + url);
};
const ORIGIN = "http://localhost:5173";
const baseEnv = () => ({
  LEADS: kv(), ALLOWED_ORIGINS: ORIGIN, RETELL_API_KEY: "key_test_webhook", RETELL_AGENT_ID: "agent_a39dab05dd12699bb82b353df2",
  RETELL_FROM_NUMBER: "+18635550100", CALLBACKS_ENABLED: "true", TEST_MODE: "true", TEST_ALLOWED_NUMBERS: "+18635550199",
  CONSENT_VERSION: "callback-consent-v1-2026-10-24", LEAD_WEBHOOK_URL: "https://crm.test/hook", HASH_SALT: "salt",
});
const lead = (over = {}) => ({
  request_id: "req-" + Math.random().toString(16).slice(2, 12), name: "Test Person", business: "Test Co", email: "test@example.com",
  service: "Not sure yet", phone: "", callback_requested: false, callback_consent: null, context: { page: "/" }, ...over,
});
const withCall = (phone, over = {}) => lead({ phone, callback_requested: true, callback_consent: { given: true, version: "callback-consent-v1-2026-10-24", text: "consent text", at: new Date().toISOString() }, ...over });
const post = (env, body, ip = "1.2.3.4", origin = ORIGIN) => worker.fetch(new Request("https://x.test/api/lead", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": ip }, body: JSON.stringify(body) }), env, { waitUntil() {} });
const reset = () => { calls = []; crm = []; retellStatus = 201; };
// pin "now" inside calling hours for the window-dependent tests (2026-10-27 14:00 ET, a Tuesday)
const RealDate = Date;
async function at(iso, fn) { globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new RealDate(iso).getTime(); } }; try { return await fn(); } finally { globalThis.Date = RealDate; } }

// ---------- pure helpers
test("E.164 normalization", () => {
  assert.equal(toE164("863-259-3434"), "+18632593434");
  assert.equal(toE164("(863) 259 3434"), "+18632593434");
  assert.equal(toE164("1 863 259 3434"), "+18632593434");
  assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
  assert.equal(toE164("123"), "");
  assert.equal(toE164("055-259-3434"), "");
});

test("calling windows (Eastern time)", () => {
  assert.equal(inCallingWindow("+18632593434", new Date("2026-10-27T13:30:00Z")), true);   // 9:30 ET, Florida 863
  assert.equal(inCallingWindow("+18632593434", new Date("2026-10-27T12:30:00Z")), false);  // 8:30 ET
  assert.equal(inCallingWindow("+18632593434", new Date("2026-10-28T00:30:00Z")), false);  // 20:30 ET
  assert.equal(inCallingWindow("+12135550100", new Date("2026-10-27T14:30:00Z")), false);  // 10:30 ET, LA number: too early there
  assert.equal(inCallingWindow("+12135550100", new Date("2026-10-27T17:30:00Z")), true);   // 13:30 ET
  assert.equal(inCallingWindow("+442079460958", new Date("2026-10-27T17:30:00Z")), false); // non-US never
});

test("validation rejects missing consent and bad phone", () => {
  assert.deepEqual(validateLead(lead({ callback_requested: true, phone: "+18632593434" })).errors, ["callback_consent"]);
  assert.ok(validateLead(lead({ phone: "abc" })).errors.includes("phone"));
  assert.ok(validateLead(lead({ service: "Hacking" })).errors.includes("service"));
});

test("webhook signature verification", async () => {
  const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
  const ts = String(Date.now());
  const good = "v=" + ts + ",d=" + (await hmacHex("key_test_webhook", body + ts));
  assert.equal(await verifyRetellSignature(body, "key_test_webhook", good), true);
  assert.equal(await verifyRetellSignature(body + " ", "key_test_webhook", good), false);              // tampered body
  assert.equal(await verifyRetellSignature(body, "other_key", good), false);                          // wrong key
  const old = String(Date.now() - 6 * 60 * 1000);
  assert.equal(await verifyRetellSignature(body, "key_test_webhook", "v=" + old + ",d=" + (await hmacHex("key_test_webhook", body + old))), false); // replay
});

// ---------- end-to-end handler behaviour (mocked Retell/CRM)
test("plain inquiry: saved, sent to CRM, no call", async () => {
  reset(); const env = baseEnv();
  const res = await post(env, lead());
  const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.ok, true); assert.equal(body.callback, "not_requested");
  assert.equal(calls.length, 0); assert.equal(crm.length, 1);
  assert.ok(env.LEADS.m.has("lead:" + body.lead_id));
});

test("origin not allowed is rejected", async () => {
  reset(); const res = await post(baseEnv(), lead(), "1.2.3.4", "https://evil.example");
  assert.equal(res.status, 403); assert.equal(calls.length, 0);
});

test("callback without consent is rejected and never calls", async () => {
  reset(); const res = await post(baseEnv(), lead({ phone: "+18635550199", callback_requested: true }));
  assert.equal(res.status, 422); assert.equal(calls.length, 0);
});

await test("authorized test number in calling hours: exactly one call, with lead context", async () => {
  reset(); const env = baseEnv();
  const body = await at("2026-10-27T18:00:00Z", async () => (await post(env, withCall("+18635550199"))).json());
  assert.equal(body.callback, "queued"); assert.equal(calls.length, 1);
  assert.equal(calls[0].to_number, "+18635550199"); assert.equal(calls[0].from_number, "+18635550100");
  assert.equal(calls[0].override_agent_id, "agent_a39dab05dd12699bb82b353df2");
  assert.equal(calls[0].retell_llm_dynamic_variables.service_interest, "Not sure yet");
  const stored = JSON.parse(env.LEADS.m.get("lead:" + body.lead_id));
  assert.equal(stored.consent.version, "callback-consent-v1-2026-10-24"); assert.ok(stored.consent.server_at);
});

await test("TEST_MODE blocks numbers that are not on the authorized list", async () => {
  reset(); const env = baseEnv();
  const body = await at("2026-10-27T18:00:00Z", async () => (await post(env, withCall("+18632593434"))).json());
  assert.equal(body.callback, "not_placed"); assert.equal(calls.length, 0);
  assert.equal(JSON.parse(env.LEADS.m.get("lead:" + body.lead_id)).callback.reason, "test_mode_number_not_authorized");
});

await test("callbacks disabled by default switch", async () => {
  reset(); const env = { ...baseEnv(), CALLBACKS_ENABLED: "false" };
  const body = await at("2026-10-27T18:00:00Z", async () => (await post(env, withCall("+18635550199"))).json());
  assert.equal(body.callback, "not_placed"); assert.equal(calls.length, 0);
});

await test("duplicate submissions never trigger a second call", async () => {
  reset(); const env = baseEnv();
  await at("2026-10-27T18:00:00Z", async () => {
    const first = withCall("+18635550199");
    const a = await (await post(env, first)).json();
    const b = await (await post(env, first)).json();                         // same request_id (retry)
    const c = await (await post(env, withCall("+18635550199"), "5.6.7.8")).json(); // new request, same number
    assert.equal(a.callback, "queued"); assert.deepEqual(b, a); assert.equal(c.callback, "not_placed");
  });
  assert.equal(calls.length, 1);
});

await test("outside calling hours: scheduled, then placed by cron inside hours", async () => {
  reset(); const env = baseEnv();
  const body = await at("2026-10-28T02:00:00Z", async () => (await post(env, withCall("+18635550199"))).json()); // 22:00 ET
  assert.equal(body.callback, "scheduled"); assert.equal(calls.length, 0);
  await runScheduled(env, new Date("2026-10-28T05:00:00Z")); assert.equal(calls.length, 0);   // 01:00 ET still closed
  await at("2026-10-28T14:00:00Z", () => runScheduled(env, new Date("2026-10-28T14:00:00Z"))); // 10:00 ET
  assert.equal(calls.length, 1);
});

await test("Retell failure keeps the lead and reports not_placed", async () => {
  reset(); retellStatus = 500; const env = baseEnv();
  const res = await at("2026-10-27T18:00:00Z", () => post(env, withCall("+18635550199")));
  const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.callback, "not_placed");
  assert.equal(JSON.parse(env.LEADS.m.get("lead:" + body.lead_id)).callback.status, "failed");
  assert.equal(env.LEADS.m.has("cb:+18635550199"), false); // claim released so a later retry is possible
});

test("rate limiting per IP", async () => {
  reset(); const env = baseEnv();
  for (let i = 0; i < 6; i++) assert.equal((await post(env, lead(), "9.9.9.9")).status, 200);
  assert.equal((await post(env, lead(), "9.9.9.9")).status, 429);
});

await test("webhook: signed events update the lead, duplicates ignored, opt-out suppresses future calls", async () => {
  reset(); const env = baseEnv();
  const body = await at("2026-10-27T18:00:00Z", async () => (await post(env, withCall("+18635550199"))).json());
  const payload = JSON.stringify({ event: "call_analyzed", call: { call_id: "call_1", call_status: "ended", metadata: { lead_id: body.lead_id }, call_analysis: { call_summary: "Asked about websites", custom_analysis_data: { opt_out: true } } } });
  const send = async (sig) => worker.fetch(new Request("https://x.test/api/retell-webhook", { method: "POST", headers: { "x-retell-signature": sig }, body: payload }), env, {});
  const ts = String(Date.now());
  const sig = "v=" + ts + ",d=" + (await hmacHex("key_test_webhook", payload + ts));
  assert.equal((await send("v=" + ts + ",d=bad")).status, 401);
  assert.equal((await send(sig)).status, 204);
  assert.equal((await send(sig)).status, 204); // duplicate
  const stored = JSON.parse(env.LEADS.m.get("lead:" + body.lead_id));
  assert.equal(stored.call_events.length, 1); assert.equal(stored.do_not_call, true);
  assert.ok(env.LEADS.m.has("dnc:+18635550199"));
});
