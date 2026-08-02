# Dark Precision — design direction

> Contest entry · isolated concept mockups under `src/pages/concepts/dark-precision/`.
> Desktop-only (~1440px), static, additive. Does not touch shipped code or config.

## Theme in one line

**Automotive configurator meets trading terminal.** A dark-first, high-contrast interface
where every vehicle is treated as an instrument to be read — and Rebi, the AI, is the
surgical expert doing the reading. Premium, technical, disciplined. Credible to a regional
Australian dealership because it feels *expert*, not *flashy*.

## Rationale — why dark, why now

A dealership website's real job is to reduce a buyer's uncertainty. Dark Precision leans
into that: it looks like the cockpit of something you'd trust to give you a straight number.
The near-black canvas makes data — prices, specs, ranges, repayments — glow like an
instrument cluster, and it makes the single cyan signal colour read as "the system is
telling you something." Crucially, it keeps Rebi visually *central*: on a dark ground, the
AI's cyan-tinted panels are the brightest thing on every page, so the product's signature
feature never recedes into a corner. This is the opposite of the generic light "car yard"
site — it signals that this dealer knows more than the one down the road.

The restraint is deliberate. One accent, hairline dividers, mono type for data, generous
black space. Nothing here is neon-gamer or crypto-hype; it reads as engineered. That is what
keeps it trustworthy to a regional buyer rather than alienating.

## Colour palette

| Token | Hex | Role |
|---|---|---|
| `--void` | `#07080B` | Page canvas (near-black, faint technical grid) |
| `--base` | `#0C0F14` | Recessed surfaces, inputs |
| `--surface` | `#12161D` | Cards, panels |
| `--raised` | `#171C25` | Elevated panels, nav-on-scroll |
| `--raised-2` | `#1E2530` | User chat bubbles, hover |
| `--line` | `#232B36` | Hairline divider (the workhorse) |
| `--line-bright` | `#35424F` | Stronger edge / focus border |
| `--ink` | `#EAF1F7` | Primary text |
| `--ink-dim` | `#9AA6B3` | Secondary text |
| `--ink-mute` | `#616C79` | Labels, meta, captions |
| **`--signal`** | **`#3EE6CB`** | **The one accent — electric cyan.** AI, active state, data highlight, primary CTA |
| `--signal-deep` | `#12B49F` | Gradient partner, orb depth |
| `--signal-ink` | `#052A26` | Text *on* the cyan (near-black-green for AA contrast) |
| `--amber` | `#F5B14C` | Rare secondary — offers / "hot" / Edmunds score only |
| `--pos` / `--neg` | `#4ADE80` / `#F8746A` | Savings / caution in data readouts |

**Discipline rule:** cyan is never decorative. It appears only where the system is being
active or authoritative — Rebi, a live figure, an active filter, the primary action. Amber
appears only on commercial "hot" moments (offers, drive-away flag, expert score). Everything
else is graphite and ink. That scarcity is what gives the accent its punch.

## Typography

- **Display / headings — Space Grotesk (600).** Technical, slightly mechanical letterforms;
  the configurator/spec-sheet voice. Tight tracking (-0.02 to -0.03em) at large sizes.
- **Body — Inter (400/500).** Neutral, highly legible for paragraphs and UI.
- **Data / mono — JetBrains Mono.** Every number that matters — prices, kms, ranges,
  repayments, VINs, timestamps, eyebrows, labels — is set in mono with tabular figures. This
  is the "trading terminal" tell: numbers line up in columns and read as instrumentation.

Loaded once via a single Google Fonts `<link>` in the shared Layout. No npm font deps.

## How the visual language reflects the AI-native product

Rebi is not a chat bubble bolted on — the whole system is built around it:

- **A persistent Rebi console** (`RebiDock`) floats on every page: an orb plus an expandable
  card with live status and quick prompts. The AI is one click from anywhere.
- **The AI surface has its own material.** `.dp-ai` panels carry a cyan-tinted inner glow and
  a brighter hairline, so anything Rebi "touches" is visually distinct from static content.
- **Grounded summaries look like instrument readouts.** On the vehicle page, Rebi's analysis
  is rendered as gauges (value-vs-market, condition index, running cost, resale hold) — data
  the buyer can trust, explicitly labelled *grounded in verified spec*, reinforcing the hard
  constraint that shopper-facing AI never touches private dealer data.
- **Natural-language search is the primary search.** The home hero and listings both lead
  with a Rebi query bar ("family 7-seater, diesel, under $55k") over a traditional box.
- **Smart lead capture is framed as a warm AI handoff** — Rebi assembles the shortlist,
  budget and finance context, then hands a briefed enquiry to a human.
- **A streaming caret + live dots** appear throughout to signal the AI is *alive and
  reasoning*, not a static FAQ.

## System / build notes

Everything composes from a small themed shell in `_components/`:
`theme.css` (all tokens + component classes, every rule scoped under `.dp` so nothing can
leak onto shipped surfaces), `Layout.astro` (fonts + nav + footer + Rebi dock), `Nav.astro`,
`Footer.astro`, `RebiDock.astro`, and `VehicleCard.astro`. Reusable classes — `.dp-panel`,
`.dp-tick` (corner-ticked instrument frame), `.dp-ai`, `.dp-insight`, `.dp-vcard`,
`.dp-readout`, `.dp-range`, `.dp-seg`, `.dp-chip` — mean each page is a thin composition and
the set stays cohesive. All values are token-driven, matching the product's config-as-data
spirit: reskinning to another dealer is a token swap.
