# Cloudflare security — audit & roadmap

The site deploys as a **Cloudflare Worker** (not Pages — see `CLAUDE.md`). That puts most of the
edge-security surface in the Cloudflare account/dashboard, not in this repo. This doc audits what
is already in place in code vs. what needs **owner / account-level action**. Owner-action items
are also registered in `TODO_KEYS.md`.

Legend: ✅ in place · ◑ partial · ⬜ available, not yet enabled · 👤 owner/account action required.

## Already in place (in code)

| Control | Status | Where |
|---|---|---|
| **Turnstile** bot protection on the chatbot | ✅ | `src/chatbot/*` (`get-env.ts`, `core.ts`, `config.ts`), `src/components/widgets/ChatWidget.astro` |
| **Per-IP rate limiting** (fixed-window, KV-backed) | ✅ | `src/lib/rate-limit.ts` (`checkRateLimit`, `RATE_LIMIT_KV`) — reuse with a distinct `keyPrefix` per endpoint |
| Secrets kept out of the bundle | ✅ | `.dev.vars` (local) / `wrangler secret` (prod) for the Worker; `.env` for Node scripts. Never hardcoded |
| Owner-gated data writes (no autonomous `--commit`) | ✅ | data scripts default to dry-run; see `TODO_KEYS.md` |

## Account-level controls (Cloudflare dashboard — owner action)

These are configured on the Cloudflare account/zone, not in this repo. Most are available on the
free/pro plans; a few need a paid plan.

| Control | Status | What it does / action needed |
|---|---|---|
| **WAF managed rules** | 👤 ⬜ | Enable Cloudflare Managed Ruleset (+ OWASP core) on the zone. Baseline protection against common exploits. Owner enables in dashboard → Security → WAF. |
| **Bot Fight Mode** (free) / Super Bot Fight (pro) | 👤 ⬜ | Zone-wide automated-bot mitigation, complements the Turnstile we already run on the chatbot. Owner enables in Security → Bots. |
| **Rate limiting rules (edge)** | 👤 ◑ | We rate-limit the chatbot in-app via KV. Cloudflare's **edge** rate-limiting rules add a zone-level layer (per-path, per-IP) that stops abuse before it reaches the Worker. Owner adds rules for `/api/*`. |
| **Security headers** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | ⬜ 👤 | **Not currently set.** No response-header security policy exists in the repo. Add via a Cloudflare **Transform Rule** (response headers) OR a small Astro middleware. HSTS + a baseline CSP are the priority. Decide owner (Transform Rule) vs code (middleware) before implementing. |
| **Cloudflare Access for Studio** | 👤 ⬜ | Put the Sanity Studio route behind **Cloudflare Access** (Zero Trust) so only authenticated staff reach it. Owner configures an Access application on the Studio path. |
| **Automated vulnerability / security scanning** | 👤 ⬜ | Cloudflare's automatic Security Center scans (misconfig + exposed-surface findings). Owner reviews Security Center periodically. |
| **TLS: Full (strict) + Always Use HTTPS + Automatic HTTPS Rewrites** | 👤 ⬜ | Confirm zone SSL/TLS mode is Full (strict) and HTTP is force-redirected. Owner verifies in SSL/TLS settings. |
| **DDoS protection** | ✅ (default) | On by default for Cloudflare-proxied traffic; no action unless custom rules are wanted. |

## Priority order for the owner

1. **Security headers** (HSTS + baseline CSP) — biggest gap, currently absent. Choose Transform
   Rule vs middleware.
2. **WAF managed ruleset + Bot Fight Mode** — one-click baseline hardening.
3. **Cloudflare Access in front of Studio** — protects the CMS admin surface.
4. **Edge rate-limiting rules on `/api/*`** — defence-in-depth over the in-app KV limiter.
5. **Confirm TLS Full (strict) + Always Use HTTPS.**
6. **Periodic Security Center review.**

## Notes

- The in-app KV rate limiter (`checkRateLimit`) and edge rate-limiting are complementary, not
  redundant — keep both. The in-app limiter also guards against internal/non-proxied paths.
- A CSP will need tuning for the Sanity Studio + any embedded widgets; start report-only, then
  enforce.
- Nothing here writes or changes account state; it is a checklist the owner actions in the
  Cloudflare dashboard.
