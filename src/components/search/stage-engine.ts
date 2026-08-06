/**
 * Focus Stage — the cinematic 3D "theatre" carousel engine.
 * ------------------------------------------------------------------
 * Framework-free, client-only. Extracted VERBATIM from SearchDock (same timings,
 * easing and depth-model constants) so the same receding-card stage can be reused
 * by other surfaces (the corner Rebi chat widget). It owns the turn stack + the
 * depth/lift/scale/blur/opacity model; the host wires in the card-column
 * container, the aria-live element, reduced-motion, the "new search" handler and
 * a reply-sound hook via `opts`.
 *
 * No DOM is touched at module load — every DOM access lives inside the returned
 * methods — so it is safe to `import` from a client `<script>` (SSR never runs it).
 * The `.turn`/`.card`/`.bubble`/… styling comes from `stage.css`, namespaced
 * under `.focus-stage` (the class the host must put on the card-column container).
 *
 * Two hosts, two personalities:
 *   - SearchDock uses the descriptor pipeline (appendRebi/showTyping/landReply)
 *     and lets old cards retire past depth 4 (`retire` defaults true).
 *   - The ChatWidget passes `retire:false` (nothing is ever destroyed — cards
 *     stack) and drives the stage through the free-form card builders
 *     (addRebiCard/addHumanCard/addSystemCard/openStreamingRebiCard/addActionCard/
 *     addPinnedCard) so it can render an arbitrary conversation as focus cards.
 */

export type ReplyKind = 'greeting' | 'results' | 'nomatch' | 'unclear';
export type Descriptor = { kind: ReplyKind; text: string; count: number };

/** One button inside an action card (wrap-up / resolved prompt). */
export interface StageAction {
  label: string;
  onClick: () => void | Promise<void>;
  primary?: boolean;
}
export interface ActionCardSpec {
  title: string;
  sub?: string;
  actions: StageAction[];
}

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
  /** Sound hook fired the moment a descriptor reply lands (Rebi chime). Optional. */
  onReply?: () => void;
  /**
   * Retire cards once they recede past depth 4 (DOM + turns[] cleanup). Defaults
   * to `true` (SearchDock). The chat passes `false` so nothing is destroyed and
   * the whole conversation stays stacked (scroll-back UX is a later phase).
   */
  retire?: boolean;
  /**
   * Layout mode. OPT-IN — defaults to `'stage'` (the cinematic receding-card
   * carousel SearchDock/SmartSearch depend on — byte-for-byte unchanged). The
   * chat widget passes `'thread'`: turns stack in NORMAL vertical document flow,
   * newest at the BOTTOM, the container scrolls, and nothing recedes / blurs /
   * translateZ's. Every card builder keeps working in both modes.
   */
  layout?: 'stage' | 'thread';
}

export interface FocusStage {
  /** Live turn stack (newest last). Exposed for host guards; do not mutate directly. */
  readonly turns: HTMLElement[];
  layout: () => void;
  retire: (node: HTMLElement) => void;
  /** Seat a user turn; returns the card's mutable `.bubble` body element. */
  addUserTurn: (text: string) => HTMLElement;
  appendRebi: (d: Descriptor) => HTMLElement;
  showTyping: () => HTMLElement;
  landReply: (typing: HTMLElement, d: Descriptor) => void;
  clearStack: () => void;
  /** Seat a Rebi card from ready HTML; returns the mutable `.body` element. */
  addRebiCard: (html: string, isError?: boolean) => HTMLElement;
  /** Seat a Team (human) card from ready HTML; returns the mutable `.body` element. */
  addHumanCard: (html: string) => HTMLElement;
  /** Seat a centered, avatarless system notice; returns the mutable body element. */
  addSystemCard: (html: string) => HTMLElement;
  /**
   * Seat an empty Rebi card for streaming. `el` is the `.body` element the caller
   * fills via innerHTML per delta; `finalize` writes the complete text to the
   * aria-live region (and stops the debounced live mirror).
   */
  openStreamingRebiCard: () => { el: HTMLElement; finalize: (plainText: string) => void };
  /** Seat a wrap-up card (title + sub + action buttons) reusing the .actions/.newsearch visuals. */
  addActionCard: (spec: ActionCardSpec) => HTMLElement;
  /**
   * Pin an arbitrary element as a focal card that does NOT recede while active
   * (used for contact capture). Replaces any existing pinned card. Returns the
   * pinned turn element.
   */
  addPinnedCard: (content: HTMLElement) => HTMLElement;
  /** Remove the pinned card (its content element is detached, not destroyed). */
  unpinCard: () => void;
  /**
   * Seat arbitrary ready content (listing tiles, an action-pill row) as a normal
   * turn in the stack. Intended for THREAD mode — the host builds the DOM (it owns
   * the price/image/link rules) and this just seats + scrolls it. In stage mode it
   * still seats correctly; it simply also recedes like any other card.
   */
  addBlock: (content: HTMLElement) => HTMLElement;
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
  const RETIRE = opts.retire !== false; // default true (SearchDock); chat passes false
  // Layout mode. Default 'stage' → the cinematic path is byte-for-byte unchanged
  // (SearchDock / SmartSearch). 'thread' → normal vertical flow, newest at bottom.
  const THREAD = opts.layout === 'thread';
  // In thread mode the column flows its cards and scrolls; the `.thread` marker
  // switches stage.css from the absolute/receding model to document flow.
  if (THREAD) column.classList.add('thread');
  // Scroll the thread's scroll-parent to the newest card (thread mode only).
  const scrollToBottom = () => {
    const sc = column.parentElement;
    if (sc) sc.scrollTop = sc.scrollHeight;
  };

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
  // Team (human) avatar — a simple person, green accent applied via `.human` CSS.
  const PERSON =
    '<span class="avatar human" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="8" r="3.6"></circle>' +
    '<path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"></path>' +
    '</svg></span>';
  const REFRESH_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 2v6h6"></path><path d="M3.5 8a9 9 0 1 1-1 5"></path></svg>';

  const turns: HTMLElement[] = []; // newest last
  let pinned: HTMLElement | null = null; // the focal card that never recedes

  // Remove a card from the DOM AND from turns[] atomically (guards double-splice
  // so turns[] never leaks detached nodes — the design-critic fix).
  const retire = (node: HTMLElement) => {
    const idx = turns.indexOf(node);
    if (idx !== -1) turns.splice(idx, 1);
    if (node.parentNode) node.parentNode.removeChild(node);
  };

  const layout = () => {
    // Thread mode: no depth model — cards live in normal flow. Just keep the
    // newest turn in view. (Every inline transform/filter is neutralised by the
    // `.focus-stage.thread` CSS, so a stray value can never re-introduce recede.)
    if (THREAD) { scrollToBottom(); return; }
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
      // once fully receded, retire it (DOM + turns[]) to stay light — but only when
      // the host opted in (SearchDock). The chat keeps every card (retire:false).
      if (RETIRE && op === 0 && depth > 4) {
        const node = el;
        setTimeout(() => retire(node), REDUCED_MOTION ? 220 : 620);
      }
    }
  };

  // set a card's "just-born" state inline (inline styles beat CSS classes)
  const seatEnter = (turn: HTMLElement) => {
    turn.style.opacity = '0';
    // Thread mode: a plain opacity fade-in — no translate/scale/blur (those are
    // the carousel's language). CSS neutralises transform/filter here anyway.
    if (THREAD) return;
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
    // Thread mode: fade the new card in and keep it in view — no depth relayout.
    if (THREAD) {
      requestAnimationFrame(() => { turn.style.opacity = '1'; scrollToBottom(); });
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(layout));
  };

  // Append → track → born → settle. Shared by every card builder.
  const seatTurn = (turn: HTMLElement) => {
    column.appendChild(turn);
    turns.push(turn);
    seatEnter(turn);
    birth(turn);
  };

  // ---- reply descriptor → safe DOM (never raw innerHTML for dynamic text) ----
  const splitWords = (s: string): string[] => s.split(/(\s+)/).filter((t) => t.length > 0);

  // Tokenise a descriptor into ordered {text, count?} chunks + the plain string.
  const tokensFor = (d: Descriptor): { toks: { text: string; count?: boolean }[]; plain: string } => {
    // Only inject the count token when the copy actually has a {count} placeholder —
    // count-free results copy must render verbatim (no stray number spliced in).
    if (d.kind === 'results' && d.text.includes('{count}')) {
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

  const makeTurn = (kind: 'rebi' | 'user' | 'human' | 'system'): { turn: HTMLElement; card: HTMLElement } => {
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
    seatTurn(built.turn);
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
    seatTurn(turn);
    return bub;
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
    seatTurn(turn);
    return turn;
  };

  // The scroll continues: the dots card rolls UP and FADES away (releasing its
  // front slot), while the real reply is born from below and rolls into place.
  const landReply = (typing: HTMLElement, d: Descriptor) => {
    // release the dots card from the depth model so real cards hold position
    const idx = turns.indexOf(typing);
    if (idx !== -1) turns.splice(idx, 1);
    if (THREAD) {
      // Thread mode: fade the dots out and append the reply below — no recede.
      typing.style.transition = 'opacity 200ms linear';
      typing.style.opacity = '0';
      setTimeout(() => retire(typing), 220);
      onReply?.();
      appendRebi(d);
      return;
    }
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

  // ================= Free-form card builders (chat host) =================
  // These drive an arbitrary conversation. Content arrives as ready HTML (the
  // chat pre-formats + escapes it), so it goes in via innerHTML on the body; the
  // COMPLETE plain text is announced once via the shared live region.

  const announce = (el: HTMLElement) => { live.textContent = el.textContent || ''; };

  const addRebiCard = (html: string, isError = false): HTMLElement => {
    const { turn, card } = makeTurn('rebi');
    card.insertAdjacentHTML('afterbegin', AVATAR);
    const bub = document.createElement('div');
    bub.className = 'bubble' + (isError ? ' is-error' : '');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = 'Rebi';
    const body = document.createElement('span');
    body.className = 'body';
    body.innerHTML = html;
    bub.appendChild(name);
    bub.appendChild(body);
    card.appendChild(bub);
    seatTurn(turn);
    announce(body);
    return body;
  };

  const addHumanCard = (html: string): HTMLElement => {
    const { turn, card } = makeTurn('human');
    card.insertAdjacentHTML('afterbegin', PERSON);
    const bub = document.createElement('div');
    bub.className = 'bubble';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = 'Team';
    const body = document.createElement('span');
    body.className = 'body';
    body.innerHTML = html;
    bub.appendChild(name);
    bub.appendChild(body);
    card.appendChild(bub);
    seatTurn(turn);
    announce(body);
    return body;
  };

  const addSystemCard = (html: string): HTMLElement => {
    const { turn, card } = makeTurn('system');
    const bub = document.createElement('div');
    bub.className = 'bubble';
    const body = document.createElement('span');
    body.className = 'body';
    body.innerHTML = html;
    bub.appendChild(body);
    card.appendChild(bub);
    seatTurn(turn);
    announce(body);
    return body;
  };

  // Empty Rebi card whose body the caller fills per streamed delta. A debounced
  // MutationObserver mirrors the settled text into the live region so the reply is
  // announced ONCE after streaming quiesces (no per-delta spam); `finalize` forces
  // the announcement immediately and stops the observer.
  const openStreamingRebiCard = (): { el: HTMLElement; finalize: (plainText: string) => void } => {
    const { turn, card } = makeTurn('rebi');
    card.insertAdjacentHTML('afterbegin', AVATAR);
    const bub = document.createElement('div');
    bub.className = 'bubble';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = 'Rebi';
    const body = document.createElement('span');
    body.className = 'body';
    bub.appendChild(name);
    bub.appendChild(body);
    card.appendChild(bub);
    seatTurn(turn);

    let settle: ReturnType<typeof setTimeout> | null = null;
    const obs = new MutationObserver(() => {
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => { live.textContent = body.textContent || ''; }, 500);
    });
    obs.observe(body, { childList: true, subtree: true, characterData: true });

    const finalize = (plainText: string) => {
      if (settle) { clearTimeout(settle); settle = null; }
      obs.disconnect();
      live.textContent = plainText || body.textContent || '';
    };
    return { el: body, finalize };
  };

  // A centered wrap-up card: title + optional sub + action buttons, reusing the
  // .actions/.newsearch visuals. Async onClick handlers auto-disable every button
  // for the duration (double-tap guard), re-enabling only if the card survives.
  const addActionCard = (spec: ActionCardSpec): HTMLElement => {
    const { turn, card } = makeTurn('system');
    turn.setAttribute('data-action-card', '1');
    const bub = document.createElement('div');
    bub.className = 'bubble';

    const h = document.createElement('span');
    h.className = 'action-title';
    h.textContent = spec.title;
    bub.appendChild(h);
    if (spec.sub) {
      const s = document.createElement('span');
      s.className = 'action-sub';
      s.textContent = spec.sub;
      bub.appendChild(s);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const btns: HTMLButtonElement[] = [];
    spec.actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'newsearch' + (a.primary ? '' : ' ghost');
      btn.textContent = a.label;
      btn.addEventListener('click', async () => {
        btns.forEach((b) => { b.disabled = true; });
        try {
          await a.onClick();
        } finally {
          btns.forEach((b) => { if (b.isConnected) b.disabled = false; });
        }
      });
      actions.appendChild(btn);
      btns.push(btn);
    });
    bub.appendChild(actions);

    card.appendChild(bub);
    seatTurn(turn);
    live.textContent = spec.sub ? spec.title + '. ' + spec.sub : spec.title;
    return turn;
  };

  // Pin an element as the focal card that never recedes (contact capture). It is
  // NOT part of turns[], so layout() leaves it alone; it sits at the front slot
  // (opacity 1, no transform) above the receding stack.
  const addPinnedCard = (content: HTMLElement): HTMLElement => {
    unpinCard();
    const { turn, card } = makeTurn('system');
    turn.setAttribute('data-pinned', '1');
    card.appendChild(content);
    turn.style.opacity = '1';
    turn.style.transform = 'none';
    turn.style.filter = 'none';
    turn.style.zIndex = '900';
    column.appendChild(turn);
    pinned = turn;
    return turn;
  };

  const unpinCard = () => {
    if (pinned && pinned.parentNode) pinned.parentNode.removeChild(pinned);
    pinned = null;
  };

  // Seat arbitrary host-built content (listing tiles, an action-pill row) as a
  // normal turn. The host owns the markup (price/image/link rules live there); the
  // engine just tracks + seats + scrolls it. `.turn.block` renders full-width with
  // no avatar/bubble chrome (see stage.css thread rules).
  const addBlock = (content: HTMLElement): HTMLElement => {
    const turn = document.createElement('div');
    turn.className = 'turn block';
    turn.appendChild(content);
    seatTurn(turn);
    return turn;
  };

  // Clear every card from the stack (turns[] + DOM) and reset the live region.
  const clearStack = () => {
    turns.splice(0, turns.length);
    pinned = null;
    while (column.firstChild) column.removeChild(column.firstChild);
    live.textContent = '';
  };

  return {
    turns,
    layout,
    retire,
    addUserTurn,
    appendRebi,
    showTyping,
    landReply,
    clearStack,
    addRebiCard,
    addHumanCard,
    addSystemCard,
    openStreamingRebiCard,
    addActionCard,
    addPinnedCard,
    unpinCard,
    addBlock,
  };
}
