// Site configuration. Everything here is public (safe to ship to browsers).
// Private Retell API keys live ONLY in the Cloudflare Worker secrets (see worker/README.md).
export const SITE_CONFIG = {
  // Inquiry + callback endpoint (Cloudflare Worker route). Empty = not connected: the form shows a truthful "not sent" message.
  // After the Worker is deployed on the production domain, set to "/api/lead".
  leadEndpoint: "",

  retell: {
    agentId: "agent_a39dab05dd12699bb82b353df2",
    // Domain-restricted PUBLIC key from the Retell dashboard (starts with "public_key_").
    // Allowed domains should include: insightproexperts.com, mtexidor7.github.io and localhost.
    // Empty = the live voice demo shows a "being connected" message instead of a fake orb conversation.
    publicKey: "",
    sdkUrl: "https://esm.sh/retell-client-js-sdk@3.0.2",
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
