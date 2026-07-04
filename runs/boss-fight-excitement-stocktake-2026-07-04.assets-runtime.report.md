# Boss Asset Runtime Stocktake - 2026-07-04

## Status

Complete by manager recovery. The `assets-runtime` worker wrapper was lost, but the lane had written the early report stub and the manager recovered the visual proof locally without editing source code, assets, package files, or config.

Preflight HEAD: `cb59209`.

Allowed writes from this lane:

- this report
- proof artifacts under `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/`

## Method And Caveats

Two kinds of proof were captured:

1. Normal guided combat from the current dev server. This confirms the current overlay still presents combat as generic `Fight!` copy on desktop and mobile.
2. Deterministic boss fixture captures created through the normal app surface with `testApi` and `createRoomRuntime`, then loaded through `?skiptitle=1&room=<room>`.

Caveat: the boss fixture script defaulted to `production-existing-dist` because ignored `dist/index.html` already existed. Those screenshots are still useful for inspecting boss assets in the normal app layout, but the source-of-truth generic-copy finding is backed by the dev guided captures and source inspection in `src/game-ui.tsx`.

No page errors were recorded in the guided captures. Console output was limited to Vite/React dev messages.

## Boss Asset Inventory

Staged boss combat sprites:

- Briar Warden: `/assets/combat/enemy-briar-warden.png`
- Crown Sentinel: `/assets/combat/enemy-crown-sentinel.png`
- Loop Tyrant: `/assets/combat/enemy-loop-tyrant.png`

Boss-class support sprites:

- Gate Wyrm: `/assets/combat/enemy-gate-wyrm.png`
- Crown Gate: `/assets/combat/enemy-crown-gate.png`
- Ash Imp: `/assets/combat/enemy-ash-imp.png`

Large normal comparison sprites included in the contact sheet because they compete visually with bosses:

- Dire Thorn
- Grave Knight
- Bone Host
- Keep Reaver
- Moon Fiend
- Loop Warden

Staged boss tile/seal assets:

- Briar Warden: `rootwall`, `bramblebloom`, `wardensheart`, `oldgrowth`
- Crown Sentinel: `guardstance`, `markedchallenge`, `retaliation`, `executionstance`
- Loop Tyrant: `seal1`, `seal2`, `seal3`, `innergate`

Boss-class tile assets:

- `wyrmgate`
- `dragonroost`
- `embergate`

Registered but not current staged boss config:

- `wyrmhead`
- `wyrmclaw`
- `wyrmcoil`
- `wyrmtail`

## Visual Findings

The tile/seal assets are the strongest part of the current boss presentation. They read as authored boss objects, stay distinct in grayscale, and fit the dark fantasy board language.

The staged boss sprites are good enough to keep. Briar Warden and Crown Sentinel read clearly as named threats. Gate Wyrm is also strong. Loop Tyrant has the right ornate/final-boss concept, but it does not dominate the five-enemy Tyrant lineup by itself; in runtime captures, the repeated Briar/Tyrant/Crown group can make the final boss feel like a party of large enemies rather than one commanding enemy.

The live combat-view weakness is presentation hierarchy, not raw asset quality. Boss fights still use the same combat shell, result language, and beat framing as normal fights. The proof captures show large boss sprites, but the headline moment is still ordinary attack text such as `The Crown Sentinel strikes Player` rather than `Loop Tyrant`, `Seal 3/4`, or `Boss Holds`.

Mobile is readable but tight. The 390px-wide boss overlay fits, but a five-enemy Tyrant lineup crowds the enemy side, and the boss identity depends heavily on tiny name/pip text. Any new boss UI should be compact: one boss title, one seal row, and result copy that replaces generic text instead of adding large extra panels.

## Runtime Proof Artifacts

Root:

`.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/`

Contact sheets:

- `boss-enemy-contact-sheet.png`
- `boss-enemy-contact-sheet-gray.png`
- `boss-tile-contact-sheet.png`
- `boss-tile-contact-sheet-gray.png`

Current dev guided combat:

- `desktop-guided-combat.png`
- `desktop-guided-combat-gray.png`
- `mobile-guided-combat.png`
- `mobile-guided-combat-gray.png`

Boss runtime fixture captures:

- `runtime-briar-warden-desktop.png`
- `runtime-briar-warden-mobile.png`
- `runtime-crown-sentinel-desktop.png`
- `runtime-crown-sentinel-mobile.png`
- `runtime-loop-tyrant-desktop.png`
- `runtime-loop-tyrant-mobile.png`
- `runtime-wyrm-gate-desktop.png`
- `runtime-wyrm-gate-mobile.png`
- `runtime-dragon-roost-desktop.png`
- `runtime-dragon-roost-mobile.png`

Supporting proof files:

- `capture-boss-runtime.mjs`
- `runtime-rooms.json`
- `capture-summary.json`
- `visual-observations.json`

## Recommendation

Do not start with new boss art. Start with a boss presentation pass in `CombatOverlay`:

- boss-specific entry cue: `boss!` / `tyrant!`
- boss title: `Act Boss` / `Loop Tyrant`
- seal progress: `Seal X/4` or compact pips
- result copy: `Seal Broken`, `Briar Warden Broken`, `Loop Tyrant Broken`, `Boss Holds`
- subtle static frame treatment for boss combats only

This should make the existing assets feel more authored while avoiding the risk of spending time replacing sprites that are already serviceable.

## Server Cleanup Status

Clean. A final port check showed no listeners on `5200-5219`.
