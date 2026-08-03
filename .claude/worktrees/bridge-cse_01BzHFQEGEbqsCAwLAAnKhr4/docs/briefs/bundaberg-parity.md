# Bundaberg Motor Group — parity page/feature inventory (for the design contest)

> Source: bundabergmotorgroup.com.au (site is behind Cloudflare bot protection — 403 to
> direct fetch; structure reconstructed from search-indexed URLs + standard AU
> multi-franchise dealer anatomy, 2026-07-30). This is a **design/content reference for
> dummy-content mockups only** — do NOT scrape, copy their copy, or wire anything live.

## Their real structure (observed URL patterns)

- `/` — brand-hub home
- `/new/` — "our vehicle brands" intro
- `/new-demo-used-vehicles/?vehicleType=New|Demo|Used` — combined inventory search (274 new / 57 used / 305 total)
- `/used-vehicles/`, `/usedcars/overview/` — used-car browse + overview
- `/<brand>/offers/` (e.g. `/ram/offers/`) — per-brand offers/specials
- `/finance/` — finance
- `/parts/` — parts overview
- `/about/` — about
- `/find-a-dealer/` — contact / locations

**Franchise brands (13):** Chery, Honda, Hyundai, Isuzu, Jaecoo, Jeep, Kia, Leapmotor,
LDV, Nissan, Ram, Subaru + "Quality Used Cars". Located 70 Johanna Boulevard, Kensington
QLD 4670. (Note: this also happens to be the owner-real franchise list that REMAINING-WORK
§3 flagged as needed for brand reconciliation — but that is a separate owner-gated Sanity
data task, NOT part of this contest.)

## What OUR site already has (do not rebuild)

Inventory + URL-driven filters, vehicle detail page, compare (2 surfaces), trade-in
valuation, book-a-service, dealer capture PWA, customer accounts/auth, Rebi chat,
Experience Mode. Light-theme standard, config-as-data.

## Parity GAP — new pages/features to design + mock (dummy content)

Pages we lack that a full dealer site has:
1. **Finance** — options + a repayment **calculator** (price, deposit, term, rate → est. repayment).
2. **Vehicle-type framing** — New / Demo / Used as first-class facets (we only have generic inventory).
3. **Per-brand landing pages** — one hub per franchise brand (logo, models, offers link).
4. **Offers / Specials hub** — current deals, per-brand offers.
5. **Electric Vehicles (EV) hub** — EV education + EV inventory cross-link.
6. **Sell your car** — outright-sale flow (distinct from trade-in valuation).
7. **Parts** — genuine-parts enquiry.
8. **Fleet & business** — fleet enquiry / business solutions.
9. **About** — dealership story, team, why-us.
10. **Contact / Find a dealer** — locations, hours, map, departments, phone.
11. **Careers** — roles + application enquiry.
12. **Test drive booking** — schedule a test drive (form).

Features/tools to express in the mockups: inventory search w/ facets, finance calculator,
trade-in + sell valuation, service booking, test-drive booking, enquiry forms, per-brand
offers, EV hub, fleet enquiry, multi-department contact.

## Mockup rules for every contest team

- **Dummy content only.** Placeholder brand names allowed; do NOT present fictional identity
  as real (knowledge.ts rule) — frame as demo. No real phone/address as fact (determinism).
- **Visual-only.** No functionality, no JS behaviour, **no mobile responsiveness** (desktop ~1440 only).
- **Additive + isolated.** New unlinked routes under `src/pages/concepts/<team>/…` — never
  overwrite or touch any shipped page/component/config (mirror the labs/ isolation pattern).
- **Light-theme standard still binds** (AGENTS.md / /auto §2): light-first shells.
- Config-as-data spirit: no need to wire real `dealerConfig`, but don't hardcode contradictions.
