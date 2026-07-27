# todo.md ground-truth audit

Read-only audit mapping every `docs/todo.md` line item to its actual implementation state
in the codebase, run at the start of the autonomous build run. Conclusion: the "In progress
/ next up" section is entirely BUILT; the backlog is stale. Full table below.

| Item (short) | Section | State | Evidence (file:line) | Genuine gap if PARTIAL/ABSENT |
|---|---|---|---|---|
| Continuity journey (D1) | Chatbot pipeline | BUILT | `chatbot/journey.ts` (record/get/beacon), `grounding/journey.ts:47`, wired `grounding/index.ts:66`, recorded `core.ts:746` (chat), `api/search.ts:79` (search), beacons `listings/[slug].astro:382` + `compare.astro:525`, migration `0003_journey.sql`, config `dealer.ts:200` | — |
| Flip reply model to Haiku | Chatbot pipeline | BUILT | `ai/tiers.ts` — `chat-cheap` primary = `anthropic/claude-haiku-4-5`, free fallbacks retained | — |
| New chatbot look & feel | Chatbot UX | BUILT | `ChatWidget.astro` centred panel, `body.reb-dreaming` greyscale, Focus Stage, mic, speaker, minimise/close, Telegram escalation polling | — |
| Global "Ask Rebi" button | Chatbot UX | BUILT | `AskRebiButton.astro`; `CompareTray.astro:34`; `compare.astro:334`; `SearchDock.astro:326` | — |
| Chatbot cross-function | Chatbot UX | BUILT | `ChatWidget.astro:1211` applyInventorySearch from any entry; server always runs live lookup `grounding/index.ts:106` | — |
| Colour attribute in AI search | AI search bar | BUILT | `ai-search/schema.ts:39,86`; `ai-search/prompt.ts:44`; `vehicle-filter-extract.ts:40,181`; `listings-query.ts:221` GROQ filter; schema `listing.ts:147` | — |
| Staggered results sequence | AI search bar | BUILT | `SearchDock.astro:516-642` 4-step choreography | — |
| Hero layout | AI search bar | BUILT | `index.astro:99-124` hero-stack/hero-copy | — |
| Price dropdowns → min/max | Filter drawer | BUILT | `FilterDrawer.astro:131/142` | — |
| Year dropdowns fix + from/to | Filter drawer | BUILT | `FilterDrawer.astro:163/175`; year-bug fixed by per-access getter `dealer.ts:359-363` | — |
| Comparison table design contest | Comparison table | OWNER/INFRA | Table built & polished (`compare.astro`, `compare-verdict.ts:811-984`). 3-agent contest, judge = owner — process/owner-judgment, not code | Process only; deliverable exists |
| Fill businessInfo Sanity doc | Owner tasks | OWNER/INFRA | Schema `businessInfo.ts`; placeholder `knowledge.ts` in use | Data write |
| GROUNDING_KV namespace + binding | Owner tasks | OWNER/INFRA | `grounding/cache.ts:5` optional/fail-open; no binding in `wrangler.jsonc` | Infra/credential |
| Reconcile demo brand data | Owner tasks | OWNER/INFRA | `knowledge.ts:36-41` Honda/Hyundai/Kia; real inventory Ford/Mitsubishi | Data alignment |
| Schema UX Tier 1 | Sanity Studio | BUILT | `listing.ts` groups tabs (28-34), options.list/radio/initialValue/validation, conditional hidden+readOnly, preview select/prepare | Minor: fieldsets not used (groups chosen) — design choice |
| Fuel economy / L-100km field | Sanity Studio | ABSENT | Guards say no such field: `system-prompt.ts:204-208`, `ai-search/prompt.ts:73`, `compare-verdict.ts:37-38`, `dealer.ts:468` | **Add field + surface in search/compare/prompt** |
| Sanity MCP plugin | Sanity Studio | OWNER/INFRA | Install action | Owner install |
| Rego/VIN → API | Dealer tool | ABSENT | No nevdis/redbook/motorweb | Post-snapshot |
| Photo → vision extraction | Dealer tool | ABSENT | none | Post-snapshot |
| Voice complement | Dealer tool | ABSENT | none | Post-snapshot |
| Draft→review→publish pipeline | Dealer tool | ABSENT | none | Post-snapshot |
| Validate against schema before create | Dealer tool | ABSENT | none | Post-snapshot |
| Resolve references, never invent | Dealer tool | ABSENT | none | Post-snapshot |
| Standalone PWA | Dealer tool | ABSENT | no manifest/service-worker | Post-snapshot |
| Worker-scoped write token | Dealer tool | ABSENT | none | Post-snapshot |
| Fork snapshot at 100% | Milestone | OWNER/INFRA | Repo-fork action | Owner action |
| Rebi in Sanity Studio | Backlog | PARTIAL | `GenerateDescriptionInput.tsx:13-36` useFormValue + `/api/generate-description`; `generate-description/prompt.ts` | One-shot generator exists; not a conversational assistant |
| Comparison — Ask Rebi entry | Backlog | BUILT | `CompareTray.astro:34` + `compare.astro:334` data-rebi-kind="compare" | — |
| Price History / "Just Reduced" | Backlog | ABSENT | no price-history field/UI | Future feature (safe stub candidate) |
| Saved searches + email alerts | Backlog | ABSENT | none | Future feature |
| Redbook trade-in valuation | Backlog | ABSENT | none | Future feature |
| Manufacturer-site grounding | Backlog | ABSENT | grounding is Sanity-only | Future (partnership-gated) |
| Review-source grounding | Backlog | ABSENT | none | Future (partnership-gated) |
| Upload to carsales.com.au | Backlog | ABSENT | none | Future (API/partnership) |
| Book a service | Backlog | ABSENT | none | Future feature |
| Customer accounts | Backlog | ABSENT | no auth | Future (security-gated) |
| Web search for Rebi | Backlog | ABSENT | no web-search tool | Future feature |
| Point-of-sale integration | Backlog | ABSENT | none | Future (per-dealer) |
| Dependency version tracking | Backlog | ABSENT | no tooling | Future/tooling |
| Cloudflare security tooling | Backlog | OWNER/INFRA | investigate/integrate | Infra |
| Extract chatbot kernel | Vision | ABSENT | modular but not extracted | Future (post-snapshot) |
| Plug into any website | Vision | ABSENT | grounding Sanity-bound | Future |
| Full agentic search | Vision | ABSENT | `src/ai/` has no tool-calling; enum-locked structured only | Future (needs paid model) |
| Experience Mode | Vision | ABSENT | none | Future |
| Multi-tenant SaaS | Vision | ABSENT | conventions point there; not built | Future (needs paid security review) |

## Genuine remaining work (code tasks only)

1. **Fuel-economy / L-100km field (ABSENT)** — highest value/lowest effort, in-scope, owner-sanctioned in todo. Add `fuelEconomy` to `vehicleSpecs`, remove the four "no such field" guards, surface in prompt/compare/search. Self-contained. **← building this run.**
2. **Rebi-in-Studio fuller assistant (PARTIAL)** — extend the existing one-shot generator, or confirm Sanity Agent Actions covers it.
3. **Full agentic search / tool-calling (ABSENT)** — foundational for vision items; needs paid model.
4. **Dealer PWA suite (ABSENT)** — post-snapshot; build extraction as a shared module.
5. **Backlog product features (ABSENT)** — price history, saved searches, trade-in, grounding sources, carsales, booking, accounts, web-search, POS, dependency tracking.
6. **Vision items (ABSENT)** — kernel extraction, plug-into-any-website, Experience Mode, multi-tenant.

OWNER/INFRA (not code tasks): comparison contest, businessInfo fill, GROUNDING_KV, brand reconciliation, MCP install, 100% fork, CF security tooling.
