# Near-Future Yard — Design System Spec (for the real rebuild)

> **Status:** planning document. No code changes. This extracts the visual target
> from the `near-future-yard` contest concept and specifies it as a **reusable,
> themeable** design system to apply to the real Rebirth Auto site
> (Astro 7 SSR + Tailwind v4, single-tenant now, multi-tenant-ready).
>
> **Source studied:**
> `src/pages/concepts/near-future-yard/` (all `.astro` pages, `_shell/` components,
> `_shell/theme.css`, `_shell/data.ts`) and
> `docs/briefs/contest/entries/near-future-yard/{DIRECTION,STRUCTURE}.md`.
>
> **Non-goals of this doc:** it does not port the throwaway `.nfy`-namespaced concept
> CSS, does not adopt the concept's fonts, and does not design page layouts route by
> route. It defines the *system* (tokens + roles + components + AI patterns +
> build approach) that the page work then composes from.

---

## 0. Guiding constraints (carried from AGENTS.md / DECISIONS.md / LENSES.md)

These bind every part of the spec below:

- **Config as data.** All dealer-specific values (colours, accents, logo, type stack)
  must be expressible as **tokens sourced from `src/config/dealer.ts`**, never hardcoded
  literals scattered across components. The concept already proves the seam: swap the
  token block and the whole yard re-skins. We formalise that seam here.
- **Keep the current site's fonts.** The rebuild does **not** adopt Space Grotesk /
  Inter / JetBrains Mono. Typography is specified by **role**, and the family for each
  role is a **variable** (`--font-display`, `--font-ui`, `--font-mono`) that resolves to
  the current site's stack. See §2.
- **Light-first.** NFY is a light theme (page mist `#F5F8FC`, white cards). This
  satisfies the "light-theme standard" — the system is authored light-first; a dark
  surface is a *token flip on a section*, not a separate theme.
- **AI stays visually prominent.** Rebi is connective tissue, not a corner bubble. The
  signature AI patterns in §4 are first-class, not optional decoration.
- **Private-data boundary is a design rule too.** Every AI surface is framed as grounded
  on *public* listing data + expert reviews only. No AI surface renders, implies, or
  ranks on `dealerNotes`, floor pricing, or any private field (DECISIONS Decision 6).
  This is copy + component contract, not just backend.
- **A system, not per-page copies.** One token layer + one small set of real Astro
  components. No `.nfy`-style per-page style blocks; no duplicated card markup.

---

## 1. Design tokens

Author these as CSS custom properties in a single global `:root` block, then map them
into Tailwind v4 via `@theme` (see §5). Hex values are lifted verbatim from
`_shell/theme.css` and `DIRECTION.md` so the concept is reproduced exactly.

### 1.1 Palette — base / surface / ink

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#F5F8FC` | page background ("mist") |
| `--color-bg-2` | `#EBF1F8` | recessed panels, segmented-control troughs, inline data blocks |
| `--color-surface` | `#FFFFFF` | cards, nav fill base |
| `--color-ink` | `#0D1626` | primary text; also the dark-section background |
| `--color-ink-soft` | `#47566B` | secondary text, body-on-card |
| `--color-ink-faint` | `#8494A8` | captions, tertiary metadata |
| `--color-line` | `rgba(13,22,38,0.09)` | default border / hairline |
| `--color-line-2` | `rgba(13,22,38,0.05)` | faint border, grid lines, chip borders |
| `--color-on-dark` | `#C4D0E0` | body text on `--color-ink` surfaces (footer, CTA band) |
| `--color-on-dark-faint` | `#7A8AA0` | muted text on dark surfaces |

### 1.2 Palette — accents (the themeable seam)

The **aurora (teal→indigo)** carries the near-future charge; the **clay/amber** is the
deliberate warm counterweight that keeps it regional-Australian, not clinical-SaaS.
These six accents are the values a tenant swap varies.

| Token | Value | Role |
|---|---|---|
| `--color-teal` | `#0FB5A6` | primary tech accent (icons, focus ring, active states) |
| `--color-teal-deep` | `#0A867B` | teal **text** on light (AA-safe) |
| `--color-indigo` | `#5566F0` | Rebi / AI identity accent |
| `--color-indigo-deep` | `#3A46C8` | AI **text** on light (AA-safe) |
| `--color-clay` | `#E0813B` | local warmth: offers, "established", amber badges (a.k.a. amber) |
| `--color-clay-soft` | `#FBEBDD` | clay chip fill |
| `--color-clay-text` | `#B4611F` | clay text on `--color-clay-soft` (AA-safe) |

**Glow tints** (for meshes, chip fills, focus rings — derived from the accents):

| Token | Value |
|---|---|
| `--glow-mint` | `rgba(15,181,166,0.14)` |
| `--glow-indigo` | `rgba(85,102,240,0.14)` |
| `--glow-clay` | `rgba(224,129,59,0.12)` |
| `--ring-teal` | `rgba(15,181,166,0.15)` (focus ring) |

> **Theming rule:** the pairs are the contract. A tenant supplies `teal`, `teal-deep`,
> `indigo`, `indigo-deep`, `clay`, `clay-soft`, `clay-text` (7 values) + optionally the
> two aurora stops; everything else (glows, gradients, shadows) derives. Deep/text
> variants exist so accent-coloured *text* stays AA-legible without per-use overrides.

### 1.3 Gradients

| Token | Value | Role |
|---|---|---|
| `--aurora` | `linear-gradient(115deg, #0FB5A6 0%, #2E86E4 48%, #5566F0 100%)` | THE signature gradient: Rebi orb, primary buttons, AI accent bars, logo mark |
| `--aurora-soft` | `linear-gradient(115deg, rgba(15,181,166,.12), rgba(85,102,240,.12))` | AI-summary fills, vehicle-card AI line background |
| `--mesh-hero` | 3 stacked `radial-gradient`s (teal 78%/12%, indigo 96%/78%, clay 12%/92%) | hero background mesh |
| `--mesh-ambient` | 2 `radial-gradient`s (mint 82%/-8%, indigo -6%/8%), `background-attachment: fixed` | faint whole-page ambient wash |

The middle aurora stop `#2E86E4` (a blue bridge between teal and indigo) is part of the
gradient identity — keep it; a straight teal→indigo two-stop reads flatter.

### 1.4 Spacing scale

The concept works on an ~8px rhythm with a few bespoke steps. Formalise as:

| Token | Value | Typical use |
|---|---|---|
| `--space-1` | `4px` | seg-control padding, tag gaps |
| `--space-2` | `8px` | icon gaps, chip internal |
| `--space-3` | `12px` | tight stacks |
| `--space-4` | `16px` | card body padding base |
| `--space-5` | `22px` | card padding (`--r-lg` cards) |
| `--space-6` | `26px` | comfortable card padding |
| `--space-7` | `40px` | inter-column gaps |
| `--space-8` | `56px` | **page gutter** (concept `--nfy-wrap` inline padding) |
| `--space-section` | `76px` | vertical section rhythm (`--section-tight: 48px`) |

> **Gutter reconciliation:** the concept hardcodes a 1440px desktop wrap at 56px
> gutters. The real site already owns a responsive gutter system (`--site-gutter`,
> `.site-container`, 16→55px in `src/styles/global.css`). **Keep the real site's
> responsive gutter** — do not reintroduce a fixed 1440/56 wrap. Map `--space-8` onto
> the existing large-desktop gutter (55px ≈ 56px) and let it collapse responsively.
> The concept is desktop-only; the rebuild is responsive.

### 1.5 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `10px` | inputs, inline AI line, small chips-as-blocks |
| `--radius` | `16px` | default / brand-tile / inner blocks |
| `--radius-lg` | `22px` | cards, glass cards, AI summary, dock card |
| `--radius-xl` | `30px` | CTA band, hero feature panels |
| `--radius-pill` | `999px` | buttons, chips, segmented controls, AI search bar |

### 1.6 Depth — shadows + soft glass

| Token | Value | Use |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(13,22,38,.05), 0 2px 8px rgba(13,22,38,.04)` | resting card |
| `--shadow-2` | `0 6px 22px rgba(13,22,38,.09), 0 2px 6px rgba(13,22,38,.05)` | hover lift, glass card, AI search |
| `--shadow-3` | `0 20px 50px rgba(13,22,38,.14), 0 6px 16px rgba(13,22,38,.08)` | floating dock, modals |
| `--shadow-glow` | `0 10px 40px -12px rgba(15,181,166,.45)` | primary button, logo mark (aurora glow) |
| `--shadow-glow-indigo` | `0 16px 46px -12px rgba(85,102,240,.55)` | primary button hover |

**Glass recipe** (the "soft-glass depth" — reproduce as a `.glass` utility / component):
```
background: linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.62));
backdrop-filter: blur(16px) saturate(1.2);
border: 1px solid rgba(255,255,255,.7);
box-shadow: var(--shadow-2);
```
**Glass nav variant** uses the page mist tint instead of white:
`linear-gradient(180deg, rgba(245,248,252,.9), rgba(245,248,252,.72))` +
`backdrop-filter: blur(14px) saturate(1.15)`.

### 1.7 Motion / transitions

Calm and ambient — nothing demands attention. Tokenise durations + easings; keep the
named keyframes as global animations.

| Token | Value |
|---|---|
| `--ease` | `ease` (default) |
| `--dur-fast` | `.16s` (nav hover, input focus) |
| `--dur` | `.18s`–`.22s` (button lift, card lift) |
| `--lift-card` | `translateY(-4px)` on card hover |
| `--lift-btn` | `translateY(-2px)` on button/dock hover |

Named keyframes (global, defined once):
- `aurora-shift` — 3s (buttons) / 6s (orb) background-position drift on `background-size:160–180%`.
- `orb-pulse` — 2.6s scale/opacity pulse of the orb's inner bead + halo.
- `scan` — 4.5s vertical sweep (the "AI is reading this" scan line).
- `dot` — 1.3s staggered bounce for thinking dots (delays .18s/.36s).

> **Reduced motion:** wrap all four keyframe animations in
> `@media (prefers-reduced-motion: reduce)` to disable — the concept omits this and the
> rebuild must add it (accessibility + LENSES restraint). Static fallbacks read fine
> (orb still shows aurora fill; scan line simply doesn't sweep).

### 1.8 Token count

**~70 tokens total**: 10 base/surface/ink · 7 accents + 4 glows · 4 gradients ·
9 spacing · 5 radii · 5 depth · ~6 motion · 3 type families (§2) · plus derived
per-role type scale steps (§2). Palette + gradient + depth + spacing + radii + motion =
**~53 core tokens**; typography adds ~17.

---

## 2. Typography — by role, family substituted

The concept uses Space Grotesk (display), Inter (UI/body), JetBrains Mono (metadata).
**The rebuild keeps the current site's fonts.** The current site ships **no custom web
font** — it renders on the browser/Tailwind default sans stack (`body` is
`antialiased text-[15px] leading-relaxed`, colour `text-slate-800` on `bg-slate-50`).

So: define typography by **role**, leave the **family as a token**, and resolve every
role to the current stack. Do **not** load Space Grotesk. If the owner later wants a
display face, it changes in exactly one place (`--font-display`).

### 2.1 Family tokens (the substitution seam)

```css
:root {
  /* Current site stack — the default. Roles differ by weight/scale/tracking, NOT family. */
  --font-ui:      ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: var(--font-ui);   /* concept used Space Grotesk; rebuild reuses UI stack */
  --font-mono:    ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
}
```

> `--font-display` is deliberately aliased to `--font-ui` so the display *role* exists
> (headings, prices, stat numbers can be retargeted to a real display face in one edit)
> without forcing a font today. Multi-tenant: a tenant may override `--font-display`.

### 2.2 Roles, scale, weight, tracking

Values distilled from the concept's type scale; families swapped per §2.1.

| Role | Family token | Size(s) | Weight | Tracking | Line-height | Where |
|---|---|---|---|---|---|---|
| **Display** | `--font-display` | `58px` hero H1, `38px` H2, `24px` H3 | 600 | `-0.02em` | 1.08 | page heroes, section headers, CTA band |
| **Heading (card)** | `--font-display` | `17px`–`22px` | 600–700 | `-0.01em` | 1.15 | card titles, vehicle model, price figure |
| **Body** | `--font-ui` | `15px` base, `17–19px` lead | 400–500 | `-0.005em` | 1.55 | paragraphs, descriptions, lead copy |
| **UI** | `--font-ui` | `13.5px`–`15px` | 500–600 | normal | 1.3 | nav links, buttons, labels, chips, form controls |
| **Data-mono** | `--font-mono` | `9.5px`–`13px` | 400–500 | `0.14em`–`0.22em`, UPPERCASE | 1.2 | eyebrows, stat labels, footer headings, small metadata, VIN/rego-style facts |

Notes carried from the concept:
- **Eyebrow** = mono, 12px, `letter-spacing:.14em`, uppercase, `--color-teal-deep`, with a
  22px teal rule before the text. High-signal "software" cue used above every section head.
- **Stat number** = display, 34px, weight 600, `-0.02em`, block; label under it is 13px body.
- **Price** = display/heading, 22px, weight 700, with a faint 12px "drive away" suffix.
- Body stays a comfortable **15–19px**; never below 12px except mono metadata.

---

## 3. Component inventory

Every reusable piece the concept ships, with a short visual spec and where it maps in
the real app. Build these as **real Astro components** (§5), prop-driven, reading tokens.
"Concept ref" points at the source to reproduce.

| # | Component | Visual spec (short) | Maps to (real app) | Concept ref |
|---|---|---|---|---|
| 1 | **Nav (glass)** | Sticky, `z-40`, glass-mist fill + blur, 74px tall. Left: aurora logo-mark (rounded 11px, `--shadow-glow`) + wordmark with mono sub-label. Center: text links, hover teal-tint pill, active = slate pill. Right: **"Ask Rebi" AI badge** + ghost "Contact" + primary "Book a test drive". | Site header (currently the plain `<header>` in `index.astro`, repeated per page). Becomes a shared `SiteHeader.astro`. Links + CTAs driven by `dealer.ts` feature flags (trade-in/service/account already gate there). | `_shell/Nav.astro` |
| 2 | **Footer (dark)** | `--color-ink` background, `--color-on-dark` text. 5-col grid (brand blurb + 3 link columns + "Talk to us" with primary **Chat with Rebi** button). Mono column headings. Bottom bar: copyright + mono concept tag. | Site footer (none shared today). New `SiteFooter.astro`. Columns from config/nav map. | `_shell/Footer.astro` |
| 3 | **Vehicle card** | Glass-lift card, 16:10 image with bottom scrim + condition/badge chips + favourite orb. Body: year·make eyebrow, model+variant heading, 2×2 spec grid (odo/fuel/trans/drive, teal icons), **inline AI line** (aurora-soft fill, spark icon), price + View. Hover: `-4px` lift, teal border tint. | The real `src/components/ListingCard.astro`. Re-skin to this spec; wire to `LISTING_FIELDS` projection. **AI line must be grounded on public data only.** | `_shell/VehicleCard.astro` |
| 4 | **Filter panel** | Sticky `top:92px`, 288px, inside a card. Header "Refine" + Reset. **"Rebi filter" AI block** (natural-language box) at top. Groups: segmented condition (New/Demo/Used), body-type checklist with counts, price range track (aurora fill), fuel/drivetrain pill rows. | `src/components/filters/FilterDrawer.astro`. Keep filter state in URL via `applyFilterUrl` (hard constraint) — the panel is presentation only. Segmented condition maps to `showCondition` config. | `_shell/FilterPanel.astro` |
| 5 | **Hero + AI search** | Grid: left = eyebrow, 58px display H1, lead, **AI search bar**, suggestion chip row, 3 stat tiles. Right = **glass Rebi snapshot card** (scan line). Background = hero mesh + faint tech grid, radial-masked. | Homepage hero (replaces the current minimal header/intro on `index.astro`). AI search bar is the **primary** inventory entry, sitting above/instead of a filter wall. | `index.astro` hero section |
| 6 | **AI search bar** | Pill, white fill with **aurora gradient border** (double-background border trick), left orb, text input, primary "Ask" button. `--shadow-2`. | Wraps the real search entry (`src/components/search/SearchDock.astro`) → `/api/search` NL interpreter. On home + listings. | `.nfy-aisearch` |
| 7 | **AI summary card** | Aurora-soft fill, left 3px **aurora bar**, optional **scan line** overlay. Header: spark + "Rebi suggests"/"Rebi read this". Body copy + result chips. | Vehicle detail page (summary of the listing), offers, finance, EV, fleet. The signature "Rebi read this for you" block. **Public-data grounded only.** | `.nfy-ai-summary` + hero glass card |
| 8 | **Scan line** | Absolutely-positioned vertical gradient sweeping top→bottom on a `.scan` container; 4.5s, purely visual "AI reading" cue. | Modifier applied to AI summary + glass Rebi cards. Respect reduced-motion. | `.nfy-scan` |
| 9 | **Section header** | Mono eyebrow (teal rule + text, e.g. "Curated by Rebi") + display H2, optional right-aligned ghost "browse all" button. | Every content section on home, listings, hubs. Shared `SectionHeader.astro` (eyebrow + title + action slot). | `index.astro` section heads |
| 10 | **Buttons** | Pill. **Primary** = aurora fill, white, glow shadow, hover lift + aurora-shift. **Ghost** = translucent white + blur + line border, hover teal. **Clay** = warm accent for offers. **Dark** = ink fill. Sizes sm/base/lg. | Global button system. Replace ad-hoc Tailwind button classes with a `Button.astro` (variant + size props) or a `@utility` set. | `.nfy-btn*` |
| 11 | **Chips / tags** | Pill, 12.5px. Neutral (bg-2), **teal** (mint glow), **AI/indigo** (indigo glow), **clay** (clay-soft). Used for condition, facets, suggestions, badges. | Filter pills, card badges, suggestion rows, spec tags. Shared `Chip.astro` (tone prop). | `.nfy-chip*` |
| 12 | **Rebi orb** | The recurring AI mark: aurora-fill circle, animated inner white bead pulse, optional blurred aurora halo. Sizes 30/38/40px. | The one consistent "AI is present" bead — nav badge, dock, AI card headers, hero card, chat. Shared `RebiOrb.astro` (size + halo props). | `.nfy-orb` |
| 13 | **Floating Rebi dock** | Fixed bottom-right, `z-60`. Peeked mini-card (orb + "Rebi · Online now" + context prompt) above a pill launcher ("Chat with Rebi"). Present on every page **except** the full chat page. | Replaces/re-skins the existing chat launcher (`AskRebiButton.astro` / `ChatWidget.astro`). Per-page `dockPrompt` prop. | `_shell/RebiDock.astro` |
| 14 | **Stat tiles** | Display 34px number + 13px body label, left-aligned, in a row. | Hero trust stats, about page, fleet TCO, finance. Shared `StatTile.astro`. | `.nfy-stat` |
| 15 | **Glass card** | Translucent white gradient + blur + saturate + `--shadow-2`, radius-lg. | Hero Rebi snapshot, elevated feature panels, floating summaries over mesh. `.glass` utility or `variant="glass"` on Card. | `.nfy-glass` |
| 16 | **Card (base)** | White surface, `--color-line` border, radius-lg, `--shadow-1`; `--lift` modifier for hover. | The generic container behind cards/tiles/tools. Base `Card.astro`. | `.nfy-card` |
| 17 | **Form controls** | Input/select/textarea: white, line border, radius-sm, 15px; focus = teal border + `--ring-teal` 3px ring. Label 13px 600 ink-soft. | Sell, contact, finance calc, test-drive, careers forms. Shared field components (reuse the site-wide focus-ring already in `global.css`). | `.nfy-input/.nfy-field` |
| 18 | **Segmented control** | Pill trough (bg-2), equal buttons, active = white pill + `--shadow-1`. | Condition (New/Demo/Used), listing toolbar, EV/hybrid toggles. `Segmented.astro`. | `.nfy-seg` |
| 19 | **Range track** | 5px bg-2 track, aurora fill between two white/teal-ring thumbs. | Price/odo filters. (Interactive impl is a separate concern; visual spec here.) | `.nfy-range` |
| 20 | **Steps / progress** | Numbered circles, active = aurora fill white, connecting lines. | Test-drive booking, sell/valuation flow, finance steps. `Steps.astro`. | `.nfy-steps` |
| 21 | **Brand tile** | 3:2 white tile, hover teal border + `-3px` lift, display wordmark. | Brand strip + per-brand hub. `BrandTile.astro`. | `.nfy-brandtile` |
| 22 | **Thinking dots** | 3 indigo dots, staggered bounce. | Chat + any "Rebi is working" affordance. Part of the AI vocabulary. | `.nfy-dots` |
| 23 | **Data table** | Borderless rows, mono-ish uppercase faint headers, hairline row borders. | Finance breakdowns, spec sheets, fleet TCO. `DataTable` styling. | `.nfy-table` |
| 24 | **Hero mesh + tech grid** | Layered radial glows (teal/indigo/clay) + faint 46px grid, radial-masked so it fades at edges. | Background treatment for heroes and the dark CTA band. `HeroMesh.astro` / background utility. | `.nfy-hero*`, `.nfy-grid-lines` |
| 25 | **Logo mark** | Rounded-square (11px) aurora tile with white spark glyph + `--shadow-glow`. | Nav + footer brand. Sourced from `dealer.ts` (fallback aurora mark if no dealer logo). | `.nfy-logo-mark` |

**~25 reusable components/primitives.** Roughly a third re-skin existing real components
(ListingCard, FilterDrawer, SearchDock, chat launcher, site header/footer); the rest are
new shared primitives (Card, Button, Chip, RebiOrb, SectionHeader, StatTile, Steps, etc.).

---

## 4. Signature AI presentation patterns

These are the reason the concept exists and must survive the rebuild intact. Rebi is
promoted from a corner bubble to the spine of the UI.

1. **The ambient aurora orb.** One consistent teal→indigo "living" bead marks the AI
   everywhere it appears: nav "Ask Rebi" badge, floating dock, every AI card header, the
   hero snapshot, the full chat. Same mark, same colour, always calm. This single motif
   is what says "the AI is present everywhere" without a single popup. → `RebiOrb.astro`,
   used pervasively.

2. **AI summary cards + scan line.** The signature "Rebi read this for you" block: aurora
   left bar, aurora-soft fill, spark-headed "Rebi suggests", and a slow vertical scan line
   implying active reading. Appears on the vehicle detail page, offers, finance, EV, fleet,
   and the hero. **Framed as grounded on public listing data + expert reviews only** — the
   copy explicitly never claims to know private/dealer/finance detail.

3. **Natural-language search as the primary entry.** The aurora-bordered AI search bar is
   *the* way into inventory on home and listings — "ask, don't scroll" over a wall of
   facets. The classic filter panel remains, but demoted to a refinement, with its own
   inline **"Rebi filter"** natural-language box ("diesel 4x4 that tows 3t under $70k").
   Wires to the existing `/api/search` interpreter.

4. **"Curated by Rebi" framing.** Section eyebrows and card AI lines attribute selection
   and summary to Rebi ("Curated by Rebi", "Rebi suggests", per-card AI line). AI presence
   is woven into editorial voice, not just widgets.

5. **Honest / human-handoff framing.** Recurring, deliberate trust copy: "Rebi does the
   legwork; our Bundaberg team does the handshake", "never pushes", "a real person will
   call back", "Rebi is online now, or leave a message". The dock shows "Online now". This
   *is* a design element — it's the counterweight that keeps the high-tech surface credible
   to a regional buyer, and it doubles as the visible face of the private-data promise.

6. **Ambient, calm motion vocabulary.** Orb pulse, aurora drift, scan sweep, thinking dots,
   slow button gradient shift — all say "alive and helpful", none demand attention. This
   restraint is load-bearing: it's what separates NFY from a cold tech demo. Gate all of it
   behind `prefers-reduced-motion`.

**Contract for every AI surface (enforce in review):** grounded on the public projection
only; never renders/implies/ranks-on `dealerNotes` or private fields; always offers the
human handoff. Shopper-facing AI ≠ dealer-facing AI (DECISIONS Decision 6).

---

## 5. Implementation approach — build it as a themeable system

**Recommended: a global token layer + Tailwind v4 `@theme` + a small set of real Astro
components.** Do **not** port the `.nfy`-namespaced concept CSS — it was a throwaway,
prefixed to stay isolated. In the real app the system is the default, so it lives in the
global layer and in components, not in a namespace.

### 5.1 The token layer

Author the §1 tokens as one `:root` block (extend `src/styles/global.css`, or a new
`src/styles/tokens.css` imported by it). This is the single source of visual truth. Then:

```css
/* global.css already: @import "tailwindcss"; */
:root { /* §1 tokens: --color-*, --aurora, --shadow-*, --space-*, --radius-*, --font-* ... */ }

@theme {
  /* Map tokens into Tailwind v4's type-scale so utilities exist:
     bg-surface, text-ink, text-ink-soft, border-line, rounded-lg, shadow-1, font-display … */
  --color-bg:        var(--color-bg);
  --color-surface:   var(--color-surface);
  --color-ink:       var(--color-ink);
  --color-teal:      var(--color-teal);
  --color-indigo:    var(--color-indigo);
  --color-clay:      var(--color-clay);
  --radius-lg:       var(--radius-lg);
  --shadow-1:        var(--shadow-1);
  --font-display:    var(--font-display);
  /* …one line per token that should become a utility. */
}
```

Tailwind v4's `@theme` generates the utilities (`bg-*`, `text-*`, `border-*`, `rounded-*`,
`shadow-*`, `font-*`) directly from these names, so components use real Tailwind classes
while every value traces back to one token. Gradients/glass/orb/scan that don't map cleanly
to a utility become a **small set of `@utility` / `@layer components`** rules
(`.glass`, `.aurora-border`, `.scan`, the orb, the keyframes) — a handful, not the concept's
~40 `.nfy-*` classes, because most spacing/colour/radius work is now plain utilities.

### 5.2 The config-as-data seam

Add a **`theme`/`branding` block to `src/config/dealer.ts`** (it has none today — verified:
`DealerConfig` covers identity/locale/inventory/copy/ai but no colours or fonts). Shape:

```ts
theme: {
  accents: { teal, tealDeep, indigo, indigoDeep, clay, claySoft, clayText },  // the 7-value contract
  aurora?: [stop1, stop2, stop3],   // optional gradient override
  fonts?: { display?, ui?, mono? }, // optional; default = current site stack
}
```

At render, the root layout emits these as inline `:root` custom-property overrides
(a `<style set:html>` in the shared layout, or a tiny `ThemeVars.astro`) so the token layer
picks up dealer values without a rebuild. Single-tenant now → one config; multi-tenant later
→ keyed by tenant. **No component ever hardcodes an accent literal** — it uses the token /
Tailwind utility, which resolves to the dealer value. This is exactly the seam
`STRUCTURE.md` flagged ("tokens would map onto the dealer config").

### 5.3 The component layer

Build the §3 inventory as real, prop-driven Astro components under `src/components/` (a
`ui/` subfolder for the primitives — Card, Button, Chip, RebiOrb, SectionHeader, StatTile,
Segmented, Steps — and re-skins of the existing ListingCard, FilterDrawer, SearchDock, chat
launcher, plus new SiteHeader/SiteFooter). One implementation each, composed across pages —
**a system, not per-page copies.** Data-bound components read `LISTING_FIELDS` projections
and `dealer.ts`; filter URLs go only through `applyFilterUrl`.

### 5.4 Light-theme + responsiveness notes

- **Light standard satisfied:** NFY is light-first (`#F5F8FC` page, white cards). Author the
  tokens as the default light theme; dark surfaces (footer, CTA band) are *ink-background
  sections* using `--color-on-dark*` text — a local flip, not a second theme.
- **Responsive, not 1440-fixed:** the concept is desktop-only at a fixed 1440/56px wrap. The
  rebuild keeps the real site's responsive gutter system (`.site-container`,
  16→55px) and fluid `.inventory-grid`. Map `--space-8` to the existing gutter; let heroes,
  the 4-up card grids, the 5-col footer, and the filter rail collapse at the site's existing
  breakpoints.
- **Motion accessibility:** add the `prefers-reduced-motion` guard the concept lacks.
- **Fonts:** keep the current stack via `--font-*` (see §2); do not load Space Grotesk.

### 5.5 Suggested build order (for the ticketed rebuild)

1. Token layer + `@theme` mapping + `dealer.ts` `theme` block + `ThemeVars` emission.
2. UI primitives (Card, Button, Chip, RebiOrb, SectionHeader, StatTile) + the `glass` /
   `aurora-border` / `scan` / keyframe utilities.
3. Shell (SiteHeader glass nav, SiteFooter, floating Rebi dock).
4. AI surfaces (AI search bar, AI summary card, hero) — the signature §4 patterns.
5. Re-skin data components (ListingCard, FilterDrawer/panel, SearchDock, chat launcher).
6. Compose pages (home first, then listings/vehicle/hubs) from the above.

Each ticket runs two-phase (investigate+propose → approved execute) per AGENTS.md.

---

## Appendix — concept source map

| Concern | Source file |
|---|---|
| Tokens, component classes, keyframes | `src/pages/concepts/near-future-yard/_shell/theme.css` |
| Nav | `_shell/Nav.astro` |
| Footer | `_shell/Footer.astro` |
| Floating Rebi dock | `_shell/RebiDock.astro` |
| Vehicle card | `_shell/VehicleCard.astro` |
| Filter panel + "Rebi filter" | `_shell/FilterPanel.astro` |
| Layout shell (fonts/nav/footer/dock) | `_shell/Layout.astro` |
| Hero, AI search, AI summary, stats, CTA band | `index.astro` |
| Dummy data + inline icon set | `_shell/data.ts` |
| Design rationale, palette, type, motion | `docs/briefs/contest/entries/near-future-yard/DIRECTION.md` |
| Route map, real-site mapping, integration notes | `docs/briefs/contest/entries/near-future-yard/STRUCTURE.md` |
| Current site fonts (none custom) / gutter / grid | `src/styles/global.css`, `src/pages/index.astro` |
| Config-as-data seam (no theme block yet) | `src/config/dealer.ts` |
