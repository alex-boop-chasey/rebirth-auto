# TODO_KEYS.md — Drop-in registry for stubbed integrations & owner actions

Every stubbed third-party service and every owner-gated write is registered here. To take
one live: add the credential where noted, flip the env flag, done — no code change.

Format: **Service** — what's needed — where to add it — what it unlocks — activation effort.

Flags live in `.dev.vars` (local) / `wrangler secret` (prod) for the Worker, and `.env` for
Node scripts. See `AGENTS.md` for which is which.

---

## Stubbed integrations

_(populated as Phase 6–8 stubs land — each `src/stubs/<service>.ts` gets a row here)_

| Service | Env flag | Credential needed | Where to add | Unlocks | Effort |
|---------|----------|-------------------|--------------|---------|--------|
| _pending_ | | | | | |

## Owner-gated data writes (no autonomous `--commit`)

| Action | Command | Blocker |
|--------|---------|---------|
| businessInfo real facts | seed script `--commit` | needs real dealer facts + Editor `SANITY_TOKEN` |
| brand reconciliation | reconcile script `--commit` | review dry-run diff first |
| fuel-economy backfill | backfill script `--commit` | review dry-run diff first |
| D1 journey table (prod) | `wrangler d1 migrations apply astro-listings-chat --remote` | owner runs against prod |

## Owner infra / account actions

| Action | Notes |
|--------|-------|
| GROUNDING_KV namespace + `wrangler.jsonc` binding | optional grounding cache; app works without it |
| Sanity MCP plugin | `/plugin install sanity@claude-plugins-official` |
| Cloudflare security tooling | account-level access required for some features |
