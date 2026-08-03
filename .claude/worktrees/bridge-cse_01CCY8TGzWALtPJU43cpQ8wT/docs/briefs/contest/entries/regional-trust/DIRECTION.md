# Regional Trust — design direction

> Concept entry for the Rebirth Auto UX/UI contest. Isolated, additive, desktop-only
> mockups under `src/pages/concepts/regional-trust/`. Demo dealer: **"Riverbend Motor Co."**
> (fictional, clearly a demo — no real identity, phone or address stated as fact).

## The idea in one line

**The car yard that feels like a neighbour.** Warm, light, photography-forward, and honest —
a two-generation family dealership that happens to have a genuinely helpful AI. Rebi is framed
as *a knowledgeable local* ("G'day, I'm Rebi"), not a clinical robot.

## Why this fits Rebirth Auto

Regional Australian dealerships live or die on trust and word-of-mouth. The brief asks for
something **credible to a regional dealership — established, honest, community-rooted; not a
slick startup, not a generic car yard.** So the whole system leans on the signals that actually
build trust in the bush and coastal towns: *family-owned since 1978*, real local reviews,
straight talk, "people you'll see again at the shops". The AI has to inherit that same voice —
warm, plain-spoken, and always ready to hand you to a real person. That's the core tension the
design resolves: **AI-native, but it reads as a trusted local, not a tech company.**

## Colour palette

Warm neutral base + a trustworthy heritage accent, with a country-red for warmth and urgency.

| Token | Hex | Role |
|---|---|---|
| Cream | `#FBF8F1` | Lightest surface, nav, card interiors |
| Paper | `#F4ECDD` | Page background (warm sand) |
| Sand | `#EDE2CD` / `#E2D4B8` | Secondary fills, chips, sliders |
| Ink | `#2B2822` | Warm near-black headings/body |
| Ink-70 | `#5A5449` | Secondary text |
| Muted | `#8B8375` | Captions, labels |
| Line | `#E2D6BF` | Warm hairline borders |
| **Heritage green** | `#2F5D50` (deep `#21453A`) | **Primary trust accent** — bottle/eucalypt green. Buttons, brand mark, Rebi. |
| Green soft | `#E3EDE7` | Rebi/AI surfaces, active states |
| **Country red / clay** | `#B5502E` (deep `#93401F`) | Warmth + secondary CTA + offers/urgency |
| Gold | `#C08A3E` | "Since 1978", star ratings, awards |
| Navy | `#2C4257` | Edmunds expert-review attribution accent |

The green is the anchor: heritage, honesty, the Australian bush — it never feels corporate-blue
or startup-neon. Clay/terracotta adds farm-and-coast warmth and carries urgency (offers, trade)
so green stays calm and trustworthy. Gold is used sparingly for provenance and reviews.

## Typography

- **Display — `Fraunces`** (soft, "old-style" serif with optical sizing). Gives headings warmth,
  craft and heritage — it reads *established*, not templated. Used at large sizes for hero lines,
  section heads, prices and pull-quotes.
- **Body / UI — `Nunito Sans`** (rounded humanist sans). Friendly and approachable at text sizes,
  highly legible, softens the whole interface. Carries all labels, specs, forms and buttons.
- Both loaded via Google Fonts `<link>` (no npm deps). AU spelling throughout ("colour", "tyres",
  "kays"), AU pricing (`$`, `en-AU` grouping), AU vehicle mix (utes, 4x4, tow ratings).

Generous rounding (10–24px radii, pill buttons), soft warm shadows, and roomy spacing complete
the friendly-but-credible feel.

## How the visual language reflects the AI-native product

Rebi is treated as **a member of the team**, present on every page and always in the warm-local voice:

- **A consistent Rebi visual identity** — a soft green "orb" (radial-gradient, gentle float +
  pulse animation), always paired with plain-English, first-person copy ("Rebi says —",
  "Rebi's honest take"). It appears as: a persistent bottom-right **dock** ("G'day, I'm Rebi 👋"),
  an "Ask Rebi" badge in the nav, and inline throughout.
- **AI search is the primary entry to inventory**, not a secondary box — the home hero and the
  listings header both lead with a natural-language Rebi search ("A safe hybrid for my daughter's
  first car, under $30k") with example chips.
- **AI summaries are front-and-centre on every vehicle** — each card carries a "Rebi says" note;
  the detail page has a prominent "Rebi's honest take" panel (who it suits / worth knowing /
  running cost) sitting *above* the raw specs.
- **The Rebi chat page is the signature surface** — a full conversational UI with inline vehicle
  cards rendered in-thread, quick-reply chips, a typing indicator, chat history, and an explicit
  "prefer a person?" hand-off — reinforcing "AI that knows the lot, but always passes you to a local".
- **AI does the maths, framed as help** — finance repayment estimator, EV savings comparison and
  the sell/trade valuation are all voiced as Rebi giving you an honest number.
- **Smart lead capture** is woven in as "Rebi replies instantly, a real local follows up" — the AI
  lowers the friction, the human closes the trust loop.

The palette encodes the same message: the AI always wears the **heritage green**, so every AI touch
point reads as *warm, trustworthy, and part of this local family* — never a cold bolt-on.

## Trust signals used throughout (dummy)

Family-owned since 1978 · 48 years in the community · 1,900+ local families served · 4.9★ from
600+ reviews · real-sounding local reviews (Bargara, Childers, Bundaberg) · "we sponsor the footy
club" · every department under one roof · demo ribbon + disclaimers making clear it's a mockup.
