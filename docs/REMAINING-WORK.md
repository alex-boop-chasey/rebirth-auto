# What's left to do — Rebirth Listings Auto

The single source of truth for outstanding work. Everything the chatbot pipeline and the
shopper/dealer features needed is built; this is what remains. Plain-language, grouped by who
does it and how big it is. (Multi-tenant and "make the chatbot reusable on other sites" work is
deliberately out of scope here.)

Legend: 🟢 quick · 🟡 medium · 🔴 larger · 👤 needs you (owner) · 🔌 needs a credential/account

---

## 1. Real gaps — features that are built but a shopper can't fully reach

- [ ] 🟡 **Dealer "create a listing" tool (`/capture`) is unreachable.** The whole photo→voice→VIN→draft
      flow is built, but it's turned off and nothing on the site links to it. Decide where dealers enter
      it (a dealer-only link / a "Studio" area), then turn it on. *Right now it just redirects home.*
- [ ] 🟡 **Saved searches can be saved but not viewed.** The "Save this search" button works and stores
      the search, but there's no page where a shopper can see their saved searches. Build a
      **"My saved searches"** view and surface it in the account.
- [ ] 🟡 **The account dashboard is mostly empty.** Login/logout works, but the "service history" and
      "saved searches" sections on `/account` are placeholders — wire them to real per-user data.
- [ ] 🟢 **Compare pages have no direct link.** `/compare` and `/compare-tools` are only reachable by
      tagging 2+ cars into the compare tray. Fine as-is, but add a nav entry if you want them easier to find.

## 2. Built but switched off — turn on when you're ready

These work; they're just disabled by default so nothing shows fake/unfinished data to shoppers.

- [ ] 🟢 **Rebi's extra knowledge** — manufacturer info, independent reviews, and web-search (allow-listed
      sites). All built; flip on in config when you want Rebi to use them in chat.
- [ ] 🟢 🔌 **Carsales upload** — the "Upload to carsales" action in Studio is built; turn on + add a
      carsales account/key to go live.
- [ ] 🔴 🔌 **Full "Rebi as an agent" search** — the deterministic tools are built and on; the smarter
      multi-turn version needs a paid tool-calling model + credit. Turn on when the demo justifies the cost.

## 3. Content & data — needs you 👤

- [ ] 👤 **Fuel economy** — the feature is built, but no car has a value yet. Enter L/100km on listings in
      Studio and Rebi/compare start using it.
- [ ] 👤 **Business info** — fill the real phone, hours, brands, address, services (a dry-run script is
      ready; until then Rebi uses placeholder facts).
- [ ] 👤 **Brand list** — reconcile the brands Rebi thinks are stocked with the real inventory (the diff is
      ready: claimed-but-absent = Jeep, Leapmotor; present-but-unclaimed = Ford, GWM, Holden, Mazda,
      Mitsubishi, Toyota).

## 4. Integrations to switch from demo to live (credential + flag) 🔌

Each is built with a realistic fake pipeline; going live is "add the key, flip the flag." Full list
and exact steps live in `TODO_KEYS.md`.

- [ ] 🔌 **Email (Resend or similar)** — real confirmation + saved-search alert emails.
- [ ] 🔌 **Redbook / NEVDIS** — real trade-in valuations and rego/VIN lookup for the creation tool.
- [ ] 🔌 **Vision model** — real photo → spec extraction in the creation tool.
- [ ] 🔌 **Saved-search alerts (recurring)** — the save + confirmation are built; the "new match arrived"
      matcher needs a scheduled (cron) job to re-run saved searches and email matches.

## 5. Infra & deploy — needs you 👤

- [ ] 👤 **Apply the database migrations in production** — the journey / saved-searches / service-bookings
      tables (`0003`–`0005`) are local-only until run against the live database.
- [ ] 👤 **Customer login hardening** — real Supabase auth is wired, but a paid security review is required
      before real customer personal data flows through it in production.
- [ ] 👤 **Security headers** — the safe ones are live; add a full Content-Security-Policy + Permissions-
      Policy (needs careful per-source testing so Turnstile/Supabase/chat still work).
- [ ] 👤 **Optional**: grounding cache (`GROUNDING_KV`), Sanity MCP plugin — both nice-to-have, work without.
- [ ] 🟢 **Restore the better chat model** — the chat reply already uses Haiku; the description/extraction
      tiers still use the free stop-gap model. Point them back at Haiku for the demo (one-line change).

## 6. Bigger / future (for this site)

- [ ] 🔴 **Experience Mode** — the opt-in premium mode where Rebi drives the screen as a canvas. Prototype
      the onboarding → standby → "boom" flow cheaply and test with ~5 real users.
- [ ] 🔴 🔌 **Point-of-sale integration** — sync with the dealer's sales platform. Per-dealer, depends on
      which system they use and whether it has an API. Long-term.

---

*Reference docs (not todos): `VISION.md`, `DECISIONS.md`, `LENSES.md` (product/architecture direction),
`TODO_KEYS.md` (exact go-live steps per integration), `cloudflare-security.md`, `dependency-tracking.md`.
Per-feature build specs are in `docs/briefs/`.*
