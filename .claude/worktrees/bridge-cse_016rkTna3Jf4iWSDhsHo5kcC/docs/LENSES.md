# LENSES.md — Doctrinal thinking

This document holds design lenses — durable ways of looking at the product that shape judgment about
what to build and how. Lenses are distinct from `DECISIONS.md` (which records architectural choices
with their reasoning) and from `AGENTS.md` (which records mechanical rules that must be followed).

A lens is a pattern of thinking that reveals design implications a narrower view would miss. Its job
is to make you *look* somewhere you wouldn't have looked. A lens is not a gate — a good proposal that
appears to cut across one is evaluated on its merits — but "this doesn't fit the lens" is a reason to
think harder, not a shortcut to the conventional answer. If a lens keeps producing insights, it earns
its place; if it keeps foreclosing good ideas, revise or retire it deliberately and say so here.

New lenses are added when a pattern of thinking has been useful across multiple decisions, not on
first sighting. If a candidate lens turns out to be a Decision or a Constraint in disguise, it belongs
in `DECISIONS.md` or `AGENTS.md` instead.

---

## Lens 1 — AI as the interface

The human shopper is the primary user; the AI is the interface by which they interact with the site.
Classic UI (forms, filter drawers, buttons, static tables) exists as fallback and complement, not as
the primary affordance.

The question the lens asks of any surface is: **is there an AI-first version of this that is genuinely
better for the user?** Not AI for its own sake — AI where, in this specific context, it beats the
classic alternative.

This lens applies to both public-facing (shopper) and dealer-facing (Studio) surfaces. It has already
shaped:

- **The classic filter drawer as the manual shopper fallback**, with the AI-first way to search built
  directly into Rebi — describe the car you want in plain English — rather than as a parallel search
  product.
- **One conversation surface, several entry points.** An earlier attempt at a *standalone* hero AI
  search bar — its own separate surface, with its own behaviour and its own answers — was removed.
  Splitting the shopper conversation across two AI surfaces made both worse. What replaced it is a
  single Rebi, reached from several entry points that prime it differently: the hero search input
  (search intent), a per-listing button (this car), the comparison tray (help me choose), and the
  floating widget (open-ended). One persona, one set of guardrails, primed by where the shopper came
  from.
- **The AI-generated listing description button** as the primary dealer copy-writing affordance, with
  manual editing preserved as fallback.
- **The plan to promote Rebi** from a floating chat widget into the primary shopper conversation
  surface, grounded in real inventory.

Applying the lens retroactively to already-shipped classic surfaces is legitimate and often reveals
unbuilt features. The comparison tray, for example, was designed as a classic side-by-side table, but
under this lens it becomes a natural entry point to Rebi — "help me decide between these three." That
kind of retroactive discovery is the lens working as intended.

**Where it doesn't apply.** The lens doesn't demand the answer always be yes. A dealer bulk-uploading
a CSV of forty vehicles is better served by a form-driven flow with AI-assisted validation than by a
conversation. A shopper who just wants to see every ute in stock should get a list. The AI is the
interface; it isn't the only interface, and forcing conversation onto a task that wants a control is
its own kind of bad design.

---

## Adding new lenses

Each new lens should follow the same shape:

- A name that captures the pattern in a few words
- A description of the lens itself — what it asks you to see
- Concrete examples of where it's already visible in the product
- An honest note on scope and edges — what it doesn't demand, where it might not apply