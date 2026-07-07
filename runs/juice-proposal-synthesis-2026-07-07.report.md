# Juice Proposal Synthesis 2026-07-07

Status: complete
HEAD inspected: `4b8428e`
Session: `juice-proposal-synthesis-2026-07-07`

## Read Of The Repo

The repo has already landed the first wave of juice work: reduced-motion is now a broad opt-out (`src/styles.css:215`), quality-low strips expensive decoration (`src/styles.css:236`), keyframe purity is gated by lint (`scripts/check-keyframe-purity.mjs:1`), runner motion is RAF/ref-driven (`src/game-ui.tsx:824`, `src/game-ui.tsx:900`), floaters merge/cap per panel (`src/game-ui.tsx:48`, `src/game-ui.tsx:2641`), and there is now a procedural SFX/shake layer (`src/audio.ts:1`, `src/screen-shake.ts:1`).

That means the next best upgrades should not be "add more general animation." They should make the highest-value game moments read harder using the existing cheap path: transform/opacity, capped DOM nodes, reduced-motion safe, and no new libraries.

## Ranked Proposal Set

### Quick Wins

1. **Rarity-aware loot/relic pickup burst. Best first slice.**
   - Current gap: the stat diff only tracks hp/score/gold/xp/level/laps (`src/game-ui.tsx:2553`) and the current loot toss is only keyed off `goldDelta > 0` (`src/game-ui.tsx:2673`). Actual new loot, especially relics (`src/types.ts:75`), does not get its own payoff.
   - Implementation: extend `previousRunnerStatsRef` to remember `lootIds`; when `player.loot` gains items, append one capped pickup glyph into `runnerFloatersRef`. Use the existing `ItemSprite`/loot glyph idiom already used in side/mobile/shop loot (`src/game-ui.tsx:1212`, `src/game-ui.tsx:1585`, `src/game-ui.tsx:1772`, `src/game-ui.tsx:2048`). Common = small toss, rare = bigger gold pulse, relic = "RELIC" plaque + larger item pop. Keep it in the same `maxFloaterNodes = 4` budget (`src/game-ui.tsx:52`) or count it against a separate tiny `maxPickupNodes = 2`.
   - Why first: very visible, does not touch movement/combat timing, no server change, no library, and it fixes a reward moment the game already has data for.

2. **Tile placement confirmation stamp.**
   - Current gap: placement is optimistically applied (`src/App.tsx:703`, `src/optimistic-placement.ts:55`), and the card burns away (`src/App.tsx:59`, `src/App.tsx:711`), but the changed road tile itself does not celebrate.
   - Implementation: when pending placement is created, pass/derive the pending tile index into `BoardTileButton` and add a one-shot `.tile-placed-pop` child or class keyed by `tile.index:tile.type`. Animate a stamp/ring with only `transform` and `opacity`. Reuse existing tile targeting classes/styles as the local idiom (`src/game-ui.tsx:2369`, `src/styles.css:1884`).
   - Risk: avoid replaying on initial board mount or every server delta. Key it to the pending placement command/tile, not the raw tile type alone.

3. **Boss seal break pop.**
   - Current gap: boss fights expose seal progress in the overlay (`src/game-ui.tsx:3063`) and style pips as static `active`/`cleared` dots (`src/styles.css:3938`), but a broken seal is not a moment.
   - Implementation: on `presentationPhase === 'result'` and a winning boss beat, animate the active/just-cleared pip with a small crack ring plus text pulse. Transform/opacity only. Make Loop Tyrant use the existing purple variant (`src/styles.css:3982`) while act bosses use gold.
   - Why quick: local to `CombatOverlayBody`; no gameplay state changes.

4. **Phase/claim meter pop when progress crosses a loop.**
   - Current gap: `PhaseStrip` already computes loop progress (`src/game-ui.tsx:817`) and renders the meter (`src/game-ui.tsx:920`, `src/styles.css:1498`), but progress changes are quiet.
   - Implementation: track previous `player.laps`/claim state and add a short meter cap pop plus score sparkle when a lap advances or claim begins. Also consider changing `.phase-meter i` from `width: var(--phase-progress)` to a full-width fill with `transform: scaleX(...)` for the same compositor pattern used by combat HP (`src/styles.css:4151`).

5. **Upgrade existing card exit into target-aware FLIP-lite for placement only.**
   - Current gap: `spawnCardExit` clones the card and burns it at the source (`src/App.tsx:59`), which is better than instant removal but does not connect the card to the chosen tile.
   - Implementation: for terrain placement only, measure source card rect and target tile rect, clone the card, and animate the clone toward the tile center with WAAPI transform/opacity. Keep the current burn as fallback for rival/bonk cards or missing target rect.

### Medium Slices

1. **Unified local pickup/placement effect budget.**
   - Pull the imperative floater/ring/toss appends around `src/game-ui.tsx:2639` into a tiny helper that enforces a per-panel cap and reduced-motion behavior. Do not make a broad event bus yet; just stop the next two quick wins from duplicating DOM cap logic.

2. **Combat finish variety by effect type.**
   - The overlay already has `combat.effect` (`src/types.ts:181`) and effect-specific sprite rows (`src/styles.css:3844`). Add slightly different SFX pitch/envelope and banner accent per sword/claw/spectral/ember. This is mostly `src/audio.ts` plus class mapping in `CombatOverlayBody`.

3. **Trait choice confirmation.**
   - Pending trait affordances currently pulse via a documented box-shadow exception (`src/styles.css:8004`, `scripts/check-keyframe-purity.mjs:28`). When a trait is chosen, add a transform/opacity confirmation sweep on the selected node and side trait chip. Keep the existing pulse exception from expanding.

4. **Target-aware card/loot/equip FLIP pass.**
   - Generalize the placement FLIP-lite into cards to rival panels, loot to equipment slots, and shop buys to inventory. Useful, but coordinate carefully with native drag state cleanup (`src/App.tsx:576`) and mobile drawers.

### Defer Or Avoid

1. **Do not add animation libraries, spring engines, or a broad feedback bus yet.**
   - The existing stack is React/CSS/WAAPI and already has SFX/shake helpers. A library adds bundle/runtime surface without solving the next visible gaps.

2. **Avoid particle systems outside one-off victory/relic moments.**
   - A victory-only canvas or very small capped DOM spark can be OK later, but general particles would fight the measured fill-rate constraints in `docs/frame-consistency-appraisal.md:1` and `docs/juice-toolkit.md:1`.

3. **Do not animate filter, box-shadow, background-size/position, width, left/top, or live blur.**
   - The repo explicitly documents these as the slow path (`docs/juice-toolkit.md:1`) and enforces keyframe purity (`scripts/check-keyframe-purity.mjs:1`). Existing exceptions are deliberately small and disabled in low quality.

4. **Do not rewrite runner/combat motion.**
   - Runner travel and combat already have the right architecture: RAF/ref writes for movement (`src/game-ui.tsx:900`) and transform/opacity combat keyframes (`src/styles.css:4535`, `src/styles.css:4611`).

## Recommended First Slice

Ship **rarity-aware loot/relic pickup burst** first.

It is the best balance of payoff and risk: one component area, no protocol or server changes, no new assets required, uses existing `Loot` data and `ItemSprite`, stays outside the runner movement loop, and makes rare rewards feel materially better.

## Proposed Next Worker Prompt Summary

Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN.

Implement the first juice slice: rarity-aware loot/relic pickup bursts in `/mnt/nxt-dev/loopduel`. Preserve the existing cheap-animation rules from `docs/juice-toolkit.md`: transform/opacity only, no new libraries, reduced-motion safe, no unbounded DOM spawning, no gameplay blocking. Extend `PlayerPanel`'s local diff tracking so it detects newly added `player.loot` items by id, then reuses the existing runner floater container to show a capped pickup effect. Common loot should show a small item toss, rare loot a stronger pickup pop, relic loot a short "RELIC" plaque plus item pop. Use existing `ItemSprite`/loot styling idioms where practical; do not change protocol/server rules. Verify with `npm run lint`, `npm run test`, `npm run build`, Playwright desktop/mobile capture, reduced-motion check, and a practical perf check (`npm run test:jank` if time; otherwise motion audit plus no new keyframe-purity exceptions). Report source files changed, verification output, and confirm no temp server remains.

## Verification Expectations For Any Slice

- `npm run lint` must pass, including `scripts/check-keyframe-purity.mjs`.
- `npm run test` and `npm run build` for implementation slices.
- Playwright desktop and mobile screenshots/captures of the affected moment.
- Reduced-motion check: CSS effects collapse under OS reduced motion; JS/WAAPI effects use `prefersReducedMotion()`.
- Perf check: run `npm run test:jank` for combat-adjacent or repeated effects; for isolated reward effects, at least run the motion audit and inspect live animation counts/caps.
- Quality-low check: decoration either disappears or remains transform/opacity only; no new `filter`/shadow animation.

## Verification Performed In This Read-Only Pass

- Preflight HEAD: `4b8428e`.
- Wrote this report only; no source/package/config edits.
- Used `rg` first for code search.
- Ran `npm run lint`; it passed and keyframe purity reported OK.
- Did not run build or Playwright because this task was proposal-only and read-only.
- Checked ports 5200-5219 with `ss`; no listener remained.

## Caveats

- The runtime UX/code audit reports present in `runs/` were still early stubs during this inspection, so this synthesis is based on direct repo inspection and existing docs.
- Line references may drift once implementation workers edit the files.
