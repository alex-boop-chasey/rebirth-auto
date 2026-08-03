# Regional Trust — structure & how it slots in

## Isolation (how it stays additive)

Everything lives under `src/pages/concepts/regional-trust/`. **Nothing shipped is touched** — no
existing page, component, config, style or another concept's folder is modified. Shared theme code
lives in a `_components/` subfolder; the `_` prefix means Astro **excludes it from routing**, so
only the intended page routes are created. All shared styling is scoped under a `.rt-root` wrapper
so no token or rule can leak into shipped surfaces.

Each page follows the brief's mechanics exactly:
```
export const prerender = false;
import '../../../styles/global.css';   // three levels up to src/styles
```
Pages are desktop-only (`~1440px`, fixed-width nav/main), static (no JS; CSS-only animation for the
Rebi orb float/pulse and the chat typing dots), Google-Fonts via `<link>`, no npm deps, dummy content.

## The theme shell (reused by every page)

| File | Role |
|---|---|
| `_components/Layout.astro` | Page wrapper: `<head>` + fonts, the full design-token + component stylesheet (`is:global`, scoped to `.rt-root`), demo ribbon, `<Nav>`, `<Footer>`, `<RebiDock>`. |
| `_components/Nav.astro` | Sticky two-tier nav: utility row (careers/fleet/parts/phone) + main bar with brand mark, primary links, an "Ask Rebi" badge and a "Book a test drive" CTA. |
| `_components/Footer.astro` | Warm dark-green footer: Rebi/contact CTA band, link columns, trust pills, franchise-brand strip, demo legal line. |
| `_components/RebiDock.astro` | Persistent bottom-right Rebi launcher ("G'day, I'm Rebi 👋") — the always-present AI entry point. |
| `_components/VehicleCard.astro` | Reusable vehicle tile with condition/badge pills, spec chips, a "Rebi says" AI summary block and drive-away price. |
| `_components/FilterPanel.astro` | Reusable filter rail: Rebi natural-language filter box, **New/Demo/Used condition facets**, price range, make/body/fuel checkboxes. |
| `_data.ts` | Dummy demo data (dealer identity, 8 vehicles, reviews, brands, `money()` formatter). Single source so every page is consistent. |

## Routes delivered (15)

Core 4 (highest polish): `index`, `listings`, `vehicle`, `rebi`.
Priority parity: `finance`, `electric`.
Remaining parity: `offers`, `sell`, `parts`, `fleet`, `about`, `contact`, `careers`, `test-drive`, `brand`.

All at `http://localhost:4321/concepts/regional-trust/<page>`.

## How each maps onto the real site / audit

- **`index`, `listings`, `vehicle`, `rebi`** — re-envisioned versions of surfaces Rebirth Auto
  already has (home/inventory, vehicle detail, Rebi chat). They show the theme applied to the core
  funnel, with AI search + AI summaries promoted to primary UI.
- **New/Demo/Used facets** — the audit flagged vehicle-type framing as a gap; surfaced as home
  facet cards *and* first-class condition buttons in the filter panel.
- **`vehicle`** — includes the required **Edmunds expert-review slot**: a dedicated "Expert review"
  block with an 8.4/10 score ring, criterion bars, a pull-quote, an explicit **"Review by Edmunds"**
  attribution, a logo/link placeholder, "Read the full expert review on Edmunds →", and a demo
  disclaimer. It sits distinct from Rebi's AI take so the two voices never blur.
- **Parity pages** (`finance` with static repayment calculator, `offers`, `electric`, `sell`,
  `parts`, `fleet`, `about`, `contact`, `careers`, `test-drive`, `brand`) — each fills a gap from
  `docs/briefs/bundaberg-parity.md`, composed from the shared shell so they stay cohesive.

## Things added beyond the audit list

- **A persistent Rebi identity system** (orb + voice + dock) unifying the AI across all pages, and
  **AI woven into every tool** — finance estimator, EV savings comparison, sell/trade valuation,
  parts-from-rego, careers role-matching are all framed as Rebi helping.
- **Inline in-chat vehicle cards** on the Rebi page (AI rendering real product results in-thread).
- **Trust layer** — reviews, "since 1978" provenance, per-department contact, meet-the-team — the
  regional-credibility signals the brief calls for, treated as first-class content.
- **`brand.astro` as a repeatable per-franchise template** (shown as Toyota) — model grid + stock +
  offers link, matching BMG's `/<brand>/` pattern.

## If promoted toward the real product (notes, not built)

Wire `_data.ts` to the existing Sanity `LISTING_FIELDS` projection; read dealer identity/colours
from `src/config/dealer.ts` instead of the local `dealer` object (config-as-data); route all Rebi
copy/AI through `src/ai/` tiers; keep any private `dealerNotes` out of every shopper-facing surface
here (none are used). Tokens would move into the shipped light-theme system as a selectable theme.
