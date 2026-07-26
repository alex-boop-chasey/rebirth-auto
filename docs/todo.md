# TODO — Rebirth Listings Auto

> Tracks the open threads for the chatbot pipeline and the longer-term product direction.

**Chatbot Design Change** - i want to try change the look of the chatbot from its current little chat screen bottom right to look just like the ai search bar and whether it's the Ask Rebi in the compare drawer or the comparison chart or the Ask Rebi on each single listing, i want the chat to open in the middle of the screen like the ai search bar currently does except when the Ask Rebi button is pressed, it trigger all the colour on the page to fade out so the site becomes greyscale and a bit brighter (so it looks like a black and white dream not heavy in contrast because i dont want dark shades distracting the users eyes) at the same time the site-wide colours fade and the overall brightness increases, the chatbot feature (just like the ai search bar fades in - in colour. You will need to build into it the exact same functionality as the existing chatbots with its primed entry points and its ability to discuss anything from the site or start a listings search (that must display on screen regardless of which page the user is on when they envoke a vehicle search or what primed the chatbot. It must include the escalation feature where it hands off to a human via telegram and patches them into the live chat. It must have a close icon and a minimise icon that function the same as the existing chatbot. It must have the microphone icon in the msg bar for users to activate voice typing and I would also like the speaker icon that deactivates or reactivates the msg tones.

- **AI search bar tweaks** - The search bar does not recognise the 'colour' attribute. We may need to add colour to the list of specs in the listing. - Also, let's stager the sequence of events so website visitors can actually witness the AI performing a function. The events should appear on screen in this order 1. the user enters a search query. 2. The current 'unfiltered' list of cars disappears with a slight fade-out and the 'AI is typing' three dot msg bubble animation triggers. 3. The AI's results msg appears in the chat. 4. The results of the search appear with a slight fade-in. Another edit to be made is to have the initial ai search bar appear at a reasonable distance underneath the hero section heading by having the heading on a layer on top of the space where the carousal effect plays out.

- **Chatbot - comparison mode tweaks** - The chatbot should be able to perform any function including the function of the ai search bar regardless of which task it's been primed with. For example, if i opened the chatbot by clicking 'Ask AI in the comparison drawer, and then asked it to show me all the suv's under $40K, it should be able to. Also, for consistency, the ask ai button in the comparison draw should say Ask Rebi - make this 'Ask Rebi' button style a global style so we have consistency with all AI features. That will make it easy if we add another ai button somewhere else.

- **Manual Filter drawer** - the text in the 2 price dropdowns is 'any' and 'any' it should be 'min' and 'max'. Also, the dropdowns for 'year' dont dropdown and show years to choose. They should be labelled 'from' and 'to'. I think eventually, we might have filters that do not appear in the manual filter drawer but exist only for the benefit of the ai search function (like 'colour'). 

- [ ] **The continuity journey** — a server-persisted D1 "journey" so Rebi remembers what the visitor did across search → listing → compare (and on return visits), folded into every reply. This is the last substantive piece before the fork-at-100% snapshot. (Its building blocks are already sketched under "Experience Mode runway".)

- **tidy up the comparison table** - The table looks messy because there is a colomn on the left with the spec names leaving a blank spece above it where the vehicle img goes on the following columns. I think the comparison table could be reimagined with a sub-agent design contest. I think for the purpose of this contest, we don't need a 3rd sub-agent looking for weaknesses in the first 2 proposals. Let's instead have 3 agents running sequentially with each one trying to out do the previous ones design. Each contestant has the freedom to propose extra features or content animations to impress me, the judge.



### ⭐ North Star — continuity

One ongoing Rebi session across search → listing → compare that *accumulates* context (the "familiar little AI friend"), not a fresh bot per entry point. Use the existing D1 session memory. Auto-opens should feel like a gentle slide-in, not a takeover.

## Owner tasks (not blocking dev)

- [ ] Fill the real business facts into the new "Business info" (`businessInfo`) document in Sanity Studio — phone, hours, brands stocked, years in business, address, services. Until then Rebi uses the `knowledge.ts` placeholder (works, just generic).
- [ ] Optional: add a `GROUNDING_KV` KV namespace + a `wrangler.jsonc` binding to enable grounding caching (runs fine live without it).
- [ ] **Flip the chatbot reply model to Haiku** — the single biggest quality upgrade for the demo, deliberately deferred during the free-tier build. A capable model that actually obeys its grounding is the real fix for "feels dumb" + residual hallucination; it's a ~one-line change (a Haiku-backed reply tier in `src/ai/tiers.ts`), and everything built (grid interpreter, grounding, firewall, concept map) already supports it. (Ties to the existing note about restoring Haiku for the demo.)

## Loose ends

- [ ] Fix the 5 stale `DECISION.md` → `DECISIONS.md` references now that the file is plural: 3 in AGENTS.md (around lines 25, 32, 66) and 2 in LENSES.md (around lines 4, 63).
- [ ] Restart Claude Code to stop the leftover SuperWhisper hook errors (the plugin was de-registered this session, but its hooks stay loaded until a restart).
- [ ] Optional: delete `/Applications/superwhisper.app` and the now-orphaned SuperWhisper plugin cache dirs (`~/.claude/plugins/cache/superwhisper`, `~/.claude/plugins/marketplaces/superwhisper`) if you're truly done with it.
- [ ] **Reconcile the demo brand data.** The anonymized business-facts doc lists brands the demo has NO inventory of (Honda/Hyundai/Kia…), while the actual inventory has brands not in that list (e.g. Ford/Mitsubishi). This mismatch softens the anti-hallucination make-firewall and can confuse Rebi. Align the facts brand list with the real inventory brands.
- [ ] Note: the make-firewall is **best-effort on free models** (the price firewall is the reliable part); the proper anti-hallucination fix is the Haiku flip above.

---

# Added 2026-07-26 — Sanity Studio, agent tooling, and the dealer-side entry tool

## Agent tooling — Sanity MCP

- [ ] **Install the Sanity plugin in Claude Code:** `/plugin install sanity@claude-plugins-official` — bundles the MCP server *plus* agent skills and slash commands. (`npx sanity@latest mcp configure` wires up Cursor/VS Code/Claude Code but skips the skills.)
- [ ] The local `@sanity/mcp-server` package is **deprecated, repo archived**. Hosted `https://mcp.sanity.io` is current — ignore any tutorial saying `npm install @sanity/mcp-server`.
- [ ] Most of the ~35 tools are content ops and won't write Studio code. The ones that help with schema work: `search_docs`, `read_docs`, `list_sanity_rules` / `get_sanity_rules`, `get_schema` (returns the **deployed** schema).
- [ ] No-auth alternative: `sanity.io/docs/llms.txt` as an index, `.md` appended to any docs URL for clean markdown. Pin a couple into `AGENTS.md` — training data still skews to the Studio v2 form API, which is the usual failure mode here.
- [ ] AI credits are consumed only by `generate_image`, `transform_image`, and `create_version` **with** an `instruction`. Everything else is a plain API call.

## Sanity Studio UX — the "add a new listing" form

> Highly malleable. Three tiers — most of the win is tier 1, which needs no React.

- [ ] **Tier 1 — schema config only. Best value/effort:**
  - `groups` → document tabs (Details / Specs / Media / Pricing / SEO)
  - `fieldsets` + `options: {collapsible, collapsed, columns}` → collapsible sections
  - `hidden` / `readOnly` as **functions** → conditional fields that appear as the editor types
  - `options.list`, `layout: 'radio' | 'grid' | 'tags'`, `initialValue`, per-field `validation` messages
  - **`preview` with `select` / `prepare`** → makes the listing index scannable. Small change, big daily payoff.
- [ ] **Tier 2 — Form Components API.** `components: {input, field, item, preview}` per-field, or globally via `form.components`. Wrap with **`renderDefault`**; a full replacement means owning patch handling yourself.
- [ ] **Tier 3 — split-pane live preview** via `structureTool` + `S.view.component()`. Plus custom document actions ("Mark as sold", "Duplicate as draft") and status badges.
- [ ] **Add the economy / L-100km field** — closes the "Fuel-economy data gap" under *Later / product direction*, so Rebi can answer running-cost questions instead of declining.

### Rebi inside Studio (only if an editor-facing assistant is wanted)

- [ ] Three placements: **custom tool** (`tools: []`, top-level nav), **document inspector** (right-hand panel), or **structure view pane**. The two document-scoped ones read the open listing via `useFormValue` and write back via `patch` — "draft a description from these specs".
- [ ] Gotchas: Worker CORS must allow `*.sanity.studio` / `sanity.io`, not just the public site; check CSP if iframing; App SDK apps inherit Sanity auth but the Worker won't know the user.
- [ ] **Different brain, same plumbing.** Rebi's KB answers buyer questions; an editor assistant wants schema awareness and copy conventions. Check whether Sanity's Agent Actions / Content Agent covers it natively first.

## ⭐ Dealer-side — listing creation from photo + voice (new product thread)

> Separate surface from Rebi: **Rebi is visitor-facing, this is dealer-facing entry.**
> Goal: a dealer with a paper spec sheet never types a custom field again.
> Sequencing: a *post-100%* thread — not a distraction from the continuity journey.

**Mental-model correction:** Claude Code isn't logging into the dashboard. It calls the Sanity API with a token (`create_documents` via MCP, or `@sanity/client`). No browser automation to replicate — the dealer tool is just a thinner client over the same call.

### Pipeline

`photo and/or voice → extraction → draft → dealer review → publish`

- [ ] **Generate the extraction contract from the schema.** `sanity schema extract` → `schema.json`, copied into the tool's repo (which doesn't need the `sanity` package). Use it as the contract, or convert to a tool-use `input_schema` so output shape is guaranteed. Re-run on schema change — no parallel field list to maintain.
- [ ] **Draft-only, never publish direct.** `create_documents` defaults to `drafts.*`; keep it. Review form → dealer corrects → publishes. Skip this and it will eventually claim 1,870,000 km and lose their trust permanently.
- [ ] **Validate against the schema before create**, so errors land in the review UI, not inside Studio later.
- [ ] **Resolve references, never invent them** — the model can't make up `_ref` IDs. GROQ lookup with fuzzy match, plus a "create new?" prompt on no match.
- [ ] **Separate image-upload step** for the actual car photos.
- [ ] **Write token lives in the Worker**, scoped to the listings dataset only. Never client-side.

### Photo path (easier than voice, not harder)

- [ ] **⭐ Rego/VIN → authoritative API is the big architectural win.** Extract one alphanumeric string (trivially reliable), then hit RedBook — authorised NEVDIS broker: Plate→VIN, Vehicle Details, Build/Compliance date, Vehicle Age, Registration Status, Written Off History, Stolen Check. Their VIN lookup returns OEM factory spec incl. variant and factory-fitted options (most brands 2010+). MotorWeb is the alternative broker. Reference price seen elsewhere: ~AU$0.65/lookup.
  - Shrinks the model's job to **one string + what no database knows**: price, odometer, condition, service history, respray colour.
  - Written-off / stolen status is a trust signal worth surfacing on public listings.
- [ ] **Don't OCR-then-parse.** Layout carries meaning on a spec sheet — a value means something because of the label beside it. Image straight to a vision model.
- [ ] **Frontier model not required.** Printed sheets are fine on Haiku/Flash/mini-class. The hard cases are handwriting, glare/angle, dense multi-column tables, unlabeled values — judgement, not reading. ~1–2k tokens per page, fractions of a cent: **route by accuracy need, not price**.
- [ ] **Route cheap → escalate** on low confidence or failed validation. The Hermes pattern, already built.
- [ ] **Bake-off before deciding:** ~20 real dealer sheets, 2–3 models, field-level accuracy. Settles the frontier question in an afternoon.
- [ ] **Capture UI is the real accuracy lever**, not model choice: guide frame, blur detection, retake prompt, multi-page.

### Voice path (complements the photo, doesn't replace it)

- [ ] **Best version is both:** sheet for the facts, ~30s voice for what's only in the dealer's head — "one owner, full books, small dent rear quarter, tyres near new". One extraction call, both inputs.
- [ ] Web Speech API is free but weak on exactly the vocabulary that matters (SR5, dual cab, rego, VIN, spoken numbers). Whisper or Deepgram, with a vocabulary hint seeded from existing makes/models via one GROQ query.

### Where it ships

- [ ] **Probably a standalone PWA (Astro + Cloudflare Worker), not a Sanity app.** The dealer is in the yard on a phone; Studio and Dashboard are both desktop-first. The PWA also handles car-photo capture in the same flow.
- [ ] Optional later: same core as a Dashboard app via App SDK — `npx sanity@latest init --template app-quickstart`, deploy with `sanity deploy`. Needs org admin/Developer; CI needs an org-level robot token with **Manage SDK Apps** (not creatable via CLI).
- [ ] **Build extraction as a shared module**, not baked into either surface.

### Why it matters commercially

"Dictate or photograph your inventory" is concrete and demonstrable to a Bundaberg dealer — a far easier sell than "AI-powered CMS". Fits the RebirthAI direction; a natural second product alongside the extracted chatbot kernel.

---

## Later / product direction

- **Buyer-safe "selling points" path:** a curated listing field (or a reply scrub) so Rebi can use dealer selling points without ever exposing the raw, private `dealerNotes` (deliberately deferred from chat v1).
- **Extract the chatbot kernel** — the framework-agnostic core + a pluggable grounding interface — into its own clean repo. That's the reusable product, not the whole dealership site.
- **The big vision:** a "plug into any website" AI helper that navigates large sites and answers questions about specific parts. The grounding source swaps from the Sanity catalog to website content — via a structural site-map index (page/section → short summary the AI walks) and/or semantic RAG, with delta-refresh on change. Possible moat: also make authoring AI-ready content tags effortless (a CMS pattern), so new content ships AI-findable by default.
- **Refine grounding precision** (small follow-up): on a "type it to Rebi" refine, gate the inventory live-lookup under the search focus so Rebi's comment grounds strictly on the on-screen set, not the message's own terms.
- **Fuel-economy data gap:** there is no economy/L-100km field on listings, so Rebi honestly declines running-cost questions. If dealers want it answered, add an economy field to the listing schema. *(See the schema task under "Sanity Studio UX" above.)*
- **Full tool-calling agentic search** (the bolder contest option, deferred): Rebi as an agent with `search_inventory`/`get_listing` tools on a capable paid model → anti-hallucination "by construction" (the model can only speak from real tool results). The richer version of the chat-drives-the-page runway; needs the paid model + tool-calling support added to the `src/ai/` layer.
- **Experience Mode (flagship "the chatbot IS the website"):** an opt-in premium mode where the AI navigator is the primary way to move through the site and the screen is a canvas the bot drives — "let me put that on the display now" → the page/grid/comparison appears. First-time visitors get a short onboarding (~5s clip/animation) explaining how to use it, with a frictionless **opt-out to the standard browsable site**; then a standby screen where a named, characterful **navigator** greets them and takes requests. Framed as fun/discovery ("what will you find?") rather than pure utility — a memorable, brandable experience best suited to big brands. **A dial, not a binary:** the normal browsable site stays underneath as the accessibility + SEO floor. Remember returning visitors and prior opt-outs (never re-onboard). Prototype the onboarding → standby → "boom" flow cheaply and test with ~5 real users early, since the delight-vs-annoyance line is thin and personal. Built on the same priming-seam + entry-points engine, dialled all the way up.
  - **Experience Mode runway (deferred from the priming-seam contest, 2026-07-24)** — building blocks the contest surfaced as the path from the basic chatbot to Experience Mode; deferred out of the per-listing v1 as too big/risky for a first slice, to land here later:
    - **AI-speaks-first opening** — Rebi generates a bespoke, *streamed* greeting about the specific car/context on open (vs the v1 canned "name the car" line). Needs a server-side "open" path that builds the model turn without a visitor message + ai-only persistence; watch the pitfalls the contest flagged: latency/cost on every open, the 10/hr rate-limit burn, the always-render-greeting duplication, and never firing mid human-handoff.
    - **Server-persisted "journey" (the real continuity engine)** — a D1-backed store that accumulates what the visitor searched / viewed / compared across the site, folded into Rebi's prompt each turn. This is what unlocks genuine cross-tab, returning-visitor, and cross-device continuity (v1's client-side context is per-tab only). Best landed together with the compare + search entry points, where cross-surface continuity actually matters. The v1 focus-injection seam is identical, so this is a source swap (client → server), not a redesign.
    - **URL-addressable primed states** — a chat state you can link to (e.g. `/listings/<slug>#rebi=ask`) that opens Rebi already primed and grounded. Shareable/bookmarkable (a salesperson texts a link that opens Rebi discussing that car); the URL becomes the conversation state — a direct stepping stone to Experience Mode.
    - **Chat-drives-the-page action channel** — Rebi emits whitelisted directives (open a listing, apply a filter to the grid, highlight) that the front-end executes — the core "chat as navigation" primitive. Higher-risk: requires a careful redesign of the streaming first-line marker handling (the contest showed a naive version leaks partial markers to the user and perturbs the `[[ESCALATE]]` buffering); keep it off by default and validate every directive server-side (verbs whitelisted, filters via `parseFilters`).

## ⭐ Milestone — fork a set-in-stone snapshot at 100%

**Once the chatbot pipeline is at 100% — all three entry points built, continuity working, verified and stable — FORK / COPY the repo exactly as it stands to create a frozen, "set in stone" snapshot.**

This gives us a complete, ready-to-go base to branch the "plug into any website" AI-helper product from later. Do this AT that 100% milestone (not before), so the snapshot captures the finished, working chatbot rather than a half-built one.

> Note: this is a full copy/fork of the repo at that point — distinct from the "extract the kernel into its own repo" task above, which is the later cleanup step.


## FUTURE IDEA

Yes — but the tagging shouldn't live in your rendered HTML. That's the instinct worth redirecting, because in-page markup means the bot still has to fetch a page, parse it, and decide what's relevant. All the latency you're trying to avoid is in that step.

What you actually want is **one source of truth that emits three outputs**: the HTML for humans, JSON-LD for external crawlers, and a chunked retrieval index for Reb. Astro's content collections are already the right place for this — you're halfway there.

## 1. Put the tags in the collection schema

```ts
// src/content/config.ts
const services = defineCollection({
  schema: z.object({
    title: z.string(),
    kind: z.enum(['service', 'faq', 'policy', 'process', 'pricing']),
    audience: z.enum(['prospect', 'client', 'technical']).default('prospect'),
    tags: z.array(z.string()),
    // the money field:
    canonicalAnswer: z.string().max(400).optional(),
    triggers: z.array(z.string()).default([]), // phrasings that should hit this
    updated: z.date(),
  }),
});
```

`canonicalAnswer` and `triggers` are what let you skip inference entirely for common questions.

## 2. Chunk at build time, not query time

Write a small integration that walks the collections and emits `/reb-index.json`. Chunk on H2/H3 boundaries, one entry per answer-sized unit — roughly 100–300 words. Each entry gets a stable ID and a deep link:

```json
{
  "id": "pricing/what-does-a-site-cost",
  "url": "https://rebirthwebdesign.com.au/pricing#what-does-a-site-cost",
  "kind": "pricing",
  "tags": ["cost", "quote", "budget"],
  "title": "What does a site cost?",
  "canonicalAnswer": "Most small business sites land between …",
  "body": "…",
  "updated": "2026-07-20"
}
```

The deep link matters: Reb can cite a real anchor rather than "see our pricing page."

Resist tagging *every* bit. Over-chunking is the common failure — you end up with fragments that carry no context and retrieval gets noisier, not sharper.

## 3. Tier the lookup so most queries never reach the model

This is where the "without waiting" comes from:

1. **Exact/normalised match** against `triggers` → return `canonicalAnswer` verbatim. Zero LLM call, single-digit milliseconds.
2. **Vector search** over the index → Cloudflare Vectorize with Workers AI for embeddings, generated at build. For a site your size (probably 100–400 chunks), you could equally ship the vectors as a flat JSON and do cosine similarity in the Worker — no Vectorize bill, no network hop.
3. **Generate** only when neither tier is confident, with the top 3 chunks as context, streamed.

Given Reb already has a comprehensive Q&A set, tier 1 is mostly a data-migration job — move those Q&As into collection entries with `triggers`, so the same content feeds the widget, the FAQ page, and the `FAQPage` JSON-LD.

## 4. Same source, external outputs

From the same build step, generate the `FAQPage` and `Service` JSON-LD blocks, plus an `/llms.txt` markdown mirror if you want it. It costs nothing once the index exists, and it means your on-page markup can never drift from what Reb believes.

The thing that makes this work isn't the markup format — it's that a question is answered by a lookup rather than a reasoning step. Everything above is just plumbing to make that lookup possible.

Want me to sketch the Astro integration that does the chunking and index emit? That's the piece with the most fiddly bits.