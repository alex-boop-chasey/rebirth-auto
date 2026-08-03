# Brief — Piece 6: aiAttributes backfill script (dry-run default, owner-gated --commit)

You are a sub-agent on the `feat/ai-attributes` branch. Scope: ONE new script,
`scripts/enrich-attributes.ts`, that backfills `aiAttributes` over the real inventory using the SHARED
enrichment module. ONE conventional commit. Touch nothing else.

## Depends on (already built — reuse, do not re-implement)
`src/lib/generate-description/enrich-attributes.ts` exports `buildEnrichmentInput(publicListing)` and
`deriveAttributes(input)` → `{ aiAttributes, sources, warnings }`. Import and use THAT module so the
script and the live endpoint derive attributes identically. Do not copy its logic.

## Model this on `scripts/migrate-details-to-specs.ts` (read it first)
Same shape and discipline:
- `import 'dotenv/config'` → `@sanity/client` with `PUBLIC_SANITY_PROJECT_ID` / `PUBLIC_SANITY_DATASET`
  / `PUBLIC_SANITY_API_VERSION` and a write-enabled `SANITY_TOKEN` (throw if missing, same as the
  reference script).
- **Dry-run by DEFAULT**; only `--commit` writes. Add `--force` to also overwrite already-populated
  `aiAttributes` (default: idempotent — only fill fields that are currently unset).
- Query: `*[_type=="listing" && category=="automotive"]{_id, title, make, model, vehicleSpecs,
  "details": details[]{label,value,valueNumber,valueBoolean,valueDate,valueType}, aiAttributes}`
  — **PUBLIC fields only** (Decision 6; never select `dealerNotes`/cost/floor). Feed each row through
  `buildEnrichmentInput` before `deriveAttributes` so the boundary is enforced at the choke point.
- For each listing: compute derived attributes, and print a per-vehicle **diff table**: `_id`, title,
  each derived value, the **rule-vs-model source** (from `sources`), and any WARN lines (from
  `warnings`). Summarise counts at the end (listings scanned / would-change / fields set / WARN count).
- Idempotency: only set a field when its current `aiAttributes.<field>` is null/undefined (unless
  `--force`).
- Writes patch by **explicit `_id`** only (`client.patch(_id).set({ 'aiAttributes.runningCost': …,
  'aiAttributes.usageFit': …, 'aiAttributes.sizeClass': … })` — set only the fields that were derived;
  never a broad query-match patch, never unset something the rules couldn't derive).

## Constraints (binding)
- **Determinism / never fabricate.** WARNs come straight from the module; the script only reports them.
  A field the module left unset stays unset — do not default it.
- **The model path.** `deriveAttributes` may make a `structured`-tier model call for `usageFit`. In a
  Node script there is no Worker AI runtime configured. Two acceptable options — pick and state which:
  (a) run the script rules-only by having it call a rules-only entry / passing a flag so the model call
  is skipped (backfill then fills the deterministic fields; `usageFit` model judgment is left to the
  live endpoint), OR (b) wire `configureAI(...)` from `.env` `OPENROUTER_API_KEY` if present and let the
  model call run, degrading to rules-only when the key is absent. Prefer (a) unless the module already
  makes the model call trivially runnable from Node — whichever you choose, the dry-run must complete
  WITHOUT a key and print a clean table.
- **`--commit` is OWNER-GATED.** Do NOT run `--commit` yourself. Run the **dry-run only**, confirm the
  table is clean/deterministic/WARN-aware, and hand that output to the orchestrator.

## Verify (DoD)
- `npx astro check` (or `tsc`) clean for the new file.
- Run the DRY-RUN against the real inventory (`.env` is present locally). Paste the diff table + summary
  counts. Confirm re-running is a no-op on already-filled fields (idempotency) — or explain if inventory
  has no `aiAttributes` yet so everything is a first fill.
- Confirm the query selects NO private fields.

## Report back
The script path, which model-path option you chose and why, the dry-run table + counts + any WARNs, and
the astro check result. Commit with a `feat(scripts):` conventional message. Note explicitly that
`--commit` was NOT run (owner-gated).
