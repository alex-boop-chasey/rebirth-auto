---
name: catchup
description: "Orient yourself in the current project before doing any work — find and read every document that defines the project's intent, your role, and the rules you operate under (AGENTS.md, CLAUDE.md, README.md, DECISIONS.md, LENSES.md, docs/, CONTRIBUTING.md, todo/roadmap files), survey the codebase structure, check git state, then report a briefing of what the project is, who you are in it, and the standing constraints. TRIGGERS: '/catchup', 'catch up', 'get up to speed', 'orient yourself', 'read the project docs', 'what is this project', 'refresh your context', 'onboard yourself', arriving in an unfamiliar repo, or resuming work after a break or a context summarization."
---

# /catchup — get up to speed in this project

You have landed in a project. Before you touch anything, find out what it is, who you
are supposed to be in it, and what rules bind you. This skill is that orientation pass.

The output is a **briefing you deliver to the owner**, and — more importantly — a context
window that now actually contains the project's operating instructions.

**This skill makes no edits.** It reads, it reports, it stops. If the briefing surfaces
work to do, propose it and wait.

---

## The one rule that shapes everything else

**Instruction documents get read into THIS session's context, verbatim — never delegated
to a sub-agent.**

A sub-agent that reads AGENTS.md and hands back "it says to delegate work and respect
scope guardrails" has destroyed the thing you needed. Rules bind by their exact wording,
their carve-outs, and their tone. A summary of a constraint is not a constraint.

So: **you** Read the instruction docs. Delegate only *code surveying* — mapping structure,
finding entry points, tracing a subsystem — where a conclusion genuinely is enough.

---

## Step 1 — Find the documents

Sweep the repo for anything that defines intent, role, or rules. Cast wide; these files
go by many names.

```bash
# Root-level and one level down — the usual homes for instruction docs
ls -la

# Every markdown file in the repo, excluding dependency and build noise
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/vendor/*" \
  -not -path "*/.next/*" -not -path "*/target/*" | head -60

# Agent/AI instruction files that aren't markdown
ls -la .cursorrules .cursor/rules .github/copilot-instructions.md \
  .claude/ .agent/ 2>/dev/null
```

What you are hunting for, in rough priority order:

| Priority | Files | What it gives you |
|---|---|---|
| **1. Your marching orders** | `AGENTS.md`, `CLAUDE.md`, `.claude/*.md`, `.cursorrules`, `.github/copilot-instructions.md` | Your role, the constraints, what not to touch |
| **2. Intent & reasoning** | `DECISIONS.md`, `ADR/`, `docs/adr/`, `RFC*`, `ARCHITECTURE.md`, `LENSES.md`, `PRINCIPLES.md` | *Why* the project is the way it is |
| **3. The pitch** | `README.md` (root and per-package) | What it is, how to run it |
| **4. Current state** | `todo.md`, `TODO`, `ROADMAP.md`, `CHANGELOG.md`, `docs/` generally | Where the work actually stands |
| **5. Process** | `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE*`, `docs/workflow*` | How changes are supposed to land |

Note that `CLAUDE.md` is often a **symlink** to `AGENTS.md` (or vice versa) — check with
`ls -la` so you don't read the same file twice and think you found two sources.

Also check for **nested instruction files**: a monorepo may put an `AGENTS.md` or
`README.md` inside each package, and those bind for work in that package.

## Step 2 — Read them, in that priority order

Read **fully**, not by excerpt, in this order:

1. **The agent instruction file first** (`AGENTS.md` / `CLAUDE.md`). It usually tells you
   what else to read and when — follow those pointers. If it says "read X before working,"
   that is now part of this catchup.
2. **Whatever it pointed you at** (decisions, lenses, architecture).
3. **README.md** — root, then any sub-package READMEs for areas you'll likely touch.
4. **Current-state docs** — todo, roadmap, recent changelog entries. Read the *most
   recent* portion carefully; older entries can be skimmed.

Long docs still get read in full. A 500-line AGENTS.md is 500 lines you need. Use
`limit`/`offset` to page through rather than skipping.

While reading, keep an explicit list of:
- **Hard constraints** — things that are correctness bugs to violate
- **Hard stops** — points where you must pause for the owner
- **Scope guardrails** — files/dirs you must not touch
- **Role definition** — are you planning, executing, orchestrating, reviewing?
- **Anything that contradicts your defaults** — these matter most, because your defaults
  will otherwise quietly win

## Step 3 — Orient in the code

Now, and only now, look at the code. You have the map from the docs; this is checking the
terrain. Do it in this order — top to bottom, no jumping around:

**3a — Read `docs/SYSTEM-MAP.md` in full, first.** It is the authoritative map of the
site: every subsystem (app shell, dealer config, listings, filters, Rebi, AI tiers,
compare, capture, auth, saved searches, trade-in, stubs, data scripts, infra, Sanity,
styling, Experience Mode), the cross-cutting audit passes, and the external-dependency
list. It is the single best orientation document in the repo — read it before opening any
source file.

**3b — Read the runtime config, and deploy-integrity-check the triplet as you go.** These
files are small and dense with signal:
- `package.json` — stack, dependencies, and especially the **scripts** section (how to
  build, test, and run).
- Deploy / runtime config: `wrangler.jsonc` (plus `astro.config.*`, `tsconfig.json`,
  `Dockerfile` as present) — bindings, entry point, compat settings.
- `package-lock.json` — the lockfile.
- `.env.example` — the shape of required config (never read secrets from `.env` itself
  unless the task requires it).

  The three deploy-critical files — **`package.json`, `package-lock.json`, and
  `wrangler.jsonc`** — get a fast once-over *together*, not line by line, checking: (1)
  manifest and lockfile in sync (no version drift — the classic cause of `npm ci` deploy
  failures), (2) the deploy config's bindings, entry point, and compat settings match what
  the code and docs describe, and (3) nothing left half-edited by the last session. Note
  any mismatch in the briefing as an open question — **do not fix it here.**

**3c — Get a structural map of the source.** One or two levels deep is usually enough:

```bash
ls -la src/ 2>/dev/null || ls -la app/ lib/ 2>/dev/null
```

If the codebase is large or unfamiliar, delegate this — the one place a sub-agent earns its
keep, because you want the map, not the file dumps:

> Use the **Explore** agent: *"Map the structure of this codebase: the main entry points,
> the major subsystems under src/ and what each is responsible for, where data models and
> shared helpers live, and how the app is built/run/tested. Breadth: medium. Return a
> concise structural map, not file contents."*

**3d — Read in full any file the instruction docs named as a source of truth** (e.g. "X is
the single source of truth for Y"). Those were flagged for a reason.

## Step 4 — Check the live state

```bash
git status
git log --oneline -15
git branch --show-current
```

This tells you what the last session was doing and whether the tree is clean. Uncommitted
changes are a live question: someone was mid-something. Note what's modified — don't
assume it's abandoned, and **never revert or commit it as part of catching up.**

If there's a background dev server pattern documented in the instructions, check whether
one is running rather than starting a second.

## Step 5 — Deliver the briefing

Report to the owner. Be dense; this is a briefing, not an essay. Cover:

**1. What the project is** — two or three sentences. What it does, who it's for, what
stage it's at. Include the commercial/personal stakes if the docs state them.

**2. Stack & deployment** — the runtime facts that will bite you if you get them wrong.
Call out anything the docs explicitly flagged as previously causing bugs.

**3. Your role** — as the docs define it, not as you'd assume. Planner? Executor?
Orchestrator who delegates? What are you allowed to decide alone, and what needs sign-off?

**4. Standing constraints** — the hard rules, as a list. Quote or tightly paraphrase; do
not soften. Include scope guardrails (what not to touch) and every hard stop.

**5. Where the work stands** — current branch, tree state, recent commits, and what the
todo/roadmap says is next.

**6. Open questions** — anything ambiguous, contradictory, or apparently stale in the
docs. Say so plainly rather than resolving it yourself. Two docs that disagree is exactly
the thing to surface.

Then **stop** and ask what to work on. Do not start work off the back of a catchup, even
if the todo file makes the next step look obvious.

---

## Communication

If the project's instructions define a communication protocol — mirroring to another
channel, a required format, a person to notify — **that protocol is now active** and the
briefing itself is the first message that follows it. Keep any out-of-band copy short:
what the project is, your role in one line, where the work stands, and the ask.

## When the project has no instruction docs

Some repos have nothing but a README, or not even that. Don't manufacture ceremony —
report what you *did* find, build the briefing from the code and git history instead, and
say plainly: *"There's no AGENTS.md/CLAUDE.md defining how I should operate here."*

Then offer to write one. A short `AGENTS.md` capturing role, constraints, and gotchas
pays for itself by the second session. Offer — don't write it unasked.

## Notes

- **Re-run this after a context summarization.** Summarized instructions are weakened
  instructions; re-reading the source restores their exact wording.
- **Don't skip the read because you "already know this project."** If the docs aren't in
  the current context window, you don't know it — you're recalling a gist, and gists drop
  carve-outs.
- **Read; do not fix.** You will notice things during catchup — a stale doc, a typo, a
  bug. Note them in the briefing. Fixing them is a separate, approved task.
