// Insight Pros: lead intake, consent-gated Retell AI callbacks and Retell webhooks.
// Routes (bind on the production domain): POST /api/lead, POST /api/retell-webhook. Cron: pending callbacks + CRM retries.
// Secrets (never in the browser): RETELL_API_KEY, LEAD_WEBHOOK_URL, OUTCOME_WEBHOOK_URL, TURNSTILE_SECRET, HASH_SALT.
import { validateLead, inCallingWindow, verifyRetellSignature, sha256Hex, isTrue, listOf, idemKey } from "./lib.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
const log = (event, fields = {}) => console.log(JSON.stringify({ event, ...fields })); // no names, emails or phone numbers in logs
const DAY = 86400;

function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = listOf(env.ALLOWED_ORIGINS);
  const ok = allowed.includes(origin);
  return { ok, headers: ok ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {} };
}

async function rateLimited(env, key, limit, ttl) {
  const k = "rl:" + key;
  const n = Number((await env.LEADS.get(k)) || 0);
  if (n >= limit) return true;
  await env.LEADS.put(k, String(n + 1), { expirationTtl: ttl });
  return false;
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // not configured: honeypot + rate limits still apply
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || "" }),
  });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

async function forward(url, payload) {
  if (!url) return "not_configured";
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return res.ok ? "delivered" : "failed";
  } catch (e) {
    return "failed";
  }
}

// ------------------------------------------------------------------ Retell outbound call
async function placeCall(env, lead) {
  const base = env.RETELL_API_BASE || "https://api.retellai.com";
  const res = await fetch(base + "/v2/create-phone-call", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RETELL_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from_number: env.RETELL_FROM_NUMBER,
      to_number: lead.phone,
      override_agent_id: env.RETELL_AGENT_ID,
      idempotency_key: idemKey("cb-" + lead.id),
      honor_internal_dnc: true,
      metadata: { lead_id: lead.id, source: "insightpros_landing_form", request_type: "requested_callback" },
      retell_llm_dynamic_variables: {
        customer_name: lead.name.split(" ")[0] || lead.name,
        business_name: lead.business,
        service_interest: lead.service,
        request_type: "requested_callback",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("retell_" + res.status + (body.message ? ":" + String(body.message).slice(0, 120) : ""));
  return body.call_id;
}

// Decide whether a requested callback may be placed. Returns { allowed, reason }.
async function callbackGate(env, lead) {
  if (!lead.callback_requested || !lead.consent?.given) return { allowed: false, reason: "no_consent" };
  if (env.CONSENT_VERSION && lead.consent.version !== env.CONSENT_VERSION) return { allowed: false, reason: "consent_version_mismatch" };
  if (!isTrue(env.CALLBACKS_ENABLED)) return { allowed: false, reason: "callbacks_disabled" };
  if (!env.RETELL_API_KEY || !env.RETELL_FROM_NUMBER || !env.RETELL_AGENT_ID) return { allowed: false, reason: "not_configured" };
  if (isTrue(env.TEST_MODE ?? "true") && !listOf(env.TEST_ALLOWED_NUMBERS).includes(lead.phone)) return { allowed: false, reason: "test_mode_number_not_authorized" };
  if (!lead.phone.startsWith("+1")) return { allowed: false, reason: "non_us_number" };
  if (await env.LEADS.get("dnc:" + lead.phone)) return { allowed: false, reason: "do_not_call" };
  if (await env.LEADS.get("cb:" + lead.phone)) return { allowed: false, reason: "recent_callback_exists" };
  return { allowed: true };
}

async function attemptCallback(env, lead, now = new Date()) {
  const gate = await callbackGate(env, lead);
  if (!gate.allowed) { lead.callback = { status: "not_placed", reason: gate.reason }; return "not_placed"; }
  if (!inCallingWindow(lead.phone, now)) {
    await env.LEADS.put("pending:" + lead.id, lead.id, { expirationTtl: 3 * DAY });
    lead.callback = { status: "scheduled", reason: "outside_calling_hours" };
    return "scheduled";
  }
  // claim the number for 24h before calling (prevents duplicate calls from retries or double submits)
  await env.LEADS.put("cb:" + lead.phone, lead.id, { expirationTtl: DAY });
  try {
    const callId = await placeCall(env, lead);
    lead.callback = { status: "requested", call_id: callId, at: new Date().toISOString() };
    log("callback_requested", { lead_id: lead.id, call_id: callId });
    return "queued";
  } catch (e) {
    await env.LEADS.delete("cb:" + lead.phone);
    lead.callback = { status: "failed", reason: String(e.message).slice(0, 160) };
    log("callback_failed", { lead_id: lead.id, reason: lead.callback.reason });
    return "not_placed";
  }
}

// ------------------------------------------------------------------ POST /api/lead
async function handleLead(request, env, ctx) {
  const c = cors(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
  if (!c.ok) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, c.headers);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 16000) return json({ ok: false, error: "too_large" }, 413, c.headers);

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "invalid_json" }, 400, c.headers); }
  if (body.company_website) return json({ ok: true, lead_id: null, callback: "not_requested" }, 200, c.headers); // honeypot

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ipHash = (await sha256Hex((env.HASH_SALT || "") + ip)).slice(0, 32);
  if (await rateLimited(env, "lead:" + ipHash, Number(env.LEAD_RATE_LIMIT || 6), 3600)) return json({ ok: false, error: "rate_limited" }, 429, c.headers);
  if (!(await verifyTurnstile(env, body.turnstile_token, ip))) return json({ ok: false, error: "bot_check_failed" }, 400, c.headers);

  const { lead, errors } = validateLead(body);
  if (errors.length) return json({ ok: false, error: "invalid_fields", fields: errors }, 422, c.headers);

  // idempotency: the same request_id returns the stored outcome and never re-triggers a call
  const prior = await env.LEADS.get("req:" + lead.request_id);
  if (prior) return json(JSON.parse(prior), 200, c.headers);

  lead.id = "lead_" + crypto.randomUUID();
  lead.received_at = new Date().toISOString();
  lead.ip_hash = ipHash;
  lead.user_agent = (request.headers.get("User-Agent") || "").slice(0, 200);
  if (lead.consent) lead.consent.server_at = lead.received_at;

  // 1) save first, so the lead is never lost
  await env.LEADS.put("lead:" + lead.id, JSON.stringify(lead));

  // 2) callback decision (only with explicit consent and all safeguards)
  let callback = "not_requested";
  if (lead.callback_requested) {
    if (await rateLimited(env, "cb:" + ipHash, Number(env.CALLBACK_RATE_LIMIT || 2), DAY)) { lead.callback = { status: "not_placed", reason: "ip_rate_limited" }; callback = "not_placed"; }
    else callback = await attemptCallback(env, lead);
  }

  // 3) hand off to the existing CRM / workflow webhook (retried by cron on failure)
  lead.crm_status = await forward(env.LEAD_WEBHOOK_URL, { type: "lead", lead });
  if (lead.crm_status === "failed") await env.LEADS.put("crmretry:" + lead.id, lead.id, { expirationTtl: 7 * DAY });

  await env.LEADS.put("lead:" + lead.id, JSON.stringify(lead));
  const response = { ok: true, lead_id: lead.id, callback };
  await env.LEADS.put("req:" + lead.request_id, JSON.stringify(response), { expirationTtl: DAY });
  log("lead_received", { lead_id: lead.id, service: lead.service, callback, crm: lead.crm_status });
  return json(response, 200, c.headers);
}

// ------------------------------------------------------------------ POST /api/retell-webhook
async function handleWebhook(request, env) {
  if (request.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const raw = await request.text();
  const ok = await verifyRetellSignature(raw, env.RETELL_API_KEY, request.headers.get("x-retell-signature"));
  if (!ok) { log("webhook_rejected", { reason: "bad_signature" }); return new Response("unauthorized", { status: 401 }); }
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return new Response("bad_request", { status: 400 }); }
  const { event, call = {} } = payload;
  const dedupe = "wh:" + (call.call_id || "none") + ":" + event;
  if (await env.LEADS.get(dedupe)) return new Response(null, { status: 204 });
  await env.LEADS.put(dedupe, "1", { expirationTtl: 7 * DAY });

  const leadId = call.metadata?.lead_id;
  const outcome = {
    event,
    call_id: call.call_id,
    call_status: call.call_status,
    disconnection_reason: call.disconnection_reason,
    duration_ms: call.duration_ms ?? (call.end_timestamp && call.start_timestamp ? call.end_timestamp - call.start_timestamp : undefined),
    summary: call.call_analysis?.call_summary,
    sentiment: call.call_analysis?.user_sentiment,
    analysis: call.call_analysis?.custom_analysis_data,
    at: new Date().toISOString(),
  };

  if (leadId) {
    const stored = await env.LEADS.get("lead:" + leadId);
    if (stored) {
      const lead = JSON.parse(stored);
      lead.call_events = [...(lead.call_events || []), outcome].slice(-10);
      // opt-out captured by the agent's post-call analysis (recommended custom field: opt_out = true)
      if (outcome.analysis && (outcome.analysis.opt_out === true || outcome.analysis.do_not_call === true)) {
        await env.LEADS.put("dnc:" + lead.phone, leadId);
        lead.do_not_call = true;
      }
      await env.LEADS.put("lead:" + leadId, JSON.stringify(lead));
    }
  }
  await forward(env.OUTCOME_WEBHOOK_URL, { type: "call_outcome", lead_id: leadId || null, outcome });
  log("webhook_processed", { event, call_id: call.call_id, lead_id: leadId || null });
  return new Response(null, { status: 204 });
}

// ------------------------------------------------------------------ cron: pending callbacks + CRM retries
async function runScheduled(env, now = new Date()) {
  const pending = await env.LEADS.list({ prefix: "pending:" });
  for (const { name } of pending.keys) {
    const id = name.slice("pending:".length);
    const stored = await env.LEADS.get("lead:" + id);
    if (!stored) { await env.LEADS.delete(name); continue; }
    const lead = JSON.parse(stored);
    if (!inCallingWindow(lead.phone, now)) continue;
    await env.LEADS.delete(name);
    await attemptCallback(env, lead, now);
    await env.LEADS.put("lead:" + id, JSON.stringify(lead));
  }
  const retries = await env.LEADS.list({ prefix: "crmretry:" });
  for (const { name } of retries.keys) {
    const id = name.slice("crmretry:".length);
    const stored = await env.LEADS.get("lead:" + id);
    if (!stored) { await env.LEADS.delete(name); continue; }
    const lead = JSON.parse(stored);
    lead.crm_status = await forward(env.LEAD_WEBHOOK_URL, { type: "lead", lead });
    if (lead.crm_status !== "failed") await env.LEADS.delete(name);
    await env.LEADS.put("lead:" + id, JSON.stringify(lead));
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/api/lead") return await handleLead(request, env, ctx);
      if (pathname === "/api/retell-webhook") return await handleWebhook(request, env);
      return new Response("not_found", { status: 404 });
    } catch (e) {
      log("worker_error", { path: pathname, message: String(e.message).slice(0, 160) });
      return json({ ok: false, error: "server_error" }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
};

export { runScheduled, attemptCallback, callbackGate };
