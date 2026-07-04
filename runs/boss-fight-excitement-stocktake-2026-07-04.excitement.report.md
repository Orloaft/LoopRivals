# Boss Fight Excitement Stocktake - Excitement Report

## Status

Complete. This was a read-only code/design audit from local project reality. No source, asset, package, config, or test files were modified. The only write is this report.

Repo HEAD from required preflight: `cb59209`.

## Files inspected

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `package.json`
- `server/rules.mjs`
- `server/runtime.mjs`
- `src/types.ts`
- `src/room-projection.ts`
- `src/game-ui.tsx`
- `src/styles.css`
- `src/game-assets.ts`
- `src/audio.ts`
- `src/App.tsx`
- `test/rules.test.mjs`
- `scripts/playwright-smoke.mjs`
- `scripts/playwright-stages.mjs`
- `scripts/jank-gate.mjs`
- `docs/_juice-audit.md`
- `docs/juice-toolkit.md`
- `docs/_juice-research.md`
- `dev-assets/reference/previews/act-bosses-v1.png`
- `dev-assets/reference/previews/loopduel-combat-overlay-v1.png`
- `dev-assets/boss-loop/loopduel-boss-loop-tiles-source-v1.png`
- `public/assets/combat/enemy-loop-tyrant.png`
- `public/assets/combat/` boss/enemy and combat background inventory

## Current boss-fight fantasy

LoopDuel is already aiming for a clear fantasy: shape a dangerous road, survive the build check at the end of each act, then break the Loop Tyrant. The copy says this plainly in the title/tutorial/help surfaces: bosses test the whole build, act bosses gate progression, and the Tyrant is the finale.

The rules support that fantasy better than the live presentation does. Boss config is explicit: Briar Warden, Crown Sentinel, and Loop Tyrant each anchor four boss tiles into the loop (`server/rules.mjs:67`, `server/rules.mjs:71`, `server/rules.mjs:2529`). Boss tiles reset the road, stage four chunks/seals, emit boss phase events, and delay promotion or victory until the visible combat has ended (`server/rules.mjs:2576`, `server/rules.mjs:2658`, `test/rules.test.mjs:1421`). Boss fights are mechanically different too: boss labels change HP caps, guard/armor mitigation, damage floor/cap, corruption handling, enemy count pressure, and disable Night Vagrant vanish (`server/rules.mjs:3217`, `server/rules.mjs:3233`, `server/rules.mjs:3253`).

Where it lands: the board gets special boss tiles, the side mechanics can show a "Boss wager" hint with remaining seals (`src/game-ui.tsx:517`), boss enemy sprites exist and are mapped as large combatants (`src/game-assets.ts:33`), the generic combat overlay has good hit-stop/audio/HP/log infrastructure, and event bursts can label boss events as `ACT BOSS` or `TYRANT` (`src/game-ui.tsx:331`).

Where it does not land: once combat starts, a boss mostly becomes a normal fight. The board cue still says `fight!` (`src/game-ui.tsx:2755`), the overlay announcement says `Fight!` (`src/game-ui.tsx:2909`), the result is `Victory`, `Loot Found`, or `Hero Fell` (`src/game-ui.tsx:2805`), the reward line is just `+XP` (`src/game-ui.tsx:2837`), and the clear detail is just `<enemy> cleared` (`src/game-ui.tsx:2838`). The result does not say "Seal broken", "3 seals remain", "Act II opens", or "The Tyrant is broken." That is the biggest excitement leak.

## Boss-excitement gaps ranked by user impact

1. High impact: boss result copy collapses the stakes into generic combat output. A boss chunk clear is a seal/chunk state change, an act unlock, or a match win, but the overlay presents it as `Victory`/`Loot Found` plus XP. This hides the most meaningful boss payoff at the exact moment the player is looking.

2. High impact: boss entry has no special escalation. Bosses use the same pending cue and overlay intro as normal combat. The player may see special board tiles beforehand, but the fight moment itself does not say "Act Boss", "Seal 2/4", or "Loop Tyrant" with extra authority.

3. High impact: the four-seal boss phase is mostly a side hint, not a combat language. `player.bossPhase` has `totalChunks`, `remainingChunks`, `defeatedChunks`, and tile indexes, but the combat overlay does not expose a seal meter or chunk name. The player has to infer progress from board tiles/logs after the fight.

4. Medium impact: mechanical boss differences are invisible. Boss-specific mitigation, corruption pressure, damage floors, and disabled vanish are real, but the UI only surfaces a generic event string like `loop tyrant: 5 foes, -N hp, +N xp`. That makes boss danger feel arbitrary instead of authored.

5. Medium impact: Loop Tyrant lineup identity can get visually diluted. The server sends a five-enemy Tyrant fight and the combat renderer supports up to five sprites, but the banner still treats the moment as normal `foes/clashes` metadata. On mobile, the large enemy party layout is already tight, so the Tyrant should get a clear textual hierarchy even if sprites overlap.

6. Medium impact: boss payoff does not connect to final or act transition UI. The final strip says the winner "claimed the loop" (`src/App.tsx:1104`), and act transition copy says the loop collapsed. Both are serviceable, but neither pays off the named boss that was just beaten.

7. Medium impact: there is no deterministic boss screenshot/video proof path. Existing Playwright smoke/stage scripts exercise live matches, but they are not designed to land on Briar/Crown/Tyrant boss states. Random stage shots can miss the exact visual surface that needs review.

8. Low/medium impact: "boss ante" copy is ahead of implementation. The code has a TODO for a low-clutter boss ante (`server/rules.mjs:2542`). Current help/tutorial language says boss fights cost an ante, which is thematically true through HP/time/gold consequences, but there is no pre-boss choice yet. Avoid making quick visual work imply a new decision UI.

## Quick-win slice recommendation

Ship a boss presentation layer inside the existing combat UI. Do not change mechanics, assets, movement, or combat timing.

Use `player.bossPhase` plus known boss labels to derive `bossCombatInfo` in `src/game-ui.tsx`. For boss combats:

- Change the pending/confirmed board cue text from `fight!` to `boss!` or `tyrant!`.
- Add `boss-combat`, `boss-kind-act`, and `boss-kind-loop` classes to `.combat-overlay`.
- Change the entry announcement from `Fight!` to `Act Boss` or `Loop Tyrant`, with a second line like `Seal 2/4 - The Crown Sentinel`.
- Add compact seal pips or `Seal X/4` to the combat banner.
- Change result copy:
  - survived, chunks remain: `Seal Broken` / `3 seals remain`
  - survived, act boss final chunk: `Briar Warden Broken` / `Act II opens`
  - survived, Tyrant final chunk: `Loop Tyrant Broken` / `The loop is claimed`
  - lethal: `Boss Holds` / `Retreat and recover`
- Reuse existing `sfx.crit()` on boss clear if no new sound is added; if adding sound, keep it procedural and gated behind the existing SFX toggle.
- Keep CSS to transform/opacity/static gradients. Avoid new blurred filters, heavy live shadows, or particle DOM bursts because combat perf is already carefully budgeted (`docs/juice-toolkit.md`, `src/styles.css:3162`, `src/styles.css:3234`).

Why this first: it reuses current state, current boss art, current combat overlay, current audio, and current event pacing. It makes the strongest perceived difference without requiring protocol or mechanics changes.

Risks:

- Deriving boss status from labels is brittle if labels change. Acceptable for a quick slice, but isolate it in one helper.
- `player.bossPhase.remainingChunks` is still the pre-resolution value while combat is visible. Result copy must infer `afterRemaining = remainingChunks - 1` only when `combat.heroHpAfter > 0`.
- Mobile combat is cramped. New title/seal copy may overflow at `390x844`.
- A larger cue may cover enemy sprites or the combat log toggle.

Verification needs:

- `npm run lint`
- `npm run build`
- `NODE_ENV=test node --test test/rules.test.mjs` if any boss helper depends on server payload assumptions
- Desktop and mobile screenshots of: boss phase staged on board, boss combat entry, boss combat result with chunks remaining, lethal boss result, final Tyrant clear
- A short video/GIF of at least one boss fight to confirm entry/result timing does not clip before unmount
- Reduced-motion spot check: boss copy must still read without shake/animation
- Quality-low spot check: boss state must not disappear when decorative effects are suppressed

## Medium slice recommendation

Add typed boss presentation metadata to the combat payload, then let the UI stop guessing.

Server-side, extend boss `player.combat` payloads with a small optional block such as:

```ts
boss?: {
  kind: 'act' | 'loop';
  phaseId: string;
  label: string;
  chunkIndex: number;
  totalChunks: number;
  remainingBefore: number;
  remainingAfterOnWin: number;
  finalChunk: boolean;
  nextTier: number | null;
}
```

Client-side, use that block for overlay classes, seal pips, result copy, event burst copy, and combat log phrasing. Add rule tests that boss combats carry the block for Briar Warden, Crown Sentinel, and Loop Tyrant, including lethal Tyrant where `remainingAfterOnWin` must not be treated as achieved.

Why this second: it removes label fragility, makes projection/type handling explicit, and gives later visual workers stable data without coupling to board tile state.

Risks:

- Touches `server/rules.mjs`, `src/types.ts`, and projection/client render assumptions, so blast radius is wider than the quick slice.
- Existing clients tolerate extra payload fields, but TypeScript and tests need updates.
- Need to ensure metadata reflects "after win" without resolving the phase early.

Verification needs:

- `npm run test`
- `npm run lint`
- `npm run build`
- New/updated rules tests around boss combat metadata
- Runtime screenshots/video as in the quick slice
- Confirm normal fights have no boss block and render unchanged

## Larger slice recommendation

Build a boss phase HUD across board, combat, and post-clear payoff.

Focused scope:

- Phase strip switches from generic loops-to-boss to `Briar Warden - 4 seals` while `player.bossPhase` is active.
- Boss tiles show numbered seal state on the board using current boss tile art and lightweight overlays.
- Combat overlay uses a named boss frame, seal tracker, and boss-specific result plaque.
- Chunk clear visibly routes back to the board: cleared boss tile resets, seal meter decrements, loop boss rally heal is surfaced as a small `+HP rally` floater or event.
- Act boss final clear gets a short `Act II opens`/`Act III opens` surge; Tyrant final clear updates winner strip copy to name the Tyrant.

Why this is larger: it spans board rendering, side/phase HUD, combat overlay, endgame copy, and screenshot tooling. It still does not require a broad redesign or new mechanics, but it touches more surfaces and needs better visual QA.

Risks:

- Board and combat can become noisy, especially in four-player desktop and mobile focused-board layouts.
- Boss tile overlays can interfere with terrain readability and rival-card targeting.
- More visuals increase jank risk if built with filters, shadows, or too many animated nodes.
- If implemented before typed boss metadata, the UI may duplicate label/phase inference in several places.

Verification needs:

- All quick/medium checks as applicable
- Four-player desktop screenshot with one focused boss phase and rival boards visible
- Mobile screenshot with drawer closed and open
- Screenshot with combat log open during boss fight
- Jank gate after visual effects: `npm run test:jank` or at minimum `node scripts/jank-gate.mjs` if build is already current
- Pixel/readability review of boss seal overlay in grayscale or low-saturation capture

## First implementation prompt for a commit-capable worker

Work only in `/mnt/nxt-dev/loopduel`. Preserve dirty state. Implement the quick-win boss presentation slice without changing combat mechanics or assets.

Start by confirming `git rev-parse --short HEAD` and reading `AGENTS.md`. Add a local helper in `src/game-ui.tsx` that derives boss presentation from `player.bossPhase`, the current boss tile at `player.position`, and boss combat labels (`briar warden`, `crown sentinel`, `loop tyrant`). Use it to:

- Change boss combat-entry cue text to `boss!` for act bosses and `tyrant!` for Loop Tyrant.
- Add boss-specific classes to `.combat-overlay`.
- Change combat announcement/title/meta/result copy for boss fights:
  - entry: `Act Boss` or `Loop Tyrant`, with `Seal X/4`
  - beat meta: keep enemy count/clashes but include boss label
  - result on survival: `Seal Broken`, `Briar Warden Broken`, `Crown Sentinel Broken`, or `Loop Tyrant Broken` as appropriate
  - result on lethal: `Boss Holds`
- Add a compact seal progress row in the combat banner for boss fights only.
- Keep CSS in `src/styles.css` transform/opacity/static-gradient only; no new blurred filters or particle loops.
- Do not add new assets.

Acceptance:

- Normal combat screenshots/copy remain unchanged.
- Boss combat entry/result clearly read as boss-specific on desktop and mobile.
- Boss result copy correctly handles chunks remaining vs final chunk vs lethal defeat.
- `npm run lint` and `npm run build` pass.
- Add or capture deterministic runtime proof: desktop and mobile screenshots of Briar or Tyrant boss entry and result. If no boss harness exists, create a small Playwright proof script or documented temporary harness path in the commit, and do not leave a dev server running.

## Final repo status

Final `git status --short` after writing this report:

```text
?? runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.prompt.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.excitement.prompt.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.prompt.md
?? runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md
```

Final filesystem state: only `runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md` remains from this audit. A transient path-location mistake while writing the report was corrected, and no out-of-scope copy remains. The other untracked `runs/` files were already present or appeared from parallel lanes and were not modified here.
