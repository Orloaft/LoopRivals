# Juice Runtime UX Audit - 2026-07-07

Session key: `juice-runtime-ux-audit-2026-07-07`
HEAD inspected: `4b8428e`
Repo: `/mnt/nxt-dev/loopduel`
Status: complete

Early stub was written before the Playwright capture loop. Source files, package files, and config were not edited. The only tracked file intentionally changed by this worker is this assigned report path.

## Runtime Evidence

Artifact dir: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/`

- Desktop title: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/01-desktop-title.png`
- Desktop pre-start room: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/02-desktop-room-before-start.png`
- Mobile pre-start room: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/03-mobile-room-before-start.png`
- Desktop multiplayer/menu/settings: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/04-desktop-room-menu-multiplayer.png`
- Desktop early live movement: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/05-desktop-live-early-movement.png`
- Mobile early live movement: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/06-mobile-live-early-movement.png`
- Desktop after terrain placement: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/07-desktop-after-terrain-placement.png`
- Desktop shop/HUD: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/08-desktop-shop-hud.png`
- Desktop combat overlay: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/09-desktop-combat-overlay.png`
- Mobile mid-run: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/10-mobile-live-midrun.png`
- Desktop later board/phase surface: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/11-desktop-phase-strip-and-board.png`
- Capture notes: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/runtime-ux-notes.json`
- Capture driver: `/mnt/nxt-dev/loopduel/.openclaw-artifacts/juice-runtime-ux-audit-2026-07-07/runtime-ux-capture.mjs`

Capture setup: app launched normally through `node server/index.mjs` with `PORT=5200`, `LOOPDUEL_VITE_HMR_PORT=5201`, `NODE_ENV=development`. Health check returned ok. The run joined a desktop and mobile browser, added socket-controlled rivals, set lobby settings to 4 seats / 7200 score / quick pace, started a live match, placed Waystone and Blood Moon terrain, opened shop, and captured a real combat overlay.

Performance sample from the capture notes:

- Desktop early movement: p95 frame gap 50ms, p99 66.6ms; only sampled active animation was `card-deal-in`.
- Mobile early movement: p95 66.7ms, p99 83.4ms; only sampled active animation was `card-deal-in`.
- Desktop combat: p95 50ms, p99 50.1ms; active sampled animations included `combat-pop`, `combat-settle`, `combat-stage-hit`, and `combat-damage-float`.

The app already has important motion safety hooks: `prefers-reduced-motion`, `quality-low`, a reusable WAAPI screen shake helper, combat overlay keyframes, damage floaters, card deal-in, target rings, stun wobble, slot-drop pulses, and trait pulses.

## Findings

The visual foundation is strong: title art, tile art, hero portraits, combat art, and the right dock give the game a clear gothic arcade identity. The weak spots are mostly runtime emphasis. Many important state changes happen, but they read as static text, tiny badges, or quiet number changes.

Top moments that currently feel flat or low-impact:

1. Movement and lap progress. The runner glides around the loop, but tile arrival, lap completion, leader changes, and score jumps do not create a strong "beat." In screenshots, the board can look almost frozen unless the viewer catches the runner position or a small score float.
2. Terrain placement and hazard arming. Placing Waystone and Blood Moon changes the board art, but there is no obvious path ripple, tile-settle pop, or route preview burst that says "the loop changed."
3. Rewards and scoring. `+514 score`, `+56`, and `+3 XP` appear as small tags. They are informative but not celebratory, and on a busy board they disappear into the interface.
4. Combat impact. Combat is the richest animated surface, but the open shop can visually compete with it, impact still relies heavily on text/HP deltas, and enemy/hero hit staging could use stronger one-shot anticipation and aftermath. The overlay is good; the surrounding game state does not clearly "yield the stage."
5. Multiplayer feedback. Rival runners, rival chips, remote score changes, stuns, and sabotage are present but subtle. On desktop, rival panels are small compared to the main board and dock; on mobile, the rival strip truncates names/status and already competes with the board and hand.
6. Shop and HUD state changes. Shop open/close and offer refreshes are functional but static. Ability readiness, heat changes, gold changes, and dock alerts would benefit from small localized motion.
7. Title/menu. The title image has high impact, but the menu stack itself is static. A subtle loop-runner idle pass or button hover glints would make the first interaction feel more alive without changing layout.
8. Boss/phase surfacing. A true boss state was not reached in this bounded live capture. The later board capture had no phase-strip text. Since bosses require loop thresholds and no low-threshold runtime hook was found, boss recommendations below are based on the visible boss-related UI patterns and existing combat/phase code rather than a captured boss fight.

## Performance-Minded Recommendations

Use event-bounded bursts and avoid permanent animation on large backgrounds. Prefer `transform`, `opacity`, CSS variables, sprite-sheet steps, and WAAPI one-shots. Every addition should respect existing `prefers-reduced-motion` and `quality-low`; reduced motion can swap travel/zoom effects for a short opacity or color pulse.

### Movement

- Add a 140-220ms tile-arrival pulse on the current tile: ring scale from 0.95 to 1.08, opacity fade, and a small runner squash/lean using transform only.
- Add lap-complete route sweep: a thin light travels around the 16-tile loop once, then fades. Trigger only on lap completion.
- Add leader-change crown snap: small crown/score badge pop on the active player and corresponding rival chip, no layout shift.

### Hazards And Placement

- On terrain placement, animate the target tile with a "card stamps into board" pop and a 1-tile neighbor ripple showing the changed route.
- For rival hazards, add a short arming glyph above the target tile and a warning pulse only while the target runner is within 2-3 steps. This keeps animation event-bounded instead of constantly pulsing every hazard.
- On combat-stop tiles, add a one-shot pre-fight inhale as the runner approaches: tile darkens/glows for 250ms, then combat overlay enters.

### Combat

- Give combat a stronger stage-takeover: briefly dim or blur non-combat drawers/docks, especially an open shop, when `combat-overlay` enters.
- Add hit-stop micro timing to HP bars and sprites: 60-90ms pause on impact, bar chip trail, and one stronger damage number scale. Keep it transform/opacity and limited to the active overlay.
- Differentiate outcomes: victory/loot/defeat should have distinct plaque colors and icon bursts. Current result phase exists, but the player should feel "I won/lost/got loot" before reading the log.

### Rewards, Shop, And HUD

- Score/gold/XP changes should fly from the event source to the HUD target or pulse the target stat. Use one particle group capped to 8-12 small elements per event.
- Shop refresh/open should slide/fade offers in with a stagger capped to 80ms total, and purchases should collapse the bought row into the gold/gear destination.
- Ability-ready and heat-threshold changes should use a small icon flash and ring fill, not a persistent glow.

### Boss And Phase Transitions

- On boss spawn, freeze runner input presentation for a short board reset ceremony: loop cracks/sweeps, four boss tiles stamp in sequentially, then resume. Cap at 900-1200ms and reduce to instant tile flashes for reduced motion.
- Boss combat should add seal/chunk pips and a per-seal break burst. The code already has boss-aware combat presentation paths; the missing runtime feel is the board-to-overlay transition and the clear/fail consequence moment.
- For phase countdowns, add a low-frequency "next boss in N loops" pulse only when one loop remains, not throughout the match.

### Multiplayer

- Rival actions should briefly draw a line from the attacker chip/panel to the victim chip/board, then show a small impact badge on the victim. Cap to one active line per attacker to avoid clutter.
- Stuns/bonks need a clear status timer flash on rival chips and a short wobble on the runner, with reduced-motion replacing wobble with color/opacity.
- Remote score/lap changes should pulse rival chips; on mobile, avoid extra vertical motion because the rival strip and hand already share limited space.

## Mobile Caveats

Mobile readability is already tight. The board, top stat buttons, rival carousel, drawer tabs, and hand all fit, but the bottom cards are partially clipped and rival chip text truncates. Extra animation should not push layout or use large vertical bounces. Prefer overlay-local opacity/scale, short stat pulses, and horizontal chip flashes. Avoid persistent particle systems near the hand because they would obscure card labels and touch targets.

## Ranked Top 5

1. Tile arrival + lap completion pulses.
   - Excitement: high. Risk: low.
   - Why: makes the core loop feel alive every few seconds and at lap milestones.
   - Perf shape: small transform/opacity rings on current tile; no background animation.

2. Terrain/hazard placement stamp and route ripple.
   - Excitement: high. Risk: low-medium.
   - Why: card plays are strategic decisions but currently feel like board art swaps.
   - Perf shape: one tile plus nearest path neighbors; 250-400ms; reduced motion gets a color flash.

3. Combat stage focus and stronger hit/result beats.
   - Excitement: high. Risk: medium.
   - Why: combat already has the most assets; one focused pass can make it feel much more forceful.
   - Perf shape: overlay-only transforms, HP chip trail, brief non-combat dim; avoid animating shop/dock internals during combat.

4. Reward/stat flyouts to HUD.
   - Excitement: medium-high. Risk: low-medium.
   - Why: score, gold, XP, heat, and ability readiness need celebratory feedback.
   - Perf shape: capped small particle group or single badge per event, merged when events arrive within a short window.

5. Multiplayer attack/response lines and rival chip pulses.
   - Excitement: medium-high. Risk: medium.
   - Why: multiplayer is mechanically present but visually quiet, especially for remote actions.
   - Perf shape: one line/badge per event, debounce repeated hits, mobile uses chip flash only when crowded.

Boss spawn/seal break is the next highest-impact item, but it should follow or share infrastructure with combat stage focus and tile stamping. It has higher implementation risk because live boss access needs deterministic capture/test support.

## Verification And Cleanup

Verification performed:

- Preflight HEAD command: `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD` -> `4b8428e`.
- Started the app through the repo server on allowed ports `5200` and `5201`.
- Captured desktop and mobile Playwright screenshots of live gameplay-scale surfaces.
- Captured multiplayer room/menu, early movement, terrain placement, shop/HUD, real combat overlay, and mobile mid-run.
- Captured frame-gap and active-animation notes in `runtime-ux-notes.json`.
- Confirmed combat appeared after placing Blood Moon.
- Confirmed final server stop: `exitCode: 0`.
- Confirmed no listeners on ports `5200-5219` after cleanup.

Final repo/server status:

- Temp server stopped.
- Ports `5200-5219` clean.
- No source/package/config edits.
- Existing unrelated untracked reports were present/visible in `git status`; this run added the assigned report path and ignored artifact files under `.openclaw-artifacts`.

Caveats/blockers:

- A complete match and true boss encounter were not captured in this bounded audit. Boss threshold settings can lower score target but not the loop threshold, and no existing live fast-forward hook was found for browser capture.
- Headless sampling showed elevated frame gaps and long tasks, so recommendations intentionally avoid always-on animation and should be checked against existing motion/jank gates after implementation.
