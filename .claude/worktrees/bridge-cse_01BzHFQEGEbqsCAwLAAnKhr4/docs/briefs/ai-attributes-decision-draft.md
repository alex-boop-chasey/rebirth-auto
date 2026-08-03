# DRAFT — DECISIONS.md entry for AI-derived shopper attributes (`aiAttributes`)

> **Why this is a draft, not applied:** `/auto` mode **may never edit `DECISIONS.md`**. This is the
> ready-to-append entry — apply it verbatim (or tell me to) once you're happy. Numbered **Decision 9**
> assuming the pending search-planner draft is applied as Decision 8; if not, this becomes Decision 8.

---

## Decision 9 — Soft "what's it good for" attributes are AI-derived from PUBLIC data only, rule-first

**The call (2026-08-02):** Listings carry a new typed object `aiAttributes` with three fixed-enum
shopper dimensions — `runningCost` (low/medium/high), `sizeClass` (compact/medium/large), and
`usageFit` (city/family/highway/towing/tradie/first-car, multi-select). They are **derived by
enrichment**, stored on the document, and used as **search/ranking/filter inputs** for soft queries
("a cheap-to-run city car", "something for towing"). The dealer can **edit any value to override the
AI** — they are not hard `readOnly`.

**Why:** The hero search and Rebi increasingly field lifestyle-shaped queries that the raw `vehicleSpecs`
can't answer directly — "cheap to run", "good first car", "big enough for the family". Rather than
re-infer these on every query from scratch, we compute them once per listing into a small fixed
vocabulary that the deterministic filter/rank layer can match. Fixed enums (not free tags) keep them
usable as URL filter codes, exactly like `vehicleSpecs`.

**Derivation is rule-first, model-only-where-judgment-is-needed:**
- `runningCost` and `sizeClass` are **pure deterministic rules** (EV/hybrid or fuel-economy bands →
  running cost; bodyType + seat count → size class). No model.
- `usageFit` takes deterministic **leans** (ute/4wd → towing/tradie; 7+ seats → family; compact + low
  running cost → city/first-car) and fills genuine judgment calls (e.g. highway) with a `structured`-tier
  model call **constrained to the enum**, validated (off-enum dropped), degrading to rule leans on
  failure.
- **Determinism guard:** anything the rules can't confidently derive is left **unset with a logged
  WARN** — never guessed or defaulted. The dealer sees blanks they can fill, not fabricated data.

**Ties to Decision 6 (private data never reaches a shopper surface — including as a ranking input):**
Because `aiAttributes` feeds shopper-facing search/ranking, enrichment is grounded on the **PUBLIC
projection ONLY**. A single choke point (`buildEnrichmentInput`) assembles a public-only input;
`dealerNotes`, cost, and floor price are never in scope. This is enforced by a test that fails loudly if
a private key ever appears in the enrichment input. The description generator (dealer-facing, dealer
reviews before publish) may still use `dealerNotes`; the two AI calls never share an object holding a
private field.

**Surfacing:** Filters flow **planner/regex → URL → GROQ** and render as **removable chips**, consistent
with the query-planner's apply-and-disclose stance (Decision 8). Decision for now: **AI-only, no visible
drawer facets** — values exist only on enriched listings, so empty facets would be poor UX; revisit
visible facets once coverage is broad. Backfill is a dry-run-default, `--commit`-gated data script that
reuses the same enrichment module.
