# Loopduel — Animation & UI-Juice Audit

Read-only audit of motion/juice. Stack: React 19 + Vite 8 + TS 5.9, no animation library; all motion is hand-rolled CSS in `src/styles.css` (~205 KB, 41 `@keyframes`) plus sprite-sheet FX. Runner movement is RAF-driven via `transform`. Citations are `file:line`.

---

## 1. Animation inventory

### Combat overlay (the juice centerpiece)

| Effect | file:line | Trigger | Duration / easing | Properties |
|---|---|---|---|---|
| Overlay enter (`combat-pop`) | styles.css:4029 / applied :2970 | Combat overlay mounts (`.combat-overlay`) | 320ms `cubic-bezier(.18,.9,.2,1.08)` | opacity + transform(scale) — GPU |
| Overlay hold (`combat-settle`) | styles.css:4036 / :2972 | Whole overlay lifetime | `var(--combat-duration)` linear | opacity only |
| Stage hit nudge (`combat-stage-hit`) | styles.css:4047 / :3008 | `.combat-beat-active` (each beat) | 180ms | `translate3d` ±2px + scale — GPU. This is the only "screen shake". |
| Announcement "FIGHT!" (`fight-card`) | styles.css:4079 / :3122 | `.combat-announcement` mount | 560ms | opacity + scale — GPU |
| Phase transitions entry→beat→result→exit | styles.css:3015–3109 | `presentationPhase` state (game-ui.tsx:2600–2605) | 180ms opacity / 220ms transform | opacity + translateY/scale — GPU |
| Result plaque (`combat-result-plaque`) | styles.css:4062 / :3108 | `.phase-result/.phase-exit .combat-banner` | 420ms | opacity + scale — GPU |
| Banner impact (`impact-pop`) | styles.css:4292 / :3506 | Banner re-render per beat | 160ms | scale — GPU |
| Hero strike lunge (`hero-strike`) | styles.css:4142 / :3421 | `.hero-combat.combat-attacking img` (game-ui.tsx:2638) | 360ms | `translate3d` (to +42px) + scale + brightness — GPU+filter |
| Enemy strike lunge (`enemy-strike`) | styles.css:4185 / :3425 | `.enemy-combat.combat-attacking img.active-enemy` | 360ms | translateX var + translate3d + scale + brightness |
| Hit reaction (`combat-hit-shake`) | styles.css:4228 / :3429 | `.combat-taking-hit` img (defender) | 300ms | translate3d shake + scale + opacity flicker + brightness |
| Slash FX sprite (`combat-fx-sheet` / `-flip`) | styles.css:4097/4121 / :3517,3533 | per-beat `combat-fx-sprite` div, keyed by beat index (game-ui.tsx:2642,2691) | 220ms `steps(7,end)` | opacity + transform + `background-position-x` (sprite-sheet, 7 frames) |
| Damage float `-N` (`combat-damage-float`) | styles.css:4308 / :3622 | per-beat `<b>` keyed by beat (game-ui.tsx:2661) | 520ms | opacity + translate3d + scale — GPU |
| HP bar drain | CombatBar; transition styles.css:2742 `width 160ms linear` | `displayHp` state set per beat (game-ui.tsx:2602,2607) | 160ms linear | **`width`** — layout-affecting |
| Combat log row in (`combat-log-scroll-in`) | styles.css:4269 / :3696 | log row mount | 220ms | opacity + translateY/scale |
| Combat log glint (`combat-log-glint`) | styles.css:4276 / :3746 | active log row `::after` | 760ms | opacity + translateX |
| Enemy HP stack bar | styles.css:3778 `transition: width 260ms` | CombatBar value change | 260ms | **`width`** — layout-affecting |

### Board / runner / world

| Effect | file:line | Trigger | Duration / easing | Properties |
|---|---|---|---|---|
| Runner travel | game-ui.tsx:618 (`setRunnerMotionTransform`) | RAF loop `useRunnerMotion` (game-ui.tsx:624–710) | continuous, server-clock driven | `transform: translate3d(%, %, 0)` — GPU, no layout |
| Runner bob (`runner-step`) | styles.css:2085 / :2049 | always-on `.runner img` | 760ms infinite | translateY 2px — GPU |
| Runner combat stance (`runner-combat-stance`) | styles.css:2406 / :2082 | combat stance | 720ms `steps(2)` infinite | translate + scale |
| Runner stat floaters (`runner-floater-rise`) | styles.css:2096 / :1997 | imperative DOM nodes on hp/score/gold/xp/level/lap delta (game-ui.tsx:2287–2330) | 1.42s | opacity + transform + filter — GPU |
| Runner board HP plate | styles.css:1963 `transition: background-size 260ms` | `--hp-ratio` change | 260ms | `background-size` — composited-ish, not layout |
| Top HP track | styles.css:1493 `transition: width 680ms` | `--hp-ratio` | 680ms | **`width`** — layout |
| Tile board resize (focus) | styles.css:1626 `transition: width/opacity 220ms` | focus/dim board | 220ms | **`width`** + opacity — layout |
| Target ring (`target-ring`) | styles.css:5374 / :1678 | rival/target tile | 860ms infinite | scale + opacity |
| Stun wobble (`stun-wobble`) | styles.css:5387 / :1687 | `.stunned` | 360ms infinite alt | rotate |
| Claim meter pulse (`claimPulse`) | styles.css:1562 / :1399 | `.phase-strip.claiming` (game-ui.tsx:722) | 1.1s infinite | **opacity only** |
| Tier/act surge (`tier-surge`) | styles.css:2440 / :2898 | `.tier-surge` shown only on "entered tier/act" event (game-ui.tsx:2511) | 1.4s | opacity + scale |
| Event burst slam (`event-burst-slam`) | styles.css:2297 / :2188 | `.event-burst` keyed by `lastEventAt` (game-ui.tsx:2506) | 1.35s | opacity + transform + filter |
| Event pop (`event-pop`) | styles.css:2417 / :2784 | event chip | 900ms | scale + filter |
| Event burst victim hit (`victim-hit`) | styles.css:2321 | event victim | 420ms | translate + scale + brightness |
| Danger pulse (`danger-pulse`) | styles.css:2429 / :2866 | danger state | 1.2s infinite | `box-shadow` inset — paint |
| Combat entry cue (`combat-entry-cue` + pending/pulse) | styles.css:2342/2375/2393 / :2255,2269 | pre-combat cue (game-ui.tsx:2515) | 720ms / 240ms / 860ms | opacity + transform + filter |

### Cards / hand / drag

| Effect | file:line | Trigger | Duration / easing | Properties |
|---|---|---|---|---|
| Card deal-in (`card-deal-in`) | styles.css:5169 / :4513 | every `.hand-card` mount, staggered 26ms (:4514) | 280ms | opacity + translate3d + rotate + scale — GPU |
| Card hover lift | styles.css:4826 `transition: transform/filter/box-shadow 150ms` | hover/focus | 150ms | transform + filter — GPU |
| Card selected | styles.css:4836 | `.selected` | (inherits 150ms transition) | transform + box-shadow |
| Drag ghost float (`drag-card-float`) | styles.css:5187 / :4928,4970 | drag ghost | 520ms infinite alt | `translate` |
| Drop slot pulse (`slot-drop-pulse`) | styles.css:5197 / :6646 | `.paper-slot.drop-ready` | 680ms infinite alt | `scale` |
| Hover tooltip (`hover-pop`) | styles.css:5208 / fade :5232 `opacity/transform 110ms` | hover/focus many elements | 110ms | opacity + transform |
| Trait/relic glow (`trait-pulse`) | styles.css:7591 / :6941,7272,7315,7588 | trait/talent chips | 1.35–1.55s infinite | `box-shadow` ring — paint |

### Screens / global

| Effect | file:line | Trigger | Duration / easing | Properties |
|---|---|---|---|---|
| Parallax backdrop (moon/clouds/spires/graves/fog/brambles) | styles.css:245–333 / applied :140–225 | always-on title + play backdrop (App.tsx:170–175) | 11–24s infinite | translate/`translate` — GPU |
| Generic button hover | styles.css:848,2498 | hover | 110ms | transform + filter |
| Equip/loot chip border | styles.css:8019 `transition border/bg 120ms` | hover | 120ms | non-layout |

---

## 2. Juice GAPS (highest value)

1. **Victory / defeat screen is completely static.** `.winner-strip` (styles.css:1055) and `.match-summary` (:1081), rendered in App.tsx:897–948, have **no entrance animation, no celebration, no stagger, no confetti/burst**. The single biggest payoff moment in the game just pops in. Highest-impact gap.

2. **Level-up has no dedicated feedback.** A level gain only surfaces as a tiny text floater `+1 Lv` (game-ui.tsx:2310 → `runner-floater`). There is no flash, no ring, no scale-punch, no sound-coupled cue. `tier-surge` (game-ui.tsx:2511) only fires on *act/tier* transitions, not ordinary level-ups.

3. **Loot / relic acquisition has no pickup moment.** Loot only appears as a `+Ng`/text floater (game-ui.tsx:2309) or silently in the inventory. No item-toss, no rarity flash, no "relic acquired" plaque despite relics being framed as the rarest tier (game-ui.tsx:435,497).

4. **Card play / consumption has no exit animation.** Cards deal in (`card-deal-in`) but on play they simply vanish — the motion-audit only checks the hand count drops (playwright-motion-audit.mjs:118). No fly-to-board, no burn/dissolve. Asymmetric: satisfying entrance, abrupt exit.

5. **Tile placement has no impact.** When terrain is dropped on a road tile there is no settle/dust/flash on the tile itself; `slot-drop-pulse` (:6646) pulses the *target hint* before drop, not the placed tile after. Combo-transform tiles (game-ui.tsx:178, e.g. Bloomgrove) swap art with zero transition.

6. **HP damage on the board reads as a slow slide, not a hit.** Both the top HP track (`width 680ms`, :1493) and runner HP plate (`background-size 260ms`, :1963) only tween width — no red flash, shake, or chip-damage "ghost" segment. Taking damage outside combat is nearly invisible.

7. **Boss encounters have no distinct treatment.** Boss/act-boss fights (game-ui.tsx:307,427,491) reuse the generic combat overlay; the only differentiator is `tier-surge` text. No boss intro, health-gate, or screen treatment.

8. **Omen / curse events are under-juiced.** Curse routes through generic `event-burst` tones (game-ui.tsx:302); `boardOmen` (game-ui.tsx:484) renders as data, not a board-level visual. No persistent ominous overlay on cursed boards.

9. **notice-toast appears/disappears with no transition** (styles.css:8037) — instant pop in/out, feels unpolished.

10. **Combat HP bars use `width` transitions** (:2742, :3778) instead of `transform: scaleX`, so the most-animated bars in the hottest path are the layout-thrashing ones (see §3).

---

## 3. Performance posture

**GPU-friendly vs layout-thrashing.** The hot path — runner travel — is correct: a RAF loop writes `transform: translate3d(%, %, 0)` directly to the runner + highlight (game-ui.tsx:618–619), no React re-render, no top/left. Combat strikes/shakes/floats/FX all animate `transform`/`opacity`/`filter`. The motion-audit enforces this: board may shift ≤1.5px and runner/highlight may drift ≤0.08% (playwright-motion-audit.mjs:279,284), and `runner-step` must be the *only* image animation during steady motion (:275).

**Layout-affecting animations** (`width`): top HP track (:1493), combat HP bar (:2742), enemy HP stack (:3778), focus board resize (:1626). These trigger layout but are short and infrequent except the combat bars, which animate every beat inside the overlay. `width`→`transform: scaleX` would remove that.

**`will-change`** — 12 declarations (styles.css:109,1843,1902,1915,2050,2254,2969,3205,3418,3505,3532,4512). One concern: `.hand-card` carries `will-change: transform, opacity` **permanently** (:4512), so every card in hand holds a compositor layer at all times rather than only while animating; with a full hand this is several always-on layers. `.combat-overlay` also keeps `will-change: opacity, transform` for its whole life (:2969). Most others are reasonable (runner, strike targets, FX sprite).

**`contain` / `isolation`** — used well: `contain` on tiles (:1625,1706), combat entry cue `paint` (:2253), combat-overlay `layout paint style` (:2968), drag layer (:4907). `isolation: isolate` on stacking contexts (:86,1574,3186,3226).

**Simultaneous animations in hot paths.** During a single combat beat the overlay can run, concurrently: `combat-settle` (overlay), `combat-stage-hit`, attacker `*-strike`, defender `combat-hit-shake`, `combat-fx-sheet`, `combat-damage-float`, `impact-pop` banner, plus HP-bar width tweens — ~7–8 concurrent, most composited. Infinite always-on animations: 6 parallax layers, `runner-step` per runner (×N panels), plus any `trait-pulse`/`target-ring`/`danger-pulse`/`claimPulse` that are visible. Multi-panel views multiply the per-runner ones.

**`prefers-reduced-motion`** — supported but narrow (styles.css:337–362). It kills parallax and clamps combat/runner/log animation/transition duration to 1ms, but the list is explicit (:338–357) so **anything not enumerated still animates** — e.g. `card-deal-in`, `slot-drop-pulse`, `drag-card-float`, `trait-pulse`, `target-ring`, `stun-wobble`, `tier-surge`, HP-bar width tweens are NOT covered. No global `* { animation-duration: 0 }` fallback.

**Jank gates (playwright).** `playwright-autopsy.mjs` enforces frame-gap p95 ≤ 180ms and p99 ≤ 360ms (:20–21,475–476), delta-apply p95 ≤ 20ms (:22,485), no horizontal overflow during motion (:492), no board-shift/occlusion (:451–467), and zero console/page errors (:445). `playwright-motion-audit.mjs` additionally gates: zero runner/sprite remounts (:252–253), sprite never drops below opacity 0.98 or goes hidden (:260–266), single sprite source (:258), and **no backward cursor jumps** > 0.22 (:313) — i.e. motion-smoothness regressions are the primary tracked jank, not raw FPS budget.

**Summary:** Core motion engine is GPU-correct and well-gated for smoothness. The gaps are (a) reward/payoff moments with no juice at all (victory, level-up, loot, card play, tile placement, board damage), (b) HP bars using `width` in the combat hot path, (c) permanent `will-change` on hand cards, and (d) a `prefers-reduced-motion` allowlist that misses many newer animations.
