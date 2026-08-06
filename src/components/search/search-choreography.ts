/**
 * search-choreography — the pure, framework-free grid/heading "watch the AI work"
 * helpers, extracted VERBATIM from SearchDock.astro's inline script so the
 * SmartSearch island stays lean. Every function operates on the STATIC SSR nodes
 * by id (`#inventory-results`, `#inventory-heading`, `#hero-subhead`) — shared
 * page infrastructure, never island state — and is parameterized on `reduced`
 * (prefers-reduced-motion) instead of closing over a module constant, so the caller
 * passes the live value at call time.
 *
 * No DOM is touched at module load; every access lives inside a function body.
 */

/** Fade out / fade in duration (ms). */
export const GRID_FADE_MS = 260;
/**
 * Fallback "thinking" beat (ms) so the fade-out + dots always read. The island now
 * reads the dealer-tunable `config.minBeatMs` (dealerConfig.chat.search); this const
 * is only the default. Keep ≥ GRID_FADE_MS so the fade-out still reads.
 */
export const MIN_BEAT_MS = 300;

export const delay = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));

const grid = (): HTMLElement | null => document.getElementById('inventory-results');

// The current list recedes (opacity + a small lift), clearing the stage while Rebi
// "thinks". Layout is preserved (opacity/transform only). Reduced motion → no-op.
export function fadeGridOut(reduced: boolean): void {
  if (reduced) return;
  const g = grid();
  if (!g) return;
  g.style.transition = `opacity ${GRID_FADE_MS}ms ease, transform ${GRID_FADE_MS}ms ease`;
  g.style.willChange = 'opacity, transform';
  void g.offsetWidth; // commit the current (visible) state before transitioning
  g.style.opacity = '0';
  g.style.transform = 'translateY(0.75rem)';
}

// applyFilterUrl replaces #inventory-results with a fresh (opacity:1) node. Called
// synchronously right after the swap — before the browser paints — so the new
// results start hidden and their fade-in reads as a distinct step.
export function primeGridHidden(reduced: boolean): void {
  if (reduced) return;
  const g = grid();
  if (!g) return;
  g.style.transition = 'none';
  g.style.opacity = '0';
  g.style.transform = 'translateY(0.75rem)';
}

// The new (or, on a no-op search, restored) grid fades into view, then its inline
// styles are stripped so nothing lingers on the node.
export function fadeGridIn(reduced: boolean): void {
  const g = grid();
  if (!g) return;
  if (reduced) {
    g.style.opacity = '';
    g.style.transform = '';
    return;
  }
  void g.offsetWidth;
  g.style.transition = `opacity ${GRID_FADE_MS}ms ease, transform ${GRID_FADE_MS}ms ease`;
  g.style.opacity = '1';
  g.style.transform = 'translateY(0)';
  setTimeout(() => {
    const gg = grid();
    if (gg) {
      gg.style.transition = '';
      gg.style.willChange = '';
      gg.style.transform = '';
      gg.style.opacity = '';
    }
  }, GRID_FADE_MS + 40);
}

// The hero subhead fades (kept in layout → nothing shifts) while a search is
// active, giving the stage clean room. Motion-safe: opacity only. The transition is
// (idempotently) seated under motion before the first opacity change — same visual
// result as the vanilla one-time init.
export function setSubheadActive(on: boolean, reduced: boolean): void {
  const subhead = document.getElementById('hero-subhead');
  if (!subhead) return;
  if (!reduced) subhead.style.transition = 'opacity 0.3s ease';
  subhead.style.opacity = on ? '0' : '';
}

// Flip the inventory heading between "Current inventory" and "Results" (JS-only;
// the no-JS heading stays "Current inventory").
export function flipHeading(toResults: boolean): void {
  const h = document.getElementById('inventory-heading');
  if (h) h.textContent = toResults ? 'Results' : 'Current inventory';
}
