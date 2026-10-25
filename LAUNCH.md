# Insight Pros: launch notes and owner approvals

Status: **ready for preview review. Not ready for production** until the items marked BLOCKER are resolved.

## Owner approvals needed

| # | Item | What the page does today | Status |
|---|---|---|---|
| 1 | Online store development scope | Listed under Websites and custom applications (from the strategy doc) | Confirm scope |
| 2 | Sales funnels | Not shown (doc marks scope to confirm) | Confirm before adding |
| 3 | Professional photography | Listed under Content and social media | Confirm scope |
| 4 | Staff training | Listed under Business consulting ("team training") | Confirm scope |
| 5 | Ongoing support packages | Shown only as "agreed ongoing support" | Confirm scope |
| 6 | Larger organization projects | Audience card uses the doc's wording, no claims of scale or certifications | Confirm |
| 7 | Published work samples | Website example = this site. Communication and dashboard examples are labeled demonstrations with sample data | Add real, permitted projects when available |
| 8 | Client testimonials and permission | Removed from the page at owner request (Oct 2026) | None needed |
| 9 | Booking platform and URL | https://calendly.com/jemst-consulting-info/30min (from the existing site) | Confirm a full test booking completes |
| 10 | Inquiry form destination | **Not connected.** Form validates and shows a clear "not sent" message with phone, email and booking options | **BLOCKER** |
| 11 | Official contact details | Phone 863-259-3434, info@jemst-consulting.com | Confirm |
| 12 | Insight Pros and JEMST legal relationship | Footer/menu say "Insight Pros is a JEMST Consulting company". No parentOrganization in schema until confirmed | Confirm |
| 13 | Public location and service area | Address labeled "Mailing address". areaServed = Central Florida | Confirm address type |
| 14 | Specialist services outside the six categories | None shown | Decide per service |

## Connecting the inquiry form (item 10)

1. Choose an approved destination (for example a form service or CRM webhook that accepts JSON POST and returns 2xx on success).
2. Put its URL in `index.html` on the form: `<form class="inquiry" id="inquiry" data-endpoint="https://...">`.
3. The form sends `{ name, business, email, service, phone, website }` as JSON. Success is shown only after a 2xx response. Errors show a retry message and the phone/email/booking fallback.
4. Test one real submission end to end and confirm it arrives.
5. Do not put API keys in the page. Use an endpoint that does not need a secret in the browser.

## Switching from preview to production

The preview (GitHub Pages) is intentionally kept out of search:
- `index.html` has `<meta name="robots" content="noindex, follow">` and no canonical tag.
- Social tags and schema logo point to the preview URL so images load.

At launch on insightproexperts.com:
1. Remove the `noindex` meta tag.
2. Add `<link rel="canonical" href="https://insightproexperts.com/">`.
3. Change `og:url`, `og:image`, `twitter:image` and the schema `logo`/`image` to the production domain.
4. Confirm `sitemap.xml` and `robots.txt` use the production domain; submit the sitemap in Search Console.
5. Redirect valuable old URLs individually (for example `/digital-marketing-2/` and `/social-media-management-2/` to the relevant section or a future service page). Do not redirect everything to the homepage.

## Service pages (proposed, not published)

`/website-design/`, `/digital-marketing/`, `/search-visibility/`, `/content-social-media/`, `/customer-communication/`, `/business-automation/`, `/custom-applications/`, `/business-consulting/` are planned in the strategy doc. They are **not built** because each needs original content, confirmed scope and real examples. The site is a single static page today; when content is ready each page can be added as `/<route>/index.html` sharing `css/style.css`, with a BreadcrumbList in its schema. Keep them out of navigation until ready.

## Analytics

Clicks on booking buttons and form outcomes call a `track()` hook that only reports if an approved analytics tool (`window.dataLayer`) is installed. Events: `booking_click`, `inquiry_accepted`, `inquiry_failed`, `inquiry_not_connected`. Accepted inquiries and completed bookings must be measured separately: a booking click is not a completed booking (track completions in the booking platform).
