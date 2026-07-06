# Boss Asset Runtime Stocktake - 2026-07-04

## Status

Complete, with caveats.

- Repo HEAD preflight: `cb59209`
- Scope honored: read-only source audit plus allowed writes to this report and proof artifacts under `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/`
- No source files, committed assets, package files, config, or tests were edited by this audit.
- Boss combat was reachable through the normal app surface. Desktop proof is clean. Mobile proof is reachable through the normal joined app flow, but the Loop Tyrant five-enemy lineup slightly clips at the right edge.
- After capture, an unrelated dirty `src/game-ui.tsx` boss-overlay polish change appeared in the worktree. It is preserved and listed in final repo status; the findings and screenshots below describe the stock `cb59209` runtime captured for this read-only audit.

## Source Reference Map

Line references are from the preflight `cb59209` stock scan.

- Combat enemy URL, size classes, and prewarmed enemy list: `src/game-assets.ts:26`, `src/game-assets.ts:30`, `src/game-assets.ts:140`
- Boss loop tile art list: `src/game-assets.ts:100`
- Boss phase configs: `server/rules.mjs:67`
- Boss combat encounter lineups/backgrounds/effects: `server/rules.mjs:353`
- Boss board staging and boss-tile resolution: `server/rules.mjs:2529`, `server/rules.mjs:2613`
- Normal combat overlay lineup/rendering: `src/game-ui.tsx:2816`, `src/game-ui.tsx:2891`, `src/game-ui.tsx:2958`
- Enemy layout/scale CSS: `src/styles.css:3194`, `src/styles.css:3471`, `src/styles.css:4115`
- Boss tile CSS mappings: `src/styles.css:4980`

## Boss Asset Inventory

### Boss Combat Sprites

All three act/final bosses use unique combat sprite files and are marked `large` by `combatEnemyPresentation`.

| Boss | Runtime lineup | Sprite | Size | Background/effect | Boss tiles |
| --- | --- | --- | --- | --- | --- |
| Briar Warden | `briar-warden` only | `public/assets/combat/enemy-briar-warden.png` | 416x472, large | `bg-grove.png`, claw | `rootwall`, `bramblebloom`, `wardensheart`, `oldgrowth` |
| Crown Sentinel | `crown-sentinel`, `gate-wyrm` | `public/assets/combat/enemy-crown-sentinel.png` | 416x472, large | `bg-forge.png`, ember | `guardstance`, `markedchallenge`, `retaliation`, `executionstance` |
| Loop Tyrant | `loop-tyrant`, `briar-warden`, `crown-sentinel`, then repeats | `public/assets/combat/enemy-loop-tyrant.png` | 352x472, large | `bg-crypt.png`, spectral | `seal1`, `seal2`, `seal3`, `innergate` |

### Boss-Class / Large Enemy Assets Referenced By The App

These are not all act bosses, but they share boss-scale treatment or appear in boss-class encounters and are referenced by the app's combat asset list.

- `public/assets/combat/enemy-gate-wyrm.png` - large; appears as Crown Sentinel helper and in Wyrm Gate/Ember Gate/Dragon Roost encounters.
- `public/assets/combat/enemy-crown-gate.png` - large; used in Wyrm Gate/Ember Gate/Dragon Roost encounters.
- `public/assets/combat/enemy-loop-warden.png` - large; prewarmed/sized by `src/game-assets.ts`, but I found no current `server/rules.mjs` encounter that emits it.
- Other large normal enemies that reduce boss distinctiveness by sharing the same large-stage treatment: `enemy-bone-host.png`, `enemy-dire-thorn.png`, `enemy-grave-knight.png`, `enemy-keep-reaver.png`, `enemy-moon-fiend.png`.

### Boss Loop / Seal Tile Assets

Current boss phases use 12 tile assets:

- Act I: `rootwall`, `bramblebloom`, `wardensheart`, `oldgrowth`
- Act II: `guardstance`, `markedchallenge`, `retaliation`, `executionstance`
- Final: `seal1`, `seal2`, `seal3`, `innergate`

Four more boss-loop tile assets are referenced/prewarmed and mapped in CSS but are not used by current boss configs: `wyrmhead`, `wyrmclaw`, `wyrmcoil`, `wyrmtail`.

## Runtime Capture Method

I used the normal app surface, not a standalone art harness, for combat screenshots.

Because reaching all three boss fights through real-time lap play would be slow and nondeterministic, I seeded rooms with the existing repo rules API and server persistence path:

- Generated combat states with `testApi.createRoom`, `testApi.createPlayer`, `testApi.checkWinner`, and `testApi.triggerTile` from `server/rules.mjs`.
- Persisted those rooms to `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-combat-seeded-rooms.persistence.json`.
- Loaded them through `server/index.mjs` using `LOOPDUEL_PERSISTENCE_PATH`.
- Served the normal dev app on `PORT=5200`, `LOOPDUEL_VITE_HMR_PORT=5201`.
- Captured desktop through the built-in `Watch` spectator flow.
- Captured mobile through the normal joined player flow, then focused the boss runner via the mobile rival chip. This was cleaner than spectator mobile, which clipped the combat panel badly.

This proves the current React/CSS combat surface using real server combat payloads. It does not prove the full hand-played progression path from a fresh run to each boss.

## Proof Artifacts

Runtime screenshots:

- Desktop Briar Warden: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-briar-warden-desktop.png`
- Desktop Briar Warden grayscale: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-briar-warden-desktop-grayscale.png`
- Desktop Crown Sentinel: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-crown-sentinel-desktop.png`
- Desktop Crown Sentinel grayscale: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-crown-sentinel-desktop-grayscale.png`
- Desktop Loop Tyrant: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-loop-tyrant-desktop.png`
- Desktop Loop Tyrant grayscale: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-loop-tyrant-desktop-grayscale.png`
- Mobile joined Briar Warden: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-briar-warden-mobile-joined.png`
- Mobile joined Briar Warden grayscale: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-briar-warden-mobile-joined-grayscale.png`
- Mobile joined Crown Sentinel: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-crown-sentinel-mobile-joined.png`
- Mobile joined Crown Sentinel grayscale: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-crown-sentinel-mobile-joined-grayscale.png`
- Mobile joined Loop Tyrant: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-loop-tyrant-mobile-joined.png`
- Mobile joined Loop Tyrant grayscale: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-loop-tyrant-mobile-joined-grayscale.png`

Contact sheets and metadata:

- Full combat enemy contact sheet: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/combat-enemy-contact-sheet-color.png`
- Full combat enemy grayscale sheet: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/combat-enemy-contact-sheet-grayscale.png`
- Boss/boss-class lineup sheet: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-lineup-contact-sheet-color.png`
- Boss/boss-class grayscale sheet: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-lineup-contact-sheet-grayscale.png`
- Boss tile sheet: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-tile-contact-sheet-color.png`
- Boss tile grayscale sheet: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-tile-contact-sheet-grayscale.png`
- Runtime capture manifest: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-screenshot-manifest.json`
- Mobile joined manifest: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/runtime-mobile-joined-manifest.json`
- Seeded room summary: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/boss-combat-seeded-rooms.summary.json`
- Readability metrics: `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/asset-readability-metrics.json`

## What Looks Exciting Now

- The three boss sprite files are unique, high-effort art, not palette swaps.
- The boss tile/seal symbols stay readable in grayscale. The seal row especially reads as deliberate boss progression.
- The combat overlay has good moment-to-moment energy: damage banner, attack text, animated hit/strike state, stage hit, HP pips, and per-theme background/effect.
- Loop Tyrant is mechanically and visually the most intense because the payload creates five enemies and a stacked HP display.
- The normal runtime view clearly names the boss in the combat banner and enemy nameplate.

## Visual / Readability / Staging Gaps

- Bosses are rendered through the same `enemy-party` layout as normal enemies. Aside from `large` sizing and different background/effect, there is no boss-specific composition, intro, camera, frame, or stage treatment.
- Crown Sentinel is visually demoted by its own runtime lineup: `gate-wyrm` is large, central, and more massive, while `enemy-kind-crown-sentinel` has a CSS scale of `0.92`.
- Loop Tyrant repeats boss sprites in a five-enemy lineup. The repeated Tyrant/Briar bodies create pressure, but also clutter the silhouette and make the final boss feel like a mob pack instead of one dominant entity.
- Mobile joined proof reaches the boss combat view, but the 390px layout is dense. In the Loop Tyrant capture, the rightmost enemy extends a little past the viewport. Spectator mobile is worse and clips the focused combat panel, so it is not a good proof surface.
- The boss banner often covers the upper torso/head area during beat captures. This adds drama, but it also hides silhouette detail at the exact moment the screenshot should sell the boss.
- The board-side boss tiles are readable, but their runtime use is quiet: boss phase staging swaps in four special tiles without a strong reveal, seal-breaking effect, or direct visual connection to the combat overlay.
- Restored seeded rooms show an authority/waiting-for-host panel outside the combat overlay. It does not block the combat proof, but it is a capture-method artifact.

## Opportunities For More Exciting Bosses

- Give each boss a bespoke combat stage layout. Briar can loom low and wide with root silhouettes; Crown Sentinel should stand central/taller than helpers; Loop Tyrant should dominate the scene as one primary body with minions pushed smaller and farther back.
- Add a boss-only intro beat before normal combat: name slam, boss portrait/sigil, background color shift, and short screen shake.
- Replace repeated Loop Tyrant copies with one oversized Tyrant plus spectral echoes, chains, seals, or orbiting defeated-boss silhouettes. Keep the five-foe mechanics, but do not make the visual read as duplicate bodies.
- Rebalance Crown Sentinel's visual hierarchy: remove the `0.92` boss scale reduction, shrink/offset Gate Wyrm, or frame Sentinel with a crown/shield aura so the boss is the first read.
- Push boss-specific VFX: bramble lash/root burst for Briar, crown beam/shield flare for Sentinel, seal fracture/loop distortion for Tyrant.
- Improve mobile boss layout: cap enemy party width to the overlay, collapse five HP rows more aggressively, reduce banner height during beats, and ensure all enemy sprites remain inside the viewport.
- Make boss tiles part of the show: pulse the active boss tile, crack seals as chunks clear, and echo the active tile symbol into the combat background/nameplate.
- Consider art passes that strengthen grayscale silhouettes: Briar already reads best as a squat thorn mass; Sentinel needs a clearer crown/shield outline at small sizes; Tyrant needs brighter face/halo/loop anchors so the robe mass does not disappear into crypt backgrounds.

## Server Cleanup Status

- First standalone server attempt on `5200/5201` exited before capture and left no listeners.
- Runtime capture then used owned subprocesses on `5200` and `5201`, stopped them in `finally`, and verified cleanup.
- Final listener check for `5200` and `5201`: no listeners remained.

## Final Repo Status

`git status --short` at report time:

```text
 M runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md
 M runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md
 M src/game-ui.tsx
?? runs/boss-combat-overlay-polish-2026-07-04.report.md
```

Only this report was intentionally edited by this audit. The other dirty entries were not part of this work and were preserved.
