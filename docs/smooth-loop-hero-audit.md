# Smooth Loop Hero Audit

Date: 2026-06-06

## Goal

Preserve the Loop Hero feel: continuous, even runner motion around the loop, with combat
and other hard stops feeling intentional instead of like frame drops or tile-to-tile
stutters.

## Findings

- Base traversal was smooth, but placed terrain reintroduced stutter because terrain
  placement changed the board key that owned the runner animation loop. The visual path
  geometry had not changed, but the runner `requestAnimationFrame` effect still restarted.
- Server position snapshots were forcing board tile UI work during motion. Placed tiles
  made each tile heavier, so routine movement snapshots paid extra React render cost.
- The runner sprite was already transform-driven, but the glow/highlight still moved
  through board-level `left`/`top` CSS variables. Updating those every frame could
  invalidate style/layout across the board subtree.
- Lap wrapping, parallax continuity, and server combat pause behavior did not show a
  separate smoothness fault after the motion layer was isolated.

## Changes Made

- Keyed the runner animation loop to board geometry only, not terrain type.
- Split the tile button path into a memoized component so ordinary position snapshots do
  not rebuild placed-tile popovers and controls.
- Removed live player-position text from placed-tile popovers; the runner/glow layer is
  now the live location indicator.
- Moved both runner and glow to direct `transform: translate3d(...)` ref updates so the
  board and tile layers stay static while the motion layer animates.
- Updated the Playwright smoke check to read transform-based runner position.

## Verification

- `npm run lint`
- `npm test` - 54 passing tests
- `npm run build`
- `npm run test:e2e`
- Placed-tile browser probe: placed 2 terrain tiles, sampled 150 frames, saw 150 unique
  runner positions, 64 unique parallax values, zero occupied tile markers, no board shift,
  and max runner/glow drift of `0.018px`.
- Mobile RAF probe: 1,195 sampled frames, p99 `16.8ms`, max `16.8ms`, zero long tasks,
  zero frame gaps over 34ms, and runner/glow misalignment `0`.
- Full loop-wrap probe: reached lap 1 over 2,516 sampled frames, p99 `16.8ms`, max
  `16.8ms`, zero frame gaps over 34ms, wrap-window max frame `16.8ms`, and runner/glow
  misalignment `0`.

## Remaining Watch Points

- The current live room still sends full snapshots. The animation path now tolerates them,
  but the engine direction remains sequenced movement segment events.
- Future tile UI additions should stay out of the per-frame and per-position-snapshot
  motion path unless they are explicitly part of the motion overlay.

## React Churn Follow-Up

Date: 2026-06-07

- Reward floaters used to live in React state, so every gain/loss appeared and expired
  through a PlayerPanel render. They now spawn as capped runner-layer DOM nodes and remove
  themselves on animation end.
- The authority-staleness check used to call `setNetworkNow(Date.now())` every 250ms,
  forcing the app shell to re-render even when no room event arrived. It now polls in the
  background and only re-enters React when the stale/not-stale value changes.
- Other React touch points found in the movement-facing surface are bounded or local:
  drag ghost coordinates update only while a card/loot drag is active, notice/profile
  timers do not run during normal movement, and combat beat timers are scoped to the
  combat overlay rather than the runner transform loop.

Remaining watch point: rival combat overlays still run local React beat timers while other
runners may be moving. If stutter lines up with rival fights after the timer fix, the next
cheapness pass should move beat presentation closer to CSS animation or imperative overlay
DOM, the same way runner floaters were handled.
