# Insight Pros Design System

Tokens live in the `:root` block of `css/style.css`. Change values there, not in components. Approved copy comes from "Insight Pros Landing Page Strategy and Copy" (Oct 18 2026); launch blockers are in `LAUNCH.md`.

## Positioning
Insight Pros helps businesses attract customers, respond to inquiries and manage daily work: websites, marketing content and connected business tools, for small businesses, growing teams and larger organizations. Geographic focus: Central Florida.

## Logo
`assets/img/logo-720.webp` / `logo-360.webp` (transparent, cropped). White "INSIGHT" needs a dark background: the nav turns solid navy when scrolled or over the light Services section. Favicons are cut from the "IP" mark.

## Color
| Token | Value | Use |
|---|---|---|
| `--midnight` / `--ink` | `#050B1B` | Page background |
| `--cornflower` | `#6AA6FF` | Gradient ends, labels |
| `--cyan` / `--ion` | `#64D7EE` | Solid accent: focus ring, links, icons |
| `--royal` | `#1F5FE6` | Logo blue, service icon tiles |
| `--grad` | `linear-gradient(90deg, #6AA6FF, #64D7EE, #6AA6FF)` | Accent words, primary buttons |
| `--ion-deep` | `#2A62D4` | Accent on the light Services section |
| `--bone` / `--bone-2` | `#ECEBE4` / `#D6D9E0` | Text on dark |

## Type
Archivo (display at `font-stretch: 62%`), Instrument Serif italic for one accent word per heading, JetBrains Mono for labels. Body 18px (17px mobile), lede `--fs-lede`. Never below 16px for readable copy.

## Components
- **Buttons**: `.btn--ion` primary ("Book a free consultation", one primary action everywhere), `.btn--ghost` secondary.
- **Problem cards** `.pcard`, **service cards** `.scard` (title, visible description, "Includes" list, CTA that pre-selects the form topic), **audience cards** `.acard`, **work cards** `.wcard` (each labeled real or demonstration).
- **Chat demo**: one message and one caption at a time; pauses off-screen and with the pause control.
- **Walkthrough film**: one caption at a time; incoming caption waits for the outgoing one. Includes an automation disclosure.
- **Testimonials**: static grid, verbatim quotes only.
- **Inquiry form**: visible labels, inline errors, loading state, duplicate-submit guard, honeypot, success only after a 2xx response.
- **Motion control**: pause button in the nav (desktop) and menu (smaller screens) stops the globe, marquee, videos and chat demo. `prefers-reduced-motion` removes motion entirely.

## Copy rules
- Do not use the standalone term "AI" in public copy, metadata, alt text, aria labels or schema. Describe the function: automated call answering, website chat, customer follow-up, connected business tools.
- Keep accurate automation disclosures in demonstrations. Never present automated systems as human staff.
- No em dashes. No guarantees of rankings, leads, revenue, uptime or certifications. Money figures are illustrative estimates with stated assumptions.
- Do not rewrite testimonials. Do not invent clients, results or locations.
