# Task brief — Rebi in Sanity Studio (editor assistant, extends the existing generator)

Extend the EXISTING one-shot description generator into a small editor-facing assistant with a
few quick actions, reading the open listing. A distinct "brain" from the visitor-facing Rebi.

## Context (read these)
- `src/sanity/components/GenerateDescriptionInput.tsx` — the existing Studio custom input that
  reads `_id` via `useFormValue` and POSTs `/api/generate-description`.
- `src/pages/api/generate-description.ts` — the endpoint: origin-guarded, reads the draft listing,
  calls the `writing` tier via `~/ai` (Decision 3 — all AI through src/ai/), returns Portable Text.
- `src/lib/generate-description/prompt.ts` — the prompt builder.
- `src/config/dealer.ts` `ai.generateDescription` block — the existing feature flag/config.

## What to build
An assistant that offers, alongside the existing "Generate description", these additional
actions (all through the SAME `writing` tier via `~/ai`, all origin-guarded, all reading the
open listing server-side — NEVER trust client-supplied listing content):
1. **Selling points** — draft 3-5 concise bullet selling points from the listing's specs + details.
2. **Tighten** — take the CURRENT description (read the draft's existing description server-side) and return a tighter, punchier version, same facts (never add specs not in the data — determinism).
3. **Adjust tone** — regenerate the description in a selectable tone from `ai.descriptionVoice` config (reuse existing tone config; do NOT hardcode tones).

Implementation:
- Prefer extending `/api/generate-description.ts` with an `action` field (`'describe' | 'sellingPoints' | 'tighten' | 'tone'`) OR add a sibling `/api/studio-assist.ts` — whichever is cleaner and lower-risk; keep the existing default behaviour intact (an absent `action` = today's "describe"). Reuse the origin guard, rate limit, flag, and the writing tier. Each action gets a focused prompt (extend `prompt.ts`).
- Extend the Studio component (`GenerateDescriptionInput.tsx` or a small sibling used in the same form-footer slot) to surface the actions as buttons with per-action loading/error states. Follow the existing component's patterns (useFormValue, the existing fetch + patch approach). For non-description outputs (selling points), write to a sensible target — e.g. append to the description, or show them for copy — pick the least-surprising and NOTE which.
- **Determinism:** every action must ground ONLY in the listing's real data; never invent specs. Keep `dealerNotes` server-side only (it's already excluded from public projections — the assistant may READ it server-side for context, exactly as generate-description already does, but never surface it verbatim as public copy).
- Note in your report whether Sanity's native Agent Actions / Content Agent would be a better long-term home (the todo asks this) — a short assessment, no need to build on it.

## Stack / rules
- `npx astro check` green (before/after; zero new errors). Config as data (reuse `ai.*`; add a small `ai.studioAssist` flag block in BOTH config objects only if you add a new endpoint/flag). All AI through `~/ai` (never call OpenRouter directly). Origin-guarded like generate-description. Do NOT edit get-env.ts. No Math.random / module-top-level new Date(). Do NOT commit.

## Scope guardrails — do NOT
- Do NOT break the existing "Generate description" behaviour. Do NOT expose dealerNotes as public copy. Do NOT build a full conversational chat in Studio (out of scope — this is quick actions). Do NOT touch the visitor-facing Rebi/grounding.

## Acceptance criteria (report each)
1. Endpoint: how actions are dispatched; existing default preserved; origin guard + flag + writing tier reused.
2. Component: the actions surfaced; where non-description output goes.
3. Determinism: how each action is constrained to real listing data; dealerNotes stays server-side.
4. Native Agent Actions assessment (short).
5. astro check before N / after M (M ≤ N).

## Report format
Concise: files, action-dispatch approach, determinism/dealerNotes handling, the native-vs-custom note, astro check before/after, anything not done.
