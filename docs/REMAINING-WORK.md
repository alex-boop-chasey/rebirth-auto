# What's left to do — Rebirth Auto

The single source of truth for outstanding work. Everything the chatbot pipeline and the
shopper/dealer features needed is built; this is what remains. Plain-language, grouped by who
does it and how big it is. (Multi-tenant and "make the chatbot reusable on other sites" work is
deliberately out of scope here.)

Legend: 🟢 quick · 🟡 medium · 🔴 larger · 👤 needs you (owner) · 🔌 needs a credential/account

---

## /auto run 5 — visual tidy-up + Bundaberg parity + whole-site design contest (2026-07-30)

Owner scope: (1) screenshot the whole site, fix visual overlaps/misalignment ("balance");
(2) review bundabergmotorgroup.com.au, list its pages/features, build parity pages into our
site with dummy content; (3) run a **UX/UI design contest — 3 teams × 2 agents** (one
traditional, one modern/experimental per team), each team a unique orchestrator-assigned
theme, all teams simultaneous; each team produces a final design + structure plan and builds
visual-only, non-responsive mockup pages (dummy content, no functionality). Owner judges.

**Phase 1 — Visual tidy-up (autonomous).** Whole-site screenshot audit done (13 surfaces,
`design-concepts/audit/`). Only genuine overlap: **`/labs/experience`** — the Rebi orb is
absolute-centered and overlaps the H1; `experience-alt` shows the correct (orb-above-headline)
pattern. Everything else aligns cleanly. (Recurring dark pill = Astro **dev toolbar**,
dev-only, not a bug; black orb bottom-right = correctly-placed chat launcher.) Note: `/capture`
is dark-themed vs the light standard — logged, out of scope for overlap tidy-up.

**Phase 2 — Bundaberg parity (folded into the contest).** Page/feature inventory +
gap list in `docs/briefs/bundaberg-parity.md`. The new pages (finance + calculator, new/demo/used
facets, per-brand landings, offers hub, EV hub, sell-your-car, parts, fleet, about, contact,
careers, test-drive) are **built by the contest teams as themed mockups** rather than once
separately (owner: "build them into our site … and run a contest … build out pages to look
like the final builds").

**Phase 3 — CONTEST (deferred to end · OWNER JUDGES · §6).**
Structure per owner's explicit instruction (a deliberate override of the default 3-sequential
contest format in AGENTS.md — recorded per §6): **3 teams of 2 designers = 6 agents, all run
SIMULTANEOUSLY.** Each team = ONE **traditional** web designer + ONE **futuristic/experimental**
web designer who **collaborate to produce their team's single unique themed entry** (NOT two
separate entries, NOT one layering on the other). Each team has a unique orchestrator-assigned
theme + a shared team brief (`docs/briefs/contest/team-<n>-<theme>.md`) fixing exact tokens,
nav and footer so the two halves read as ONE cohesive site. Page-ownership is split so the pair
build in parallel without conflict: the **traditional** designer owns inventory + vehicle +
finance(+calculator) + PLAN.md; the **experimental** designer owns the showpiece home + one
signature new page. Each entry lives in `src/pages/concepts/team-<n>-<theme>/`. Desktop-only,
non-functional, light-theme, dummy content, fully isolated. Owner judges the 3 team entries at
the very end — not self-selected.

Teams/themes: **T1 Concierge** (editorial luxury) · **T2 Velocity** (kinetic sport) ·
**T3 Clarity** (calm, AI-forward).

**Three themes (orchestrator's call — all light-first per the binding light-theme standard):**
- **Team 1 — "Concierge" (Refined Editorial):** boutique quiet-luxury; ivory/paper + charcoal,
  serif display + humanist sans, generous whitespace, brochure-grade restraint.
- **Team 2 — "Velocity" (Kinetic Sport):** high-energy modern-sport; bright white + electric
  cobalt/signal accents, heavy grotesk type, diagonal/asymmetric sections, confident motion.
- **Team 3 — "Clarity" (Calm Minimal / AI-forward):** Scandinavian-clean; soft slate/white,
  lots of air, precise modular grid, one muted accent, Rebi/conversation front-and-centre.

Deliverable set per team (comparable across teams): themed mockups of **home, inventory/search,
vehicle detail, finance (with calculator UI), one signature new page (EV hub or offers), and one
reimagined existing surface**, plus a short `PLAN.md` (design language + full sitemap/structure).
Screenshots of each entry presented to the owner for judgment.

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
