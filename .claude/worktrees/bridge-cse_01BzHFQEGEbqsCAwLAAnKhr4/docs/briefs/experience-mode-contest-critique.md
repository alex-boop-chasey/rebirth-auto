# Experience Mode — Contest Critique (Agent 3, the critic)

_Contest report · Agent 3 · reviews Candidate A (`/labs/experience`) and Candidate B
(`/labs/experience-alt`). Proposes nothing of its own — this is evidence and trade-offs for the
owner and orchestrator to judge. Read-only review; no source files were modified._

## Method

Read both briefs, both SSR routes, both engines (`matcher.ts` vs `taste.ts`), both view layers
(`ExperienceCanvas.astro` vs `ShowroomTour.tsx`), and `src/config/dealer.ts` for the config surface
each leans on. Both routes return **200** on the running dev server. I also inspected the **real
inventory payload** the pages actually ship, because the demo stock materially changes how each
engine behaves — and neither brief's "verification" exercised it.

### The single most important finding: the demo stock breaks both engines' assumptions

The live lot (24 vehicles fetched SSR) is almost entirely **brand-new / ex-demo, model-year
2025–2026, with odometers under ~3,000 km**, and the **cheapest car is $25,990** (a Chery Tiggo 4);
**nothing is under $20k**. There are also **exact-duplicate listings** (two "2026 Chery Tiggo 4
Hybrid Ultimate" at $31,490; two "2026 Chery Tiggo 4 Ultimate" at $25,990). This is not a side note
— it directly exposes honesty and "does-the-wow-land" problems in _both_ candidates, detailed below.

---

## Candidate A — "The Concierge" (`/labs/experience`)

Question-led curation: three scripted questions → deterministic `curate()` → three ranked cards with
spec-derived "why it fits" chips. Framework-free vanilla engine.

### Strongest thing
The **honest-reasons layer is genuinely clean and legible**. `scoreOne()`
(`matcher.ts:266–326`) only ever emits a chip from a spec the car actually carries — `4WD → ready
for the rough stuff`, `Seats 7 — room for everyone`, `Only 25 km on the clock` — and dedupes/caps to
two. There is no `Math.random`, no module clock, and a stable multi-key sort
(`matcher.ts:255–261`), so identical answers yield an identical shortlist. The "boom" is easy to read
and reliably lands: the shopper sees _why_, which is exactly the thing a brochure site can't do.

### Weaknesses & risks
- **Config-as-data violation (hard-constraint level).** All dealer-tunable thresholds are
  **hardcoded in feature code**, not read from `dealerConfig`: budget bands `22000` / `30000` /
  `20000` / `42000` / `38000` (`matcher.ts:95,153,207,214,221`), low-km ceiling `40000`
  (`matcher.ts:183`), "newest" floor `2023` (`matcher.ts:192`). AGENTS.md says _"Never hardcode a
  dealer value anywhere else."_ Worse, A's low-km ceiling of **40,000** contradicts the site's
  canonical `lookup.lowKmThreshold` of **60,000** (`dealer.ts:771`) — so "low kms" means two
  different things in two parts of the same product. Onboarding a second tenant means editing the
  engine. The brief calls `QUESTIONS` "the analogue of `dealer.ts` concepts," but it is not in
  config — it only aspires to be.
- **Silent over-budget picks — demonstrable on the real lot.** Budget is a soft penalty, never an
  exclusion (`matcher.ts:308–320`), and the "within budget" chip is added _only_ when in-band
  (`matcher.ts:313`). So the **"Under $20k"** answer, against a lot whose cheapest car is $25,990,
  returns a top card priced **$25,990+ with a real price shown but no "over budget" flag of any
  kind**. The brief admits this needs a "just over budget" chip; the real stock guarantees it fires
  for a plausible shopper. Not a fabricated fact, but a **misleading omission** at exactly the moment
  trust matters.
- **Over-asserted ranking labels on weak matches.** `curate()` always returns up to three cars even
  when every score is zero or negative, and `cardHtml()` unconditionally stamps them **"Top pick /
  Also great / Worth a look"** (`ExperienceCanvas.astro:551`). On a mismatched answer set the
  shopper is told a poor fit is the "Top pick." The fallback chip **"A solid all-rounder"**
  (`ExperienceCanvas.astro:558`) is also the one non-spec-derived claim in the whole flow — mild, but
  it is Rebi asserting something the data didn't say.
- **Weak discriminators on this stock.** "Barely driven" (`lowKmUnder 40000`) and "The latest"
  (`newerFrom 2023`) match **essentially every car in the lot**, so two of the five priority options
  carry almost no signal here; the top-3 is then decided mostly by body-type and budget. The brief's
  "thin/duplicated stock repeats models" caveat is real — the duplicate Cherys can occupy two of
  three cards.
- **Image URL double-query-string bug.** The mapped `image` already carries a full query string
  (`…?rect=…&w=640&h=400&fit=crop`, confirmed in the shipped payload), and `cardHtml()` appends a
  **second** `?w=640&h=400&fit=crop&auto=format` (`ExperienceCanvas.astro:554`), producing a
  malformed `…&fit=crop?w=640…` URL. The image usually still loads (the first query already sizes
  it), but `auto=format` is silently lost and the URL is invalid. Cosmetic today, sloppy, and a
  latent breakage if the CDN tightens parsing.

### Edge cases
- **Cold start / no free text.** Fixed 3-question quiz, no "or just tell me" affordance — the brief's
  own acknowledged gap; it can feel like a form, which is the very thing the feature set out to
  escape.
- **No-JS:** graceful — there's a real `<noscript>` fallback to the classic inventory
  (`ExperienceCanvas.astro:56–61`).
- **Accessibility:** reduced-motion is handled (typewriter writes text directly, animations disabled,
  `ExperienceCanvas.astro:306–310`); options are real focusable buttons with `:focus-visible`. But
  **focus is dropped on every beat** — `canvas.replaceChildren()` (`:384`) tears down the focused
  node, so a keyboard/AT user is bounced to `<body>` and must re-tab each transition. The typewriter
  also gates option reveal behind the typing animation (`:481`), adding latency for non-reduced-motion
  users.
- **Mobile:** handled — orb hidden and margins collapsed under 640px (`:302–305`).

### Fixable-polish vs fundamental
Over-budget flag, "solid all-rounder" filler, image bug, focus management, and moving the thresholds
into `dealerConfig` are all **fixable polish**. What is **fundamental to the approach**: it front-
loads a quiz and hands back a frozen list — it is the salesperson-with-a-clipboard, and no amount of
polish makes the interaction itself feel like Rebi _driving_ a canvas rather than powering a smarter
search form.

---

## Candidate B — "The After-Hours Walk" (`/labs/experience-alt`)

Implicit-preference tour: full-bleed cinematic car → Love / Not for me / Tell me more → live taste
vector re-ranks the unseen queue → payoff collects loved cars, deep-linked to real listings. React 19
island.

### Strongest thing
It is the **more literal expression of "AI drives the screen as a canvas."** The screen _is_ the car,
Rebi narrates over it, and the interface advances itself (hands-free auto-walk with a progress ring,
`ShowroomTour.tsx:143–162,345–353`). Config-as-data is **clean**: price bands, low-km threshold and
family-seat count are read from `dealerConfig.chat.grounding` at the SSR seam
(`experience-alt.astro:65–71`) — reusing the site's canonical tunables so the taste engine speaks the
same "budget/family/low-kms" language as the chatbot. And it **closes A's dead-end**: every loved car
and every on-canvas car deep-links to its real `/listings/[slug]` (`ShowroomTour.tsx:261,446`), so the
experience feeds the rest of the site.

### Weaknesses & risks
- **Universal tokens masquerade as learned taste — a credibility problem, provable on this stock.**
  Tokens are bucketed against the dealer thresholds (`taste.ts:79–93`). With `lowKmThreshold = 60000`
  and `nearNewWithinYears = 3` (current year 2026), **every car in the lot is `km:low` and every car
  is `era:near-new`** (max odo ~3,000; all 2025–2026). So the moment the shopper loves _any_ car,
  those two tokens gain weight, and `topLeanings()` / `tasteRead()` surface **"low-kilometre
  examples · near-new stock"** for _every_ shopper regardless of what they reacted to
  (`taste.ts:232–242`, `ShowroomTour.tsx:512–518`). Rebi's "here's your taste" read — the emotional
  payoff — reports a trait shared by 100% of stock as if it were personal insight. It is technically
  true of the loved cars and therefore not a fabrication, but it is **non-informative and identical
  across users**, which undercuts the exact "it read me" wow the mode is selling.
- **The re-ranking's value is nearly invisible on homogeneous stock.** With most cars being near-new
  petrol/hybrid SUVs in one or two price bands, `pickNext()` (`taste.ts:126–145`) has little to
  differentiate, so the "smart steering" the whole concept rests on is subtle-to-imperceptible here —
  the brief's own caveat, confirmed by the data. On this lot it can read as a swipe-gallery
  ("Tinder for cars") rather than something that measurably saves the shopper work.
- **"Tell me more" is silently a preference signal.** Clicking through the expanded facts dispatches
  `react('more')` (`ShowroomTour.tsx:439`), a **+1 soft-positive** (`taste.ts:99–103`). Curiosity
  about a car you're skeptical of nudges Rebi _toward_ it. Defensible, but the shopper isn't told
  that reading = leaning-in, so the taste vector can drift in a direction they didn't intend.
- **Cold-start lead car is arbitrary.** The first car is `pickNext` with empty prefs → original array
  order → **first row of an unordered GROQ query**. Neither route pins `order()` (query is
  `…[0...24]{…}` with no sort in both `experience.astro:27` and `experience-alt.astro:29`), so the
  "lead car" Rebi opens on is whatever Sanity returns first, and can shift between fetches. The brief
  calls it "the lot's lead vehicle," implying intent it doesn't have.
- **The production path puts an LLM into the honesty-critical path.** B's whole premium upgrade is
  swapping templated narration for `generateStream` so Rebi narrates each car in real prose (brief,
  "productionised version"). That is precisely where spec embellishment/hallucination enters — the
  deterministic floor here governs _which car_ is shown, **not what is said about it** once prose is
  model-generated. Wiring in the chatbot's anti-hallucination `verify` firewall becomes mandatory,
  not optional. (Contrast A, whose LLM upgrade only chooses _questions_; its facts stay templated.)

### Edge cases
- **No-JS:** **no fallback.** The island is `client:load` with no `<noscript>` (`experience-alt.astro`
  has none); JS-off gets a blank page. Mitigated by `noindex` and "premium interactive" framing, but
  it's a real gap A doesn't have.
- **Accessibility:** reduced-motion is well handled — it disables Ken-Burns, car-enter _and_ pauses
  auto-advance (`ShowroomTour.tsx:141–142,320,326`), and there's a real Pause control (WCAG 2.2.2).
  But a **non-reduced-motion AT user gets cars auto-swapping every 9s** under them; and because the
  Love/Pass/More buttons **persist across car changes**, focus stays put but now applies to a
  _different_ car with no announcement — a subtle "you reacted to the wrong car" hazard.
- **No-love ending is honest:** empties degrade gracefully ("keeping your options open," "that's the
  lot for tonight," `ShowroomTour.tsx:237,251,290`) and the empty-lot state is handled (`:172–184`).
- **Light-first guideline:** the tour is full-bleed **dark** (`bg-slate-900`, `:317`), a deliberate
  cinematic choice but a departure from the project's stated light-first UI guideline (onboarding /
  standby / shortlist stay light).

### Fixable-polish vs fundamental
The `noscript` fallback, the "more = preference" disclosure, pinning `order()`, and even suppressing
non-discriminating universal tokens from the taste read are **fixable polish**. What is
**fundamental**: the payoff quality is hostage to lot _variety_ — on clustered stock the learning is
invisible and the taste read is generic — and the premium production wow (LLM prose narration) can
only be delivered by moving an LLM into the claim path, which raises the honesty bar rather than
lowering it.

---

## Head-to-head

| Criterion | Candidate A — Concierge | Candidate B — After-Hours Walk |
|---|---|---|
| **Fit to "AI drives the canvas"** | Partial — Rebi drives a _questionnaire_, then hands back cards | **Stronger** — the screen _is_ the car; Rebi drives continuously, even hands-free |
| **Genuine value over filter+grid** | Clear & legible: 3 taps + _reasons_ (the chips are the moat) | Novel (zero vocabulary) but value is subtle; risks feeling like a swipe gallery on this stock |
| **The wow / "boom"** | Reliable, legible reveal; reads a touch like a fancy search result | Higher ceiling (cinematic), but the "it read me" magic **doesn't land on homogeneous stock** |
| **Honesty / determinism** | Deterministic; **silent over-budget picks**, over-asserted "Top pick" labels, one filler claim | Deterministic ranking; **universal tokens surface as fake "taste"**; "more" is a hidden signal |
| **Anti-hallucination floor in production** | **Robust** — LLM only picks questions; facts stay templated | **Weaker** — premium upgrade = LLM prose _in the claim path_; needs the chatbot firewall wired in |
| **Cold start / thin stock** | Fixed quiz, no free text; duplicates can repeat in top-3 | Arbitrary lead car; re-ranking near-invisible when stock is clustered |
| **Accessibility** | `<noscript>` ✓, reduced-motion ✓, but **focus lost every beat** | Reduced-motion ✓ + pause control ✓, but **no `<noscript>`**, auto-advance shifts content under AT |
| **Config-as-data / multi-tenant** | **Violates** it — budget/low-km/year hardcoded in engine; low-km disagrees with site's 60k | **Clean** — thresholds read from `dealerConfig.chat.grounding` |
| **Journey / listings integration** | Weak — picks link only to `/`, no per-car deep link (dead-end) | **Strong** — every car & loved pick deep-links to `/listings/[slug]`; loved-set is a natural journey artifact |
| **Code quality & risk** | Framework-free, tiny bundle; ~600-line string-templated DOM; image-URL bug | Idiomatic React 19, pure testable engine; larger bundle + a live rAF timer; more moving parts |
| **Determinism at the data seam** | Shared gap: no `order()` on the GROQ query → tie-breaks can shift between fetches | Shared gap: same unordered query → cold-start lead car can shift between fetches |

---

## Trade-offs for the owner to weigh

1. **Legible-and-safe vs cinematic-and-riskier.** A's value proposition (reasoned curation) is easy
   to grasp and its facts stay deterministic even in production — the safer path to "genuinely better
   than filter+grid," but it interacts like a smarter search form, not Rebi driving a canvas. B is the
   truer expression of the "AI is the interface" lens and has the higher wow ceiling, but its premium
   magic (live learning + eventual LLM narration) is the part most exposed to this demo lot's
   homogeneity and to hallucination risk.

2. **Where the honesty risk actually sits is different in kind.** A's is a **UX omission** (an
   over-budget car shown without a flag; a weak match still stamped "Top pick") — cheap to fix, but
   live right now on the real stock. B's is **conceptual** (a trait shared by 100% of inventory read
   back as personal "taste") plus a **production architecture** question (LLM prose in the claim path).
   A's floor holds better under productionisation; B's floor needs reinforcement to hold at all.

3. **Config-as-data and site integration cut cleanly for B.** B reuses the dealer's canonical
   grounding tunables and deep-links into real listings; A hardcodes dealer values in feature code
   (and even disagrees with the site's own "low kms" definition) and dead-ends at `/`. If the
   multi-tenant future and journey integration are weighted heavily, B is materially ahead here — and
   A's version of this is real engine surgery, not a config move.

4. **Both share two unforced gaps** worth noting regardless of choice: neither pins `order()` on the
   inventory query (so tie-breaks / cold-start are not truly stable across fetches), and **both are at
   the mercy of the near-new, tightly-clustered demo stock** — A's low-km/newest discriminators go
   flat and B's re-ranking goes quiet for the same underlying reason. Whichever wins, a more varied
   demo lot (or a curated demo subset) would flatter it, and stabilising the query order is a
   prerequisite for the determinism both briefs claim.

_No winner or synthesis is recommended here by design — the above is the evidence for the owner and
orchestrator to decide._
