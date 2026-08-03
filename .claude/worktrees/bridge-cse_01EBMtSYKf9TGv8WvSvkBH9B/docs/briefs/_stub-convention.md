# Stub convention (shared by every stubbed integration)

Every feature that touches a third-party service is built in full with a fake pipeline that
is behaviourally indistinguishable from the real one, so the feature is fully demoable now
and going live is a config change, not a code change.

## Rules

1. **Interface file:** `src/stubs/<service>.ts` exports the SAME TypeScript interface the real
   integration will implement (typed request → typed response). The stub returns realistic
   mock data that exercises the full feature UI/logic end-to-end.

2. **Activation flag:** a stub is active when the real credential is absent OR an explicit
   `STUB_<SERVICE>` flag is truthy. Concretely, the caller resolves:
   `useStub = !env.<SERVICE>_API_KEY || truthy(env.STUB_<SERVICE>)`.
   This means it **auto-stubs until a real key is added** — no code change to go live, just add
   the credential (and optionally set `STUB_<SERVICE>=false`). Read env via the existing
   worker pattern (`~/chatbot/get-env.ts` / `cloudflare:workers`), never `process.env` in
   worker code.

3. **Drop-in markers:** at every real-integration point leave a comment:
   `// TODO_KEYS: <service> — <credential needed> — <where to add it>`
   and add a row to the root `TODO_KEYS.md` "Stubbed integrations" table:
   `| Service | STUB_<SERVICE> | <credential> | <where> | <what it unlocks> | <effort> |`.

4. **Determinism & honesty:** mock data is clearly mock. NEVER present fabricated data as real
   in a way that could mislead in PRODUCTION — stubs are dev/demo-only and gated behind the
   flag. Where a feature would show invented data on a real listing (e.g. a price-drop badge),
   the stub must be OFF by default in production config and only ON in the demo/dev flag set.

5. **Config as data:** any dealer-facing copy/toggle for the feature lives in
   `src/config/dealer.ts` (a feature flag under a sensible namespace), never hardcoded.

6. **No real spend, no real writes:** stubs never call a paid API or write to a third party.
   `astro check` must stay green.
