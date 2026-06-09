# Loopduel — Juice Improvement Proposal

> Synthesis of `docs/_juice-audit.md` (current-state audit) and `docs/_juice-research.md` (industry technique + DOM/CSS implementation guidance). Every recommendation honors the stack constraint: **React 19 + Vite + TS, DOM + CSS rendering, no canvas/WebGL (one optional non-gameplay `<canvas>` overlay allowed for celebration particles only), no animation library, animate only `transform`/`opacity`, ~16.7ms frame budget across multiple player panels, and `prefers-reduced-motion` honored.**

## Framing

The core motion engine is already good and should **not** be rebuilt. The runner-travel hot path is RAF-driven and writes `transform: translate3d()` directly to the runner/highlight with no React re-render and no layout (`game-ui.tsx:618`), and the combat overlay is a genuinely rich, well-tuned sequence — overlay pop, stage-hit nudge, attacker lunge, defender hit-shake, sprite-sheet slash FX, bouncing damage floats, and a result plaque, all on `transform`/`opacity`/`filter` and gated by Playwright smoothness checks (`scripts/playwright-motion-audit.mjs`, `scripts/playwright-autopsy.mjs`). The combat *engine* is the thing the game does well.

**Thesis: the biggest wins are the un-juiced reward moments.** Combat is lavished with feel while the moments that should pay the player off — winning the match, levelling up, picking up loot, spending a card, taking a hit on the open board — currently just *pop* with zero motion or with a single tiny text floater. These are the highest-leverage, lowest-risk additions because they sit *outside* the gated hot path, they're fire-and-forget, and they map directly to canonical juice techniques (celebration burst, scale-punch, pop+drift damage text, squash & stretch, impact flash). Layered on top: add the cheapest highest-impact thing of all per the research — **a WebAudio hit/crit layer** (none exists today; only a BGM `<audio>` tag at `App.tsx:887`/`:439`) — and clean up two latent perf liabilities the audit flagged (`width`-animated HP bars in the combat hot path, and permanent `will-change` on hand cards) plus a leaky reduced-motion allowlist.

---

## Tier 1 — Quick wins (high impact / low risk / hours each)

All Tier 1 items are self-contained CSS `@keyframes` or WAAPI fire-and-forget effects on `transform`/`opacity` only. None touch the gated runner path.

### 1.1 Victory / defeat celebration on the end screen
- **Moment:** match ends; the single biggest payoff in the game.
- **Renders today (static, no animation):** `.winner-strip` at `App.tsx:897-907` (styles `styles.css:1055`) and `.match-summary` at `App.tsx:908-937` (styles `styles.css:1081`). They appear instantly with no entrance.
- **Technique (research §a "Juice It or Lose It", easing, damage-number anatomy):** ease-out entrance with overshoot + a staggered reveal of the four leaderboard cards.
  - Add `@keyframes winner-strip-in` → `from { opacity:0; transform: translateY(-12px) scale(.96) }` with `cubic-bezier(.18,.9,.2,1.08)` (reuse the `combat-pop` curve), ~420ms.
  - Add `@keyframes summary-card-in` → `from { opacity:0; transform: translateY(14px) scale(.9) }` ~360ms ease-out; stagger via `animation-delay: calc(var(--rank-index) * 70ms)` driven off the existing `entry.rank`/map index in `App.tsx:911`.
  - Give the winner card (`.summary-card.winner`, already keyed at `App.tsx:915`) one extra scale-punch pulse (`scale(1)→1.05→1`) and pair it with a brief gold opacity flash overlay (`::after`, `opacity` only — not `box-shadow`).
- **Properties:** `opacity` + `transform` only. **Effort:** ~3h.

### 1.2 Level-up punch
- **Moment:** player gains a level. Today it surfaces only as a tiny `+1 Lv` text floater.
- **Renders today:** floater logic at `game-ui.tsx:2310` (`if (levelDelta > 0) addFloater(\`+${levelDelta} Lv\`, 'xp')`), styled via `runner-floater` `@keyframes runner-floater-rise` (`styles.css:1997`). Note `tier-surge` (`game-ui.tsx:2511`) fires only on act/tier transitions, **not** ordinary level-ups.
- **Technique (Vlambeer impact-flash + scale-punch; damage-number "spawns large, bounces"):** when `levelDelta > 0`, in addition to the existing floater, imperatively add a one-shot `.level-up-punch` node into the same `runnerFloatersRef` container (`game-ui.tsx:2314-2330`) that the floaters already use, and add a `.leveled-up` class to the runner panel for the animation lifetime.
  - `@keyframes level-up-ring`: a ring element scaling `scale(.4)→scale(1.6)` while fading `opacity 1→0`, ~520ms ease-out (pure transform/opacity, no `box-shadow` animation).
  - Make the `+Lv` floater itself bigger/bolder for level vs XP by giving the level floater its own tone class with a larger spawn scale that overshoots and settles.
- **Properties:** `transform` + `opacity`. **Effort:** ~2–3h.

### 1.3 Loot / relic pickup moment
- **Moment:** loot/gold/relic acquired. Today only a `+Ng`/text floater (`game-ui.tsx:2302,2309`); relics — framed as the rarest tier (`game-ui.tsx:435,497`) — appear silently in inventory.
- **Technique (Vlambeer "permanence" + pop; rarity-scaled exaggeration):** reuse the floater container for a brief "toss + settle" of an item glyph, and for relics show a short "RELIC" plaque that scales in and fades (same pattern as `combat-result-plaque`, `styles.css:4062`).
  - `@keyframes loot-toss`: `transform: translateY(0) scale(.6)` → overshoot `translateY(-10px) scale(1.1)` → settle, `opacity` 0→1→0, ~700ms.
  - Rarity scales amplitude: common = small, relic = larger + brief gold opacity flash overlay.
- **Properties:** `transform` + `opacity`. **Effort:** ~3h (relic plaque +1h).

### 1.4 Card-play exit animation
- **Moment:** a card is spent. Today the entrance (`card-deal-in`, `styles.css:5169` / applied `:4513`) is satisfying but the exit is instant — the card just vanishes (audit gap #4; the motion-audit only checks the hand count drops).
- **Renders today:** hand buttons mapped at `game-ui.tsx:1024-1042`, keyed by `card.instanceId`; played card is simply removed from `hand`.
- **Technique (squash & stretch + follow-through; Slay-the-Spire "card goes somewhere"):** before removing the card from state, add an `.exiting` class and let a CSS animation play, removing the node on `animationend`. A pure-CSS dissolve/launch is the low-risk version; the fly-to-board FLIP version is Tier 2 (§2.2).
  - `@keyframes card-burn-exit`: `transform: translateY(-26px) scale(1.08) rotate(2deg)` + `opacity 1→0`, ~260ms ease-in. Squash on launch (`scale(0.92,1.12)`) then fade.
  - Keep it **non-blocking** (research: never gate input on animation) — the game-state removal proceeds; only the visual node lingers briefly.
- **Properties:** `transform` + `opacity`. **Effort:** ~3h.

### 1.5 Out-of-combat HP-hit flash
- **Moment:** taking damage on the open board. Audit gap #6: reads as a slow width slide, nearly invisible.
- **Renders today:** top HP track `transition: width 680ms` (`styles.css:1493`) and runner HP plate `background-size 260ms` (`styles.css:1963`); the damage already flows through the floater diff at `game-ui.tsx:2300,2307` (`hpDelta`).
- **Technique (Vlambeer impact flash + small shake):** when `hpDelta < 0`, add a transient `.hp-hit` class to the runner panel for ~300ms.
  - Red impact flash via an overlay layer's `opacity` (0→.55→0) — **not** animating `background`/`box-shadow` (paint).
  - A tiny decaying panel shake `@keyframes hp-hit-shake` (`translate3d` ±3px, ~3 cycles decaying, ~280ms). Keep amplitude small per the over-shake warning.
- **Properties:** `transform` + `opacity`. **Effort:** ~2h. (Converting the bars off `width` is the cleanup item §2.2 / Guardrails.)

---

## Tier 2 — Medium

### 2.1 WebAudio hit / crit / play layer  *(research: "highest-leverage juice per unit effort" — do this early)*
There is no SFX layer today (only a BGM `<audio>` at `App.tsx:887`). Add a tiny `audio.ts` module wrapping a single `AudioContext` (created/resumed on first user gesture), with a small pool of decoded buffers for: card play, combat hit, crit, loot pickup, level-up, victory, defeat. Pitch-vary repeated sounds ±a few percent to avoid machine-gun sameness. Trigger from the same call-sites as the Tier-1 visuals (card play `game-ui.tsx:1035`, the stat-diff effect block `game-ui.tsx:2300-2312`, combat beat application). Gate behind a settings toggle and respect a "reduce effects" preference. **Effort:** ~6–8h incl. asset sourcing.

### 2.2 FLIP-based card/tile moves + HP bars off `width`
- **FLIP** (research §b) for card → board/discard and tile reorders: measure `getBoundingClientRect()` First/Last, invert with `transform`, play to identity via WAAPI. Upgrades §1.4's dissolve into a true fly-to-target.
- **HP bars:** convert the three `width`-transition bars to `transform: scaleX()` with `transform-origin:left` so they leave the layout/paint hot path: combat bar `styles.css:2742`, top track `styles.css:1493`, enemy stack `styles.css:3778`. This is the audit's "combat bars are the layout-thrashing ones in the hottest path" fix and unblocks a chip-damage ghost segment. **Effort:** ~6h.

### 2.3 Hit-stop on big combat beats
On crit / killing-blow beats, briefly pause the overlay's animations (~50ms, up to ~120ms for a finisher) **before** releasing the shake + damage number (research §a, "freeze, then erupt"). Sequence with WAAPI `await anim.finished` or `animation-play-state` toggled on `.combat-stage` for a few frames keyed off `presentationPhase` (`game-ui.tsx:2600-2605`). **Effort:** ~4h.

### 2.4 Decaying screen-shake utility
Extract the one-off `combat-stage-hit` nudge (`styles.css:4047`) into a reusable JS utility that applies a short, **always-decaying-to-zero** `translate3d` shake on any wrapper, amplitude scaled by event magnitude (crit > normal). Drive via WAAPI on a single wrapper element; reuse for §1.5 board hits and big-score moments. Behind the screen-shake toggle. **Effort:** ~4h.

---

## Tier 3 — Ambitious

### 3.1 Canvas particle overlay for victory bursts *(the one sanctioned canvas exception)*
A single non-gameplay `<canvas>` overlay component, pixel-drawn, never restyled, mounted only on victory for a confetti/spark burst — the research's explicit escape hatch for celebration-scale particles (DOM freezes around ~250 particles). Keep it isolated so the "no canvas for gameplay" rule holds. Pairs with §1.1. **Effort:** ~1–1.5d.

### 3.2 Balatro-style spring/velocity card tilt
Hovered/held cards rotate via `perspective` + `rotateX/Y` proportional to pointer velocity/offset, then spring back; plus a subtle idle wobble. Pure `transform`; this is the one place a small RAF/WAAPI spring is justified, scoped to a single hovered card so it can't multiply across panels. Replaces the static hover lift (`styles.css:4826`). **Effort:** ~1–2d.

### 3.3 Unified juice/feedback system
A single `useFeedback()` hook / event bus that fans game events (hit, crit, level-up, loot, KO, victory) out to coordinated visual + audio + shake responses, with global caps (e.g. ≤40 on-screen particles/floaters total **across all panels**, not per panel) and JIT `will-change` management. Consolidates the imperative floater logic (`game-ui.tsx:2314-2330`) and the Tier-1/2 effects into one budgeted, reduced-motion-aware layer. **Effort:** ~3–5d.

---

## Performance & accessibility guardrails (cross-cutting)

- **Transform/opacity rule:** every new effect animates **only** `transform` and `opacity` (flashes via an overlay layer's `opacity`, never animated `box-shadow`/`background`/`filter`/`width`). This keeps work on the compositor thread, off React's busy main thread, and within the ~10ms-of-our-work-per-frame RAIL animation budget across multiple panels.
- **`will-change` budgeting (cleanup item):**
  - `.hand-card` declares `will-change: transform, opacity` **permanently** (`styles.css:4512`) — with a full hand this pins several always-on compositor layers. Remove the static declaration; apply `will-change` JIT (add on hover/drag/play-exit start, remove on `animationend`/`transitionend`). The Tier-3 spring tilt (§3.2) should manage it per-card.
  - `.combat-overlay` keeps `will-change` for its whole life (`styles.css:2969`) — acceptable since it's short-lived and single-instance, but verify it's demoted on phase exit.
  - HP bars currently animate `width` (`styles.css:1493,2742,3778`) → migrate to `transform: scaleX()` (§2.2) to remove per-beat layout/paint in the combat hot path.
- **Reduced-motion strategy — invert the allowlist:** today `@media (prefers-reduced-motion: reduce)` (`styles.css:337-362`) is an explicit *allowlist* (kills parallax, clamps a named set to 1ms), so **anything not enumerated still animates** — `card-deal-in`, `slot-drop-pulse`, `drag-card-float`, `trait-pulse`, `target-ring`, `stun-wobble`, `tier-surge`, and every new Tier-1 effect would leak through. **Invert it to opt-out** (research §b pattern):
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
  ```
  then selectively re-enable a few *essential, gentle* opacity-only cues (e.g. HP-hit flash without the shake, a soft win fade). Also add an **in-game "reduce effects" + "disable screen shake" toggle** independent of the OS setting (the WebAudio layer and §2.4 shake both read it). Keep any flash ≤3/sec for photosensitivity.
- **Caps & non-blocking:** pool/cap floaters and particles **globally across panels** (extend the existing `childElementCount > 8` cap at `game-ui.tsx:2327` into a shared budget). Never gate gameplay input on animation completion — effects overlap, they don't serialize.
- **Verification via existing gates:** run `scripts/playwright-motion-audit.mjs` (zero runner/sprite remounts, sprite opacity ≥0.98, single sprite source, board-shift ≤1.5px, runner drift ≤0.08%, no backward cursor jumps >0.22) and `scripts/playwright-autopsy.mjs` (frame-gap p95 ≤180ms / p99 ≤360ms, delta-apply p95 ≤20ms, no horizontal overflow, no board-shift/occlusion, zero console/page errors) after each tier. New end-screen/level-up/loot effects sit outside the runner path but **must not regress** these numbers; add a targeted autopsy trace around victory and a busy combat beat. Profile on a throttled (4–6×) mid-range CPU with multiple panels, and use Paint Flashing to confirm no new repaints during the new transform animations.

---

## Suggested sequencing

1. **Ship the reduced-motion inversion + `will-change`/HP-bar cleanup first (Guardrails).** It's a prerequisite: every Tier-1 effect we add would otherwise leak past the current allowlist and accrue accidental compositor layers. Low risk, makes everything after it safe and accessible by default.
2. **Then Tier-1 reward moments, in payoff order: victory/defeat (§1.1) → level-up punch (§1.2) → loot pickup (§1.3) → card-play exit (§1.4) → HP-hit flash (§1.5).** Each is hours, self-contained, outside the gated hot path, and closes the highest-value gaps in the audit.
3. **Layer the WebAudio SFX (§2.1) as soon as Tier-1 visuals exist** — the research is unanimous that sound is the cheapest biggest win, and the call-sites are already wired by the Tier-1 work. Then the rest of Tier 2 (FLIP + bars, hit-stop, shake utility), and Tier 3 only if the feel still warrants more.

Re-run both Playwright gates after step 1 and after each Tier-1 item.

---

## Executive summary

Loopduel's combat engine and runner-travel hot path are already strong, GPU-correct, and Playwright-gated — do not rebuild them. The opportunity is the **un-juiced reward moments**: winning, levelling up, looting, spending a card, and taking a hit on the board currently pop in with no motion or one tiny text floater. The proposal is three tiers, all honoring the stack (DOM+CSS, transform/opacity only, one optional victory-only canvas, reduced-motion respected, 16.7ms budget across panels).

**Tier 1 (quick wins, hours each):** animated victory/defeat screen (`App.tsx:897-937`, staggered card reveal + overshoot), level-up scale-punch + ring (`game-ui.tsx:2310`), loot/relic pickup toss + rarity plaque (`game-ui.tsx:2302`), card-play exit/burn animation (`game-ui.tsx:1024`), and an out-of-combat HP-hit flash + tiny shake (`game-ui.tsx:2307`, bars at `styles.css:1493/1963`). **Tier 2 (medium):** a WebAudio hit/crit/play SFX layer (none exists today; cheapest biggest win per the research), FLIP-based card/tile moves plus migrating the three `width`-animated HP bars to `transform: scaleX`, hit-stop on crit/finisher beats, and a reusable decaying screen-shake utility. **Tier 3 (ambitious):** a single sanctioned `<canvas>` victory-particle overlay, Balatro-style velocity-spring card tilt, and a unified `useFeedback()` system with global effect caps.

**Top three to do first:** (1) **Guardrails cleanup** — invert the `prefers-reduced-motion` allowlist (`styles.css:337`) to an opt-out, make `.hand-card` `will-change` just-in-time instead of permanent (`styles.css:4512`), and move HP bars off `width`; this must precede new effects so they don't leak past reduced-motion or pin extra layers. (2) **Victory/defeat celebration** — the single biggest payoff moment is fully static today and is the highest-impact, lowest-risk addition. (3) **WebAudio SFX layer** — universally cited as the highest-leverage juice per unit effort, and the Tier-1 work already exposes the trigger call-sites. Verify everything against the existing `playwright-motion-audit.mjs` and `playwright-autopsy.mjs` gates on throttled mid-range hardware after each step.
