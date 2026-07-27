# LENSES.md — Doctrinal thinking

This document holds design lenses — durable ways of looking at the product that shape judgment
about what to build and how. Lenses are distinct from `DECISIONS.md` (which records architectural
choices with their reasoning) and from `AGENTS.md` (which records mechanical rules that must be
followed).

A lens is a pattern of thinking that reveals design implications a narrower view would miss.
Lenses evolve as understanding of the product evolves. Disagreeing with a lens is legitimate and
does not require special justification — a good proposal that appears to violate a lens should
be evaluated on its merits, not rejected for non-conformance. If a lens keeps producing insights,
it earns its place; if it keeps foreclosing good ideas, it should be revised or retired.

New lenses are added when a pattern of thinking has been useful across multiple decisions, not on
first sighting. If a candidate lens turns out to be a Decision or a Constraint in disguise, it
belongs in `DECISIONS.md` or `AGENTS.md` instead.

---

## Lens 1 — AI as the interface

The human shopper is the primary user; the AI is the interface by which they interact with the
site. Classic UI (forms, filter drawers, buttons, static tables) exists as fallback and
complement, not as the primary affordance.

This lens applies to both public-facing (shopper) and dealer-facing (Studio) surfaces. It has
already shaped:

- The classic filter drawer as the manual shopper fallback, with the AI-first way to search built
  directly into Rebi (the site's AI chat assistant) as a "search intent" entry point — describe
  the car you want in plain English — rather than a separate hero search bar. An earlier standalone
  hero AI search bar was tried and removed in favour of concentrating the shopper conversation in
  one surface.
- The AI-generated listing description button as the primary dealer copy-writing affordance,
  with manual editing preserved as fallback.
- The plan to promote Rebi from its current demo-stub floating chatbot into the primary shopper
  conversation surface, accessible from multiple entry points across the site.

The lens is a source of design ideas, not a gate. Applying it to any surface — including
already-shipped classic surfaces like the comparison tray — is legitimate and often reveals
unbuilt features. The comparison tray, for example, was designed as a classic side-by-side table
but under this lens becomes a natural fourth entry point to Rebi ("help me decide between these
three"). That kind of retroactive discovery is the lens working as intended.

Applying it dogmatically to surfaces where the classic pattern genuinely fits better is not
required. A dealer bulk-uploading a CSV of 40 vehicles, for instance, may be better served by a
form-driven flow with AI-assisted validation than by a conversation. The lens asks "is there an
AI-first version of this?" — it doesn't demand the answer always be yes.

---

## Adding new lenses

Each new lens should follow the same shape:

- A name that captures the pattern in a few words
- A description of the lens itself (what it asks you to see)
- Concrete examples of where it's already visible in the product
- An honest note on scope and edges — what it doesn't demand, where it might not apply

Lenses are added when a pattern of thinking has proven useful across multiple decisions, not on
first sighting. If a candidate lens turns out to be a Decision or a Constraint in disguise, it
belongs in `DECISIONS.md` or `AGENTS.md` instead.