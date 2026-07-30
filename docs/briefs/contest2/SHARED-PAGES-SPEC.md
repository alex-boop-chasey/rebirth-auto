# Contest 2 — Shared page/content spec (FIXED — all 3 contestants fold in the SAME content)

The orchestrator (not the contestants) defines WHAT pages/content exist. The contest is about the
**information architecture + navigation** — WHERE each lives and HOW you reach it. Do NOT scrape
bundabergmotorgroup.com.au (it 403s bots; and all entries must start from identical content). Content
is dummy/config-driven; obvious placeholders; no real phone/address stated as fact; AU spelling/pricing.

Rebirth Auto ALREADY HAS (do not rebuild — reuse, and decide how to surface): inventory/home, listings
+ filter panel (New/Demo/Used are **filter facets**, not separate pages), vehicle detail (with the new
Edmunds slot + Rebi's-take), compare + compare-tools (sliders — keep as-is), trade-in valuation,
book-a-service, Rebi chat, Experience Mode, accounts, dealer capture.

## The 11 pages to fold in (purpose · key sections · AI touchpoint)
1. **Finance** (`finance`) — options + a **repayment calculator** (sliders: price / deposit / term /
   rate → indicative weekly & monthly). Sections: hero, calculator, lender panel, pre-approval CTA,
   short FAQ. Rebi: "ask about finance / pre-qualify".
2. **Offers / Specials** (`offers`) — current deals hub. Sections: featured drive-away offers grid,
   filter by brand/type, fine print. Rebi: "find me a deal that fits".
3. **Electric (EV) hub** (`electric`) — education + EV stock. Sections: hero, why-EV, running-cost
   compare (EV vs petrol), charging basics, EV/hybrid stock teaser (real inventory), incentives note.
   Rebi: "is an EV right for my drive?".
4. **Sell your car** (`sell`) — outright sale (distinct from trade-in). Sections: how it works, a
   valuation intake (make/model/year/odometer/condition → indicative), sell-vs-trade explainer. Rebi.
5. **Parts** (`parts`) — genuine parts enquiry. Sections: hero, parts categories, fitment note,
   enquiry form. Rebi: "check a part for my vehicle".
6. **Fleet & business** (`fleet`) — fleet solutions. Sections: hero, benefits, brands available,
   enquiry form. Rebi.
7. **About** (`about`) — dealership story. Sections: hero, our-story/since-year (dummy), team, why-us,
   community, locations teaser. Rebi.
8. **Contact / Find-a-dealer** (`contact`) — departments (Sales / Service / Parts) with hours (dummy),
   map placeholder, general enquiry form, phone/email placeholders (clearly demo). Rebi: "who do I
   talk to about X".
9. **Careers** (`careers`) — hero, culture, open-roles list (dummy), application enquiry. Rebi.
10. **Book a test drive** (`test-drive`) — pick a vehicle + preferred time form, what-to-bring. Rebi:
    "book me a test drive in the <car>".
11. **Brand hub** (`brand`) — per-brand landing. Sections: brand hero, models, brand offers link,
    brand inventory teaser. (One template; brands from `dealerConfig`/inventory makes.) Rebi.

## Cross-content notes
- Several of these overlap in content (finance ↔ offers pre-approval; sell ↔ trade-in; test-drive ↔
  vehicle detail; brand ↔ listings facets; EV ↔ listings fuel facet). **The overlap is the point** —
  the contest should absorb/interlink these so the site feels slim, not add redundant siloed pages.
- Every page carries a Rebi entry and reuses the Wave-0 NFY components (SiteNav/SiteFooter, cards,
  ai-summary, aisearch, buttons). Config-as-data; `dealerNotes` never shown; light-theme NFY.
