# Insight Pros lead + Retell callback Worker

Status: **built and tested locally, NOT deployed.** No outbound calls have been placed.

## What it does

| Route | Purpose |
|---|---|
| `POST /api/lead` | Validates the landing page form, saves the lead (Cloudflare KV) before anything else, forwards it to your existing CRM webhook, and, only when the visitor checked the callback box, requests an AI callback through Retell. |
| `POST /api/retell-webhook` | Receives Retell call events (started, ended, analyzed), verifies the `X-Retell-Signature`, ignores duplicates, records the outcome on the lead and forwards it to your CRM. |
| Cron every 15 min | Places callbacks that arrived outside calling hours once the window opens; retries failed CRM deliveries. |

The browser **voice orb does not use this Worker**: it uses Retell's official SDK with a domain-restricted public key (see `js/config.js`).

## Safety rules built in

- A call is requested only if: the callback box was checked, consent text + version + timestamps are recorded, `CONSENT_VERSION` matches, `CALLBACKS_ENABLED=true`, the number is a valid US E.164 number, it is not on the opt-out list, and it has not been called in the last 24 hours.
- `TEST_MODE=true` (default): only numbers listed in `TEST_ALLOWED_NUMBERS` can be called. Real leads cannot be called until you switch this off.
- Calling hours (Eastern time): Florida Eastern area codes 9am to 8pm; 850/448 10am to 8pm; any other US number 12pm to 8pm (9am Pacific). Outside hours the request is queued for the next window.
- Idempotency: repeated submissions with the same request ID return the stored result; Retell `idempotency_key` is set per lead; `honor_internal_dnc` is on.
- Rate limits per hashed IP (6 inquiries/hour, 2 callback requests/day), honeypot, optional Cloudflare Turnstile, origin allowlist.
- Logs contain lead IDs and outcomes only, no names, emails or phone numbers. Visitor IPs are stored only as salted hashes.
- If Retell or the CRM fails, the lead is still saved and the visitor sees a truthful message.

## Test it locally

```bash
cd worker
npm test                      # 15 unit tests, Retell and CRM mocked, no network
npx wrangler@3 dev --local    # runs the Worker in Cloudflare's runtime on http://127.0.0.1:8787
```

## To go live (owner approval required for each step)

1. **Retell dashboard**
   - Buy or import an outbound phone number; put it in `RETELL_FROM_NUMBER` (E.164).
   - Create an API key with the **webhook badge**; store it as the `RETELL_API_KEY` secret.
   - Create a **public key** restricted to `insightproexperts.com`, `www.insightproexperts.com`, `mtexidor7.github.io` and `localhost`; put it in `js/config.js` → `retell.publicKey`. Optionally enable reCAPTCHA on that key.
   - Set the agent's webhook URL to `https://insightproexperts.com/api/retell-webhook`.
   - Recommended agent changes (not made, need your approval): open outbound calls with "Hi, this is the AI assistant for Insight Pros. You requested a call about {{service_interest}}. Is now still a good time?"; add post-call analysis fields `opt_out` (boolean), `appointment_requested` (boolean), `human_follow_up` (boolean); use `{{customer_name}}`, `{{business_name}}`, `{{service_interest}}`.
2. **Cloudflare**
   - `npx wrangler kv namespace create LEADS` and paste the id into `wrangler.toml`.
   - `npx wrangler secret put RETELL_API_KEY` (and `HASH_SALT`, optional `LEAD_WEBHOOK_URL`, `OUTCOME_WEBHOOK_URL`, `TURNSTILE_SECRET`).
   - Uncomment the `routes` in `wrangler.toml`, then `npx wrangler deploy`.
3. **Site**: set `leadEndpoint: "/api/lead"` in `js/config.js` once the page is served from the same domain as the Worker.
4. **Test with your own phone only**: add it to `TEST_ALLOWED_NUMBERS`, set `CALLBACKS_ENABLED=true`, submit the form with the box checked, confirm the call, the webhook outcome and the CRM record.
5. **Legal review** of the consent wording, recording notice and calling rules (TCPA/FCC AI-voice rules, Florida Telephone Solicitation Act). Only then set `TEST_MODE=false`.

## Not covered yet

- National Do Not Call registry scrubbing (requested informational callbacks with prior consent may be exempt; confirm with counsel).
- SMS follow-up (needs its own consent; not built).
- KV is eventually consistent; for strict once-only guarantees at very high volume, move the callback claim to a Durable Object.
