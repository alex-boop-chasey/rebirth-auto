# DRAFT — DECISIONS.md entry for the LLM search query planner

> **Why this is a draft, not applied:** the Phase-2 ticket asks to "update DECISIONS.md", but `/auto`
> mode **may never edit `DECISIONS.md`** (a protected guiding doc). Rather than override that guardrail
> autonomously, this is the ready-to-append entry — apply it verbatim (or tell me to) once you're happy.
> Numbered Decision 8 (DECISIONS.md currently ends at Decision 7).

---

## Decision 8 — The hero search is interpreted by an LLM query planner, grounded and disclosed

**The call (2026-08-01):** The plain-English hero search is interpreted by an **LLM "query planner"**
(`src/ai/search/query-planner.ts`) as the **primary** interpreter, replacing the deterministic
regex/synonym extractor on that path. The regex extractor (`extractFilters`) is **retained as the
fallback** — it runs whenever the planner is disabled, has no API key, times out, or fails. The planner
emits a structured **query plan only**; real results always come from the deterministic executor against
real inventory.

**Why:** Regex extraction dropped soft and messy input — the documented failure *"a secondhand vehicle
as a second car for our family"* returned only `seats=[7,8]` (a synonym gap on "secondhand" and no
concept for "second car"), and worse, its partial match short-circuited before any richer interpretation
could run. The hero search is a flagship feature demoed live to dealers, so graceful handling of natural
language is the product, not a nicety. An LLM interprets intent where regex can't; keeping regex as the
fallback means the feature degrades rather than breaks when the model is slow or unavailable.

**The design (contest-decided, owner-signed):** Settled via a 3-agent contest (two blind competing
designs + a critic) and an orchestrator synthesis (`docs/briefs/search-planner-*.md`). Key commitments:

- **Three signal classes, one flat plan.** *Explicit* filters map straight to the FilterState
  projection; *soft* inferences are **applied AND disclosed** in an `inferences[]` array (the shopper's
  words + a speakable line + the exact fields set) so every assumption is a removable, speakable chip;
  *load-bearing ambiguities* set at most **one** `clarification` flag. The planner **never asks** — it
  flags; Rebi asks.
- **Apply-and-disclose over silent-or-interrogate.** Silent inference is magical when right and
  infuriating when wrong; disclosure (undo chips) is what makes aggressive inference safe.
- **Never invent a number.** Lifestyle wording ("cheap", "second car") never fabricates a price ceiling
  — it flags a budget question. (Owner chose *flag, never guess* over a silent config budget band.)
- **Grounding (ties to Decision 6/3):** the model emits filters + an optional keyword only; the
  `interpretation` string is forbidden from asserting stock or counts. No path shows model output as
  inventory.
- **Config-as-data / tenant-ready:** family seat default, low-km threshold, soft-concept phrases, the
  planner timeout, and a kill-switch all live in `dealerConfig` and interpolate into the prompt.

**Family-trap correction:** `familySeats` changed from `[7,8]` to **`[5]`** — a family car, especially a
second car, is overwhelmingly a 5-seater; `[7,8]` is reserved for explicit large-family cues. Shared by
the planner and the regex fallback so both agree. The `chat.search.concepts` family entry (and the
price-inventing first-car/economical entries) were reconciled to the above so the prompt no longer
contradicts itself.

**Cost/latency:** an LLM call now sits on the primary search path (the `structured` tier — Haiku-class
paid + free fallback). Bounded by a config `timeoutMs` (7s) and an `enabled` kill-switch; the regex path
is always the floor. If per-search cost bites, a "concrete-query short-circuit" (regex-first for fully
unambiguous queries) is the obvious lever.

**Status:** Built and merged locally (Phase 2). **Live emit reliability not yet measured** — needs
`OPENROUTER_API_KEY` (absent in the build environment); the eval harness
(`scripts/eval/search-planner-eval.ts`, 15/15 offline schema conformance) runs the live pass-rate the
moment a key is present. **Open follow-ups:** (1) keyword has no grid mechanism yet — the planner
surfaces it but it isn't applied; (2) the SmartSearch inference-**chip** UI (render/remove) is not built
— the response carries the data.
