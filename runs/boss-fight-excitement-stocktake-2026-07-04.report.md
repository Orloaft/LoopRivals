# Boss Fight Excitement Stocktake - Manager Synthesis - 2026-07-04

## Verdict

Boss fights have stronger mechanics and assets than their combat-view presentation suggests. The board already stages four authored boss tiles, the server has distinct Briar Warden, Crown Sentinel, and Loop Tyrant phases, and the combat sprites are usable. The excitement leak is that, once the combat overlay opens, the fight mostly reads like normal combat.

The best next slice is a boss presentation pass, not an asset replacement pass.

## What The Fanout Found

Mechanics/data:

- Briar Warden gates Act I at lap 4 with four themed tiles.
- Crown Sentinel gates Act II at lap 9 with four themed tiles and Gate Wyrm support.
- Loop Tyrant is the Act III finale after four tier-3 loops, uses five enemies, and ends the room when all chunks clear.
- Boss phases reset the board and anchor four boss tiles, then resolve one chunk/seal per boss tile combat.
- Boss combat has real mechanical pressure: armor/guard mitigation changes, boss damage floors/caps, corruption pressure, and no Night Vagrant vanish from lethal boss damage.
- The promised boss ante/wager is not implemented; current boss cost is implicit through danger/death/reset pressure.

Assets/runtime:

- Boss tile/seal art is strong and readable, including grayscale.
- Briar Warden and Crown Sentinel sprites read well as named bosses.
- Loop Tyrant art is serviceable but loses dominance in the five-enemy lineup; the UI should elevate it with text/hierarchy.
- Mobile combat is tight but workable if boss UI replaces generic copy instead of adding bulky new panels.
- Proof artifacts are under `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/`.

Excitement/design:

- Current overlay entry cue is generic `fight!`.
- Current overlay title/result language is generic: `Fight!`, `Victory`, `Loot Found`, `Hero Fell`.
- Boss phase progress exists in state, but combat does not clearly say `Seal X/4`, `Seal Broken`, or `Loop Tyrant Broken`.
- The fastest perceived improvement is boss-aware copy/classes/progress in `CombatOverlay`.

## Recommended Next Implementation

Ship a commit-capable quick-win pass in `src/game-ui.tsx` and `src/styles.css` only if possible:

- derive boss presentation from `player.bossPhase`, current tile, and boss combat labels
- change boss entry cue to `boss!` or `tyrant!`
- add boss-specific overlay classes
- show `Act Boss` or `Loop Tyrant`
- show compact `Seal X/4` progress
- change result copy to `Seal Broken`, named boss broken, `Loop Tyrant Broken`, or `Boss Holds`
- keep normal combat unchanged
- keep CSS lightweight: static gradients, opacity, transforms; no heavy filters or particle loops

This uses the existing mechanics and existing assets while making the fight moment feel authored.

## Proof And Caveats

Reports:

- `runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md`
- `runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md`
- `runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md`

Visual proof:

- `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-enemy-contact-sheet.png`
- `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-tile-contact-sheet.png`
- `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-loop-tyrant-desktop.png`
- `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-loop-tyrant-mobile.png`

Caveat: deterministic boss fixture screenshots used the normal app surface, but defaulted to the existing ignored production `dist/` bundle. Generic current-overlay findings are cross-checked by dev guided captures and source inspection.

Server cleanup: final check showed no listeners on `5200-5219`.

## Commit-Capable Worker Prompt

Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

Work in `/mnt/nxt-dev/loopduel`. Read `AGENTS.md` first. Preserve dirty state and use explicit-path staging only.

Implement the quick-win boss combat presentation slice without changing combat mechanics or replacing assets. Start from the reports:

- `runs/boss-fight-excitement-stocktake-2026-07-04.report.md`
- `runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md`
- `runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md`
- `runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md`

Scope:

- derive boss presentation in `src/game-ui.tsx` from `player.bossPhase`, current boss tile/chunk, and boss combat labels
- for boss combats, change entry cue to `boss!` for act bosses and `tyrant!` for Loop Tyrant
- add boss-specific classes to `.combat-overlay`
- change boss overlay title/meta/result copy:
  - entry/title: `Act Boss` or `Loop Tyrant`
  - progress: compact `Seal X/4` or pips
  - survived with chunks remaining: `Seal Broken`
  - final act-boss chunk: `Briar Warden Broken` or `Crown Sentinel Broken`
  - final Tyrant chunk: `Loop Tyrant Broken`
  - lethal: `Boss Holds`
- keep normal combat copy and layout unchanged
- keep CSS in `src/styles.css` lightweight: static gradients, opacity, transforms; no new heavy filters, particle loops, or new assets

Acceptance:

- `npm run lint`
- `npm run build`
- desktop and mobile Playwright screenshots of at least one boss combat entry/result
- screenshot proof that normal combat still reads unchanged
- no dev server left listening on `5200-5219`
