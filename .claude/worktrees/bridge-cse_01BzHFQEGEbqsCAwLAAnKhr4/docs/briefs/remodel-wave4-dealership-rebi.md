# Remodel Wave 4 — Dealership + Rebi (about, contact, careers, /rebi)

READ `docs/briefs/REMODEL-BRIEF.md` first. Base = inline-contextual; Waves 0–3 done. Build these as
REAL routes ported from their mockups, using the real `SiteNav`/`SiteFooter` + `.entry` classes + REAL
config, following the Wave-2/3 patterns. `astro check` 0 errors. This wave completes the footer's
Dealership column + the Rebi full-view.

## Design sources (read)
`src/pages/concepts2/inline-contextual/{about,contact,careers,rebi}.astro` + `_shell/{Layout,RebiChat}.astro`
+ `IA.md`. Real Rebi: `src/components/widgets/ChatWidget.astro` (the shipped chat — DO NOT edit its
mechanics) + the `data-rebi-open` seam + `/api/chat`.

## Pages to build
1. **`/about` (`about.astro`)** — company story / why-us / team / stats. **Determinism: no fabricated
   facts.** Everything dealer-specific (name, story, stats, team) comes from `dealerConfig` /
   `businessInfo`. If a fact isn't configured, use generic non-specific copy or a placeholder-gated
   state — NEVER invent a statistic, a person, or a claim. Cross-link `.entry` to `/contact`, `/careers`.
2. **`/contact` (`contact.astro`)** — department cards (hours / phone / email / address) + a general
   enquiry FORM. **All contact facts from `dealerConfig` (phone/hours/address/email); if unset, show a
   clearly-placeholder state — do NOT print a made-up phone/address** (this is the owner-blocked real
   business info). Form → stub `src/pages/api/contact-enquiry.ts` + `src/stubs/contact-enquiry.ts` per
   /auto §4 (flag `STUB_CONTACT` / cred `CONTACT_API_KEY`, deterministic `MSG-<hash>`, `contact:`
   limiter fail-open, optional fail-open Turnstile, `// TODO_KEYS:` + TODO_KEYS.md row). `dealerConfig.contact`
   block (copy + the facts, if not already present — check what `dealerConfig` already exposes for
   phone/address/hours and REUSE it; do not duplicate).
3. **`/careers` (`careers.astro`)** — culture + open roles (`dealerConfig.careers.roles`, default `[]` →
   graceful "no open roles" state; never invent roles) + register-interest FORM → stub
   `src/pages/api/careers-enquiry.ts` + `src/stubs/careers-enquiry.ts` per §4 (`STUB_CAREERS`,
   `CAREERS_API_KEY`, `CAR-<hash>`, `careers:` limiter, TODO_KEYS row). `dealerConfig.careers` block.
   Cross-link `.entry` from `/about` ("Join the team").
4. **`/rebi` (`rebi.astro`)** — the full-page Rebi navigator. **CRITICAL: reuse the REAL chat mechanics —
   do NOT reimplement the chat and do NOT edit `ChatWidget.astro`.** Faithful options (pick the cleanest
   that touches no chat internals):
   - Host the real `<ChatWidget/>` on a dedicated full-height page and auto-open it (dispatch a
     `data-rebi-open` click on load), wrapped in the inline-contextual page chrome + the navigator's
     "Rebi can take you to…" jump list (real links to the site's hubs/pages) + example action chips that
     are real links. The chat itself is the shipped widget hitting `/api/chat` (grounding intact).
   - If auto-opening the floating widget reads poorly full-page, present a navigator landing (jump list +
     "Ask Rebi" `data-rebi-open` CTA + the real featured cards) — still the real widget for the actual
     conversation. Either way: NO mock conversation, NO duplicated chat logic, NO grounding bypass.
   Nav "Ask Rebi" stays a `data-rebi-open` button (Wave 0) — the `/rebi` page is an ADDITIONAL surface,
   reached from the footer + a "Full view" affordance.

## Constraints (bind)
- **Determinism / real data** — no fabricated business facts, stats, people, roles, phones, addresses.
  Dealer values from `dealerConfig`; placeholder-gated if unset. **All AI through `src/ai/`**;
  `dealerNotes` never public; grounding never bypassed on `/rebi`.
- **Config-as-data** — new config only in `src/config/dealer.ts` (+ interface); REUSE existing
  business-info fields rather than duplicating. Stub pattern for the 3 form endpoints. Light-theme.
- Do NOT edit `ChatWidget.astro`, the chat API, grounding, or the grid/filter/compare seams. Only
  additive `dealer.ts` config + the new pages/endpoints/stubs + TODO_KEYS rows.

## Verify (DRIVE it)
`astro dev --background`: `/about` `/contact` `/careers` `/rebi` all 200 in the inline-contextual style
with real nav/footer; `/contact` shows config-driven facts or a clean placeholder (no invented
phone/address); `/careers` shows the empty-roles state; drive one submit each of contact + careers →
stub success ref; **`/rebi` opens/hosts the REAL ChatWidget** (confirm a message round-trips through
`/api/chat`, or — if no key — that it's the real widget, not a mock) and the jump list links resolve.
Report `astro check` (0 errors), what you drove, new config keys, TODO_KEYS rows, and exactly how you
wired `/rebi` to the real chat. Do NOT commit.
