# Boss Fight Excitement Stocktake - Mechanics Audit - 2026-07-04

## Status

Complete. This was a read-only mechanics/data/flow audit. No source, asset, package, config, or test files were edited. No build or tests were run because this lane only needed code/data inspection.
The target report already existed as an untracked file at startup; this pass verified it against source and refreshed the allowed report path only.

## Repo HEAD From Preflight

`cb59209`

## Files Inspected

- `AGENTS.md`
- `CLAUDE.md`
- `server/rules.mjs`
- `server/runtime.mjs`
- `src/types.ts`
- `src/room-projection.ts`
- `src/game-assets.ts`
- `src/optimistic-placement.ts`
- `src/game-ui.tsx`
- `src/App.tsx`
- `src/styles.css`
- `test/rules.test.mjs`
- `test/room-projection.test.mjs`
- `test/tile-art.test.mjs`
- `test/optimistic-placement.test.mjs`

## Boss Roster And Trigger Map

### Staged act/final bosses

| Boss | Trigger | Phase tiles | Combat lineup | Core numbers |
| --- | --- | --- | --- | --- |
| Briar Warden | Act I gate, when a tier-1 player reaches lap 4 and has not cleared gate 1 | `rootwall`, `bramblebloom`, `wardensheart`, `oldgrowth` | `briar-warden` / The Briar Warden | threat 26, reward 74, 1 enemy, next tier 2, armor 2 |
| Crown Sentinel | Act II gate, when a tier-2 player reaches lap 9 and has not cleared gate 2 | `guardstance`, `markedchallenge`, `retaliation`, `executionstance` | `crown-sentinel`, `gate-wyrm` | threat 35, reward 112, 2 enemies, next tier 3, armor 3 |
| Loop Tyrant | Act III finale, when a tier-3 player reaches `tierStartLap + 4` | `seal1`, `seal2`, `seal3`, `innergate` | `loop-tyrant`, `briar-warden`, `crown-sentinel` | threat 42, reward 160, 5 enemies, armor 3 |

Evidence:
- Tier goals and boss loop requirement are defined in `server/rules.mjs:45` through `server/rules.mjs:50`.
- Boss configs and boss tile type set are in `server/rules.mjs:67` through `server/rules.mjs:102`.
- Boss gate promotion is lap-driven, not score-driven: `loopTierForLaps` checks only laps, then `promotePlayerIfReady` gates promotion on act-boss clear. Evidence: `server/rules.mjs:2379` through `server/rules.mjs:2382`, `server/rules.mjs:2492` through `server/rules.mjs:2500`.
- Combat encounter assets/lineups for the three staged bosses are in `server/rules.mjs:353` through `server/rules.mjs:376`.
- Tests confirm the three staged rosters and tile sequences at `test/rules.test.mjs:1421`, `test/rules.test.mjs:1670`, and `test/rules.test.mjs:1701`.

### Boss-class placed tiles/enemies

These are not `bossPhase` bosses, but the app calls them boss-class or late-loop boss fights and they share hard combat-tile handling:

- `Wyrm Gate` / `wyrmgate`: terrain card text says "Boss-class tile"; triggers `fight(room, player, 'wyrm gate', 23, 34, encounterStack(..., 3))`; lineup is `gate-wyrm`, `crown-gate`, `ash-imp`. Evidence: `server/rules.mjs:542`, `server/rules.mjs:305`, `server/rules.mjs:3609`.
- `Ember Gate` / `embergate`: combo result from Forge + Wyrm Gate; triggers `ember gate` at threat 29, reward 48, base 4 enemies, then grants armor and loot chance on survival. Evidence: `server/rules.mjs:1686`, `server/rules.mjs:313`, `server/rules.mjs:3611`.
- `Dragon Roost` / `dragonroost`: terrain card text says "Late-loop boss fight"; triggers `dragon roost` at threat 22, reward 32, base 2 enemies, then grants 28 gold and loot on survival. Evidence: `server/rules.mjs:560`, `server/rules.mjs:321`, `server/rules.mjs:3724`.

`wyrmhead`, `wyrmclaw`, `wyrmcoil`, and `wyrmtail` exist as boss-loop tile art IDs, but are not used by current boss phase configs. `loop-warden` exists as a large combat enemy asset ID, but no current server encounter or boss config references it. Evidence: `src/game-assets.ts:30` through `src/game-assets.ts:52`, `src/game-assets.ts:100` through `src/game-assets.ts:117`, `src/game-assets.ts:140` through `src/game-assets.ts:163`.

## Trigger, Scaling, Rewards, Deaths, And Events

Boss entry:
- Tier promotion is blocked until the visible act boss phase resolves. `promotePlayerIfReady` calls `challengeActBoss` instead of advancing if the current act gate is uncleared. Evidence: `server/rules.mjs:2492` through `server/rules.mjs:2500`.
- Entering a boss phase first resets the entire board to fresh road, then anchors four boss tiles on side-lane indexes, usually `[2, 6, 10, 14]` after the reset. Evidence: `server/rules.mjs:92` through `server/rules.mjs:97`, `server/rules.mjs:2469` through `server/rules.mjs:2489`, `server/rules.mjs:2529` through `server/rules.mjs:2588`.
- Boss entry emits `bossBoardReset`, `tileChanged` for each boss tile, and `bossPhaseStarted`; the client projection applies the reset before the boss board. Evidence: `server/rules.mjs:2477`, `server/rules.mjs:2569`, `server/rules.mjs:2578`, `src/room-projection.ts:460` through `src/room-projection.ts:495`, `test/room-projection.test.mjs:655` through `test/room-projection.test.mjs:713`.
- Boss tiles are combat stops on server and client. Evidence: `server/rules.mjs:573` through `server/rules.mjs:590`, `src/room-projection.ts:10` through `src/room-projection.ts:39`.

Boss chunk resolution:
- Boss tiles route into `resolveBossTile`. Solo players who reach a boss with `tilesPlaced <= 0` are forced to 0 HP and reset. Evidence: `server/rules.mjs:2613` through `server/rules.mjs:2621`.
- The first uncleared act chunk increments `soloGateAttempts`; the first uncleared Loop Tyrant chunk increments `bossAttempts`. Attempt pressure is capped at 4 for act bosses and 8 for the Tyrant. Evidence: `server/rules.mjs:2622` through `server/rules.mjs:2629`.
- Boss threat uses a chunk share: 52% of act boss threat, 72% of Tyrant threat, plus attempt pressure, solo corruption pressure, and act-boss armor pressure. Evidence: `server/rules.mjs:72` through `server/rules.mjs:75`, `server/rules.mjs:2625` through `server/rules.mjs:2640`.
- Act boss enemy count grows halfway through the four chunks; the Tyrant stays at 5 enemies every chunk. Evidence: `server/rules.mjs:2632`, `test/rules.test.mjs:1628` through `test/rules.test.mjs:1668`.
- Surviving a boss chunk creates `pendingBossOutcome`. After visible combat expires, the tile is reset, `bossPhaseChanged` is emitted, and remaining chunks decrement. Evidence: `server/rules.mjs:2647` through `server/rules.mjs:2655`, `server/rules.mjs:2658` through `server/rules.mjs:2688`, `server/rules.mjs:2770` through `server/rules.mjs:2777`.
- Tyrant chunks grant a rally heal of 10 to 20 HP between surviving chunks. Act bosses do not. Evidence: `server/rules.mjs:2681` through `server/rules.mjs:2687`.

Combat math:
- Boss labels are special-cased inside generic `fight`: higher HP cap, boss pierce pressure, stricter guard/armor mitigation, higher damage floors/caps, boss corruption cap, and Night Vagrant cannot vanish from lethal boss damage. Evidence: `server/rules.mjs:3201` through `server/rules.mjs:3254`.
- Boss fights also unlock some hero-specific late-combat upsides: Rune Archer power and Moss Warden wild power can turn on for boss labels. Evidence: `server/rules.mjs:3217` through `server/rules.mjs:3224`.
- The combat payload is otherwise generic: label, damage, XP reward, enemy count, rounds, HP before/after, enemy HP, beats, timing. Evidence: `server/rules.mjs:3301` through `server/rules.mjs:3335`, `src/types.ts:175` through `src/types.ts:197`.

Rewards and progression:
- Per-chunk reward starts as `ceil(phase.reward / 4)`, then generic combat adds tier multiplier, enemy-count/round bonuses, hero bonuses, XP, KOs, and normal loot chance. Evidence: `server/rules.mjs:2633` through `server/rules.mjs:2640`, `server/rules.mjs:3264` through `server/rules.mjs:3339`.
- Full act boss clear stores the act number in `soloGatesCleared`, logs the boss break, promotes the player, resets board, refills HP, sets armor floor, and adds solo corruption if solo. Evidence: `server/rules.mjs:2692` through `server/rules.mjs:2697`, `server/rules.mjs:2500` through `server/rules.mjs:2525`.
- Full Tyrant clear finishes the room and marks the player winner. Evidence: `server/rules.mjs:2402` through `server/rules.mjs:2414`, `server/rules.mjs:2699`.

Deaths/resets:
- Boss failure is lethal combat. Visible combat stays up until `combatEnded`, then `resolveDefeat` revives or eliminates. Evidence: `server/rules.mjs:2641` through `server/rules.mjs:2645`, `server/rules.mjs:2770` through `server/rules.mjs:2777`, `test/rules.test.mjs:1592` through `test/rules.test.mjs:1625`.
- Revive spends one of three lives, resets the current board, clears `bossPhase` and `pendingBossOutcome`, trims hand to 3, applies solo corruption/gold/score/loot penalty, and logs a knockback. Evidence: `server/rules.mjs:82` through `server/rules.mjs:84`, `server/rules.mjs:3440` through `server/rules.mjs:3470`, `server/rules.mjs:3477` through `server/rules.mjs:3498`.
- Final life elimination clears combat/boss state and emits `playerEliminated`. Evidence: `server/rules.mjs:3500` through `server/rules.mjs:3535`.

## Current Boss-Fight Player Experience

1. The player reaches the act/finale loop threshold.
2. Before the threshold, the phase strip can show remaining loops to the next `Act N Boss` or `Tyrant`.
3. The server resets the board to fresh road and anchors four boss tiles. The board shows unique boss tile art/glyphs, and the player event/log says the boss anchored into the loop.
4. The runner continues around the normal loop. Each boss tile behaves like a combat stop.
5. Entering a boss tile triggers the same `CombatOverlay` used by normal fights. It shows "Fight!", `combat.label vs combat.enemyName`, attack beats, HP bars, damage floaters, enemy pips, and a short combat log.
6. If the player survives, the boss tile clears after visible combat; the boss phase loses one chunk/seal. The Tyrant gives a small rally heal between remaining chunks.
7. If all act-boss chunks clear, the player enters the next act and the board resets again. If all Tyrant chunks clear, the match ends with the player as winner.
8. If the player dies, visible combat ends first, then the player revives or is eliminated. Revive clears the boss phase and restarts the current act board.

Client-facing evidence:
- Boss event bursts are inferred from event text containing boss names and labeled `ACT BOSS` or `TYRANT`. Evidence: `src/game-ui.tsx:321` through `src/game-ui.tsx:336`.
- The top phase strip can show loop countdowns to `Act N Boss` or `Tyrant` before the phase spawns. Evidence: `src/game-ui.tsx:693` through `src/game-ui.tsx:708`, `src/game-ui.tsx:806` through `src/game-ui.tsx:820`.
- The mechanics hint can show `Boss wager` with remaining seals while `player.bossPhase` exists. Evidence: `src/game-ui.tsx:517` through `src/game-ui.tsx:522`.
- Board tile popovers show tile name, combat stop, charges/permanence, and loop path, but not boss name, seal index, or phase progress. Evidence: `src/game-ui.tsx:2320` through `src/game-ui.tsx:2330`.
- Combat entry cue is always just `fight!`. Evidence: `src/game-ui.tsx:2755` through `src/game-ui.tsx:2767`.
- Combat outcome text is generic: `Hero Fell`, `Loot Found`, or `Victory`; there is no boss-specific `Seal broken`, `Boss enraged`, or `Tyrant defeated` state in the overlay. Evidence: `src/game-ui.tsx:2805` through `src/game-ui.tsx:2843`.
- Help/tutorial copy says bosses have an ante/wager, but server implementation has only a TODO for a real boss ante. Evidence: `src/App.tsx:1435` through `src/App.tsx:1439`, `src/game-ui.tsx:3110` through `src/game-ui.tsx:3112`, `server/rules.mjs:2542`.

## Excitement Strengths Already Present

- The boss is not a single invisible stat gate. It becomes four unique tiles on the board, so the player has to run the loop and clear a sequence.
- Boss entry force-resets the board, which is a strong phase-change mechanic and prevents old terrain from muddying the boss route.
- The visible phase strip gives pre-spawn loop countdowns to the next act boss or Tyrant.
- Act promotion waits for visible combat; tests guard against silent tier jumps.
- The Tyrant is a real finale: it appears only after act III loop progress and full clear immediately finishes the match.
- Boss combat is mechanically harsher than normal combat: boss pierce pressure, higher damage floors, capped but meaningful corruption, weakened guard/armor mitigation, no Night Vagrant vanish, and multi-enemy lineups.
- The generic combat overlay already has a useful base: beat timing, HP bars, enemy lineups, enemy pips, hit-stop, screen shake, SFX, and a combat log.

## Top Mechanics/Pacing Gaps

1. Boss ante/wager is promised but not implemented.
   - The UI/tutorial says boss fights cost an ante or wager, and the mechanics hint says "Boss wager." The server only has `TODO(low-clutter boss ante)` and no `bossWager` assignment in rules. Evidence: `server/rules.mjs:2542`, `src/game-ui.tsx:452` through `src/game-ui.tsx:455`, `src/game-ui.tsx:517` through `src/game-ui.tsx:522`, `src/App.tsx:1435` through `src/App.tsx:1439`.
   - Current actual cost is implicit: combat damage, time, death reset, corruption, gold loss, score debt, and possible loose loot loss.

2. Boss combat presentation is generic despite boss-specific mechanics.
   - `Combat` has no boss metadata beyond `label`; the overlay chooses generic outcomes from hero HP and enemy count. Evidence: `src/types.ts:175` through `src/types.ts:197`, `src/game-ui.tsx:2805` through `src/game-ui.tsx:2843`.
   - Player cannot see "seal 2 of 4," "act boss," "Tyrant chunk," attempt pressure, or rally heal inside the combat overlay.

3. Boss phase progress is under-signaled on the board/HUD once the phase has spawned.
   - `bossPhase` is tracked in type/projection, but board tile popovers do not expose boss phase ID, chunk index, seal order, or remaining chunks. Evidence: `src/types.ts:277` through `src/types.ts:308`, `src/room-projection.ts:481` through `src/room-projection.ts:495`, `src/game-ui.tsx:2320` through `src/game-ui.tsx:2330`.
   - A loop-tier card exists in JSX, but CSS hides it with `display: none !important`; the separate phase strip covers pre-spawn loop countdown, but not spawned boss seal/chunk progress. Evidence: `src/game-ui.tsx:1407` through `src/game-ui.tsx:1423`, `src/styles.css:6645` through `src/styles.css:6648`.

4. Terminology drifts between "chunk," "seal," and tile names.
   - Server/player event copy says chunks left, UI hint/help says seals, type/test names say chunks, and final boss tile names are `Seal I/II/III` plus `Inner Gate`. Evidence: `server/rules.mjs:2686`, `src/game-ui.tsx:517` through `src/game-ui.tsx:522`, `src/game-ui.tsx:3110`, `src/types.ts:288` through `src/types.ts:292`.

5. Boss failure feedback is mechanically accurate but player-facing cause/effect is muddy.
   - On lethal boss combat, `resolveBossTile` logs "the boss phase holds," but the subsequent revive clears the board and boss phase. Evidence: `server/rules.mjs:2641` through `server/rules.mjs:2645`, `server/rules.mjs:3449` through `server/rules.mjs:3453`.
   - Solo corruption, score penalty, gold loss, and possible loose loot loss are applied by generic death penalty code, not as a boss-failure summary. Evidence: `server/rules.mjs:3477` through `server/rules.mjs:3498`.

6. The four chunks can feel repetitive.
   - Act bosses vary enemy count only halfway through. The Tyrant keeps five enemies every chunk. No per-seal move, resistance, threshold behavior, or named phase is represented in data. Evidence: `server/rules.mjs:2630` through `server/rules.mjs:2640`, `test/rules.test.mjs:1628` through `test/rules.test.mjs:1668`.

7. "Boss-class" placed tiles are mechanically normal fights with bigger numbers.
   - Wyrm Gate and Dragon Roost are described as boss-class/boss fights, but they use the same generic `fight` path and generic overlay/outcomes. Evidence: `server/rules.mjs:542`, `server/rules.mjs:560`, `server/rules.mjs:3609` through `server/rules.mjs:3617`, `server/rules.mjs:3724` through `server/rules.mjs:3730`.

8. The one-loop Tyrant prewarning hook appears ineffective.
   - On lap completion, code calls `maybeSpawnStageBoss` when `loopsToTyrant === 1`, but that function immediately returns false because the player has not reached the target lap yet. No warning event/log is emitted there. Evidence: `server/rules.mjs:3790` through `server/rules.mjs:3804`, `server/rules.mjs:2591` through `server/rules.mjs:2597`.

## Candidate Implementation Slices

1. High impact, low-medium risk: add boss-aware combat metadata and overlay states.
   - Add optional `boss` metadata to `Combat`: `phaseId`, `kind`, `label`, `sealIndex`, `totalSeals`, `remainingBefore`, `remainingAfter`, `isFinalSeal`.
   - Populate it from `resolveBossTile` or an options object passed into `fight`.
   - Update `CombatOverlay` copy/outcomes to show `Act Boss`, `Tyrant Seal 3/4`, `Seal Broken`, `Boss Survived`, `Tyrant Defeated`.
   - Verification: unit tests for payload shape, projection stability, desktop/mobile screenshots of normal boss combat.

2. High impact, low risk: surface boss progress on the board before combat.
   - Add a compact spawned-boss target card or extend the existing phase strip with seal/chunk progress.
   - Add boss tile popover lines like `Briar Warden seal 1/4` and `3 seals remain`.
   - Add a one-lap Tyrant warning event/log instead of the current no-op precheck.
   - Verification: projection tests for boss phase display inputs, Playwright screenshots for boss phase board state.

3. Medium-high impact, medium risk: make ante/wager real or remove the promise.
   - Conservative option: rename current UI copy from "ante/wager" to "boss pressure" until a choice exists.
   - Larger option: implement a simple pre-boss default wager in `stageBossPhaseForPlayer`, such as paying gold/armor/time for a visible advantage, with `bossWager` stored and projected.
   - Verification: balance tests for act gates/solo failure, UI tests for hint copy.

4. Medium impact, medium-high risk: give each boss seal a distinct data-driven beat.
   - Extend boss configs with per-chunk modifiers: enemy lineup, effect, pressure delta, reward delta, rally/heal/armor rules, and short phase title.
   - Start with small changes: Briar chunks root/regen, Crown chunks guard/retaliate, Tyrant chunks prior bosses then inner gate.
   - Verification: rules tests for enemy count/damage/reward by seal, screenshots/video for readable overlay copy.

5. Medium impact, low-medium risk: make boss failure and clear consequences explicit.
   - Emit a `bossPhaseFailed` or enrich `playerDefeated`/log with boss label, lost gold, corruption gained, score debt, and whether the phase reset.
   - Add clear rewards or clear summaries distinct from ordinary XP, even if they reuse existing loot/gold/armor systems.
   - Verification: rules tests for emitted event order, client projection tests, combat-end screenshots.

## Final Repo Status

`git status --short` after this audit:

```text
?? runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.prompt.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.excitement.prompt.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.prompt.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md
```

Only the allowed mechanics report path was modified by this audit. Existing untracked run/prompt/report files were preserved. Nothing was staged, committed, or pushed.
