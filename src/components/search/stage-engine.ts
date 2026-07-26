/**
 * Focus Stage — the cinematic 3D "theatre" carousel engine.
 * ------------------------------------------------------------------
 * Framework-free, client-only. Extracted VERBATIM from SearchDock (same timings,
 * easing and depth-model constants) so the same receding-card stage can be reused
 * by other surfaces (e.g. the corner chat widget). It owns the turn stack + the
 * depth/lift/scale/blur/opacity model; the host wires in the card-column
 * container, the aria-live element, reduced-motion, the "new search" handler and
 * a reply-sound hook via `opts`.
 *
 * No DOM is touched at module load — every DOM access lives inside the returned
 * methods — so it is safe to `import` from a client `<script>` (SSR never runs it).
 * The `.turn`/`.card`/`.bubble`/… styling comes from `stage.css`, namespaced
 * under `.focus-stage` (the class the host must put on the card-column container).
 */

export type ReplyKind = 'greeting' | 'results' | 'nomatch' | 'unclear';
export type Descriptor = { kind: ReplyKind; text: string; count: number };

export interface FocusStageOptions {
  /** The card-column container cards are appended to (must carry `.focus-stage`). */
  column: HTMLElement;
  /** Polite aria-live region; receives the COMPLETE reply text once per landed card. */
  live: HTMLElement;
  /** Honour prefers-reduced-motion (opacity-only; no reveal/translate/scale/blur). */
  reducedMotion: boolean;
  /** Label for the "New search" button inside a results reply. */
  newSearchLabel: string;
  /** Invoked when the "New search" button in a results reply is clicked. */
  onNewSearch: () => void;
  /** Sound hook fired the moment a reply lands (Rebi chime). Optional. */
  onReply?: () => void;
}

export interface FocusStage {
  /** Live turn stack (newest last). Exposed for host guards; do not mutate directly. */
  readonly turns: HTMLElement[];
  layout: () => void;
  retire: (node: HTMLElement) => void;
  addUserTurn: (text: string) => HTMLElement;
  appendRebi: (d: Descriptor) => HTMLElement;
  showTyping: () => HTMLElement;
  landReply: (typing: HTMLElement, d: Descriptor) => void;
  clearStack: () => void;
}

export function createFocusStage(opts: FocusStageOptions): FocusStage {
  const {
    column,
    live,
    reducedMotion: REDUCED_MOTION,
    newSearchLabel,
    onNewSearch,
    onReply,
  } = opts;

  // ================= The Focus Stage depth engine =================
  // Newest card = depth 0 (front, sharp, at the bottom). Older cards recede
  // up + back, blurring and fading, tucking behind the shelf.
  const AVATAR =
    '<span class="avatar" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3.6v1.8"></path>' +
    '<circle cx="12" cy="2.7" r="1" fill="currentColor" stroke="none"></circle>' +
    '<rect x="4.5" y="6" width="15" height="12" rx="3.6"></rect>' +
    '<circle cx="9.2" cy="12" r="1.25" fill="currentColor" stroke="none"></circle>' +
    '<circle cx="14.8" cy="12" r="1.25" fill="currentColor" stroke="none"></circle>' +
    '<path d="M9.6 15.3h4.8"></path>' +
    '<path d="M2.6 10.6v2.8"></path>' +
    '<path d="M21.4 10.6v2.8"></path>' +
    '</svg></span>';
  const REFRESH_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 2v6h6"></path><path d="M3.5 8a9 9 0 1 1-1 5"></path></svg>';

  const turns: HTMLElement[] = []; // newest last

  // Remove a card from the DOM AND from turns[] atomically (guards double-splice
  // so turns[] never leaks detached nodes — the design-critic fix).
  const retire = (node: HTMLElement) => {
    const idx = turns.indexOf(node);
    if (idx !== -1) turns.splice(idx, 1);
    if (node.parentNode) node.parentNode.removeChild(node);
  };

  const layout = () => {
    const n = turns.length;
    for (let i = 0; i < n; i++) {
      const el = turns[i];
      const depth = n - 1 - i; // 0 = newest/front
      const lift = depth * 4.35; // rem up per step
      const push = depth * -78; // px back in Z
      const scale = Math.max(0.62, 1 - depth * 0.11);
      const blur = Math.min(6, depth * 2.1);
      const op = depth >= 4 ? 0 : Math.max(0, 1 - depth * 0.26);
      if (REDUCED_MOTION) {
        // opacity only — no translate/scale/blur
        el.style.transform = 'none';
        el.style.filter = 'none';
      } else {
        el.style.transform = 'translateY(-' + lift + 'rem) translateZ(' + push + 'px) scale(' + scale + ')';
        el.style.filter = blur ? 'blur(' + blur + 'px)' : 'none';
      }
      el.style.opacity = String(op);
      el.style.zIndex = String(100 + i);
      // once fully receded, retire it (DOM + turns[]) to stay light
      if (op === 0 && depth > 4) {
        const node = el;
        setTimeout(() => retire(node), REDUCED_MOTION ? 220 : 620);
      }
    }
  };

  // set a card's "just-born" state inline (inline styles beat CSS classes)
  const seatEnter = (turn: HTMLElement) => {
    turn.style.opacity = '0';
    if (REDUCED_MOTION) {
      turn.style.transform = 'none';
      turn.style.filter = 'none';
    } else {
      turn.style.transform = 'translateY(2.5rem) scale(.9)';
      turn.style.filter = 'blur(4px)';
    }
  };
  // force reflow, then settle everyone into their depth on the next frame
  const birth = (turn: HTMLElement) => {
    void turn.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(layout));
  };

  // ---- reply descriptor → safe DOM (never raw innerHTML for dynamic text) ----
  const splitWords = (s: string): string[] => s.split(/(\s+)/).filter((t) => t.length > 0);

  // Tokenise a descriptor into ordered {text, count?} chunks + the plain string.
  const tokensFor = (d: Descriptor): { toks: { text: string; count?: boolean }[]; plain: string } => {
    if (d.kind === 'results') {
      const parts = d.text.split('{count}');
      const before = parts[0] ?? '';
      const after = parts[1] ?? '';
      const countStr = String(d.count);
      const toks: { text: string; count?: boolean }[] = [];
      splitWords(before).forEach((t) => toks.push({ text: t }));
      toks.push({ text: countStr, count: true });
      splitWords(after).forEach((t) => toks.push({ text: t }));
      return { toks, plain: before + countStr + after };
    }
    return { toks: splitWords(d.text).map((t) => ({ text: t })), plain: d.text };
  };

  // Fill a .body element with word spans (or plain, reduced-motion). Server text
  // and the count go in via textContent — NEVER innerHTML. Visual words are
  // aria-hidden; the live region carries the complete text for AT.
  const renderBody = (body: HTMLElement, d: Descriptor): { wordSpans: HTMLElement[]; plain: string } => {
    const { toks, plain } = tokensFor(d);
    const wordSpans: HTMLElement[] = [];
    toks.forEach((tok) => {
      if (/^\s+$/.test(tok.text)) {
        body.appendChild(document.createTextNode(tok.text));
        return;
      }
      const span = document.createElement('span');
      span.className = 'word' + (tok.count ? ' count' : '');
      span.textContent = tok.text;
      span.setAttribute('aria-hidden', 'true'); // visual only
      if (REDUCED_MOTION) span.classList.add('lit'); // fully visible at once
      body.appendChild(span);
      wordSpans.push(span);
    });
    return { wordSpans, plain };
  };

  const makeTurn = (kind: 'rebi' | 'user'): { turn: HTMLElement; card: HTMLElement } => {
    const turn = document.createElement('div');
    turn.className = 'turn ' + kind;
    const card = document.createElement('div');
    card.className = 'card';
    turn.appendChild(card);
    return { turn, card };
  };

  // Build (but do not seat) a Rebi reply card from a descriptor.
  const buildRebiCard = (d: Descriptor): { turn: HTMLElement; wordSpans: HTMLElement[]; plain: string } => {
    const { turn, card } = makeTurn('rebi');
    card.insertAdjacentHTML('afterbegin', AVATAR); // trusted static markup
    const bub = document.createElement('div');
    bub.className = 'bubble';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = 'Rebi';
    const body = document.createElement('span');
    body.className = 'body';
    const { wordSpans, plain } = renderBody(body, d);
    bub.appendChild(name);
    bub.appendChild(body);
    card.appendChild(bub);
    if (d.kind === 'results') {
      const actions = document.createElement('div');
      actions.className = 'actions';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'newsearch';
      btn.innerHTML = REFRESH_ICON; // trusted static icon
      btn.appendChild(document.createTextNode(newSearchLabel));
      btn.addEventListener('click', onNewSearch);
      actions.appendChild(btn);
      bub.appendChild(actions);
    }
    return { turn, wordSpans, plain };
  };

  // Seat a Rebi reply card onto the stack (append → born → reveal → announce).
  const appendRebi = (d: Descriptor): HTMLElement => {
    const built = buildRebiCard(d);
    column.appendChild(built.turn);
    turns.push(built.turn);
    seatEnter(built.turn);
    birth(built.turn);
    if (!REDUCED_MOTION) revealWords(built.wordSpans);
    live.textContent = built.plain;
    return built.turn;
  };

  const addUserTurn = (text: string): HTMLElement => {
    const { turn, card } = makeTurn('user');
    const bub = document.createElement('div');
    bub.className = 'bubble';
    bub.textContent = text; // user text = plain, always textContent
    card.appendChild(bub);
    column.appendChild(turn);
    turns.push(turn);
    seatEnter(turn);
    birth(turn);
    return turn;
  };

  // word-by-word reveal (motion only; skipped under reduced motion)
  const revealWords = (spans: HTMLElement[]) => {
    spans.forEach((w, idx) => {
      setTimeout(() => w.classList.add('lit'), 40 + idx * 55);
    });
  };

  const showTyping = (): HTMLElement => {
    const { turn, card } = makeTurn('rebi');
    turn.setAttribute('data-typing', '1');
    turn.setAttribute('aria-hidden', 'true'); // dots are decorative; live carries "finding"
    card.insertAdjacentHTML('afterbegin', AVATAR);
    const bub = document.createElement('div');
    bub.className = 'bubble';
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.innerHTML = '<i></i><i></i><i></i>';
    bub.appendChild(dots);
    card.appendChild(bub);
    column.appendChild(turn);
    turns.push(turn);
    seatEnter(turn);
    birth(turn);
    return turn;
  };

  // The scroll continues: the dots card rolls UP and FADES away (releasing its
  // front slot), while the real reply is born from below and rolls into place.
  const landReply = (typing: HTMLElement, d: Descriptor) => {
    // release the dots card from the depth model so real cards hold position
    const idx = turns.indexOf(typing);
    if (idx !== -1) turns.splice(idx, 1);
    if (REDUCED_MOTION) {
      typing.style.transition = 'opacity 200ms linear';
      typing.style.opacity = '0';
    } else {
      typing.style.transform = 'translateY(-4.6rem) translateZ(-78px) scale(0.88)';
      typing.style.filter = 'blur(3px)';
      typing.style.opacity = '0';
    }
    setTimeout(() => retire(typing), REDUCED_MOTION ? 220 : 640); // atomic DOM + turns[] cleanup

    // the reply rolls up into the front slot, word-by-word, with its chime
    onReply?.();
    appendRebi(d);
  };

  // Clear every card from the stack (turns[] + DOM) and reset the live region.
  const clearStack = () => {
    turns.splice(0, turns.length);
    while (column.firstChild) column.removeChild(column.firstChild);
    live.textContent = '';
  };

  return { turns, layout, retire, addUserTurn, appendRebi, showTyping, landReply, clearStack };
}
