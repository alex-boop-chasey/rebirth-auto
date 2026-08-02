# Brief — fix "Forbidden" on the Studio "Generate description" button (origin check too strict)

You are a sub-agent on `feat/ai-attributes` (worktree `bridge-cse_01BzHFQEGEbqsCAwLAAnKhr4`). Read the
repo CLAUDE.md (Stack, Hard constraints, Field notes) first. ONE small change, ONE conventional commit.

## Bug
`src/pages/api/generate-description.ts` (~line 108-113) gates on a hardcoded origin allowlist:
```
const origin = request.headers.get('Origin');
if (!origin || !dealerConfig.ai.studioOrigins.includes(origin)) {
  return json({ error: 'Forbidden.' }, 403);
}
```
`dealerConfig.ai.studioOrigins` is `['http://localhost:4321', 'https://rebirth-listings-auto.alexharris0079.workers.dev']`.
The embedded Sanity Studio (studioBasePath `/studio`) posts to this endpoint from whatever origin the
site is actually served on. On any other origin (a different deploy URL, a custom domain, a different
local port) the button fails with a 403 → the Studio shows "Rebi assistant: Forbidden". The SAME bug
exists in the sibling AI endpoints if they use the same pattern — check and fix them consistently.

## The fix — accept same-origin, keep the allowlist for cross-origin
The Studio is embedded in the SAME Astro app as the API, so a **same-origin** POST is inherently from
the dealer's own deployment. Allow the request when EITHER:
1. `origin` is in `dealerConfig.ai.studioOrigins` (explicit cross-origin allowlist — keep as-is), OR
2. `origin` is **same-origin** with the request itself: parse `origin` and `new URL(request.url)` and
   compare **protocol + host** (host includes port). If they match → allow.

Still reject when there is NO `Origin` header (keep the `!origin` → 403; browsers always send Origin on
a cross-* fetch, and a same-origin POST from the Studio does send it). Keep the 403 `'Forbidden.'`
response otherwise.

Put the same-origin comparison in a tiny shared helper (e.g. `src/lib/studio-origin.ts` exporting
`isAllowedStudioOrigin(request, origin, allowlist)`) and reuse it across all AI Studio endpoints that
currently duplicate the check, so the rule lives in one place. Do NOT hardcode any origin in the helper
or the endpoints — the allowlist stays in `dealerConfig.ai.studioOrigins` (config-as-data).

## Constraints that bite
- **Config as data:** no origin literals outside `src/config/dealer.ts`. The helper derives same-origin
  from the request; it does not embed any host.
- **Don't weaken further:** same-origin OR configured allowlist ONLY. Do not allow `*`, do not drop the
  null-origin rejection.
- Behind Cloudflare, `new URL(request.url)` gives the public URL in the Worker/`astro dev`; compare on
  host+protocol. If you find `request.url` is unreliable, fall back to the `Host` header — but verify.

## Verify (DoD)
- `npx astro check` → 0 errors.
- Dev server is running on :4321. Drive it with curl against a real listing id
  (`drafts.import-bundaberg-516716`) and header `Origin: http://localhost:4321` → must get PAST the
  origin check (a 200 with a description OR a graceful AI-degrade error — NOT 403).
- Simulate the owner's case: send a DIFFERENT `Origin` that is neither in the allowlist nor the request
  host, e.g. `-H "Host: example.com"` semantics — easiest: curl with `Origin: https://foo.bar` while the
  server host is localhost:4321 → still 403 (proves cross-origin is still rejected).
- Simulate a real deploy origin: curl with BOTH `Origin: https://my-deploy.example` AND make the request
  host match it — since you can't easily change the dev host, instead ADD a temporary console.log or a
  unit-style check proving `isAllowedStudioOrigin` returns true when origin protocol+host === request
  protocol+host. Remove any temporary log before committing.
- Paste the curl outputs (status codes) and the astro check result.

## Report back
Files changed, the helper's exact logic, which endpoints you updated, the curl results (same-origin →
pass, foreign origin → 403), astro check. Commit `fix(ai): allow same-origin Studio requests to the
description generator (was 403 on non-localhost origins)`. Do not push.
