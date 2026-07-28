---
description: Autonomous build mode — work through every outstanding task to completion without stopping; contests are decided up front and judged by the owner at the very end.
argument-hint: [optional scope — a task, feature, or area; omit to work the whole backlog]
---

# /auto — Autonomous build mode

You are operating in **/auto mode**. Work through every task to completion **without stopping for
the owner**. The owner returns when the run is done. The single exception is contest judgments,
which are decided up front and queued to the very end (see §6).

`$ARGUMENTS` is the scope. If empty, the scope is **all outstanding work**: reconcile `docs/todo.md`,
`docs/build-plan.md`, `TODO_KEYS.md`, and any open tickets **against the actual code first** (audit —
never rebuild what is already shipped), then execute everything that remains.

## 1. Authority granted in this mode
These project-doc rules that normally require owner authorization are **lifted** here:
- **Commit autonomously** (overrides AGENTS.md's "one commit per ticket / owner sign-off" gate).
- **Push the working branch** to origin, and integrate to `main` **non-destructively** (fast-forward
  or merge).
- **Run data scripts with `--commit`** once the dry-run diff is clean, deterministic, and WARN-free.
- **Make directional / architectural decisions yourself** wherever the docs do not specify.

## 2. Rules that STILL bind — do NOT break any of these
- Every **other** rule in `AGENTS.md` / `DECISIONS.md` / `LENSES.md`: **config-as-data** (no dealer
  literals outside `src/config/dealer.ts`), **all AI through `src/ai/`**, **determinism** (ambiguous →
  logged WARN, never guess or fabricate data), **filter state only via `applyFilterUrl`**,
  **`dealerNotes` never public**, the data-model rules, and the **light-theme** UI standard.
- **Never `git push --force`** (rewriting shared history). Use `--force-with-lease` only if a rewrite
  is genuinely unavoidable.
- Foundational safety always applies: never enter real credentials, never wire a stub to real spend
  or real PII, never permanently delete data you did not create, never publish/send outside the repo
  as a side effect. External integrations stay **stubbed**.

## 3. Commit-before-decision protocol
**Immediately before any directional decision that would normally require owner sign-off, make a
commit** capturing the current state — a clean checkpoint and audit trail — then make the decision and
proceed. The commit message must name the decision you are about to make (e.g.
`chore(checkpoint): before choosing X approach for Y`). Every autonomous directional call therefore
has a reviewable restore point.

## 4. Missing dependency → stub, never stop
If a task needs something only the owner can provide (API key, token, external account, a write to a
live third party), do **not** stop. Build the **full feature plus a dummy engine that feeds realistic
fake data**, behind an env flag, using the established pattern:
`src/stubs/<service>.ts` exporting the real interface · `useStub = !env.<KEY> || truthy(env.STUB_<X>)`
(auto-stubs until a credential exists) · a `// TODO_KEYS:` marker at every integration point · a row in
`TODO_KEYS.md`. Going live must be **add credential + flip flag, no code change**. Stubs are
deterministic (no `Math.random`, no module-top-level `new Date()`).

## 5. Per-task loop
1. If a directional decision is imminent, commit a checkpoint (§3).
2. Write a scoped brief to `docs/briefs/<slug>.md` → spawn a sub-agent (the harness **Agent** tool,
   not `claude --print`; worktree isolation only when parallel agents mutate files) → review its
   output against §2 → issue a tight fix-brief if it falls short.
3. `npx astro check` must be green. **Verify the change actually renders/behaves** (drive the flow —
   dev server + curl/screenshot — don't just typecheck).
4. **Commit the completed task** with a conventional message.
5. Move to the next task. Do not stop. Mirror substantive progress to the owner's channel if
   configured, but never block on a reply.

## 6. Contests — decide up front, run LAST
**Before starting the run**, review the whole task list and **decide which complex sections genuinely
warrant a sub-agent contest** — a *design* contest for gold-standard UI/UX, a *coding* contest for a
hard or open-ended technical problem. Record the decision in `docs/build-plan.md`. Then:
- Build **everything else first**, autonomously, to completion.
- **Defer the contest-designated features to the very end.** They are the **only** tasks that require
  the human. Run each contest per AGENTS.md (**3 sub-agents, strict sequence**), present the candidates,
  and let the **owner judge** — do **not** self-select the winner for a contest-designated feature.

## 7. Start & finish
On invocation: audit the backlog vs the code, produce/refresh the sequenced plan in
`docs/build-plan.md` **including the up-front contest designations**, commit it, then **execute
without stopping**. When every non-contest task is done: run `astro check`, verify the key pages,
update `docs/BUILD_SUMMARY.md`, commit, push the branch. Then present the queued contest(s) for the
owner's decision — that handoff is the only stop.
