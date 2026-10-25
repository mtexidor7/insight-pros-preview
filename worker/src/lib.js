// Insight Pros lead + Retell callback Worker: pure helpers (unit-tested in worker/test).

export const SERVICES = [
  "Websites and custom applications",
  "Digital marketing and search visibility",
  "Content and social media",
  "Customer communication and follow up",
  "Business automation and integrations",
  "Business consulting and implementation",
  "Not sure yet",
];

// ------------------------------------------------------------------ validation
export function toE164(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (v.startsWith("+")) { const d = "+" + v.slice(1).replace(/\D/g, ""); return /^\+[1-9]\d{7,14}$/.test(d) ? d : ""; }
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? "+1" + d : "";
}

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export function validateLead(body) {
  const errors = [];
  const lead = {
    request_id: clean(body.request_id, 80),
    name: clean(body.name, 100),
    business: clean(body.business, 150),
    email: clean(body.email, 254).toLowerCase(),
    service: clean(body.service, 80),
    phone: body.phone ? toE164(body.phone) : "",
    website: clean(body.website, 200),
    callback_requested: body.callback_requested === true,
    context: {},
  };
  if (!/^[A-Za-z0-9-]{8,80}$/.test(lead.request_id)) errors.push("request_id");
  if (lead.name.length < 2) errors.push("name");
  if (lead.business.length < 2) errors.push("business");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.push("email");
  if (!SERVICES.includes(lead.service)) errors.push("service");
  if (body.phone && !lead.phone) errors.push("phone");
  if (lead.callback_requested && !lead.phone) errors.push("phone");
  const ctx = body.context && typeof body.context === "object" ? body.context : {};
  for (const k of ["page", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
    if (ctx[k]) lead.context[k] = clean(ctx[k], 200);
  }
  const c = body.callback_consent;
  lead.consent = lead.callback_requested && c && c.given === true
    ? { given: true, version: clean(c.version, 80), text: clean(c.text, 1200), client_at: clean(c.at, 40) }
    : null;
  if (lead.callback_requested && !lead.consent) errors.push("callback_consent");
  return { lead, errors };
}

// ------------------------------------------------------------------ calling hours
// Conservative windows (called party local time 9:00-20:00 assumed unknown unless the area code is known Eastern).
// Florida area codes in the Eastern zone; 850/448 straddle Eastern/Central.
const EASTERN_FL = new Set(["239", "305", "321", "324", "352", "386", "407", "561", "645", "656", "689", "727", "728", "754", "772", "786", "813", "863", "904", "941", "954"]);
const ET_CT_FL = new Set(["850", "448"]);

export function easternHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(date);
  return { hour: Number(parts.find((p) => p.type === "hour").value), weekday: parts.find((p) => p.type === "weekday").value };
}

export function callingWindowFor(e164) {
  const area = e164.startsWith("+1") ? e164.slice(2, 5) : "";
  if (EASTERN_FL.has(area)) return { startET: 9, endET: 20, label: "eastern" };      // 9am-8pm Eastern
  if (ET_CT_FL.has(area)) return { startET: 10, endET: 20, label: "eastern-central" }; // 9am Central
  return { startET: 12, endET: 20, label: "conservative" };                           // 9am Pacific to 8pm Eastern
}

export function inCallingWindow(e164, date = new Date()) {
  if (!e164.startsWith("+1")) return false; // only US numbers are supported for callbacks
  const { hour } = easternHour(date);
  const w = callingWindowFor(e164);
  return hour >= w.startET && hour < w.endET;
}

// ------------------------------------------------------------------ crypto helpers
const enc = new TextEncoder();
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function hmacHex(key, text) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Retell webhook signature: header "v={timestamp_ms},d={hex}", HMAC-SHA256(rawBody + timestamp) keyed by the webhook-badge API key, 5-minute tolerance.
export async function verifyRetellSignature(rawBody, apiKey, header, now = Date.now()) {
  if (!header || !apiKey) return false;
  const m = /v=(\d+),d=(.*)/.exec(header);
  if (!m) return false;
  const ts = Number(m[1]);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60 * 1000) return false;
  const digest = await hmacHex(apiKey, rawBody + m[1]);
  return safeEqual(digest, m[2].trim());
}

// ------------------------------------------------------------------ misc
export const isTrue = (v) => String(v).toLowerCase() === "true";
export const listOf = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
export const idemKey = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 255);
