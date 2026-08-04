# /catchup — get up to speed in this project, fast

You have been invoked deliberately by the owner at the start of a session. Your job is to
orient quickly — read the small, load-bearing things in full, note where everything
else lives, report where the project stands, and then stop and wait for a ticket.

This is a command the owner runs on purpose. It is not a background refresh. Do the pass
once, now, and do not repeat it later in the session unless the owner invokes it again.

This command makes no edits. It reads, it reports, it stops. If the briefing surfaces
work to do, name it and wait — do not start it.

---

## The one rule that shapes everything else

**Instruction documents get read into THIS session's context, verbatim — never delegated
to a sub-agent.**

A sub-agent that reads the instruction file and hands back "it says to delegate work and
respect scope guardrails" has destroyed the thing you needed. Rules bind by their exact
wording, their carve-outs, and their tone. A summary of a constraint is not a constraint.

So: you read the instruction docs yourself. Delegate only *code surveying* — mapping
structure, tracing a subsystem — where a conclusion genuinely is enough.

---

## The budget principle (why this command is built the way it is)

Catchup deliberately spends context on the few things that are load-bearing — the
instruction file and the live git state — so the working session doesn't waste context
re-deriving them later. It deliberately does not inhale the whole project. Big
reference docs are located, not loaded. After catchup, you read only what the ticket
names.

Concretely, this means a tiered read:

- Read in full, always — because they are small and everything depends on them.
- Locate and note, read on demand — because they are large and only some of them
  matter to any given task. You tell the owner where they are; you read the specific one
  when a ticket calls for it.

Getting this tiering right is the whole point of the command. A catchup that reads all of
SYSTEM-MAP.md and every reference doc on every invocation is the exact context burn the
owner built this command to avoid.

---

## Step 1 — Read in full, always (the load-bearing core)

1. `CLAUDE.md` — the single authoritative instruction file for this repo. Read it
   completely. It defines your role, the hard constraints, the scope guardrails, the
   two-phase ticket discipline, and the commit/push rules. It is the most important thing
   you read all session. If it tells you to read something else *before working*, note
   that — but do not go read those things now; note them for when a ticket needs them
   (see Step 3).

   While reading, keep an explicit running list of:
   - Hard constraints — things that are correctness bugs to violate (e.g. private
     dealer data never reaching shopper-facing surfaces; all AI through src/ai/; config
     as data in `src/config/dealer.ts`).
   - Hard stops — where you must pause for the owner (anything irreversible; pushing;
     --commit data writes).
   - Scope guardrails — what not to touch.
   - Role — you plan and delegate; you do not push without explicit owner approval.
   - Anything that contradicts your defaults — these matter most, because your
     defaults will otherwise quietly win.

2. Git state — small, and tells you what the last session was doing:

   ```
   git status
   git log --oneline -15
   git branch --show-current
   ```

   Uncommitted changes are a live question — someone was mid-something. Note what's
   modified. Never revert, stash, or commit it as part of catching up.

---

## Step 2 — Read the current-state summary (bounded, not the whole file)

Read `docs/REMAINING-WORK.md`, but be disciplined about which parts:

- Read in full: the most recent run-status section at the top (the newest dated
  /auto run block — it tells you what the last working session shipped and what it left
  awaiting owner action), and the numbered outstanding-work sections near the bottom
  (the "Real gaps", "Built but switched off", "Content & data needs you", "Integrations",
  "Infra & deploy", "Bigger / future" lists — these are the actual live to-do state).
- Skip: the older historical /auto run logs in the middle. They are an append-only
  record of past sessions, not current state. Skimming their headings is fine; reading
  them in full is wasted context.

The point is to learn where the work stands right now, not to replay the project's
entire history.

---

## Step 3 — Locate the reference docs (note where they are — do NOT read them now)

These are the large or specialised docs. Do not read them during catchup. Confirm
they exist and note their path and one-line purpose, so that when a ticket needs one you
know exactly where to go. Reading them now is the context burn this command exists to
prevent.

| Doc | Read it only when a ticket touches… |
|---|---|
| docs/SYSTEM-MAP.md | a specific subsystem — then read that subsystem's section, not the whole 50kb+ map |
| docs/DECISIONS.md | an architectural decision or its reasoning |
| docs/LENSES.md | design judgment for a new feature |
| docs/VISION.md | product direction / what the thing is becoming |
| TODO_KEYS.md | switching an integration from stub to live |
| docs/cloudflare-security.md | security headers / CSP / infra hardening |
| docs/dependency-tracking.md | a dependency or lockfile change |
| docs/briefs/ | a feature that has a build spec there |

If CLAUDE.md named a file as a "single source of truth for X," note it here too — read
it in full only when a ticket touches X.

Optionally, get a shallow structural map of the source only if the session is likely
to need it — and if so, delegate it rather than reading file contents yourself:

> Use the Explore agent: *"Map the structure of this codebase: main entry points, the
> major subsystems under src/ and what each does, where data models and shared helpers
> live, and how the app is built/run/tested. Breadth: medium. Return a concise structural
> map, not file contents."*

Skip even this if the owner's likely task is small or already scoped — don't map the whole
tree to fix one file.

---

## Step 4 — Deliver the briefing, then wait

Report to the owner. Be dense; this is a briefing, not an essay. Cover:

1. What the project is — two or three sentences: what it does, who it's for, what
   stage it's at.
2. Stack & deployment — the runtime facts that bite if you get them wrong. Call out
   anything CLAUDE.md flagged as having previously caused bugs (e.g. Cloudflare Worker
   not Pages; the npm lockfile discipline).
3. Your role — as CLAUDE.md defines it, not as you'd assume. What you may decide
   alone, and what needs owner sign-off. State plainly that pushing requires explicit
   owner approval every time.
4. Standing constraints — the hard rules, as a tight list. Quote or closely
   paraphrase; do not soften. Include scope guardrails and every hard stop.
5. Where the work stands — current branch, tree state (clean or with uncommitted
   changes, and what they are), the last run's shipped/awaiting-approval status, and what
   the outstanding-work sections say is next.
6. Open questions — anything ambiguous, contradictory, or apparently stale. Surface
   it; do not resolve it yourself. Two docs disagreeing is exactly the thing to flag.

Then stop. You are now in the wait-for-a-ticket state that CLAUDE.md describes:
oriented, holding the constraints, holding current state — and reading nothing further
until the owner gives you a ticket that names what to read. Do not start work off the back
of a catchup, even if the to-do list makes the next step look obvious.

---

## Communication

If CLAUDE.md defines a communication protocol — mirroring to another channel, a required
format, a person to notify — that protocol is now active, and the briefing is the first
message that follows it. Keep any out-of-band copy short: what the project is, your role
in one line, where the work stands, and the ask.

## Notes

- Re-invoked after a context summarization? Good — summarized instructions are
  weakened instructions, and re-reading CLAUDE.md from source restores its exact
  wording. This is the one time re-running mid-session is correct: when the real
  instructions have dropped out of context.
- Don't skip the read because you "already know this project." If CLAUDE.md isn't in
  the current context window, you don't know it — you're recalling a gist, and gists drop
  carve-outs.
- Read; do not fix. You will notice things during catchup — a stale doc, a typo, a
  bug. Note them in the briefing. Fixing them is a separate, approved task.
