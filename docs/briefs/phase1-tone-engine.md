# Brief — Phase 1: extract `createToneEngine()` from `rebi-sounds.ts` (zero React)

## Goal
Split the pure Web-Audio tone synthesis out of `src/components/widgets/rebi-sounds.ts` into a reusable
`createToneEngine()` so a future React hook can consume it, **without changing any current behaviour**.
This is a pure, behaviour-preserving refactor. No React in this phase.

## Constraints that bite here (restated per AGENTS.md)
- **Determinism:** no `Math.random`, no module-top-level `new Date()`. (None exist today — keep it that way.)
- **Light-theme / config-as-data / AI-through-`src/ai/`:** not touched by this file — leave alone.
- The still-vanilla `ChatWidget.astro` imports `createRebiSounds()` from this module. Its public API and
  behaviour must stay **byte-identical** (same mute key `rebi:chat:muted`, same `#reb-speaker` wiring, same
  a11y labels, same tones, same lazy-unlock-on-gesture). Do not touch `ChatWidget.astro`.

## Exact change
In `src/components/widgets/rebi-sounds.ts`:

1. Add a new exported pure factory with NO DOM, NO mute, NO persistence:
   ```ts
   export interface ToneEngine {
     soundSend: () => void;
     soundRebi: () => void;
     unlock: () => void; // = ac(): create/resume the AudioContext on a user gesture
   }
   export function createToneEngine(): ToneEngine { /* ... */ }
   ```
   Move the `Note` type, the `audioCtx` closure, `ac()`, `blip()`, `soundSend`, `soundRebi` bodies into it
   **verbatim** (same frequencies, gains, timings). `unlock()` simply calls `ac()`.
   - IMPORTANT: `createToneEngine` must NOT read `muted` — the mute gate stays in the DOM wrapper. So `blip`
     inside the engine drops the `if (muted) return;` line; muting is enforced by the caller (see step 2).

2. Rewrite `createRebiSounds()` to delegate to `createToneEngine()` while preserving its exact behaviour:
   - keep `const speakerBtn = document.getElementById('reb-speaker')`, `MUTE_KEY = 'rebi:chat:muted'`,
     the `muted` load from localStorage, `reflectMute()`, and the speaker click handler **unchanged**.
   - `const engine = createToneEngine();`
   - `soundSend = () => { if (muted) return; engine.soundSend(); }` and likewise for `soundRebi`.
   - the speaker unmute-preview gesture becomes `engine.unlock(); engine.soundRebi();` (equivalent to the
     old `ac(); soundRebi();`).
   - Return type `RebiSounds` unchanged (`{ soundSend, soundRebi }`).

Net effect: `createRebiSounds()` behaves exactly as before; `createToneEngine()` is a new pure export.

## Do NOT
- Do not touch `ChatWidget.astro`, `stage-engine.ts`, `filter-url.ts`, or any config.
- Do not add React, hooks, or `.tsx` — that is Phase 2.
- Do not change tone parameters or the mute key.

## Verify
- `npx astro check` is green.
- Grep-confirm `ChatWidget.astro` still imports and uses `createRebiSounds` unchanged.
- Confirm `createToneEngine` has no `document`/`localStorage` reference and no `muted` variable.

## Report back
The final `rebi-sounds.ts`, confirmation `astro check` passed, and a one-line note that ChatWidget is
untouched.
