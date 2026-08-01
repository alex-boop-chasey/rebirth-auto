/**
 * Rebi — message tones (Web Audio). Extracted verbatim from ChatWidget.astro so
 * Rebi's noises live in ONE editable place. Ported from the SearchDock sound
 * module: no audio files — every tone is synthesised from oscillators. A bright
 * rising blip when YOU send, a warm rounded ping when a reply arrives. The
 * AudioContext is created/resumed lazily on the first gesture (submit or the
 * speaker toggle) — never on load. Mute state persists in localStorage under a
 * key distinct from the search dock's, so the two toggles don't collide.
 *
 * `createRebiSounds()` wires the #reb-speaker toggle (mute persistence + a11y
 * labels) and returns the two tone players. Behaviour is byte-identical to the
 * previous inline block — same key, same tones, same triggers.
 */
type Note = { f: number; type?: OscillatorType; t?: number; dur?: number; gain?: number; slideTo?: number };

export type RebiSounds = { soundSend: () => void; soundRebi: () => void };

/**
 * Pure Web-Audio tone engine — NO DOM, NO mute, NO persistence. Owns only the
 * lazily-created AudioContext and the two synthesised tones. `unlock()` creates/
 * resumes the AudioContext on a user gesture. Muting is the caller's concern.
 */
export interface ToneEngine {
  soundSend: () => void;
  soundRebi: () => void;
  unlock: () => void; // = ac(): create/resume the AudioContext on a user gesture
}

export function createToneEngine(): ToneEngine {
  let audioCtx: AudioContext | null = null;

  const ac = (): AudioContext | null => {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) { try { audioCtx = new AC(); } catch { audioCtx = null; } }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  };
  const blip = (notes: Note[]) => {
    let ctx: AudioContext | null = null;
    try { ctx = ac(); } catch { ctx = null; }
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      notes.forEach((n) => {
        const start = now + (n.t || 0);
        const dur = n.dur || 0.14;
        const peak = n.gain == null ? 0.12 : n.gain;
        const osc = ctx!.createOscillator();
        const g = ctx!.createGain();
        osc.type = n.type || 'sine';
        osc.frequency.setValueAtTime(n.f, start);
        if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, start + dur);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(g); g.connect(ctx!.destination);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
    } catch { /* unsupported browser — degrade silently */ }
  };
  // YOU send: bright, snappy, rising fifth + shimmer — "sent!"
  const soundSend = () => blip([
    { f: 523.25, type: 'triangle', t: 0.0, dur: 0.11, gain: 0.13, slideTo: 783.99 }, // C5 → G5
    { f: 1046.5, type: 'sine', t: 0.03, dur: 0.09, gain: 0.05 },                       // C6 shimmer
  ]);
  // A reply arrives: warm rounded two-note ping with a soft undertone — "incoming"
  const soundRebi = () => blip([
    { f: 174.61, type: 'sine', t: 0.0, dur: 0.34, gain: 0.05 }, // F3 warm body
    { f: 659.25, type: 'sine', t: 0.0, dur: 0.20, gain: 0.11 }, // E5
    { f: 987.77, type: 'sine', t: 0.12, dur: 0.24, gain: 0.10 }, // B5 (lifts a fifth)
  ]);
  const unlock = () => { ac(); };

  return { soundSend, soundRebi, unlock };
}

export function createRebiSounds(): RebiSounds {
  const speakerBtn = document.getElementById('reb-speaker');
  const MUTE_KEY = 'rebi:chat:muted';
  let muted = false;
  try {
    const stored = localStorage.getItem(MUTE_KEY);
    if (stored !== null) muted = stored === '1';
  } catch { /* private mode / no storage — default unmuted */ }

  const engine = createToneEngine();
  const soundSend = () => { if (muted) return; engine.soundSend(); };
  const soundRebi = () => { if (muted) return; engine.soundRebi(); };

  const reflectMute = () => {
    if (!speakerBtn) return;
    speakerBtn.classList.toggle('muted', muted);
    speakerBtn.setAttribute('aria-pressed', String(muted));
    const label = muted ? 'Unmute message tones' : 'Mute message tones';
    speakerBtn.setAttribute('aria-label', label);
    speakerBtn.setAttribute('title', label);
  };
  reflectMute();
  speakerBtn?.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    reflectMute();
    if (!muted) { engine.unlock(); engine.soundRebi(); } // this click is a gesture: unlock + preview
  });

  return { soundSend, soundRebi };
}
