# Smoothness Rewrite Plan

## Goal

Make Loopduel feel consistently smooth under multiplayer authoritative-server play, aiming for Loop Hero-style motion confidence without surrendering server authority.

The plan keeps the current Socket.IO + React architecture for now. The research points to protocol churn, client state application, and independent animation scheduling as the highest-leverage problems. PixiJS remains the best future rendering candidate, but only after telemetry shows the board/combat viewport is the limiting factor.

## Research Verdict

- Keep Socket.IO and strengthen the existing snapshot/delta protocol.
- Make `room:delta` the normal gameplay authority stream.
- Reserve full `state` snapshots for joins, recovery, protocol mismatch, explicit keyframes, and snapshot-required events.
- Keep React for the shell, cards, shop, logs, and menus.
- Move motion consistency work into a shared RAF scheduler and client projection layer, not React renders.
- Consider selector-based state subscriptions only if instrumentation shows React commit churn during motion.
- Defer PixiJS until we have measured paint/render pressure or need sprite batching, particles, atlases, camera effects, and richer combat presentation.
- Avoid Phaser, boardgame.io, Nakama, and full Colyseus migration as first moves; they do not directly solve the current smoothness bottleneck.

## Phase 1: Telemetry And Stress Baseline

Capture the current behavior before changing protocol semantics.

- Add client smoothness metrics:
  - RAF frame-gap histogram with p50, p95, p99, and max gap.
  - Long-task observer samples.
  - React commit/remount counters around gameplay surfaces.
  - `applyRoomDelta` timing and count per second.
  - Socket event count and payload bytes per second.
- Add or extend a debug overlay/log channel for local playtests.
- Extend `scripts/ws-load.mjs` or add a companion script to stress:
  - multiple connected players,
  - long loop runs,
  - command bursts,
  - reconnect/resume,
  - combat stops.
- Record baseline numbers before protocol changes.

Acceptance:

- A local playtest can report frame pacing, socket volume, delta application cost, and long tasks.
- Stress scripts produce repeatable before/after measurements.

## Phase 2: Delta-Only Normal Updates

Stop undoing the delta protocol by following ordinary deltas with full state snapshots.

- Audit `commitRoomCommand()` and simulation tick broadcasting.
- Emit full `state` only for:
  - initial join,
  - resume/recovery fallback,
  - protocol mismatch,
  - explicit periodic keyframe,
  - events that are marked snapshot-required.
- Keep `room:delta` monotonic and authoritative with:
  - sequence number,
  - server time,
  - command acceptance/rejection details,
  - compact movement/combat/shop/state events.
- Preserve the room event journal as the source of resumable deltas.
- Add tests for ordinary commands and ticks proving they do not broadcast full state.

Acceptance:

- Normal movement/combat/shop progression streams through deltas.
- Reconnect and `fromSeq` recovery still work.
- Full snapshots still happen in the explicit fallback paths.

## Phase 3: Command Acks And Retry Discipline

Make player commands reliable without requiring full-state rebroadcasts.

- Add command acknowledgements keyed by existing command ids.
- Keep command idempotency on the server.
- Add client retry behavior for unacknowledged commands where Socket.IO delivery does not guarantee arrival.
- Surface rejected commands as explicit delta/ack outcomes rather than hidden correction churn.
- Measure duplicate command handling under reconnect and packet delay simulations.

Acceptance:

- Commands can be retried safely.
- Duplicate command ids do not double-apply.
- Rejections are visible and deterministic.

## Phase 4: Batched Client State Application

Avoid multiple React state updates when several authority messages arrive in the same frame.

- Queue incoming `room:delta` and `state` messages.
- Apply queued messages once per microtask or animation frame.
- Prefer one `setGame` per batch.
- Preserve ordering by sequence number.
- Keep snapshot fallback able to replace state immediately when needed.

Acceptance:

- Burst socket updates coalesce into fewer React commits.
- Delta ordering remains deterministic.
- Projection behavior remains visually stable.

## Phase 5: Shared Motion Scheduler

Centralize visual motion timing so runner panels, parallax, and combat cues advance in one RAF phase.

- Introduce a small RAF scheduler for gameplay visual targets.
- Move runner cursor, parallax, and combat-arrival cue timing onto that scheduler.
- Keep DOM writes transform-based and outside normal React render.
- Ensure the scheduler can pause/resume cleanly on unmount and reconnect.
- Add tests for arrival timing and no oversized local jumps after delayed frames.

Acceptance:

- One gameplay RAF loop drives the moving surfaces.
- Combat crossed-swords animation starts at the projected arrival moment at the combat tile center.
- Motion remains smooth through delayed frames and segment gaps.

## Phase 6: Server Cadence Tuning

Tune authority update cadence with measured client interpolation, not guesswork.

- Test current 260ms cadence against 10 Hz and 8 Hz movement authority updates.
- Keep render interpolation client-side with the existing presentation buffer as the starting point.
- Compare bandwidth, CPU, p95/p99 frame gaps, correction frequency, and perceived smoothness.
- Tune periodic keyframe interval after delta-only streaming is stable.

Acceptance:

- Chosen cadence is backed by stress data.
- More frequent authority updates do not create unnecessary client or network pressure.

## Phase 7: PixiJS Spike Gate

Only run the renderer spike if telemetry says DOM/CSS rendering is the limiting factor or we need a higher visual ceiling.

- Prototype PixiJS as a board/combat viewport only.
- Keep React as the UI shell and Socket.IO as the network layer.
- Feed Pixi from the same projection/scheduler data.
- Compare against DOM implementation using the Phase 1 metrics.

Acceptance:

- Decision is based on measured render cost and visual needs.
- No full Phaser-style scene/lifecycle rewrite is started unless Pixi proves insufficient and the product direction changes.

## Initial Work Order

1. Land telemetry and baseline stress reporting.
2. Convert normal server broadcasts to delta-only updates.
3. Add command acknowledgements and safe retries.
4. Batch client state application.
5. Introduce shared gameplay RAF scheduling.
6. Tune server cadence with stress data.
7. Decide whether PixiJS is justified.

## Success Criteria

- Multiplayer loop runs maintain stable p95/p99 frame pacing during movement and combat transitions.
- Normal gameplay no longer emits full snapshots after every ordinary authoritative event.
- Client correction churn is reduced and measurable.
- React commits during continuous movement are bounded and explainable.
- Combat cues align with projected arrival at tile centers.
- The architecture remains incremental: React UI, Socket.IO authority, and optional future Pixi board/combat viewport.
