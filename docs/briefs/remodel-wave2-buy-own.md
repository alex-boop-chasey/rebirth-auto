# Remodel Wave 2 — Buy & Own (finance, offers, sell, test-drive)

READ `docs/briefs/REMODEL-BRIEF.md` first. Base = inline-contextual; nav/footer/design-layer already
built (Wave 0); grid lives at `/listings` (Wave 1). Build these four as REAL routes ported from their
mockups. Use the REAL `SiteNav`/`SiteFooter` (via the existing page pattern — see how
`src/pages/service.astro` or `trade-in.astro` compose their `<html>` + `<SiteNav/>` + `<SiteFooter/>` +
`<ChatWidget/>`), the `.entry` design classes (Wave 0), and REAL data/config. `astro check` 0 errors.

## Design sources (read each, port the layout/sections)
`src/pages/concepts2/inline-contextual/{finance,offers,sell,test-drive}.astro` + `_shell/Layout.astro`
+ `IA.md`. Also read `src/pages/service.astro` + `src/pages/trade-in.astro` (existing real pages) for
the real page shell + form-POST + Turnstile patterns to match.

## Pages to build (real routes under `src/pages/`)
1. **`/finance` (`finance.astro`)** — repayment calculator + finance info. The calculator is a **real
   client-side computation** (weekly/monthly repayment from price, deposit, term, rate). Rate/term
   defaults come from **`dealerConfig`** (add a `finance` config block: e.g. `defaultAprPct`,
   `defaultTermMonths`, `depositPct`, plus display copy). Reads `?price=<n>` (from the vehicle entry) to
   prefill. **Never invent lender names or approval claims** — generic, config-driven copy only.
   Cross-link `.entry` to `/offers` and `/trade-in` ("trade as deposit"). Ask-Rebi entry (`data-rebi-open`).
2. **`/offers` (`offers.astro`)** — current deals. **Determinism: do NOT fabricate deals/prices.** Make
   offers **config-as-data**: add a `dealerConfig.offers` array (default `[]`) and render a graceful
   "no current offers — talk to us / browse stock" empty state when empty. (If you prefer, additionally
   surface REAL price-drop listings if that seam already exists — but never invent a discount.)
   Cross-link `.entry` to `/finance` (finance↔offers fold) and `/listings`.
3. **`/sell` (`sell.astro`)** — outright-sale valuation intake FORM. Needs a backend → build a **stub
   endpoint** per /auto §4: `src/pages/api/sell-enquiry.ts` + `src/stubs/sell-enquiry.ts` exporting the
   real interface, `useStub = !env.<KEY> || truthy(env.STUB_SELL)`, `// TODO_KEYS:` markers, a
   `TODO_KEYS.md` row. Deterministic stub (no `Math.random`/module-top-level `new Date()`). Reuse the
   per-IP limiter (`checkRateLimit`, distinct `keyPrefix`) + Turnstile like the other form endpoints.
   Cross-link `.entry` to `/trade-in` (sell↔trade fold, "compare with a trade-in").
4. **`/test-drive` (`test-drive.astro`)** — test-drive booking FORM. Reads `?vehicle=<slug>` to prefill
   the chosen car. Backend: reuse the existing `/api/book-service` PATTERN or add a sibling stub
   endpoint `src/pages/api/book-test-drive.ts` + `src/stubs/*` per §4 (same rules as sell). Cross-link
   `.entry` back to the vehicle / `/finance`.

## Constraints (bind)
- **Real data / determinism** — no fabricated cars, prices, deals, lender names, or dealer facts.
  Anything dealer-specific (phone, finance rates, offers) comes from `dealerConfig`; if a value isn't
  set, show a graceful placeholder-gated state, never a made-up value.
- **Config-as-data** — new config in `src/config/dealer.ts` only (finance block, offers array). Extend
  the `DealerConfig` interface too.
- **All AI through `src/ai/`**; `dealerNotes` never public; `data-rebi-open` for Rebi entries.
- **Stub pattern** for sell + test-drive endpoints (external integrations stay stubbed — no real email/
  PII/spend). Light-theme; visible focus rings.
- Do NOT touch the grid/filter/SearchDock/ChatWidget/compare seams or Wave-0/Wave-1 files beyond adding
  the config blocks.

## Verify (DRIVE it)
`astro dev --background`: all four routes return 200 and render in the inline-contextual style with the
real nav/footer; the finance calculator computes a repayment from a price (and prefills from
`/finance?price=60500`); `/offers` shows the config-driven state (empty state if `offers=[]`); the sell
+ test-drive forms POST to their stub endpoints and get a success response (drive one submit each);
`?vehicle=` prefills test-drive. Report `astro check` + what you drove + the exact new config keys +
the `TODO_KEYS.md` rows added. Do NOT commit.
