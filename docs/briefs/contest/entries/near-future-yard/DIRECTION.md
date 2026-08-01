# Near-Future Yard — design direction

> Contest concept for Rebirth Auto. Desktop-only (~1440px), static, visual-only.
> Isolated under `src/pages/concepts/near-future-yard/`. Touches no shipped code.

## Theme in one line
A modern showroom that a country buyer still trusts — clean light surfaces with
soft glass depth, one calm aurora accent, and **Rebi woven through every page as
an ambient helper, never a pop-up salesman.**

## The tension we're designing across
Two failure modes to avoid:
- **Cold tech demo** — a Silicon-Valley SaaS look a Bundaberg buyer wouldn't
  trust to sell them a ute.
- **Generic car yard** — red-and-yellow "HUGE SAVINGS" clutter with a bolted-on
  chat bubble.

Near-Future Yard sits deliberately between them. The surface is app-like and
quietly high-tech (glass cards, a faint tech grid, gentle motion), but the voice,
the warmth accent, and the constant "a real local closes the deal" messaging keep
it **grounded and credible to a regional Australian dealership.**

## How the visual language reflects the AI-native product
Rebi isn't a feature bolted to the corner — it's the connective tissue:

- **The aurora orb** (teal→indigo, softly pulsing) is Rebi's recurring mark. It
  appears in the nav ("Ask Rebi"), floats as an ambient dock on every page, heads
  every AI card, and anchors the full chat interface. One consistent bead of
  "living" colour = the AI is present everywhere, calm everywhere.
- **AI summary cards** carry a signature left aurora bar and a slow vertical
  *scan line* — a purely visual cue that Rebi has "read" the listing/offer/finance
  for you. Used on the home hero, every vehicle card, the vehicle detail page,
  offers, finance, EV, parts and fleet.
- **AI search bars** (aurora-gradient border) are the *primary* way into
  inventory on the home and listings pages — plain-English search over a filter
  wall, reinforcing "ask, don't scroll."
- **Grounded, not guessing** — the chat and about pages state plainly that Rebi
  speaks only from public listing data and expert reviews, never private info,
  and always hands off to a human. This maps directly to the product's private-
  data constraint and is itself a trust signal.

## Colour palette
| Token | Hex | Role |
|---|---|---|
| Page mist | `#F5F8FC` | app background |
| Recessed | `#EBF1F8` | panels, segmented controls |
| Surface | `#FFFFFF` | cards |
| Ink | `#0D1626` | primary text / dark sections |
| Ink soft | `#47566B` | secondary text |
| Ink faint | `#8494A8` | captions |
| **Teal** | `#0FB5A6` | primary tech accent |
| Teal deep | `#0A867B` | accent text on light |
| **Indigo** | `#5566F0` | Rebi / AI identity |
| Indigo deep | `#3A46C8` | AI text on light |
| **Amber** | `#E0813B` | local warmth — offers, "established", badges |
| Amber soft | `#FBEBDD` | amber chip fill |

**Aurora** = `linear-gradient(115deg, #0FB5A6 → #2E86E4 → #5566F0)` — the signature
gradient for the Rebi orb, primary buttons and AI accents.

The **teal→indigo aurora** carries the "near-future" charge; the **amber** is the
deliberate counterweight — a warm, sunset-clay note that keeps the palette from
feeling clinical and reads as regional-Australian rather than start-up. A faint
warm glow sits in the corner of every hero mesh for the same reason.

## Typography
- **Space Grotesk** — display & headings. Geometric and a touch technical, but
  friendly and legible; the "modern showroom" voice.
- **Inter** — all UI and body copy. Neutral, trustworthy, workhorse.
- **JetBrains Mono** — eyebrows, stat labels, small metadata. A restrained mono
  accent that signals "software" without shouting.

Type is large and confident (58px hero), letter-spacing tightened on display for
a premium app feel; body stays at comfortable 15–19px.

## Motion (visual only — CSS)
Calm, ambient, never busy: the orb's soft pulse and aurora drift, a slow scan
line across AI cards, gentle 2–4px card lifts on hover, animated "thinking" dots,
and a slow gradient shift on primary buttons. Everything says *alive and helpful*,
nothing demands attention.

## System, not pages
Everything composes from one shell in `_shell/` — `Layout` (nav + footer + ambient
Rebi dock + tokens), `Nav`, `Footer`, `RebiDock`, `VehicleCard`, `FilterPanel`,
plus a `theme.css` token layer namespaced under `.nfy` and a `data.ts` of dummy
stock + an inline icon set. Swap the tokens and the whole yard re-skins — matching
the product's config-as-data spirit.
