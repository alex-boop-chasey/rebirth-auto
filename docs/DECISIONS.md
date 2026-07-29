# DECISIONS.md — True North & Architecture Decisions

This document records the big directional decisions for Rebirth Auto and — more
importantly — *why* they were made. It's written in plain language, not code, so the project owner
(the "ideas person") can read it any time to confirm the build is still pointed at true north,
without needing to read the code. Any future collaborator, security reviewer, or AI agent should
read this first to understand not just *what* was decided but *why*, so decisions don't get
silently reversed by someone who doesn't know the reasoning.

When a major decision is made or changed, record it here with its reasoning and the date in
`docs/log.txt` at the repo root.

---

## TRUE NORTH (the one-paragraph version)

Rebirth Auto is a world-class car-sales website with AI features as the **core product**,
not bolted on. The near-term goal is to build it as a **single-tenant** site (one dealership —
first target: Bundaberg Motor Group), land that first paying dealer, and prove the product. The
long-term goal is a **multi-tenant SaaS platform** sold to car dealers across Australia for
significant upfront fees plus recurring monthly subscriptions, running as the owner's flagship for
the next ~20 years. Therefore: **build single-tenant now, but keep every door open so the eventual
transition to multi-tenant is an evolution, not a rewrite.** That "keep the doors open" discipline
is the north star. Every decision is checked against it.

---

## Decision 1 — Single-tenant now, multi-tenant-ready, multi-tenant later

**The call:** Build the site to serve one dealership for now, but follow strict conventions so that
converting it to serve many dealerships later is a contained change, not a demolition.

**Why:** The thing that makes this a business is landing the first paying dealer. Building the full
multi-tenant platform before having a single customer would delay revenue to build machinery for a
scale that doesn't exist yet — the classic way solo software founders stall. But building in a way
that *forecloses* multi-tenancy (by hardcoding one dealer's details everywhere) would force an
expensive rewrite later. Single-tenant-but-ready threads that needle: fast to a first sale, no
rewrite later.

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

**Alternatives considered:** Full multi-tenant now (too much before first revenue); separate repos
per dealer (creates an unmanageable deployment-drift problem as dealer count grows).

---

## Decision 2 — When we DO go multi-tenant, how dealers' data stays separated

**The call (decided in principle now, not yet built):** One shared database where every piece of
data is tagged with which dealer owns it, and the isolation rule is enforced in ONE mandatory
central checkpoint that every data request must pass through — rather than trusting each feature to
remember the rule.

**Why:** A shared, centrally-guarded database is how most successful multi-tenant SaaS platforms
are built — it lets a small team serve many customers without drowning in per-customer maintenance.
The alternative (a fully separate database per dealer) is safer against leaks but recreates the
per-customer maintenance burden at scale.

**The risk and how it will be controlled (planned, not yet implemented):**
The shared model's danger is a data leak — one dealer seeing another's cars or customer leads,
which would be business-ending and could carry legal weight under Australian privacy law.
1. One mandatory checkpoint every data request passes through — the safe way is the only way.
2. Automated tests that actively try to break isolation — run on every change.
3. Tenant identity resolved server-side from the domain, never from user-supplied input.
4. A paid human security review before any real dealer customer data flows through a multi-tenant
   version — non-negotiable, and the one thing neither the owner nor AI agents can personally catch.

**Status:** Decided in principle. Not built yet. Recorded now so the future transition follows this
model rather than being reinvented.

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

**Cost decision:** Routed through OpenRouter, which reaches every model with consolidated billing.
No direct single-provider integration — it buys nothing here and costs more. Free-tier models
during the build; paid models switched on when revenue justifies them.

---

## Decision 4 — The site is automotive-only

**The call:** The project began as a multi-vertical template (cars + real estate). Real estate has
been fully removed; this is now an automotive-only product.

**Why:** Focus. The flagship is a car-sales platform. The listing data model still uses flexible
structures that could support other verticals later, but the product intent is cars.

---

## Decision 5 — Build for scale where it's cheap to do so

**The call:** Where building the scalable version now costs little extra, do it now rather than
retrofit later (e.g. server-side filtering with pagination built in from the start, even though
current inventory fits on one page).

**Why:** Retrofitting scale-critical things into code that assumed small scale is exactly the kind
of rewrite to avoid. This applies where the extra cost is small — it does NOT mean over-building
speculative machinery for scale that may never come (we did not build the full multi-tenant
platform now — see Decision 1).

---

## How we keep pointing at true north

- **This document** records decisions and reasoning so intent survives across time and work sessions.
- **`AGENTS.md`** carries the operating rules for Claude Code — roles, conventions, and hard
  constraints — so every session starts already knowing them.
- **Enforcement in code** (a lint rule or test) should fail the build if dealer-specific values are
  hardcoded outside the central config — structure beats memory.
- **Periodic audits** — occasionally a task should audit the codebase against these conventions and
  report any drift.

## Working method

See `AGENTS.md` for the full operating detail. In short: the owner makes business decisions and
signs off on anything significant; the orchestrator plans and delegates **all** coding to
sub-agents (it never writes code itself — that keeps its context sharp for planning and review, and
lets several sub-agents work in parallel); the orchestrator reviews their work and brings decisions
back to the owner before implementing.