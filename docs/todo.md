# TODO — Rebirth Listings Auto

---

## In progress / next up

### Chatbot pipeline — reach 100% then snapshot

- [ ] **Continuity journey** — server-persisted D1 "journey" so Rebi remembers what the visitor did across search → listing → compare (and on return visits), folded into every reply. Last substantive piece before the 100% snapshot.
- [ ] **Flip chatbot reply model to Haiku** — single biggest quality upgrade for the demo. One-line change in `src/ai/tiers.ts`. Fixes "feels dumb" + residual hallucination. Deliberately deferred during free-tier build.

### Chatbot UX overhaul

- [ ] **New chatbot look and feel** — replace the bottom-right chat bubble with a centre-screen overlay matching the AI search bar style. On open: page fades to greyscale/bright (soft black-and-white, low contrast) while the chat UI fades in in colour. Must retain all existing functionality: primed entry points, listings search that displays on screen regardless of current page, human escalation via Telegram, close/minimise icons, microphone for voice typing, speaker toggle for message tones.
- [ ] **Global "Ask Rebi" button style** — make this a single reusable component used consistently across all AI entry points (comparison drawer, per-listing, search). Currently the comparison drawer says "Ask AI" — update to "Ask Rebi" and switch to the global style.
- [ ] **Chatbot cross-function** — chatbot must be able to perform any function (including inventory search) regardless of which entry point primed it. e.g. opening via "Ask Rebi" in the comparison drawer and then asking for all SUVs under $40K should work.

### AI search bar

- [ ] **Colour attribute** — search bar does not recognise colour. Add colour to vehicleSpecs or details[] and wire into search extraction.
- [ ] **Staggered results sequence** — current results appear too abruptly. New sequence: user submits query → current listing grid fades out + "AI is typing" bubble appears → AI response message appears → filtered results fade in.
- [ ] **Hero layout** — AI search bar should sit at a comfortable distance below the hero heading, with the heading layered above the carousel space.

### Manual filter drawer

- [ ] Price dropdowns: change "any / any" labels to "min / max"
- [ ] Year dropdowns: fix — currently do not open/show years. Label as "from" and "to".

### Comparison table

- [ ] **Design contest** — run a 3-agent sequential contest (each agent tries to outdo the previous design, no critic agent needed here). Agents have freedom to propose extra features or content animations. Judge is the owner.

---

## Owner tasks (not blocking dev)

- [ ] Fill real business facts into the "Business info" (`businessInfo`) Sanity document — phone, hours, brands stocked, years in business, address, services. Until then Rebi uses the `knowledge.ts` placeholder.
- [ ] Optional: add `GROUNDING_KV` KV namespace + `wrangler.jsonc` binding to enable grounding caching (works fine without it).
- [ ] Reconcile demo brand data — the business facts doc lists brands with no inventory (Honda/Hyundai/Kia) while actual inventory has brands not in the list (Ford/Mitsubishi). Align the brand list with real inventory to sharpen the make-firewall.

---

## Sanity Studio improvements

- [ ] **Schema UX — Tier 1 (schema config only, best value/effort):**
  - `groups` → document tabs (Details / Specs / Media / Pricing / SEO)
  - `fieldsets` + collapsible options → collapsible sections
  - Conditional `hidden` / `readOnly` fields
  - `options.list`, radio/grid layouts, `initialValue`, per-field validation messages
  - `preview` with `select` / `prepare` → makes listing index scannable
- [ ] **Add fuel economy / L-100km field** — closes the running-cost gap so Rebi can answer economy questions instead of declining.
- [ ] **Sanity MCP plugin** — install via `/plugin install sanity@claude-plugins-official` in Claude Code. Note: local `@sanity/mcp-server` is deprecated; use hosted `https://mcp.sanity.io`.

---

## Dealer-side listing creation tool (post-100% snapshot)

> Separate surface from Rebi. Goal: a dealer with a paper spec sheet or a car in the yard never manually types a listing again.
> Ship AFTER the chatbot pipeline hits 100% and the snapshot is forked.

- [ ] **Rego/VIN → authoritative API** (RedBook/MotorWeb via NEVDIS) — extract one alphanumeric string, hit the API, get OEM factory spec. Shrinks the model's job to price, odometer, condition, service history, colour. ~AU$0.65/lookup. Written-off/stolen status worth surfacing on public listings.
- [ ] **Photo → extraction** — image straight to vision model (no OCR-then-parse). Route cheap → escalate on low confidence. Capture UI is the real accuracy lever: guide frame, blur detection, retake prompt.
- [ ] **Voice complement** — ~30s dealer voice note for what's only in their head ("one owner, full books, small dent rear quarter"). Web Speech API weak on automotive vocab — use Whisper or Deepgram with a vocabulary hint from existing makes/models.
- [ ] **Pipeline:** photo and/or voice → extraction → draft → dealer review → publish. Draft-only, never publish direct.
- [ ] **Validate against schema before create** — errors land in the review UI, not inside Studio.
- [ ] **Resolve references, never invent** — GROQ fuzzy lookup for makes/models, "create new?" prompt on no match.
- [ ] **Ships as a standalone PWA** (Astro + Cloudflare Worker) — dealer is in the yard on a phone; Studio is desktop-first. Build extraction as a shared module, not baked into either surface.
- [ ] Write token lives in the Worker, scoped to listings dataset only. Never client-side.

---

## ⭐ Milestone — fork snapshot at 100%

Once the chatbot pipeline is complete — all three entry points built, continuity working, verified and stable — **fork/copy the repo as a frozen snapshot.** This becomes the base for the "plug into any website" AI-helper product. Do this AT the 100% milestone, not before.

---

## Features backlog (not yet ticketed)

- **Rebi in Sanity Studio** — editor-facing assistant inside Studio that reads the open listing via `useFormValue` and drafts descriptions from specs. Different brain from the visitor-facing Rebi. Check whether Sanity's Agent Actions / Content Agent covers it natively first.
- **Comparison table — Ask Rebi entry point** — "help me decide between these" as a fourth natural Rebi entry point from the comparison tray.
- **Price History / "Just Reduced"** — surface price change history on listings.
- **Saved searches + email alerts** — registered shoppers save a search and get notified on new matches.
- **Redbook trade-in valuation** — help visitors get an approximate value for their trade-in.
- **AI grounded on manufacturer websites** — AI has access to partnered manufacturer sites for new model info.
- **AI grounded on automotive review sources** — Wheels Magazine or similar for model ratings and secondhand buying advice.
- **Upload listing to carsales.com.au** — push published listings to carsales via their API.
- **Book a service** — service booking flow for the dealership's service department.
- **Customer accounts** — login, service history, tyre rotation dates, previous repairs, email/SMS alerts. Platinum-level customer care that creates long-term dealer loyalty.
- **Web search for Rebi** — hardcoded allowlist of URLs Rebi can search for supplementary info.
- **Point-of-sale integration** — per-dealer build depending on which sales platform they use and API availability. Long-term. ⏸️ **PARKED (2026-07-28)** — see Vision / future direction.
- **Dependency version tracking** — tooling to safely track and update Astro and other stack dependencies.
- **Cloudflare security tooling** — investigate and integrate Cloudflare's automated security features; ongoing vulnerability scanning and performance auditing.

---

## Vision / future direction

> ⏸️ **PARKED (2026-07-28)** — the items below are deferred to pick up later, behind the 100%
> snapshot fork / paid security review. Not to be built until then. Alongside POS integration
> (above), the parked set is: kernel extraction, plug-into-any-website, multi-tenant, Experience
> Mode, POS, and the paid multi-turn agentic loop (the deterministic tools + gated scaffold are
> already built; only the paid tool-calling loop is parked).

- **Extract the chatbot kernel** — framework-agnostic core + pluggable grounding interface into its own clean repo. The reusable product, not the whole dealership site.
- **"Plug into any website" AI helper** — grounding source swaps from Sanity catalog to website content via a structural site-map index and/or semantic RAG with delta-refresh on change.
- **Full agentic search** — Rebi as an agent with `search_inventory` / `get_listing` tools on a capable paid model. Anti-hallucination by construction. Needs paid model + tool-calling in `src/ai/`.
- **Experience Mode** — opt-in premium mode where the AI navigator is the primary interface and the screen is a canvas the bot drives. A dial, not a binary — the standard browsable site stays underneath. Prototype the onboarding → standby → "boom" flow cheaply and test with ~5 real users early.
- **Multi-tenant SaaS** — see DECISIONS.md. All coding conventions already point this direction.