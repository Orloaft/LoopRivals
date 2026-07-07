# Juice Code Audit 2026-07-07

Early stub written before long inspection.

- Session key: juice-code-audit-2026-07-07
- HEAD inspected: 4b8428e
- Status: complete

## Scope

Read-only code audit of LoopDuel's existing animation, rendering, UI, and audio paths. No source/package/config edits were made; only this assigned report path was written.

## Existing Juice Primitives

- Shared motion clock: `gameplayRaf` owns a single rAF scheduler with subscribers and metrics hooks, avoiding one rAF per feature (`src/gameplay-raf.ts:420`, `src/gameplay-raf.ts:441`, `src/gameplay-raf.ts:481`).
- Runner travel: `useRunnerMotion` writes `translate3d(...)` directly to runner/highlight refs each frame, bounded by `maxVisualFrameStepMs`, and avoids React state for normal tile travel (`src/game-ui.tsx:824`, `src/game-ui.tsx:830`, `src/game-ui.tsx:897`, `src/game-ui.tsx:907`).
- Parallax backdrop: `GothicParallaxBackdrop` subscribes to the shared rAF and writes transform-only progress to spires/graves/brambles (`src/App.tsx:105`, `src/App.tsx:173`, `src/App.tsx:199`); CSS adds small transform-only creep animations (`src/styles.css:127`, `src/styles.css:146`, `src/styles.css:159`, `src/styles.css:185`).
- Reduced/low motion controls: CSS globally calms animations under `prefers-reduced-motion` (`src/styles.css:215`) and `quality-low` drops expensive decorative layers, shadows, filters, and pulses (`src/styles.css:236`, `src/styles.css:246`, `src/styles.css:259`, `src/styles.css:265`).
- Quality watcher: auto low-quality mode watches sustained rAF present rate and toggles `<html class="quality-low">` after two slow windows (`src/quality-mode.ts:18`, `src/quality-mode.ts:74`, `src/quality-mode.ts:114`).
- Board/runner effects: runner step, combat stance, current-tile glow, HP plate, merged stat floaters, level-up ring, loot toss, board-hit flash, and spent-card ghost are already present (`src/styles.css:1948`, `src/styles.css:2008`, `src/styles.css:2084`, `src/styles.css:2171`, `src/styles.css:2201`, `src/styles.css:2234`, `src/styles.css:2245`, `src/styles.css:2313`).
- Floater discipline: stat floaters merge by tone within 900ms and hard-cap live nodes at 4 per panel (`src/game-ui.tsx:48`, `src/game-ui.tsx:52`, `src/game-ui.tsx:2639`, `src/game-ui.tsx:2682`).
- Board event bursts: event classification drives short, transform/opacity-heavy warning banners plus victim-hit runner animation for bonk/meteor/curse/rival danger moments (`src/game-ui.tsx:435`, `src/styles.css:2391`, `src/styles.css:2539`, `src/styles.css:2549`).
- Combat overlay: combat beats are timer-bounded, update active beat/display HP, play SFX, run finisher hit-stop, and cancel timers/WAAPI on unmount (`src/game-ui.tsx:2899`, `src/game-ui.tsx:2971`, `src/game-ui.tsx:2982`, `src/game-ui.tsx:3007`).
- Combat visuals: entry card, combat pop/settle/stage hit, strike keyframes, hit-shake, damage floaters, FX spritesheet, active enemy pop, result plaque, boss seal progress, and combat log glint are implemented mainly through transform/opacity (`src/styles.css:3212`, `src/styles.css:3271`, `src/styles.css:3381`, `src/styles.css:3733`, `src/styles.css:3748`, `src/styles.css:3856`, `src/styles.css:3991`, `src/styles.css:4490`, `src/styles.css:4535`, `src/styles.css:4611`).
- Combat sprite performance guard: combat sprite brightness is baked into bitmaps, with static glow/shadow underlays, because scale-animated filters were measured expensive (`src/game-ui.tsx:3171`, `src/styles.css:3490`, `src/styles.css:3510`, `src/styles.css:3529`).
- Audio: procedural SFX use a lazy shared `AudioContext`, user preference, unlock-on-gesture, and short oscillator/noise envelopes for card, hit, crit, loot, level, victory, defeat (`src/audio.ts:213`, `src/audio.ts:247`, `src/audio.ts:264`, `src/audio.ts:337`).
- Screen shake: shared WAAPI `shake()` is reduced-motion aware, user-toggleable, and transform-only (`src/screen-shake.ts:141`, `src/screen-shake.ts:183`, `src/screen-shake.ts:200`).

## Performance-Sensitive Surfaces

- Avoid new per-frame React state in board movement. The current hot path is ref style writes through shared rAF (`src/game-ui.tsx:882`, `src/game-ui.tsx:907`); new board-following effects should either piggyback on that transform or spawn one-shot DOM/CSS effects on events.
- Avoid layout-forced animation restarts in hot bursts. Floater merge currently uses `offsetWidth` to restart animation (`src/game-ui.tsx:2648`); it is bounded by merge/cap, but this pattern should not be copied broadly.
- Avoid animating width/background-size on frequently changing bars. Combat HP already uses `scaleX` (`src/styles.css:4159`), but runner HP uses `background-size` transition (`src/styles.css:2072`); this is okay at HP tick cadence, not a pattern for rapid effects.
- Avoid live filters on moving/scaling surfaces. Docs explicitly forbid animated filters and warn that constant filters on scale-animated elements re-raster (`docs/juice-toolkit.md:30`, `docs/juice-toolkit.md:37`); CSS still has some constant filters on small/static elements like tiles and cue labels (`src/styles.css:1840`, `src/styles.css:2477`, `src/styles.css:2501`), so new motion should prefer separate static underlays or opacity overlays.
- Keep paint exceptions rare. The keyframe purity gate only permits small documented exceptions for combat FX spritesheet background-position and tiny box-shadow pulses (`scripts/check-keyframe-purity.mjs:26`, `scripts/check-keyframe-purity.mjs:28`, `scripts/check-keyframe-purity.mjs:36`).
- Watch full-screen/backdrop effects. Prior weak-machine appraisal found the bottleneck was full-screen layer blend/filter cost, not engine or React (`docs/weak-machine-perf-appraisal.md:21`, `docs/weak-machine-perf-appraisal.md:53`, `docs/weak-machine-perf-appraisal.md:62`).
- Board tiles are many small DOM nodes with static filtered art (`src/styles.css:1825`, `src/styles.css:1840`); per-tile infinite animation should be limited to critical gameplay information and disabled in `quality-low`.
- Combat overlay already stacks images, gradients, absolute FX, text shadows, and timers; add combat juice by extending existing beat/event channels rather than creating persistent particles or new canvas layers (`src/game-ui.tsx:3041`, `src/game-ui.tsx:3091`, `src/styles.css:3455`, `src/styles.css:3856`).
- Existing verification surface is good: `npm run lint` includes keyframe purity, `test:motion` and `test:jank` exist for motion/jank gates (`package.json:8`, `package.json:13`, `package.json:15`, `package.json:16`).

## Proposed High-Impact, Low-Risk Ideas

1. **Tile placement "stamp" ripple**
   - Targets: `placeCard()` in `src/App.tsx:703`, `BoardTileButton` in `src/game-ui.tsx:2384`, board/tile CSS around `src/styles.css:1825`.
   - Player moment: dropping terrain currently has card-exit feedback, but the target tile could confirm "the road changed here".
   - Sketch: after successful `placeCard`, pass a short `lastPlacedTileKey` to the active `PlayerPanel` or use a bounded DOM append inside the target tile: `<span class="tile-stamp-ripple">`. Animate opacity/transform scale from tile center; optionally add a tiny glyph pop using existing `tileGlyphs`.
   - Performance: one node per successful card command, animation is transform/opacity only, remove on `animationend`, no persistent per-tile animation.
   - Risk: Low. Verify with unit-free UI smoke plus screenshot of tile placement; run keyframe purity.

2. **Runner tile-arrival footfall flash**
   - Targets: `useRunnerMotion()` arrival/pending-stop path in `src/game-ui.tsx:886`, `src/game-ui.tsx:909`; runner highlight CSS at `src/styles.css:1948`.
   - Player moment: automatic loop movement reads smoother if each tile crossing has a soft landing pulse.
   - Sketch: track `Math.floor(nextCursor)` in a ref and, when it changes, fire a CSS class or WAAPI opacity/scale pulse on `runnerHighlightRef.current` or append a tiny dust ring under `.runner-sprite::before`.
   - Performance: event-bounded at tile cadence, transform/opacity only, uses existing runner/highlight nodes; skip/shorten under reduced motion and `quality-low`.
   - Risk: Medium-low because it touches the motion loop. Verify with `test/movement.test.mjs`, `npm run test:motion`, and visual smoke.

3. **Combat beat impact sparks by damage/effect**
   - Targets: `CombatOverlayBody` active beat rendering at `src/game-ui.tsx:3045`, `src/game-ui.tsx:3105`; FX sheet CSS at `src/styles.css:3856`, `src/styles.css:4490`.
   - Player moment: hits would feel less samey if crit/finisher/effect type changed burst size/tone.
   - Sketch: add class modifiers such as `combat-fx-heavy`, `combat-fx-poison`, `combat-fx-gold` based on `activeBeat.damage`, `isFinisher`, or `combat.effect`; reuse the existing spritesheet quad and CSS custom properties for scale/opacity.
   - Performance: no new dependencies; no new timers beyond existing beat key; spritesheet is already a documented small paint exception and disabled by quality safety net.
   - Risk: Low. Verify with keyframe purity, combat screenshot, and jank probe if many fights are exercised.

4. **Boss seal break burst**
   - Targets: boss progress rendering in `src/game-ui.tsx:3063`; boss seal CSS at `src/styles.css:3938`.
   - Player moment: act/loop boss progress would feel more decisive when a seal breaks.
   - Sketch: key active/cleared seal pips by current seal and add one-shot `seal-break` class on result phase. Use transform scale/rotate and opacity on a pseudo-element halo.
   - Performance: tiny fixed pip area; one-shot on boss result; no layout. Keep any glow static or quality-low disabled if using box-shadow.
   - Risk: Low. Verify with boss combat scripted/e2e capture.

5. **Rival attack travel cue**
   - Targets: `playRival()`/`playRivalOnTile()` in `src/App.tsx:717`, `src/App.tsx:737`; rival target board classes in `PlayerPanel` at `src/game-ui.tsx:2726`; `event-burst` at `src/styles.css:2391`.
   - Player moment: playing a rival/bonk card would visually connect the card action to the victim board/tile.
   - Sketch: spawn one fixed-position slash/curse token from selected hand card rect to target panel/tile rect, similar to `spawnCardExit()` (`src/App.tsx:56`), then remove on animation end.
   - Performance: one fixed node per command; animate transform/opacity. It would need one or two `getBoundingClientRect()` reads at command time only, not per frame.
   - Risk: Medium because it crosses hand/card/board targeting paths. Verify desktop and mobile target flows.

6. **Card draw/deal variant by card suit**
   - Targets: `cardSuit()`/`cardFaceClass()` in `src/game-ui.tsx:479`, hand card CSS around `src/styles.css:4890`, `@keyframes card-deal-in` at `src/styles.css:5555`.
   - Player moment: new terrain/rival/bonk cards entering hand could telegraph "Peril/Haven/Engine/Doom" immediately.
   - Sketch: add suit classes/custom props to card markup and vary entry offset/settle hue via static border/background, not animated filter. Keep same `card-deal-in` transform/opacity keyframe.
   - Performance: no extra nodes, existing animation, event-bounded by card list changes.
   - Risk: Low. Verify hand wrap/mobile drawer screenshots and reduced motion.

7. **Ability ready "charge snap"**
   - Targets: board ability button in `src/game-ui.tsx:2818`, side dock ability button styles near `src/styles.css:6990` and `src/styles.css:7059`.
   - Player moment: when an ability cooldown hits ready, the player should notice without reading the dock.
   - Sketch: compare previous `player.ability.ready` in `PlayerPanel` and append/trigger `ability-ready-pop` on the board/side ability button. Add a short SFX variant using `sfx.levelUp()` or a new tiny tone.
   - Performance: one state transition, transform/opacity pulse; disable decorative repeat in `quality-low` if kept alive.
   - Risk: Medium-low due to active/cooldown state plumbing. Verify by guided/bot match or mocked state component screenshot.

8. **Lap completion road-ring sweep**
   - Targets: lapDelta detection in `PlayerPanel` at `src/game-ui.tsx:2598`, existing loop floater at `src/game-ui.tsx:2605`, board CSS at `src/styles.css:1806`.
   - Player moment: completing a loop is a core progression beat; current floater could be paired with a quick circular board sweep.
   - Sketch: on positive `lapDelta`, append a `.lap-sweep-ring` to `.board` or `.runner-floaters` that scales/fades around the board core.
   - Performance: one node per lap, transform/opacity only. Avoid animating border width/box-shadow; use pre-styled outline/gradient opacity.
   - Risk: Low. Verify visual timing and mobile board bounds.

9. **Low-HP danger heartbeat**
   - Targets: HP ratio computation at `src/game-ui.tsx:2695`; player panel classes at `src/game-ui.tsx:2726`; `.runner-hp-plate` CSS at `src/styles.css:2036`.
   - Player moment: survival tension increases when the runner is near death outside combat.
   - Sketch: add `low-hp` class below 30%, with a slow opacity pulse on a small pseudo-element behind the HP plate or runner highlight. Stop while `quality-low`, `prefers-reduced-motion`, or eliminated.
   - Performance: one tiny element, opacity only; avoid box-shadow keyframes. This is an infinite animation, so it must be low area and disabled in quality-low.
   - Risk: Medium because it is persistent during low HP. Verify `quality-low` disables it and keyframe purity passes.

10. **Combat result reward shower**
   - Targets: `presentationPhase === 'result'` branch in `CombatOverlayBody` at `src/game-ui.tsx:2957`; combat result CSS at `src/styles.css:3375`, `src/styles.css:4455`.
   - Player moment: victory/loot found/result plaques would feel more rewarding.
   - Sketch: add up to 3 `<i class="reward-spark">` children inside `.combat-banner` only in result phase, keyed by reward/loot/XP; animate translateY/scale/opacity with staggered CSS variables.
   - Performance: hard cap 3 nodes, one-shot transform/opacity; no text layout dependency.
   - Risk: Low. Verify combat result screenshots and no mobile overlap.

11. **Tactical preview countdown pulse for next danger**
   - Targets: `upcomingTiles()`/`tacticalLabel()` at `src/game-ui.tsx:407`, `src/game-ui.tsx:426`; tactical preview CSS at `src/styles.css:3065`, `src/styles.css:3107`.
   - Player moment: the "3 to Crypt" type preview could become more readable as a near-term threat.
   - Sketch: expose nearest danger `step` as a custom prop/class and add a one-shot/slow pulse only when `step <= 2`, reusing existing danger text and stopping in `quality-low` (`src/styles.css:265` already disables tactical danger animation).
   - Performance: tiny text/chip area; reuse existing danger-pulse exception or replace with opacity/transform pseudo-element.
   - Risk: Medium-low. Verify no visual noise on four-player desktop.

12. **Victory/defeat end-state title punch**
   - Targets: winner/profile sounds in `src/App.tsx:556`; summary animations around `src/styles.css:1073`, `src/styles.css:1129`, `src/styles.css:1159`.
   - Player moment: match end already has SFX; title/banner could land harder for winner vs defeated players.
   - Sketch: add class based on winner/local player and extend existing winner strip/card punch with a one-shot foreground flash using opacity/transform.
   - Performance: end-of-match only; no runtime cost during gameplay.
   - Risk: Low. Verify endgame e2e completed match screenshot.

## Top 3 Recommended Slices

1. **Tile placement stamp ripple**: high moment-to-moment frequency, very small implementation, no new loops, pairs naturally with existing card-exit ghost.
2. **Combat beat impact sparks by damage/effect**: largest perceived combat payoff, leverages existing beat/FX path, minimal extra architecture.
3. **Lap completion road-ring sweep**: reinforces LoopDuel's core loop progression with one event-bounded board effect and low complexity.

Runner tile-arrival footfalls are also attractive, but they touch the hottest rAF path and should follow after the simpler event-bounded effects.

## Verification Performed

- Preflight HEAD: `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD` -> `4b8428e`.
- Code search used `rg` first across source/docs/scripts, then targeted line reads.
- Ran `node scripts/check-keyframe-purity.mjs`: passed with `[keyframe-purity] OK`.
- Checked listening ports 5200-5219 with `ss`: an initial check after inspection showed none listening; final check showed an existing `/mnt/nxt-dev/loopduel` node process on 5200/5201 (pid 1281828, started 2026-07-07 07:53:58). This worker did not start it and left it untouched.
- Did not start any app/server command.

## Caveats / Blockers

- This is a static code audit, not a live UX capture. No Playwright screenshots or app server were run.
- `git status --short` shows this assigned report plus two unrelated untracked reports: `runs/juice-proposal-synthesis-2026-07-07.report.md` and `runs/juice-runtime-ux-audit-2026-07-07.report.md`. I left them untouched.
- Ideas that depend on exact battle/endgame timing should get live desktop/mobile Playwright verification when implemented.

## Final Repo / Server Status

- Source/package/config files unchanged by this worker.
- Only assigned report path written: `runs/juice-code-audit-2026-07-07.report.md`.
- No temp server was started by this worker, so no worker-owned temp server remains. Existing node process pid 1281828 is listening on 5200/5201 and was not modified.
