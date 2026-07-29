# Task brief — Phase 0: Foundation quick wins

You are a sub-agent working in the Rebirth Auto repo (an Astro 7 SSR car-dealership
site deployed as a Cloudflare Worker). Fresh context — this brief is everything you need.
Make FOUR small, low-risk changes. Do not touch anything outside the scope below.

## Stack context you need
- Astro 7 SSR, `@astrojs/cloudflare` v14, Tailwind v4. Components are `.astro` files in `src/components/`.
- **Config as data:** never hardcode a dealer value. Dealer values come from `src/config/dealer.ts` at runtime. These four tasks should not need any dealer literal — if you think you do, stop and note it in your report instead.
- **All AI through `src/ai/`:** task 1 only *re-points a model tier*; it does NOT add any direct provider call.
- Verify your work compiles: `npx astro check` must pass (no NEW errors introduced by you — record the before/after error count).

## Task 1 — Flip chatbot reply model to Haiku
- File: `src/ai/tiers.ts` (and wherever the chatbot reply resolves its capability — likely `src/chatbot/core.ts`; grep for the capability string `chat-cheap`).
- Goal: the buyer-facing chatbot reply should run on a Haiku-backed tier instead of the free `chat-cheap` primary.
- Preferred approach (whichever is cleaner and lowest-risk): either switch the chatbot reply call site's `capability` from `'chat-cheap'` to `'chat-quality'` (that tier is already `['anthropic/claude-haiku-4-5']`), OR prepend `'anthropic/claude-haiku-4-5'` as the primary of `chat-cheap` keeping the free models as fallbacks.
- Keep all fallbacks intact. Do NOT remove the grounding/firewall. Do NOT change temperature/token defaults.
- Leave a one-line comment noting the flip and that fallbacks remain.

## Task 2 — Filter drawer price labels
- File: `src/components/filters/FilterDrawer.astro`.
- The price min/max dropdowns currently label their default option "any / any". Change the default option labels to "min" (for the lower bound) and "max" (for the upper bound). Copy-only — do not change the filter values, params, or `applyFilterUrl` behaviour.

## Task 3 — Filter drawer year dropdowns
- File: `src/components/filters/FilterDrawer.astro`.
- BUG: the year dropdowns currently do not open/populate with years. Diagnose and fix so both year selects render the year options correctly.
- Label the two selects "from" (lower) and "to" (upper).
- Preserve URL/filter behaviour via the existing helper — do not construct filter URLs independently.

## Task 4 — Unify the "Ask Rebi" button
- Files: `src/components/AskRebiButton.astro` (the intended reusable component) and `src/components/CompareTray.astro` (currently renders its own "Ask AI" affordance).
- Goal: the compare tray should use the shared `AskRebiButton` component and read **"Ask Rebi"**, not "Ask AI". If other entry points render bespoke ask buttons, switch them to the shared component too — but only if it's a clean drop-in; if a call site needs behaviour the component doesn't expose, note it in your report rather than forcing it.
- Do not change what the button *does* on click (its wiring to the chat surface) — only unify the component + label + style.

## Scope guardrails — do NOT
- Do not restyle the chatbot overlay, search bar, or hero.
- Do not modify grounding, journey, or the AI provider layer beyond Task 1's tier re-point.
- Do not run any data script, migration, or `--commit`.
- Do not commit — leave changes in the working tree; the orchestrator commits.

## Acceptance criteria (report on each)
1. Chatbot reply now resolves to a Haiku-backed tier; fallbacks intact; exact lines changed.
2. Price defaults read "min"/"max".
3. Year selects populate and open; labelled "from"/"to"; the root cause of the bug named.
4. Compare tray uses shared `AskRebiButton` reading "Ask Rebi"; list any other call sites unified or why not.
5. `npx astro check` — report error count before and after; you must introduce zero new errors.

## Report format
Write a concise report: what you changed (file:line), the year-bug root cause, any call site you chose NOT to unify and why, and the astro check before/after counts.
