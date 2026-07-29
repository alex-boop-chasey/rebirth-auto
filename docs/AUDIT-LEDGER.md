# Audit Ledger — Rebirth Auto

> **APPEND-ONLY HISTORICAL RECORD. Do not overwrite, regenerate, truncate, or delete.**
> This ledger tracks, per audit, which findings were **shipped** and which were **deferred** (and why).
> It is protected by a hard rule in `AGENTS.md` ("Audit records — append-only"): no autonomous
> process — including `/auto` — may rewrite it. New audits **append** a new dated section; corrections
> **append** a dated note rather than editing history.
>
> Authoritative per-finding detail lives in the audit docs referenced by each entry
> (`docs/AUDIT-FINDINGS.md` + `docs/AUDIT-PUSHBACK.md`). Finding IDs (`6.1`, `13.2`, …) refer to those.

---

## Audit 001 — SYSTEM-MAP audit (2026-07-29)

- **Scope:** whole codebase vs `docs/SYSTEM-MAP.md` (16 subsystem audits + 8 security-domain sweeps).
- **Pipeline:** scope → hunt → adversarial pushback. 78 findings; pushback verdicts: 60 confirmed,
  9 partially valid, 9 needs-decision, **0 false positives**.
- **Source docs:** `docs/AUDIT-FINDINGS.md` (findings), `docs/AUDIT-PUSHBACK.md` (verdicts).
- **Fix mode:** safe-fixes-only (owner directive). Orchestrator-reviewed, then committed.
- **Fix commit:** `4b223c5` — *fix(audit): apply the safe, confirmed batch from the SYSTEM-MAP audit*.

### ✅ SHIPPED (23 findings — committed `4b223c5`, reviewed & verified)

| ID | Fix |
|----|-----|
| 6.1 | configureAI configs made identical across chat/search/generate-description (+ try/catch) — stops an uncaught 500 that can break buyer chat |
| 13.1 | `import-bundaberg.ts` dry-run by default; writes require `--commit` |
| 13.2 | `seed.ts` dry-run by default + `--commit`; deletes by explicit `_id` (no broad query match) |
| 13.4 | `SANITY_API_TOKEN` → `SANITY_TOKEN` in script error text |
| 4.1 | Public inventory query scoped to `status=="active"` (was leaking drafts; verified 0 active listings dropped) |
| 5.1 | Make-firewall `CAR_MAKES` gains `jaecoo` + `leapmotor` (real franchises) |
| 8.1 | Capture voice-parser: odometer span stripped before price match (word-order-proof) |
| 8.2 | Capture voice-parser: `142k on the clock` now ×1000 → 142000 |
| 24.1 | `_id asc` tiebreaker on the paginated listings `order()` |
| 24.2 | `_id` tiebreaker on inventory-tools / grounding context+lookup `order(price)` |
| 24.3 | `_id` tiebreaker on related-listings `order()` |
| 24.4 | Deterministic import `_key` (djb2 hash, no `Math.random()`) |
| 3.1 | `formatDate` uses `dealerConfig.locale.locale` (was hardcoded `en-US`) |
| 2.3 / 3.2 | `detailDisplay` number formatting from `dealerConfig.locale` (was `en-AU`) |
| 3.4 | No-price copy "Contact agent" → "Contact dealer" |
| 12.1 | Email stub no longer logs the recipient address (PII) |
| 20.1 | Journey beacon rate-limited (own keyPrefix, fail-open, still returns 204) |
| 16.1 | Focus rings added to previously-unringed inputs/tabs (WCAG 2.4.7) |
| 16.3 | `motion-reduce` guard on pulse dot; Firefox slider focus ring |
| 22.1 | `compare.astro` escapes `</script>` in embedded JSON |
| 22.2 | `compare-tools.astro` same `</script>` escape |
| 7.2 | No dead `/listings/` link for slug-less compare cars |

### ⏸ DEFERRED (open — see `AUDIT-PUSHBACK.md` for full per-ID verdicts)

**A. Owner — gated by the mandated pre-launch security review** (DECISIONS.md). Real, but not safe to auto-apply:
- `17.1` / `9.6` — Supabase session cookies set without `httpOnly`/`secure` (`secure` also breaks local HTTP dev).
- `9.2` — auth action echoes session tokens to the client.
- `9.3` / `21.1` — `/account` reads PII by unverified email (add `email_confirmed_at` gate).
- `15.1` / `17.2` / `21.3` — `generate-description` gated only by a spoofable `Origin` (feeds `dealerNotes` to the LLM).
- `15.2` — `carsales-upload` same Origin-only gate (latent; flag off today).
- `8.5` — capture endpoints Origin-gated (latent; writes stubbed today).
- `10.1` / `21.2` — guest write endpoints accept an arbitrary email (content injection into the account page).

**B. Owner — design / infra decision (behaviour-changing, not a clear bug):**
- `1.2` / `1.3` — prerender vs SSR on the listing detail page (+ header reach).
- `14.1` — Turnstile fail-open → fail-closed (could break chat if a secret is unset).
- `14.2` — `astro.config.mjs` `site` is a `.pages.dev` placeholder (needs the real domain).
- `14.3` — HSTS; `14.4` — edge/Transform-rule headers for static assets; `22.3` — baseline CSP.
- `2.4` / `16.2` — config-as-data scope (identity struct / brand colour) — multi-tenant-timing call.
- `15.3` — Studio behind Cloudflare Access; `20.3` — Turnstile/spend cap on search; `8.4` — capture PWA dark theme.

**C. Confirmed low / info — deferred for a later sweep** (real, low value):
`2.1`/`5.2`, `2.5`, `3.3`, `4.2`, `4.3`, `4.4`, `5.3`, `5.4`, `6.2`, `7.1`, `7.3`, `8.3`, `9.1`, `9.4`,
`9.5`, `10.2`, `10.3`, `11.1`, `11.2`, `12.2`, `13.3`, `14.5`, `14.6`, `15.4`, `18.1`, `19.1`, `19.2`, `20.2`.

<!-- Next audit appends "## Audit 002 — …" below this line. Never edit the section above. -->
