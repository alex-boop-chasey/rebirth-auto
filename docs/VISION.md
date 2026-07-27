# VISION.md — What we're building and why it matters

This document is the expanded north star for Rebirth Listings Auto. It's written in plain language
so the owner, any collaborator, and any AI agent can read it and understand not just what the
product does, but what it's trying to become and why that matters. Read this before a planning
session to stay aligned with the ambition, not just the constraints.

---

## The one-paragraph version

Rebirth Listings Auto is a world-class car-dealership platform where AI is the core product, not
an afterthought. The near-term goal is to prove the product with one real dealership — Bundaberg
Motor Group — and land them as a paying customer. The long-term goal is a multi-tenant SaaS
platform sold to car dealers across Australia: a significant upfront setup fee plus a recurring
monthly subscription for a service so good it makes the old "build once and forget" web design
model look embarrassing by comparison. This is the owner's flagship product for the next 20 years.

---

## The commercial model

Most web design businesses build a site, hand it over, and move on. The site ages, the dealer
falls behind, and eventually they pay someone else to start over. That model commoditises the
builder and gives the dealer nothing durable.

This platform inverts that. Dealers pay once to get set up on a world-class product, then pay
every month for a service that keeps improving — security updates, model upgrades, new AI
features, performance improvements — without them having to think about it. The dealer gets a
site that gets better over time. The platform owner gets recurring revenue and a growing moat.
The more dealers on the platform, the better the product gets for everyone.

The AI features are what justify the monthly fee. A static brochure site has no reason to charge
ongoing. A platform where AI handles shopper questions, writes listing copy, processes inventory
from a photo, and creates lifelong customers through platinum-level service — that earns its
subscription every month.

---

## What makes it different

**AI is the interface, not a feature bolted on the side.**

Most dealership websites treat AI as a chatbot widget in the corner — a novelty that answers
a few FAQs and hands off to a human. This platform is built on the opposite premise: the AI
is the primary way a shopper interacts with the site. Classic UI (filter drawers, comparison
tables, listing pages) exists as the accessible foundation underneath, but the AI — Rebi — is
the guide, the navigator, the assistant who remembers what you looked at, understands what you
actually want, and helps you find it in plain English.

Rebi isn't a chatbot in the old sense. It's a new kind of interface that hasn't been done well
in the automotive space yet. The design goal is something that feels like a knowledgeable friend
at the dealership — present when you want it, unobtrusive when you don't, genuinely useful rather
than a fancy FAQ machine.

**The AI knows everything the dealership knows.**

Rebi is grounded in real inventory, real business facts, and real dealer knowledge. It can discuss
specific cars in stock, answer running-cost questions, compare models, explain features, surface
vehicles that match what a shopper describes in plain English, and escalate to a real human when
the conversation calls for it. It doesn't hallucinate results — if it can't find it in the actual
inventory, it says so.

Over time, Rebi's knowledge expands: manufacturer websites for new model detail, authoritative
automotive review sources for secondhand buying guidance, and eventually the dealer's own service
history and customer records for a platinum level of post-sale care that builds the kind of
loyalty that keeps customers coming back for their next car.

**The dealer side is just as considered as the shopper side.**

A dealer with a car in the yard should be able to photograph it, say thirty seconds of notes into
their phone, and have a complete draft listing ready to review — specs pulled from the rego or VIN
via authoritative data, description drafted from the dealer's voice notes, photos ready to
sequence. No typing. No looking up specs. No staring at a blank description field.

That's the listing creation tool: a standalone mobile-first PWA that turns the most painful part
of running a dealership website into something that takes two minutes in the yard.

---

## The platform arc

**Now — single tenant, one dealer, prove the product.**
Build the full product for Bundaberg Motor Group. Use their real inventory as demo data. Land them
as a paying customer. Every architectural decision is made to keep the doors open for what comes
next, without over-building machinery for a scale that doesn't exist yet.

**Next — extract and replicate.**
Once the product is proven, the chatbot kernel — the AI grounding framework, the conversation
engine, the escalation system — becomes a reusable module. The platform becomes multi-tenant:
one codebase, one set of updates, many dealers. Each dealer gets their own configured instance;
security updates, model upgrades, and new features ship to all of them at once.

**Later — plug into any website.**
The grounding layer that makes Rebi know a dealership's inventory can be adapted to make an AI
know any website's content. A structural content index replaces the Sanity catalog. The same
conversation engine, the same escalation system, the same architecture — pointed at a law firm,
a medical practice, a hospitality group. That's the bigger product the dealership platform is
a prototype for.

---

## What "world-class" means in practice

Not the most technically complex. Not the most feature-rich. World-class means:

- A shopper can describe what they want in plain English and get real results, not a filter form
- A returning shopper is remembered — Rebi picks up where they left off
- A dealer can create a listing from a photo and thirty seconds of voice in under two minutes
- The site is faster, more secure, and more capable six months from now than it is today
- A dealer never has to think about hosting, updates, or maintenance — it just works
- The AI never embarrasses the dealer by making things up or going off-script

The benchmark isn't other dealership websites. It's what a shopper would experience if they had
a brilliant, knowledgeable friend who happened to know everything about that dealership's inventory.

---

## The design principle behind every AI decision

When faced with a choice about where AI fits into a feature, the question is always:
**"Is there an AI-first version of this that's genuinely better for the user?"**

Not AI for its own sake. Not AI because it's trendy. AI because in this context — helping someone
find the right car, helping a dealer capture inventory, helping a service customer track their
history — the AI-first version is meaningfully better than the classic alternative.

Where it isn't better (a dealer bulk-uploading a CSV, a shopper who just wants to see all the
utes), the classic pattern stays. The AI is the interface; it's not the only interface.

---

## The north star check

Before any significant decision — architectural, product, commercial — ask:

1. Does this keep the doors open for multi-tenant, or does it foreclose it?
2. Does this make Rebi more useful to a real shopper, or is it complexity for its own sake?
3. Does this make the dealer's life easier, or does it add work?
4. Does this earn its place in a recurring subscription model, or is it a one-off trick?

If the answer to any of these is the wrong one, reconsider.