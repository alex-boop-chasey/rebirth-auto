# DECISIONS.md — True North & Architecture Decisions

This document records the big directional decisions for Rebirth Auto and — more importantly —
*why* they were made. It's written in plain language, not code, so the project owner (the "ideas
person") can read it any time to confirm the build is still pointed at true north, without needing
to read the code. Any future collaborator, security reviewer, or AI agent should read this first to
understand not just *what* was decided but *why*, so decisions don't get silently reversed by
someone who doesn't know the reasoning.

**This file is the record.** When a major decision is made or changed, it is written here, in full,
with its reasoning and the date. `docs/log.txt` is a running changelog of activity — it is not a
substitute for this document, and a decision that exists only in the log has not been recorded.

**The companion documents:**
- **`VISION.md`** — what the product is trying to become, and why that's worth building
- **`LENSES.md`** — durable ways of looking at the product that shape design judgment
- **`CLAUDE.md`** — the operating rules and hard constraints for Claude Code in this repo

---

## TRUE NORTH (the one-paragraph version)

Rebirth Auto is a world-class car-sales website with AI features as the **core product**, not bolted
on. The near-term goal is to build it as a **single-tenant** site (one dealership — first target:
Bundaberg Motor Group), land that first paying dealer, and prove the product. The long-term goal is
a **multi-tenant SaaS platform** sold to car dealers across Australia for significant upfront fees
plus recurring monthly subscriptions, running as the owner's flagship for the next ~20 years.
Therefore: **build single-tenant now, but keep every door open so the eventual transition to
multi-tenant is an evolution, not a rewrite.** That "keep the doors open" discipline is the north
star. Every decision is checked against it.

---

## Decision 1 — Single-tenant now, multi-tenant-ready, multi-tenant later

**The call:** Build the site to serve one dealership for now, but follow strict conventions so that
converting it to serve many dealerships later is a contained change, not a demolition.

**Why:** The thing that makes this a business is landing the first paying dealer. Building the full
multi-tenant platform before having a single customer would delay revenue to build machinery for a
scale that doesn't exist yet — the classic way solo software founders stall. But building in a way
that *forecloses* multi-tenancy (by hardcoding one dealer's details everywhere) would force an
expensive rewrite later — exactly the "too busy to rebuild" wall the owner wants to avoid.
Single-tenant-but-ready threads that needle: fast to a first sale, no rewrite later.

**What "multi-tenant-ready" concretely means (the conventions we always follow):**
- **Config as data, never hardcoded.** Everything specific to the dealer — name, logo, colours,
  domain, contact details, AI settings, feature toggles — lives in ONE central config object, read
  at runtime. It is never sprinkled through the code as literal values. Today it holds one dealer;
  later it becomes keyed by tenant.
- **No code assumes "the dealer" in a way that can't later take an ID.** Logic refers to "the
  current dealer," resolved from config — not a baked-in name. Today "the current dealer" always
  resolves to the one dealer; later it resolves from the domain.
- **Data is structured so a per-dealer tag can be added later** without restructuring.
- The AI provider layer is already config-driven and feature-scoped, so it's naturally
  tenant-ready.

**Alternatives considered:** Full multi-tenant now — too much machinery before first revenue.
Separate repos per dealer — rejected because it creates an unmanageable deployment-drift problem as
dealer count grows: every security patch, model upgrade and new feature would have to be deployed
into each dealer's separate codebase individually, and those codebases would diverge over time until
they were effectively different products. That destroys the whole economic argument for the
platform, which is that one improvement lifts every dealer at once.

---

## Decision 2 — When we DO go multi-tenant, how dealers' data stays separated

**The call (decided in principle now, not yet built):** One shared database where every piece of
data is tagged with which dealer owns it, and the "only show a dealer their own data" rule is
enforced in ONE mandatory central checkpoint that every data request must pass through — rather than
trusting each feature to remember the rule.

**Why:** A shared, centrally-guarded database is how most successful multi-tenant SaaS platforms are
built, because it lets a small team serve many customers without drowning in per-customer
maintenance — which is the whole point of the platform. The alternative (a fully separate database
per dealer) is safer against leaks but recreates the per-customer maintenance burden at scale.

**The risk and how it is controlled — by structure, not by hope:** The shared model's danger is a
data leak — one dealer seeing another's cars or customer leads, which would be business-ending and
could carry legal weight under Australian privacy law.

1. **One mandatory checkpoint** every data request passes through, so the isolation rule can't be
   accidentally skipped — the safe way is the only way.
2. **Automated tests that actively try to break in** (pretend to be dealer A, attempt to read dealer
   B's data, fail loudly if it ever succeeds) — run on every change.
3. **Tenant identity resolved server-side from the domain**, never trusted from user-supplied input
   that could be tampered with.
4. **A paid human security review before go-live** — see Decision 7 for exactly what triggers it.
   This is a non-negotiable budget line, and the one thing neither the owner nor the AI agents can
   personally catch.

**Status:** Decided in principle. Not built yet (we're single-tenant). Recorded now so the future
transition follows this model rather than being reinvented.

---

## Decision 3 — AI is the core product, and it runs through one provider layer

**The call:** All AI features go through a single internal provider abstraction layer (`src/ai/`).
No feature calls an AI provider directly. Models are chosen per-feature via "capability tiers"
mapped centrally, so swapping or upgrading a model is a one-line change.

**Why:** AI is the differentiator that justifies the price, so it must be built cleanly, not as a
collection of inline calls. Centralising it means: swap models in one place, control costs
per-feature (cheap models for high-volume features, better models for high-value ones), add
fallbacks so a provider outage doesn't break features, and keep the whole thing future-proof as
better models arrive.

**Cost decision:** Routed through OpenRouter, which already reaches every model including top-tier
ones, with consolidated billing. **No direct single-provider integration** — not Anthropic's API,
not OpenAI's, not anyone's. It buys nothing here and costs more. Free-tier models during the build;
paid models switched on when revenue justifies them.

**Note:** Any older document describing a feature as "powered by the Anthropic API key" predates
this decision and is superseded.

---

## Decision 4 — The site is automotive-only

**The call:** The project began as a multi-vertical template (cars + real estate). Real estate has
been fully removed; this is now an automotive-only product.

**Why:** Focus. The flagship is a car-sales platform. The listing data model still uses flexible
structures that *could* support other verticals later, but the product intent is cars.

**On the "any website" future:** `VISION.md` describes a possible later use of the same AI grounding
kernel — pointing it at a law firm, a medical practice, a hospitality group. That is a possible
downstream use, **not a design constraint now and not a reason to generalise anything today.**
Building an abstraction for a customer who doesn't exist yet would make the product worse at cars and
better at nothing. If the kernel turns out to be portable, that will be upside earned by having
built it properly for one vertical first. The dealership platform is the flagship product, not a
stepping stone to something else.

---

## Decision 5 — Build for scale from day one where it's cheap to do so

**The call:** Where building the scalable version now costs little extra, do it now rather than
retrofit later (e.g. server-side filtering with pagination built in from the start, even though
current inventory fits on one page).

**Why:** The owner is not on a deadline and would rather build it right once than rebuild under
pressure once the business is busy. Retrofitting scale-critical things (like pagination) into code
that assumed small scale is exactly the kind of rewrite to avoid. This applies where the extra cost
is small; it does NOT mean over-building speculative machinery for scale that may never come — we
did not build the full multi-tenant platform now (see Decision 1).

---

## Decision 6 — Private dealer data never reaches a shopper-facing surface

**The call:** Anything the dealer holds privately — internal notes (`dealerNotes`), cost or floor
pricing, private condition flags, acquisition detail, and anything else marked private — must never
reach a shopper-facing surface. Not as rendered text. Not in an API response a shopper could read.
Not paraphrased or summarised by Rebi. **Not as an input to ranking, sorting, or recommendation.**

**Why — this is a commercial promise, not just a technical guardrail:** A dealer will only put their
real internal knowledge into the system if they are certain a buyer can never see it. That knowledge
is precisely what makes the AI good — descriptions written from real notes instead of brochure
filler, honest context, accurate answers. If a dealer feels they have to sanitise what they type,
the product loses the one thing that makes it better than a template site. The promise is what earns
the data, and the data is what earns the subscription.

**The subtle failure is ranking, not text.** Private data can leak through behaviour rather than
words. If a car with a thin margin is quietly pushed down the results, a shopper can't read the
floor price — but the ordering exposes it in aggregate to anyone paying attention, including a
competitor. The same applies to AI answers: a model handed private context will paraphrase it under
mild pressure no matter how firmly it was told not to.

**So the rule is exclusion at the source, not instruction at the output:**
- Private fields are excluded from the shared public projection (`LISTING_FIELDS`).
- Shopper-facing AI (Rebi) is grounded on a corpus built **only** from the public projection. Private
  data never enters the corpus, the digest, or the context window on a shopper path.
- Private context is passed only to dealer-facing AI features (description generation, Studio tools)
  on dealer-facing paths.
- Ranking, sorting and recommendation inputs are drawn from public fields only.
- A test should attempt to find each private field in shopper-facing output and fail loudly if it
  ever appears.

**Status:** Partly enforced (`dealerNotes` is excluded from `LISTING_FIELDS`). The broader rule —
pricing, ranking inputs, and the Rebi grounding corpus — needs explicit enforcement and tests.

---

## Decision 7 — What triggers the paid human security review

**The call:** The paid human security review is triggered by **whichever comes first**:

**(a)** the platform serving more than one dealer from shared infrastructure, **or**
**(b)** real customer personal information entering any system an AI can read.

**Why:** The original gate was multi-tenancy alone. But `VISION.md` plans for Rebi to eventually
reach the dealer's service history and customer records, and to remember returning shoppers — and
either of those could land while the platform is still single-tenant. Customer personal information
sitting inside an AI-reachable corpus is arguably a larger exposure than multi-tenancy: it sits
behind a shopper-facing surface anyone on the internet can reach, and it sits inside a system that
can be talked into repeating what it was given. Tying the review to tenancy alone means the riskier
of the two changes could ship completely ungated.

**Also unresolved, and needing its own decision before it is built:** "the returning shopper is
remembered" is a data-retention product, not just a nice touch. Before it is built we need an
explicit position on what is stored, for how long, on what basis, how a shopper turns it off, and how
it is deleted on request. Under Australian privacy law those are not optional details. This is
flagged here so it doesn't get built as a side-effect of a chat-memory feature.

**Status:** Decided. Neither trigger has been reached. No customer records or service history are in
the system today.

---

## Decision 8 — "What's it good for" shopper attributes are AI-derived from public data, and stay behind the scenes

**The call (2026-08-02):** Every listing carries a small set of soft, plain-English attributes —
`runningCost` (cheap / medium / expensive to run), `sizeClass` (small / medium / large), and
`usageFit` (city, family, highway, towing, tradie, first-car — a car can be several). They are
**derived once per listing** and stored on the car, so that lifestyle-shaped searches like "a cheap
little first car for the city" or "something for towing" actually match real inventory. The dealer can
**edit any value to override the AI** — nothing is locked.

**They are not shown to shoppers as filters.** These attributes exist to power search and Rebi's
matching behind the scenes; they are deliberately **not** rendered as visible tick-box facets. Coverage
is partial (many cars won't have every attribute), so visible half-empty filters would read as broken.
The soft query is understood from the shopper's own words and matched against the stored attributes;
removable "what you searched for" chips disclose what was applied. Visible facets can be revisited once
coverage is broad.

**How each attribute is derived — real data first, judgement only where needed:**
- **`sizeClass` is a pure rule** — body type (plus seat count) maps deterministically to a size. No AI.
- **`runningCost` is rule-first, with an AI fallback.** If the car is electric/hybrid, or has a real
  measured fuel-economy figure, that decides it — a measured fact always wins. **Only when there is no
  measured figure** does a model judge cheap/medium/expensive from the public make, model, engine and
  body — the same knowledge a good salesperson has. The model must **abstain** (leave it blank) when it
  genuinely can't tell; it is never allowed to invent a value. This judgement is folded into the same
  single AI call that handles `usageFit`, so there is no extra round-trip.
- **`usageFit` is rule leans plus AI judgement** — confident deterministic leans (a 4wd ute → towing +
  tradie; 7 seats → family; a cheap compact → city + first car), refined by the model for the genuine
  judgement calls (e.g. "highway"), constrained to the six codes and dropped if off-list.
- **Determinism guard:** anything that can't be confidently derived — including a running cost the model
  abstains on — is left **blank with a logged warning**, never guessed. The dealer sees a blank they can
  fill, not a fabricated label.

**Ties to Decision 6 (private data never reaches a shopper surface — including as a ranking input):**
Because these attributes feed shopper-facing search, the AI that derives them is fed the **public data
only**. A single choke point assembles a public-only input; `dealerNotes`, cost, and floor price are
never in scope, and a test fails loudly if a private field ever appears in that input. The dealer-facing
description generator may still use private notes — but the two AI calls never share an object that holds
a private field.

**Models:** all of this runs through the shared AI layer on the current free models. When the platform
moves to the Anthropic API, that is a configuration change in the model layer (which already assigns a
model per task), not a rewrite of this feature.

**Backfill:** a dry-run-by-default, `--commit`-gated data script fills these attributes across existing
inventory using the exact same derivation module, so the script and the live "Generate description"
button always agree. It patches explicit document IDs, only fills blanks, and never writes a value the
rules or model left unset.

**Status:** Decided and built. Backfill is dry-run-verified and awaiting an owner-approved `--commit`.

---

## How we keep pointing at true north

- **This document** records the decisions and reasoning so intent survives across time and across
  many work sessions.
- **`CLAUDE.md`** carries the operating rules and hard constraints for Claude Code — so every session
  starts already knowing them, and so sub-agents can't miss a constraint the orchestrator forgot to
  mention.
- **Enforcement in code** (a lint rule or test) should fail the build if dealer-specific values are
  hardcoded outside the central config, and if any private field appears in shopper-facing output.
  Structure beats memory.
- **Periodic audits** — occasionally a task should audit the codebase against these conventions and
  report any drift. Audit records are append-only (see `CLAUDE.md`).

---

## Working method (how this project is built)

- **The owner** is the ideas and business person, not a coder. They make the high-level
  business-shaped and architectural decisions. They do not read or write code. They sign off on every
  major decision, every contest outcome, and anything irreversible before it proceeds.

- **The planning surface** (the Claude.ai project, where `VISION.md`, `DECISIONS.md`, `LENSES.md` and
  `CLAUDE.md` live alongside the owner) turns the owner's decisions into architecture and into
  written tickets — plain language for the owner, precise instructions for the coding agent. This is
  where genuinely competitive design decisions get made, because it's the surface with the most
  context on intent and the least on implementation detail.

- **The orchestrator** (the main Claude Code CLI session) executes tickets. It plans the work,
  delegates **all** coding to sub-agents, and reviews and integrates their output. It never writes
  application code itself — that keeps its context sharp for judgment and review, and lets several
  sub-agents work in parallel. When a ticket arrives already specified, the orchestrator implements
  it rather than quietly re-planning it; if it disagrees with the plan, it says so and brings it back
  to the owner rather than silently substituting its own.

- **Sub-agents** (background Claude Code sessions) do all the actual coding, under precisely scoped
  task briefs. They do not make architectural decisions.

- **Guardrails:** two-phase tickets (investigate and propose, stop for approval, then execute); dry
  runs before any data write; deletions and patches target explicit document IDs, never a broad query
  match; determinism over guessing — anything ambiguous is logged as a warning, never silently
  defaulted.

Because the owner cannot personally review the code, correctness is not protected by review. It is
protected by **structure**: enforced guardrails, two-phase tickets, automated tests that try to break
the rules, and — for anything holding real dealer or customer data (see Decision 7) — a paid human
expert review before go-live. Any change that weakens one of those structures is a bigger decision
than it looks, and belongs in this document.