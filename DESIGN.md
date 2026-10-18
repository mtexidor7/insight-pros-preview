# Insight Pros Design System

Source of truth for tokens is the `:root` block in `css/style.css`. Change values there, not in components.

## Positioning (use in headings, meta and schema)
Insight Pros builds websites, AI agents and connected business tools that help Central Florida businesses handle inquiries and simplify daily work. Based in St. Petersburg. Insight Pros is a JEMST Consulting company.

## Color tokens
| Token | Value | Use |
|---|---|---|
| `--midnight` / `--ink` | `#050B1B` | Page background, dark text on light sections |
| `--cornflower` | `#6AA6FF` | Gradient ends |
| `--cyan` / `--ion` | `#64D7EE` | Solid accent: borders, icons, focus ring |
| `--grad` | `linear-gradient(90deg, #6AA6FF, #64D7EE, #6AA6FF)` | Accent text and primary buttons |
| `--ion-deep` | `#2A62D4` | Accent on the light (bone) Services section; gradient is too low-contrast there |
| `--bone` | `#ECEBE4` | Primary text on dark, light section background |
| `--bone-2` | `#D9D8CF` | Supporting text on dark |

Gradient text: add class `grad-text` (or one of the existing accent selectors). It uses `background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`. Keep gradient text short and `width: fit-content` so the full blue to cyan to blue sweep is visible.

## Type
| Token | Value | Use |
|---|---|---|
| `--fs-label` | 13px | Mono labels (section numbers, captions) |
| `--fs-small` | 16px | Footer, card questions, notes |
| `--fs-body` | 18px (17px mobile) | Body copy, FAQ answers, step and card text |
| `--fs-lede` | clamp(19px, 1.55vw, 23px) (18px mobile) | Hero line, section intros, service descriptions |
| `--fs-contact` | clamp(18px, 1.6vw, 24px) (19px mobile) | Phone, email, address in the contact section |

Families: Archivo (display at `font-stretch: 62%`, body at normal width), Instrument Serif italic for one accent word per heading, JetBrains Mono for labels. Never go below 16px for readable copy.

## Components
- **Buttons**: `.btn--ion` (gradient fill, primary, one per view), `.btn--ghost` (outline, secondary), `.pill--ion` (nav), `.cta__btn` (final CTA). Labels say the action: "Book a free consultation", "See what we build".
- **Section label**: `.label` = mono number + name, e.g. `04 / Services`. No em dashes.
- **Service row**: `.svc__item` accordion. On wide hover screens a preview image shows in a fixed lane on the right (`.svc__name` is capped at `calc(100% - 320px)` so it can never sit under the preview). Hidden on touch and under 1100px.
- **Photo strip**: `.strip` of 4:5 industry photos in its own row (swipeable on mobile). Photos never overlap headings. They are AI-generated and labelled by industry only; never pair them with testimonial names.
- **Testimonials**: `.quotes` crossfade. Outgoing fades in 0.3s, incoming starts at 0.32s, so two quotes are never visible at once. The JEMST note above explains why reviews mention JEMST.
- **Voice steps**: one caption visible at a time; incoming caption waits 0.28s for the outgoing one to clear.

## Copy rules
- No em dashes. No buzzwords (seamless, elevate, unlock, robust, game-changing) outside client quotes.
- No absolute promises. Say "can answer calls at any hour", "answer more calls", "improve how you show up". Not "never miss a call", "every caller", "rank #1".
- Money figures are labelled estimates ("about $100 per missed call; your numbers will vary").
- Geography: "Based in St. Petersburg, serving Central Florida, including the Tampa Bay area."
