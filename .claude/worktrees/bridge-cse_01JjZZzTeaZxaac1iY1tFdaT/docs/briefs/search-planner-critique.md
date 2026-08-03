# Search-planner contest — critic's comparison report

Role: critic only. I propose nothing of my own — no schema, no prompt, no import selection. I judge the
two designs as written against the brief, the real `FilterState`/`parseFilters` contract
(`src/lib/listings-query.ts`), the real `generateObject` mechanics (`src/ai/structured.ts`), and the real
config (`src/config/dealer.ts`). Synthesis and import selection are the orchestrator's job.

Shorthand: **C1** = candidate 1 ("Apply-and-disclose, clarify only the pivot"); **C2** = candidate 2.

---

## Verified facts both were held against

- **`generateObject` transport** (`structured.ts`): `buildStructuredMessages` serializes the Zod schema
  via `z.toJSONSchema(schema)` and injects it as a *separate* system message, so every `.describe()`
  string does reach the model as a JSON-Schema `description`. Both candidates understand this correctly.
- **Retry-once** (`parseStructured` + `buildRepairMessages`): a validation failure is not fatal — the Zod
  error summary (up to 5 lines) is fed back for one repair attempt. This softens, but does not remove,
  the cost of a schema that fails on the first shot.
- **`FilterState`** (`listings-query.ts` L89-105): `bodyType/colour/transmission/fuelType/driveType/
  condition: string[]`, `seats: number[]`, `priceMin/Max`, `yearMin/Max`, `odoMax` are optional
  `number`. `parseFilters` re-validates every code against allowed sets and **silently drops unknowns**
  (`parseMulti`, L111-123); `seats` is filtered to `SEAT_OPTIONS = [2,4,5,7,8]` (L139-146). `bodyType` is
  validated against the *dealer subset* `dealerConfig.inventory.bodyTypes` — today the full 8, so both
  candidates' full-set emit is safe.
- **Config paths**: `lowKmThreshold` (60000) and `familySeats` (`[7,8]`) live at
  `chat.grounding.lookup.*` (dealer.ts L767-773) — i.e. under the *chatbot grounding* feature, **not**
  under `chat.search`. The soft-concept list both prompts interpolate is `chat.search.concepts`
  (L830-855), shape `{phrase, maps}` — both read the real shape.
- The current `chat.search.concepts` **family** entry (L848-851) reads: *"bodyType suv or wagon, and
  seats 7 or 8 when they mention several children."* This is load-bearing for the shared flaws below.

Both designs project cleanly onto the contract and **neither invents a filter field or enum the executor
would drop** (colour omits the `other` sentinel in both — harmless; it is not a nameable request). Both
correctly wrap the contract in planner-level fields and never mutate it. Projection fidelity is a pass
for both.

---

## Axis-by-axis

### 1. Emit reliability on a Haiku-class model (highest weight)

Both schemas are flat, all-keys-required, `[]`/`null` for "unset", `nullable` not `optional` — the right
instincts, and both say so. The differences are in the fine print, and they roughly trade:

**C1-specific risks**
- **`seats` is a literal union** — `z.array(z.union([z.literal(2),z.literal(4),z.literal(5),z.literal(7),
  z.literal(8)]))` (C1 §2). This is the single field most able to *fail one-shot validation*: any
  off-list integer the model reasons its way to (e.g. `[6]` for "six-seater") is a hard Zod error →
  forces the retry. C2's `seats: z.array(z.number().int())` (C2 §2) **cannot** fail on value — the
  executor drops non-`SEAT_OPTIONS` later. On the literal "which validates in one shot" metric, C2's
  seats field is strictly safer; C1's is a stricter *projection* that self-corrects on retry.
- **Redundant `needsClarification` boolean** — C1 carries both `needsClarification: boolean` (§2 L97) and
  `clarification: nullable` (L100) and states the invariant `needsClarification === (clarification !==
  null)` is "enforced by the prompt" (§4 rule 5). A prompt-enforced cross-field invariant is exactly what
  a mid model breaks — and worse, `needsClarification:true` + `clarification:null` **passes Zod** (null is
  valid for a nullable), so it produces an *inconsistent-but-valid* object that never triggers a repair
  and lands a UI gate with no payload. This is a latent runtime bug, not a caught validation error.

**C2-specific risks**
- **`kind` + `noPlanReason` is the same redundant-pair defect** — `kind:'no_plan'` with
  `noPlanReason:null`, or `kind:'search'` with `noPlanReason:'gibberish'`, both pass Zod (§2 L87-88). So
  C2 has one silently-disagreeing pair too. It is *symmetric* with C1: C1 encodes the no-plan axis
  cleanly (single `intent` enum, §2 L86) but the clarification axis redundantly; C2 encodes the
  clarification axis cleanly (single nullable `clarification`) but the no-plan axis redundantly. **Neither
  is cleaner overall on redundant pairs — it is a wash, one each.**
- **`inferences[].fields: z.array(z.string())`** (§2 L72) is unconstrained free strings. Easy to emit,
  but the model can write `"seat count"` or `"budget"` and the UI's `fields → filter-removal` mapping
  breaks silently. C1's `inferences[].field` is a single **enum** of `FilterState` keys (§2 L68) — harder
  to fumble into a bad key, machine-safer.

**Net:** genuinely close. The redundant-pair issue cancels. C1's advantage is the enum-typed inference
field; C2's advantage is the open-int `seats` (no one-shot validation failure) and a marginally leaner
canonical output (see Family trap). I give emit reliability a **thin edge to C2**, driven almost entirely
by the `seats` literal-union being the most likely first-shot failure surface across either schema — but
retry-once blunts even that. Low-confidence edge.

### 2. Signal taxonomy (problem A)

Structurally **identical**: explicit → `filters` (never disclosed), soft → `filters` **and**
`inferences[]`, ambiguity → `clarification`, plan still runs. Both name and defend the line. Both reject
per-signal confidence scores for the same correct reason (a mid model can't calibrate a float; §8 in
both).

The real divergence is *how aggressively soft signals write body type*:
- **C1** maps `family`/`second car` onto `bodyType: [hatchback, suv]` (prompt §3; canonical §7 ex.1). On
  the flagship query this **excludes sedans and wagons** — both common family cars — narrowing recall on
  the exact demo query, mitigated only by the removable chip.
- **C2** deliberately applies *only the almost-always-true part* — `family → seats [5]`, **no body type**
  ("Do NOT force a body type on 'family' alone", prompt §3; thesis §1.2). Broader, more defensible
  restraint; its stated discipline ("apply the part that is never wrong, never the part that is a guess")
  is the sharper articulation of the taxonomy.

Edge on discipline: **C2**. Edge on "shows more working on stage" (two disclosed chips vs one): C1. Call
it **even**, leaning C2 for judgment.

### 3. Clarification policy (problem B)

Both are three-condition gates, both keep a runnable plan alongside the flag, both cap at one, both handle
the contradiction case by widening the contested dimension to `[]`.

- **C1 is the more mechanical gate.** It explicitly calls out that the brief's "badly mis-ranks" is a
  *vibe* and replaces it with a checkable rule: flag **only** when a soft signal *narrows* **price or
  seats** the user didn't state (§4 rule 1), with an explicit priority tie-break (**price > seats**, rule
  2) that C2 lacks. `clarification.topic` is an **enum** (`budget/seats/condition/bodyType/fuelType`, §2
  L78) so the UI can pre-wire quick-reply chips.
- **C2's gate keeps "high mis-rank cost"** (§4 cond. 2) — the vibe the brief warned about — softened only
  by examples. Its `clarification.topic` is a **free snake_case string** (§2 L79): better for session
  de-dupe, worse for rendering (the UI can't switch on an open vocabulary).
- **C2 has an internal inconsistency in the infer-vs-flag line.** Its canonical (§7 ex.1) *flags*
  "second car" budget and refuses to set `priceMax` — but ex.9 "cheap little runabout" *silently applies*
  `priceMax: 25000` from a config band with **no flag**. Applying a hard $25k ceiling to "cheap" is
  precisely the "infuriating when wrong" case its own gate exists to catch (a shopper after a cheap $32k
  SUV is excluded), yet it flags the softer signal and applies the harder one. C1 is more consistent
  here: lifestyle wording *never* invents a price number — it flags (§3 rule 3; ex.10 applies no price).

Both give `topic` + a verbatim-speakable `question`; both let search proceed if ignored. Neither carries
structured *answer options* (e.g. suggested budget bands) — a shared, minor gap.

Edge: **C1** (sharper rule, explicit tie-break, consistent price handling, renderable enum topic).

### 4. Inference transparency (problem C)

Both render "I assumed X" chips from the single response with **no second model call** — the core
requirement — and both keep the disclosure speakable.

- **C1**: `{field: enum, value, basis}`, one entry **per field**. The `field` enum is machine-safe and
  maps to a filter key for chip removal. But its claim to "reuse the existing `DIMENSION_LABELS`/
  `codeLabel` helpers" (§5) is **slightly overstated**: those helpers key on dimension names
  `seatCount/price/year/odometer` (listings-query.ts L300-311), whereas the inference enum emits
  `seats/priceMin/priceMax/yearMin/yearMax/odoMax` — the keys don't line up 1:1, so a small adapter is
  needed. C1 does correctly insist removal re-runs through `applyFilterUrl` (respecting the filter-state
  hard constraint).
- **C2**: `{signal, assumed, fields[]}`, one entry **per phrase**. The `signal` field quotes the
  shopper's own words ("*for our family*") — a genuine UX asset C1 lacks, and the per-phrase grouping
  reads more naturally as disclosure. But `fields[]` is free strings (see axis 1) and inherits the same
  key-mismatch adapter need, less safely.

Edge: **even** — C1 for machine-safety of the field key, C2 for the quoted `signal`. Both satisfy the
no-second-call requirement fully.

### 5. Family trap (problem D)

**Identical, and both correct.** Both change `dealerConfig.chat.grounding.lookup.familySeats` from
`[7,8]` to `[5]`, both keep `[7,8]` for *explicit* large-family cues (several kids / third row /
people-mover / stated 7+) via prompt logic rather than widening the default, both produce `seats:[5]` for
the canonical query, both correctly note `[5]` round-trips through `SEAT_OPTIONS`. Escalation rule is
sound in both.

One coherence nit against **C1**: its prompt rule says `"family" -> bodyType suv/wagon` (§3) but its
canonical example emits `bodyType [hatchback, suv]` attributed to *"second car"* — the prompt and worked
example disagree on the family body mapping. C2's "don't force a body type on family" is internally
consistent. Slight edge **C2** on consistency; the config recommendation itself is a dead heat.

### 6. Failure modes (problem E)

All four cases handled correctly by both, and both respect the grounding rule:
- **Gibberish / zero-vehicle**: C1 `intent: gibberish|non_vehicle`; C2 `kind:no_plan` +
  `noPlanReason:gibberish|not_vehicle`. Both empty filters, both route to chat. Equivalent.
- **Unverifiable make/model (MG4)**: both keep it a *search*, emit `keyword:"mg4"`, assert no stock, let
  the executor return zero-or-more. Both explicitly note the planner cannot know the catalogue. Correct
  and grounding-safe.
- **Contradiction ("new secondhand")**: both leave `condition:[]` (widest, still runs) and raise the one
  clarification. Correct.

**Shared grounding risk worth flagging:** `interpretation` is a free-text field shown to the shopper, and
neither prompt hard-forbids it from *asserting stock* — both describe() it as "what you searched for", and
examples stay safe ("Checking our stock for an MG4" / "Searching stock for an MG4"), but a mid model
could write "we have several red HiLuxes". The anti-hallucination firewall (`verify.ts`) guards *Rebi's
chat replies*, not this search-path `interpretation` string, so it is an **unguarded free-text surface**
in both designs. Low probability, but it is the one place model output could read like an inventory
claim.

### 7. FilterState projection fidelity

Both pass. Both wrap the contract without altering it; both add only planner-level wrapper fields
(`intent/kind`, `keyword`, `inferences`, `clarification`, `interpretation`) that the wiring layer must
strip before `parseFilters`. Neither candidate spells out that only the `filters` sub-object becomes URL
params (via `applyFilterUrl`) and the wrapper is discarded — implied, not stated, in both. C1's literal-
union `seats` is a *stricter* projection (rejects bad values at the schema); C2 leans on the executor's
silent-drop. Both valid. **Even.**

### 8. Prompt quality

Both are under ~800 tokens (C1 ≈740 est. incl. `{{softConcepts}}`; C2 ≈550 — more headroom), both carry
the taxonomy + clarification gate + no-plan escape explicitly, both use `{{placeholders}}` correctly for
`dealerName`, `familySeats`, `lowKmThreshold`, and the interpolated concept list. Neither infers policy
from vibes.

- **C1** hardcodes concept-level English mappings in the template itself — `"second car"/"runabout"/
  "daily" -> hatchback/suv` and `"family" -> suv/wagon` (§3) — which is buyer-language that arguably
  belongs in `{{softConcepts}}` (tenant-readiness), *and* it duplicates/partly contradicts the
  interpolated concepts (see shared flaws). Also the fuller prompt sits closer to the ceiling.
- **C2** keeps its universal rules lighter and more headroom, but also hardcodes some mappings inline.

Edge: **C2**, narrowly (headroom + less template/concept duplication).

---

## Shared flaws (highest-priority for the synthesiser)

1. **The `{{softConcepts}}` / config `concepts` conflict with the new family rule — neither candidate
   caught it.** Both prompts interpolate `chat.search.concepts` verbatim, whose family entry (dealer.ts
   L848-851) still says *"bodyType suv or wagon, and seats 7 or 8 when they mention several children."*
   Both then add a hardcoded universal rule saying family → `[5]` seats (and C2: don't force a body).
   **The model receives two directly contradictory family instructions in one prompt.** The family-trap
   fix is incomplete in both: changing `familySeats` to `[5]` without also editing the `concepts` family
   entry leaves the interpolated text fighting the fix. This must be fixed in synthesis.
2. **Redundant-field pairs that pass Zod while self-contradicting.** C1's `needsClarification`↔
   `clarification`, and C2's `kind`↔`noPlanReason`, can each be emitted in an inconsistent state that
   *validates* (so no repair fires) and produces a latent UI/routing bug. One offender each; the winning
   schema should collapse *both* redundant axes to single derived fields.
3. **Inference `field(s)` → chip-helper key mismatch.** Both emit inference keys (`seats`, `priceMin`,
   `priceMax`, `yearMin`, …) that don't line up 1:1 with the existing `DIMENSION_LABELS`/`activeChips`
   dimension names (`seatCount`, `price`, `year`, `odometer`). Both slightly overstate "reuses the
   existing chip helpers"; a small adapter is required either way.
4. **`interpretation` is an unguarded free-text surface** on the search path — outside the `verify.ts`
   firewall — and neither prompt hard-forbids it from asserting stock.
5. **Config-location hygiene.** Both pull `lowKmThreshold`/`familySeats` from `chat.grounding.lookup.*`
   (the *chatbot* feature) into the *search* feature. It works, but neither flags that the search planner
   is reaching across feature blocks for its tunables.
6. **Neither offers structured clarification answer options** (e.g. suggested budget bands) — only
   `topic` + `question`. Rebi can still ask, but the UI can't render typed quick-replies without a
   convention layered on top.

---

## Comparison table

| Axis | C1 | C2 | Winner |
|---|---|---|---|
| **Emit reliability** (highest weight) | Enum inference `field` (safe); but literal-union `seats` can fail one-shot, + redundant `needsClarification` bool | Open-int `seats` never fails; single nullable `clarification`; but free-string `fields[]` + redundant `kind`/`noPlanReason` | **C2 (thin)** |
| **Signal taxonomy (A)** | Same 3-channel; forces `bodyType[hatchback,suv]` on family (over-narrows) | Same 3-channel; applies only seats on family, no body (sharper discipline) | **Even / lean C2** |
| **Clarification policy (B)** | Mechanical: narrow to price/seats, explicit price>seats tie-break, enum topic, consistent | "High mis-rank cost" vibe retained; free-string topic; cheap→apply vs second-car→flag inconsistency | **C1** |
| **Inference transparency (C)** | Enum field (machine-safe); no quoted phrase; overstates helper reuse | Quotes shopper's `signal` (UX asset); free-string `fields[]` looser | **Even** |
| **Family trap (D)** | `[7,8]→[5]`, escalation sound; prompt vs example disagree on family body | `[7,8]→[5]`, escalation sound; internally consistent | **Even / lean C2** |
| **Failure modes (E)** | All four correct, grounding-safe | All four correct, grounding-safe | **Even** |
| **Projection fidelity** | Clean; stricter (literal-union seats) | Clean; leans on executor drop | **Even** |
| **Prompt quality** | Under budget; fuller; template/concept duplication | Under budget; more headroom; leaner | **C2 (narrow)** |

---

## Per-axis winners and overall lean

- **Emit reliability:** C2 (thin — `seats` open-int is the deciding field; retry-once blunts the gap).
- **Signal taxonomy:** even, leaning C2 (restraint on body type).
- **Clarification policy:** C1 (most mechanical rule in either doc; explicit tie-break; consistent).
- **Inference transparency:** even (C1 enum safety vs C2 quoted `signal`).
- **Family trap:** even, leaning C2 (internal consistency).
- **Failure modes:** even.
- **Projection fidelity:** even.
- **Prompt quality:** C2 (narrow).

**Overall lean: a narrow lean to C2, at LOW confidence.** The two designs share an identical taxonomy and
produce near-identical output on the canonical query and all failure cases; the contest is decided in the
fine print, and it is close. C2 edges ahead where the brief weights hardest — one-shot emit reliability
(open-int `seats`, leaner canonical output) — and shows better internal consistency (family body
restraint, no cheap-vs-second-car flag contradiction). But C2's win is not clean: **C1 owns the
clarification policy** (the sharpest, most mechanical gate in either doc, with the explicit price>seats
tie-break and the consistent "never invent a price number" rule) and the **enum-typed inference field**.
These are C1's standout, importable strengths, and a synthesiser choosing C2's schema shape should weigh
pulling C1's clarification narrowing and its enum `field`.

I am genuinely close to even here and flag the low confidence deliberately: pick either schema skeleton
and the result will hinge far more on fixing the **shared** flaws — above all the `concepts`/family-rule
contradiction (#1) and the redundant-field pairs (#2) — than on which base was chosen.
