# Dependency tracking & safe-bump process

How we keep this stack current without breaking the Cloudflare Worker deploy. Read this
BEFORE bumping anything the report flags.

## The report

`scripts/deps-report.ts` (`tsx scripts/deps-report.ts`, or `--json` for machine output) prints,
for the key stack, the **declared** range (`package.json`), the **installed** version
(`node_modules`), and — if `npm outdated` succeeds — the **wanted** and **latest** published
versions. It is read-only: it never installs, upgrades, or writes.

Watched packages: `astro`, `@astrojs/cloudflare`, `@astrojs/check`, `@astrojs/react`,
`@astrojs/sitemap`, `sanity`, `@sanity/astro`, `@sanity/client`, `@sanity/image-url`,
`tailwindcss`, `@tailwindcss/vite`, `wrangler`, `typescript`, `tsx`.

**Graceful-offline behaviour:** `npm outdated` requires the network. If it is offline, missing,
or times out (30s), the report silently drops the "Wanted/Latest" columns and prints only the
pinned + installed versions with a NOTE. It never crashes. (`npm outdated` also exits non-zero
when anything is outdated — the script parses the JSON it prints on stdout in that case too.)

## Stack-specific gotchas (do NOT relearn these the hard way)

These are the load-bearing constraints from `CLAUDE.md`. A dependency bump that ignores them
produces bugs that look like code bugs but aren't.

1. **Cloudflare adapter is v14 — Worker, NOT Pages.** We deploy as a **Cloudflare Worker** via
   `@astrojs/cloudflare` v14. This has caused real bugs when treated as Pages. Do not switch the
   adapter target or "helpfully" migrate to Pages.

2. **Runtime env is `import { env } from 'cloudflare:workers'`.** The old
   `locals.runtime.env` pattern was REMOVED in adapter v14. `src/chatbot/get-env.ts` is the
   shared helper — env access goes through it. A major-version bump of `@astrojs/cloudflare` is
   the single most likely thing to reintroduce the old pattern or change env access; re-verify
   `get-env.ts` and a live chatbot call after any adapter bump.

3. **`.dev.vars` (local Worker) vs `wrangler secret` (prod Worker) vs `.env` (Node scripts).**
   Three separate secret stores. Bumping `wrangler` can change how `.dev.vars` / secrets are
   read — smoke-test a local Worker run after a wrangler bump.

4. **Stale Vite optimizer after a config/dep change.** A Vite *"file does not exist in optimize
   deps"* 500 after changing deps or config is a **stale optimizer cache, not a code bug**.
   Fix: `rm -rf node_modules/.vite` and restart the dev server. Always do this first after any
   bump before concluding the bump "broke" something.

5. **Tailwind v4 uses `@tailwindcss/vite`.** Keep `tailwindcss` and `@tailwindcss/vite` on the
   same version. v4 is config-in-CSS, not `tailwind.config.js`; do not reintroduce a v3-style
   config on a bump.

6. **Sanity `@sanity/client` v7 + `sanity` studio v6 are separate release trains.** Bump them
   independently and check the GROQ projection (`LISTING_FIELDS` in `src/lib/listing.ts`) and the
   Studio still loads. `@sanity/image-url` and `@sanity/astro` track their own versions too.

7. **TypeScript major bumps** (e.g. 6 → 7) can surface new diagnostics. `npx astro check` must
   stay green; treat a TS major as a real task, not a routine bump.

## Safe-bump checklist

Run this for each package you decide to bump (bump ONE risky package or one cohesive group at a
time — never everything at once):

- [ ] `tsx scripts/deps-report.ts` — note current installed vs latest for the target.
- [ ] Read the target's changelog for the range you're crossing (patch/minor/major).
- [ ] For **patch/minor**: bump the range in `package.json`, `npm install`.
- [ ] For **major** (adapter, wrangler, astro, typescript, sanity): treat as a scoped task; read
      the migration guide first.
- [ ] `rm -rf node_modules/.vite` (clear the stale optimizer cache).
- [ ] `npx astro check` — must be **0 errors** (no new errors vs the pre-bump baseline).
- [ ] `npm run build` — Worker build must succeed.
- [ ] Start the dev server (`astro dev --background`) and smoke-test:
      - a listings page renders,
      - the chatbot answers (exercises `cloudflare:workers` env + get-env.ts),
      - Studio loads (`/studio` or configured route).
- [ ] After an `@astrojs/cloudflare` bump specifically: re-verify `src/chatbot/get-env.ts` still
      reads env via `cloudflare:workers` and a chat request works end-to-end.
- [ ] After a `wrangler` bump: confirm `.dev.vars` local secrets + a local Worker run still work.
- [ ] Commit as its own ticket (one bump/group per commit). Push only on owner sign-off.

## What this tooling does NOT do

- It does not upgrade anything — bumps are a human decision.
- It does not run in CI or on a schedule — run it manually before a maintenance pass.
- It does not track transitive deps — only the declared key stack above.
