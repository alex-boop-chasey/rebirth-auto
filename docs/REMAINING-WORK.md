# What's left to do — Rebirth Auto

The single source of truth for outstanding work. Everything the chatbot pipeline and the
shopper/dealer features needed is built; this is what remains. Plain-language, grouped by who
does it and how big it is. (Multi-tenant and "make the chatbot reusable on other sites" work is
deliberately out of scope here.)

Legend: 🟢 quick · 🟡 medium · 🔴 larger · 👤 needs you (owner) · 🔌 needs a credential/account

---

## /auto run 6 — LLM search query planner (design contest, Phase 1) (2026-08-01)

Scope = one two-phase ticket: **replace the regex search extractor with an LLM query planner** on the
search path (`extractFilters()` stays as the fallback on LLM failure/timeout). The known failure this
fixes: *"a secondhand vehicle as a second car for our family"* → the regex extractor returned ONLY
`seats=[7,8]`, dropping "secondhand" (synonym gap) and "second car" (no soft-signal concept).

**Contest designation (§6 — decided up front):** the schema + clarification-policy design (problems A
and B — how soft inferences flow through the plan, and when to flag `needsClarification`) is genuinely
open-ended and becomes an architectural commitment in `DECISIONS.md`, so it **warrants the sub-agent
contest**: 3 agents in strict sequence — two committed competing designs (blind to each other) + a
critic — then the orchestrator's named synthesis. Per this ticket's Phase 1, the synthesis + proof are
presented for the **owner's sign-off before any production code** (Phase 2).

**Phase 1 (this run) — design + prove only, no production code:**
- Run the contest → candidates 1 & 2 + critique (`docs/briefs/search-planner-*`).
- Orchestrator synthesis: final Zod v4 schema (`.describe()` per field), system-prompt template with
  `{{config placeholders}}`, numbered clarification policy.
- Test harness: ~15 queries (incl. the canonical case + adversarial) with expected outputs.
- **Known blocker:** live model pass-rate needs `OPENROUTER_API_KEY` (absent from `.env`/`.dev.vars`
  here). Harness runs offline Zod-conformance now and is wired to hit the real `structured` tier once
  the key is present — reported as a risk, not silently skipped.
- The family-trap fix (`familySeats [7,8]` → 5-seat-lean, `src/config/dealer.ts:772`) is proposed in
  Phase 1 and applied in Phase 2.

**Phase 1 — DELIVERED ✅ (awaiting owner sign-off before Phase 2):**
- Contest ran (3 agents, strict sequence): `search-planner-candidate-1.md`, `-candidate-2.md`,
  `-critique.md`. Synthesis: `search-planner-synthesis.md` — **winner: candidate 2's schema skeleton +
  taxonomy discipline; imports from candidate 1** the mechanical clarification gate, the never-invent-a-
  price rule, and the enum-typed inference field + clarification topic. Plus five fixes neither had
  (collapsed redundant field pairs, the `concepts`/family-rule contradiction, `interpretation` grounding
  guard, the chip-key adapter, the keyword-with-filters wiring note).
- Proof: `scripts/eval/search-planner-eval.ts` — **15/15 offline Zod conformance, `astro check` clean.**
  Live model pass-rate **blocked on `OPENROUTER_API_KEY`** (absent here); harness runs it the moment a
  key is present.
- **Owner sign-off needed** on: the winner/synthesis, the budget-flag-vs-guess tradeoff (policy r6), and
  the family-trap two-line config change — before Phase 2 writes any production code.

**Phase 2 (after approval only):** wire the planner into `/api/search` (regex fallback preserved),
apply the config change, keep the harness as a permanent test, record the decision in `DECISIONS.md`.

---

## /auto run 5 — AI-search → React island (refactor-first) (2026-08-01)

Autonomous run, scope = the owner-approved React migration of the AI surfaces. A 3-agent planning pass
(two cohesive planners + one critic, all verifying against the code) established that **both existing AI
surfaces render imperatively via `createFocusStage`**, so wrapping them in React is parity-only cost on
the SEO-critical shopper pages. Owner picked scope **"Refactor + SmartSearch only"**. Recorded here as the
§3 checkpoint before executing.

**Building autonomously this run:**
- **Phase 1 — zero-React refactor.** Extract a pure `createToneEngine()` from `src/components/widgets/
  rebi-sounds.ts`; keep `createRebiSounds()` byte-compatible so the still-vanilla ChatWidget is untouched.
- **Phase 2 — shared React island foundation.** New `src/components/ai/hooks/`: `useReducedMotion`,
  `useRebiSounds`, `useFocusStage`, `useFilterUrl`. SSR-safe and **remount-safe from day one** (defensive
  re: a future `<ClientRouter>` — none exists today). Wraps the existing imperative engine + filter-URL
  seam; **zero changes** to `stage-engine.ts` and `filter-url.ts`.
- **Phase 3 — SmartSearch island.** `SmartSearch.tsx` replaces SearchDock's inline `<script>`;
  `SearchDock.astro` becomes a thin host gated on a new `dealerConfig.chat.search.useReactIsland` flag
  (config-as-data owner kill-switch). Filter state stays **URL-only** (DECISION 5) — island holds none.
  Revives the currently-dead `reb:search` hero→Rebi handoff as a bonus.

**Deliberately NOT done this run (with reasons):**
- **Full Rebi chat migration to React** — DEFERRED. Parity-only on the product's core Google → listing →
  enquiry funnel (1476-line battle-tested vanilla: SSE streaming, human-handoff polling, Turnstile,
  dictation, persistence). Revisit only after SmartSearch is proven in prod, or when a genuinely-new
  *declarative* chat feature justifies it. If migrated later, use `client:load` (not `idle`) so early
  "Ask Rebi" CTA clicks on listing/compare pages aren't dropped.

**Contest designated up front (§6):** **NONE.** This is a well-specified refactor + one island with a
settled approach — no gold-standard-UI design contest and no open-ended coding contest is warranted.

**✅ Shipped this run** (commits `eca2999` → `a86769e`; `astro check` 0 errors, `npm run build` green;
homepage driven on the dev server — dock SSR'd hidden until hydration, `/api/search` +
`/partials/inventory` return the expected shapes, count node matches `readGridTotal`):
- **Phase 1** `refactor(sounds)` — pure `createToneEngine()` extracted; `createRebiSounds()` byte-compatible.
- **Phase 2** `feat(ai)` — shared island hooks `src/components/ai/hooks/` (`useFocusStage`, `useRebiSounds`,
  `useFilterUrl`, `useReducedMotion`), SSR- and remount-safe. Zero changes to `stage-engine.ts`.
- **Phase 3** `feat(search)` — `SmartSearch.tsx` island replaces SearchDock's inline script; `SearchDock.astro`
  is now a thin `client:idle` host (filename kept → `index.astro` untouched). URL-only filter state preserved.

**Two directional deviations from the approved plan (autonomous calls, §1):**
1. **Dropped the `useReactIsland` config flag.** The existing `dealerConfig.chat.search.enabled` is already
   the operational kill-switch for AI search; a second dual-implementation flag would have duplicated ~600
   lines of dock CSS across a legacy component and the island for marginal benefit. Straight swap instead;
   rollback is via `git revert`.
2. **Did NOT revive `reb:search`.** Review found the `ChatWidget.astro:1284` listener *opens the chat panel*,
   so dispatching it on every applied search would auto-open the corner chat every search — a regression, not
   a bonus. Preserved today's behaviour (no dispatch). An explicit "ask Rebi about these results" affordance
   remains a possible future feature.

**One assumption corrected during integration:** `filter-url.ts` did NOT need "zero changes" — pulling it
into the island's SSR graph exposed a top-level `window` (popstate binding) that 500'd server render; guarded
with `typeof window` (behaviour-neutral for browser importers). Also fixed a hydration mismatch on the sound
toggle (mute now reconciles in a mount effect). The **full Rebi chat migration remains DEFERRED** as planned.

---

## /auto run 4 — audit verdicts, decisions & contest (2026-07-29)

Autonomous run, scope = finish the backlog. Audited the code against this doc + `TODO_KEYS.md` first.
Directional decisions recorded here (this section is the §3 checkpoint before executing):

**Building autonomously this run:**
- **/capture reachability** — the flow is fully built behind `capture.enabled=false` (redirect + API 404)
  and has zero inbound links. Decision: flip the flag ON and add a **discreet, flag-gated dealer entry
  link** (the write stays the owner-gated stub `src/stubs/listing-writer.ts`). There is no bespoke
  "Studio" dealer area — Studio = embedded Sanity Studio — so the entry point is a new link, not a toggle.
- **Account dashboard real data (folds in "saved searches view")** — the saved-search + service-booking
  tables key on an anonymous `visitor_id`+`email`, NOT the Supabase user (no `user_id` column). Decision:
  wire the `/account` cards to real data via a **query-by-email** path (the logged-in user's email), adding
  `getSavedSearchesByEmail` / `getBookingsByEmail` helpers — no schema migration. Saved-search rows get
  re-run links via `applyFilterUrl`.
- **Restore Haiku tiers** — reorder `writing` + `structured` in `src/ai/tiers.ts` so Haiku is primary.
- **Brand reconciliation** — deterministic (match Rebi's claimed brands to actual inventory). Run the
  read-only `reconcile-brands.ts` for the authoritative diff, then edit `src/chatbot/knowledge.ts` to match.

**Deliberately NOT done this run (with reasons):**
- **Compare nav link** — SKIP. Marked optional ("fine as-is"); a nav link lands on an empty-state compare
  page (compare needs 2+ tagged cars), which is worse UX than the tray entry. Owner can override.
- **Full CSP** — DEFER to owner. Baseline security headers already ship; a full CSP that doesn't break
  Turnstile/Supabase/chat needs careful per-source browser testing and is better as a CF Transform Rule
  (see `TODO_KEYS.md`). Too risky to ship blind autonomously.
- **Business info / fuel economy real values** — BLOCKED on owner. Fabricating a real dealer's phone/
  address or a car's L/100km would violate the determinism rule. Scripts are ready; owner supplies facts.
- **Integration go-lives** (email, Redbook/NEVDIS, vision, carsales, agentic search, grounding) — all built
  + stubbed, flag-gated OFF; going live = add credential + flip flag. Owner-gated. No code work remains.
- **Prod D1 migrations, paid security review, CF account-level settings** — owner infra actions.

**Contest designated up front (deferred to end, OWNER JUDGES — §6):**
- **Experience Mode** (§6) — the premium "Rebi drives the screen as a canvas" surface. Genuinely
  open-ended, gold-standard UI/UX → a **design contest** (3 sub-agents, strict sequence). Built last;
  candidates presented for the owner's decision. Not self-selected.

---

## 1. Real gaps — features that are built but a shopper can't fully reach

- [x] 🟡 **Dealer "create a listing" tool (`/capture`) is unreachable.** ✅ *Run 4:* flipped
      `capture.enabled` on and added a discreet, flag-gated "Dealer: add a vehicle" footer link. Flow now
      reachable (verified `/capture` → 200). The Sanity draft-write stays the owner-gated stub.
- [x] 🟡 **Saved searches can be saved but not viewed.** ✅ *Run 4:* folded into the account dashboard —
      the "Saved searches" card now lists the user's saved searches (by email) with re-run links.
- [x] 🟡 **The account dashboard is mostly empty.** ✅ *Run 4:* "service history" and "saved searches"
      cards wired to real per-user D1 data keyed by the logged-in email (new by-email helpers; no migration).
- [ ] 🟢 **Compare pages have no direct link.** `/compare` and `/compare-tools` are only reachable by
      tagging 2+ cars into the compare tray. *Run 4 decision: SKIP — a nav link lands on an empty-state
      compare page (needs 2+ tagged cars), worse UX than the tray. Left as-is; owner can override.*

## 2. Built but switched off — turn on when you're ready

These work; they're just disabled by default so nothing shows fake/unfinished data to shoppers.

- [ ] 🟢 **Rebi's extra knowledge** — manufacturer info, independent reviews, and web-search (allow-listed
      sites). All built; flip on in config when you want Rebi to use them in chat.
- [ ] 🟢 🔌 **Carsales upload** — the "Upload to carsales" action in Studio is built; turn on + add a
      carsales account/key to go live.
- [ ] 🔴 🔌 **Full "Rebi as an agent" search** — the deterministic tools are built and on; the smarter
      multi-turn version needs a paid tool-calling model + credit. Turn on when the demo justifies the cost.

## 3. Content & data — needs you 👤

- [ ] 👤 **Fuel economy** — the feature is built, but no car has a value yet. Enter L/100km on listings in
      Studio and Rebi/compare start using it.
- [ ] 👤 **Business info** — fill the real phone, hours, brands, address, services (a dry-run script is
      ready; until then Rebi uses placeholder facts).
- [ ] 👤 **Brand list** — reconcile the brands Rebi thinks are stocked with the real inventory.
      *Run 4 finding: the automated diff is INVALID and must not be applied blindly.* Rebi's list is
      **new-vehicle franchise brands** ("…new-vehicle brands, alongside a Quality Used Cars department"),
      but the reconcile script compares it against **all** inventory makes incl. used stock — so it wrongly
      flags used-only makes (Ford, GWM, **Holden** [discontinued 2020, cannot be a new franchise], Mazda,
      Mitsubishi, Toyota) as "unclaimed", and flags stockless franchises (Jeep, Leapmotor) as "absent".
      Needs the owner's real new-vehicle franchise list; determinism rule forbids guessing. Owner-blocked.

## 4. Integrations to switch from demo to live (credential + flag) 🔌

Each is built with a realistic fake pipeline; going live is "add the key, flip the flag." Full list
and exact steps live in `TODO_KEYS.md`.

- [ ] 🔌 **Email (Resend or similar)** — real confirmation + saved-search alert emails.
- [ ] 🔌 **Redbook / NEVDIS** — real trade-in valuations and rego/VIN lookup for the creation tool.
- [ ] 🔌 **Vision model** — real photo → spec extraction in the creation tool.
- [ ] 🔌 **Saved-search alerts (recurring)** — the save + confirmation are built; the "new match arrived"
      matcher needs a scheduled (cron) job to re-run saved searches and email matches.

## 5. Infra & deploy — needs you 👤

- [ ] 👤 **Apply the database migrations in production** — the journey / saved-searches / service-bookings
      tables (`0003`–`0005`) are local-only until run against the live database.
- [ ] 👤 **Customer login hardening** — real Supabase auth is wired, but a paid security review is required
      before real customer personal data flows through it in production.
- [ ] 👤 **Security headers** — the safe ones are live; add a full Content-Security-Policy + Permissions-
      Policy (needs careful per-source testing so Turnstile/Supabase/chat still work).
- [ ] 👤 **Optional**: grounding cache (`GROUNDING_KV`), Sanity MCP plugin — both nice-to-have, work without.
- [x] 🟢 **Restore the better chat model** — ✅ *Run 4:* `writing` + `structured` tiers reordered so
      Haiku is primary (free gemma retained as fallback) in `src/ai/tiers.ts`.

## 6. Bigger / future (for this site)

- [ ] 🔴 **Experience Mode** — the opt-in premium mode where Rebi drives the screen as a canvas. Prototype
      the onboarding → standby → "boom" flow cheaply and test with ~5 real users.
- [ ] 🔴 🔌 **Point-of-sale integration** — sync with the dealer's sales platform. Per-dealer, depends on
      which system they use and whether it has an API. Long-term.

---

*Reference docs (not todos): `VISION.md`, `DECISIONS.md`, `LENSES.md` (product/architecture direction),
`SYSTEM-MAP.md` (whole-codebase system map & audit checklist — audit the site whole or by subsystem),
`TODO_KEYS.md` (exact go-live steps per integration), `cloudflare-security.md`, `dependency-tracking.md`.
Per-feature build specs are in `docs/briefs/` (incl. the Experience Mode contest candidates A/B + critique).*
