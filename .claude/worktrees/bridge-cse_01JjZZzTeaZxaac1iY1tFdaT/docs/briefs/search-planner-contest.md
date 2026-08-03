# Contest brief — LLM search query planner (design + working proof)

You are one competitor in a design contest. Your job: propose a **complete, defensible design** for an
LLM "query planner" that turns a shopper's plain-English hero-search input into a structured search
plan, and **prove it holds up** with a schema, a system prompt, and worked examples. You are NOT
writing production code and NOT wiring anything into the app — your entire deliverable is one markdown
design doc (path given in your task message). Do not edit any file under `src/`.

This is a genuinely open-ended design problem. Commit to a coherent position and defend it — do not
hedge across every option. A later session builds from the winning design.

---

## Product context

Rebirth Auto — an AI-native used-car dealership website (single-tenant now; Bundaberg Motor Group is
the first target; multi-tenant SaaS later). The hero search bar is a **flagship, demoed-live-to-dealers
sales feature**: a shopper types plain English, an AI interprets it, and real inventory comes back.
Graceful handling of messy input matters more than benchmark cleverness.

**Today** the extractor is 100% deterministic regex/synonym matching (no LLM). Its known failure — the
case your design must nail — is: **"a secondhand vehicle as a second car for our family"** → the regex
extractor returned ONLY `seats=[7,8]` (triggered by the word "family"), dropping "secondhand" (a
synonym gap) and "second car" (a soft budget signal it has no concept for).

Your planner **replaces** the regex extractor on the search path. The regex extractor is kept only as a
fallback for when the LLM call fails or times out.

---

## The execution contract you must project onto (do NOT change it)

The deterministic executor accepts exactly this `FilterState` (from `parseFilters` in
`src/lib/listings-query.ts` — the same contract as the URL filter params). Your plan's filter fields
must map cleanly onto these; the executor re-validates everything and silently drops unknown codes.

| Field | Type | Allowed values |
|---|---|---|
| `bodyType` | `string[]` | `sedan hatchback suv ute wagon van coupe convertible` |
| `colour` | `string[]` | `white black silver grey blue red green gold brown orange yellow purple` |
| `transmission` | `string[]` | `auto manual` |
| `fuelType` | `string[]` | `petrol diesel hybrid electric lpg` |
| `driveType` | `string[]` | `2wd awd 4wd` |
| `condition` | `string[]` | `new used demo` |
| `seats` | `number[]` | e.g. `[5]`, `[7,8]` |
| `priceMin` / `priceMax` | `number \| null` | AUD |
| `yearMin` / `yearMax` | `number \| null` | build year |
| `odoMax` | `number \| null` | km |
| `keyword` | `string \| null` (optional) | free-text make/model match, e.g. `"hilux"` |

Your query-plan schema **wraps/extends** this — it adds planner-level fields (inference disclosure,
clarification flag, no-plan escape, etc.) around the filter projection. It never alters the filter
contract itself.

---

## The structured-output transport (design for what this can reliably emit)

All AI runs through `src/ai/` via `generateObject(messages, schema)` on the **`structured` capability
tier**. Mechanics you must design within:

- The tier is **Haiku-class primary with a free open model (gemma) as fallback**, `temperature: 0`,
  `maxTokens: 2048`. Assume a **competent-but-not-frontier** model.
- `generateObject` prompts the model to return **ONLY JSON**, strips markdown fences, `JSON.parse`s the
  outermost `{…}`, validates with your **Zod v4** schema, and **retries once** on a validation failure
  (feeding the Zod errors back). There is **NO tool-calling transport.**
- Therefore: design a schema a mid-tier model emits **reliably in one shot** — prefer flat-ish objects,
  **enums / nulls / arrays** over deeply nested optional objects. **Every field gets a `.describe()`** —
  those descriptions are the model's only field-level instructions.
- **One LLM call per search.** No multi-turn planning loop, no chained calls.
- **System prompt budget: under ~800 tokens.** It must carry the reasoning load explicitly — the model
  will not infer policy from vibes.

---

## Hard constraints (design within these — non-negotiable)

1. **Projects onto the FilterState contract above** — wrap/extend, never change it.
2. **`generateObject` / `structured` tier, one call, no tools** — as above.
3. **The planner never asks questions.** If clarification is needed it **FLAGS** it in the output; a
   separate conversation layer (Rebi) asks. Max **one** clarification per query.
4. **Tenant-ready — no dealer-specific values hardcoded** in schema or prompt. Family seat counts,
   low-km thresholds, price bands, etc. are **config values interpolated at runtime** — represent them
   as `{{placeholders}}` in your prompt text (e.g. `{{familySeats}}`, `{{lowKmThreshold}}`,
   `{{dealerName}}`). The available config today includes `familySeats` (currently `[7,8]` — see the
   family trap), `lowKmThreshold` (60000), and dealer identity.
5. **Grounding rule (decision-level):** the LLM **never generates inventory**. It emits only a query
   plan; real results come from the deterministic executor against real stock. No field or flow may
   allow model output to be shown as if it were inventory data. (E.g. the planner must not "suggest
   cars"; it produces filters + a keyword only.)

---

## The design problems your doc must solve (this is the meat — take a position on each)

**A. Signal taxonomy.** Queries carry three classes of signal:
- **Explicit filters** — "diesel", "under 30k", "secondhand", "7 seater" → map directly onto the
  contract.
- **Soft inferences** — "family" → seats/body, "second car" → budget-lean, "first car for my daughter"
  → cheap + safe + small, "tow the boat" → ute/4wd/diesel-lean, "daily driver", "runabout",
  "something reliable". **How are these represented?** Silently applied as filters? Weighted hints? A
  separate `inferences` array with human-readable rationale? Something else?
- **Ambiguities worth asking about** — e.g. "second car": does the shopper mean *cheap* or just
  *additional*? These may warrant a clarification flag.

Decide **exactly how each class flows through your schema.** Name and defend the line. The core tension:
silently applying an inference feels magical when right and infuriating when wrong; asking a question
every time feels dumb. Where is your line, and why is it mechanical rather than vibes?

**B. Clarification policy.** Give **mechanical, predictable rules** for when `needsClarification` is
set. A candidate principle to interrogate (adopt, refine, or reject with reasons): flag only when **(a)**
a soft signal implies a constraint the user didn't state, **AND (b)** getting it wrong would badly
mis-rank results, **AND (c)** one question resolves it. Define the **exact fields** Rebi needs to ask a
good question — a topic? a suggested phrasing? both? — and how the planner still returns a usable plan
alongside the flag (so search can proceed if the shopper ignores the question).

**C. Inference transparency.** Design the schema field(s) that let the UI/Rebi disclose *"I've assumed
X — tell me if that's wrong"* **without a second model call**. Machine-usable enough to render chips,
human-readable enough to speak.

**D. The family trap.** Config currently maps family → `[7,8]` seats. That is **wrong** — a family
second car is far more likely a **5-seat** hatch/SUV than a 7–8 seat people-mover. Recommend the
correct family-signal mapping (this becomes a config change to `familySeats`). Show how your design
produces the right result for the canonical query.

**E. Failure modes.** Define the **non-vehicle / no-plan escape** so the caller can route to normal chat
instead of searching. Stress-test your design against: **gibberish** input; **zero vehicle content**
("what are your opening hours"); an **unverifiable make/model** ("do you have a MG4" — the planner
cannot know the catalogue); **contradictions** ("new secondhand car"). What does the plan look like in
each case?

---

## Deliverable — a single markdown design doc

Write ONLY to the output path given in your task message. Structure:

1. **Design thesis** — 3–6 sentences: your central position on the signal taxonomy and the
   clarify-vs-infer line. What makes this design good for a live dealer demo.
2. **Zod v4 schema** — the full query-plan schema as code, **`.describe()` on every field.** This is
   the contract; make it emittable in one shot by a Haiku-class model.
3. **System prompt** — a fenced template, **under ~800 tokens**, with `{{config placeholders}}` for all
   dealer values. It must teach the model the taxonomy, the clarification rule, and the no-plan escape.
4. **Clarification policy** — numbered, mechanical rules; the exact fields Rebi needs to ask.
5. **Inference transparency** — the field(s) and how the UI consumes them.
6. **Family-trap recommendation** — the proposed `familySeats` mapping and reasoning.
7. **Worked examples (~10)** — `query → exact expected JSON (your schema) → one-line rationale`.
   **MUST include** `"a secondhand vehicle as a second car for our family"` with its exact expected
   output, plus the four failure-mode cases from E and a few clean/messy real ones.
8. **Rejected alternatives** — 3–5 design choices you considered and rejected, one sentence each on why.

Be concrete. Emit real Zod and real JSON, not prose descriptions of them. Your worked examples are your
proof that the schema + prompt actually produce the right plans.
