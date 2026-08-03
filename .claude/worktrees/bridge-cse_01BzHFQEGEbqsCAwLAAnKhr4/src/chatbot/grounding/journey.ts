/**
 * Continuity-journey grounding — folds a visitor's recent breadcrumb trail into
 * the system prompt as CONTEXT ONLY.
 * ------------------------------------------------------------------
 * Mirrors resolveFocus (context.ts): fail-open (`null` on disabled / no db / no
 * visitor / no events / ANY error), deterministic (a single D1 read, NO LLM),
 * and it renders a PRICE-FREE, clearly-delimited block explicitly framed as NOT
 * a source of prices, specs, or availability — live inventory / focus keep
 * last-word authority. Event labels are untrusted DISPLAY text: they are shown
 * inside the delimited block and defensively stripped of any price-looking
 * tokens, never treated as instructions.
 */
import { getRecentJourney, type JourneyEvent } from '../journey';
import type { D1Like } from '../state';
import type { JourneyConfig } from '../visitor';

/** Strip any price-looking token so the journey block can never carry a price. */
function stripPrices(text: string): string {
  return text.replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** Render one event to a short past-tense clause, or '' to omit it. */
function renderEvent(ev: JourneyEvent): string {
  const label = ev.label ? stripPrices(ev.label) : '';
  switch (ev.event_type) {
    case 'search':
      return label ? `searched "${label}"` : 'ran a search';
    case 'listing':
      return label ? `viewed "${label}"` : 'viewed a listing';
    case 'compare': {
      // `ref` is a comma-joined id list; derive an honest count.
      const n = ev.ref ? ev.ref.split(',').filter(Boolean).length : 0;
      return n > 0 ? `compared ${n} vehicle${n === 1 ? '' : 's'}` : 'compared vehicles';
    }
    case 'chat':
      return 'chatted with us';
    default:
      return '';
  }
}

/**
 * Resolve the visitor's recent journey into a delimited CONTEXT-ONLY block, or
 * `null` when there's nothing to fold or on any failure (fail-open). Consecutive
 * duplicate clauses are collapsed so a burst of identical events reads cleanly.
 */
export async function resolveJourney(
  db: D1Like | undefined,
  visitorId: string | null,
  cfg: JourneyConfig,
): Promise<string | null> {
  if (!cfg.enabled || !db || !visitorId) return null;
  try {
    const events = await getRecentJourney(db, visitorId, cfg.maxEventsFolded);
    if (!events.length) return null;

    // getRecentJourney returns newest-first; reverse to a chronological narrative.
    const clauses: string[] = [];
    for (const ev of [...events].reverse()) {
      const clause = renderEvent(ev);
      if (!clause) continue;
      // Collapse consecutive duplicates ("viewed X; viewed X" → "viewed X").
      if (clauses[clauses.length - 1] === clause) continue;
      clauses.push(clause);
    }
    if (!clauses.length) return null;

    const trail = clauses.join('; ');
    return [
      '=== VISITOR JOURNEY (context only, not a price/stock source) ===',
      `Earlier this visitor: ${trail}.`,
      'Use only for continuity (a natural "picks up where they left off" feel); it is NOT a source of prices, specs, or availability.',
      '=== END VISITOR JOURNEY ===',
    ].join('\n');
  } catch (err) {
    console.error('[grounding] Journey resolution failed (omitting journey)', err);
    return null;
  }
}
