// Site configuration. Everything here is public (safe to ship to browsers).
// Private Retell API keys live ONLY in the Cloudflare Worker secrets (see worker/README.md).
export const SITE_CONFIG = {
  // Inquiry + callback endpoint (Cloudflare Worker route). Empty = not connected: the form shows a truthful "not sent" message.
  // Cloudflare Worker (workers.dev). Once the Worker is routed on the production domain, this can become "/api/lead".
  leadEndpoint: "https://insightpros-leads.mtexidor7.workers.dev/api/lead",

  retell: {
    agentId: "agent_a39dab05dd12699bb82b353df2", // Ashley
    agentName: "Ashley",
    // Which agent version web calls use. "latest_published" never picks up unpublished draft edits.
    // To freeze a specific version instead, put its number here (e.g. 12).
    agentVersion: "latest_published",
    // Domain-restricted PUBLIC key from the Retell dashboard (starts with "public_key_"). Safe to ship to browsers.
    // Allowed domains should include: insightproexperts.com, www.insightproexperts.com, mtexidor7.github.io and localhost.
    // Empty = the live voice demo shows a "not connected yet" message instead of a fake orb conversation.
    publicKey: "public_key_6dd3034544bca8007fffe",
    // Google reCAPTCHA v3 SITE key, only if reCAPTCHA is turned on for the public key in Retell. Empty = off.
    recaptchaSiteKey: "",
    // Loaded only after the visitor presses the orb. 3.0.3 ends the call when the microphone is denied.
    sdkUrl: "https://esm.sh/retell-client-js-sdk@3.0.3",
    connectTimeoutMs: 25000,
  },

  // Cloudflare Turnstile site key (public). Empty = Turnstile not used; the Worker still applies a honeypot and rate limits.
  turnstileSiteKey: "",

  // Callback consent text. Bump the version whenever the wording changes; the version is stored with each consent record.
  callbackConsent: {
    version: "callback-consent-v1-2026-10-24",
  },

  // 30-day promotion. OFF until the owner approves the offer, terms and real dates.
  // When approved: set enabled: true, start/end as ISO dates (America/New_York), and the exact approved text.
  promo: {
    enabled: false,
    start: "",   // e.g. "2026-11-01T00:00:00-04:00"
    end: "",     // e.g. "2026-11-30T23:59:59-05:00"
    text: "",    // exact approved wording
  },
};
