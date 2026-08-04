# Brief — Piece 1: description-generation reasoning-leak fix

You are a sub-agent on the `feat/ai-attributes` branch. Scope is EXACTLY this piece — do not touch
search files, schema, the Studio component, or enrichment. One conventional commit at the end.

## Repo constraints that bite here (from CLAUDE.md — obey)
- **All AI through `src/ai/`.** The endpoint already calls `generate('writing')` via the `~/ai` barrel.
  Do NOT call OpenRouter or a provider directly, and do NOT add a model call for validation — the
  post-validation is PURE STRING CHECKS, not an LLM call.
- **Determinism.** The validator is deterministic pure functions. No randomness, no `Date.now()`.
- **Config as data.** No dealer literals.
- Light-theme UI standard (n/a here, no UI).

## Problem (verified root cause)
`src/pages/api/generate-description.ts` calls `generate('writing')` then `plainTextToPortableText()`
with no output contract in the prompt and no post-validation. The `writing` primary
(`openai/gpt-oss-20b:free`) is reasoning-capable and leaks scratchpad into the published copy:
`"Paragraph 1:"`, word counts, `"We need…"`, `"Let me…"`, etc.

## Do this

### 1. Prompt output contract
In `src/lib/generate-description/prompt.ts` (the `buildSystemPrompt` builder, and the tighten + tone
builders if they exist there), append a hard **OUTPUT CONTRACT** block, verbatim intent:

> Return ONLY the finished description a buyer will read — paragraphs separated by blank lines. No
> reasoning, planning, word counts, self-checks, headings like "Paragraph 1", labels, or any
> commentary before or after.

Match the existing prompt's tone/structure; don't reword the rest of the prompt.

### 2. Deterministic post-validation helper
Add a shared pure helper `looksLikeReasoning(text: string): boolean`. Put it in a small new module
under `src/lib/generate-description/` (e.g. `looks-like-reasoning.ts`) so it can be unit-checked and
reused. Returns `true` (i.e. "this is leaked scratchpad, reject") if **any line** (case-insensitive,
trimmed) starts with any of: `Paragraph`, `Count`, `We need`, `Word count`, `Let me`, `First,`,
`Draft`, `Note:`, `Okay`, `Sure`, or matches `^\d+[.)]\s`; OR the whole text (case-insensitive)
contains `word count`, `~\d+ words` (regex), or `paragraph 1`.

Guard against false positives on legit prose as best the rules allow, but the listed markers are the
contract — implement them exactly. Keep it a pure function.

### 3. Wire into the endpoint
In `src/pages/api/generate-description.ts`, for the description-producing actions (describe / tone /
tighten — whichever the endpoint handles that return generated prose): after `generate(...)`, if
`looksLikeReasoning(content)` → **retry once** (re-call `generate` with the same args). If still bad →
return a graceful `{ error: '<short message>' }` at **HTTP 200** (never publish the scratchpad, never
500). If clean → proceed as today (`plainTextToPortableText`, etc.).

Do NOT change the response shape for the success path beyond what already exists. Do NOT touch the
`describe` action's future enrichment wiring — another piece owns that; just leave the describe action
returning what it returns today plus the validation guard.

### 4. Verify (don't assume)
- Add/adjust a lightweight check that `looksLikeReasoning` returns `true` for each known bad marker
  (`"Paragraph 1: ..."`, `"We need to..."`, `"Let me draft..."`, `"~120 words"`, `"1. First point"`)
  and `false` for a clean two-paragraph description. If the repo has a test runner (check
  `package.json` scripts), add it as a real test file; otherwise inline a `// self-check` you can run
  with `npx tsx` and confirm, then remove the throwaway. State in your report which you did.
- `npx astro check` MUST be 0 errors.

## Report back
- Files changed, the exact marker list implemented, retry+graceful-200 behaviour, how you verified
  `looksLikeReasoning`, and the `astro check` result. Commit with a `fix(ai):` conventional message.
