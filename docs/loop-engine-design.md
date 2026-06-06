# Loop Engine Direction

Loopduel should render like Loop Hero by separating the authoritative simulation from the visual runner.

## Target Model

- Server owns game truth: tile index, combat start/end, loot, deaths, cards, and lap/tier transitions.
- Client owns presentation: continuous runner position, step animation, camera/parallax, impact timing, and short interpolation buffers.
- Network packets describe timeline anchors, not animation frames.

## Server Timeline

For each runner, broadcast a compact movement timeline:

```ts
{
  runnerId: string;
  segmentId: number;
  fromIndex: number;
  toIndex: number;
  startedAt: number;
  arriveAt: number;
  state: 'moving' | 'combat' | 'stunned' | 'dead';
}
```

The server should advance in fixed simulation steps, but movement should be scheduled by absolute timestamps. If the server tick runs late, it should process every due transition before emitting. It should never depend on the client frame rate or packet cadence.

## Client Presentation

The client renders behind the server timeline by more than one server tick. That buffer absorbs jitter and lets the runner move at a constant visual speed from segment to segment. When a packet arrives late, the client may ease toward the new timeline cursor, but it must not create "movement debt" that makes the runner sprint after combat.

The client must not create a stop at ordinary tile arrivals. The Loop Hero read is continuous travel: tile centers are logical trigger points, not per-tile station stops. Blocking states such as combat and stun hold the runner at the tile; non-blocking arrivals immediately continue into the next segment at the normal visual speed.

The map should make blocking semantics visible. Snapshots annotate every path tile with `movementStopKind`: `combat` for deterministic fight tiles, `possible-combat` for visibly risky tiles such as Obelisk, and `none` for pass-through tiles. The client may keep walking through `none` tiles while waiting for the next snapshot; it should only prepare to hold at the next known combat or possible-combat tile.

Combat and stun are hard state transitions. Ordinary movement is soft presentation.

Combat must pause the movement timeline itself. A combat tile should schedule the next departure after the combat expires, then schedule arrival one normal movement duration after that departure. The client should not treat combat time as elapsed walking time.

## Packet Strategy

- Send full room snapshots on join, reconnect, and major recovery.
- During active play, send deltas/events: movement segment changed, combat started, combat ended, card played, loot changed.
- Include `serverNow` in every packet so clients can estimate clock offset.
- Keep sequence numbers per runner so stale movement segments are ignored.

## Performance Budget

- Use one `requestAnimationFrame` loop for presentation, not one timer per runner component.
- Keep board geometry precomputed as path points.
- Animate runner transforms only with `translate3d`.
- Avoid React state updates every frame for runner motion once the renderer grows; write CSS variables or use a small external presentation store.
- Batch incoming socket events and apply them once per frame.

## Runtime Bridge

Live rooms now run through `server/runtime.mjs`, which is the boundary between Socket.IO transport and `server/rules.mjs` simulation. The runtime records accepted/rejected commands, assigns room event sequence numbers, drains semantic events emitted inside the rules layer, and wraps recovery snapshots with:

```ts
{
  runtime: {
    protocol: 1,
    reason: 'connect' | 'join' | 'simulation' | string,
    snapshotSeq: number,
    eventSeq: number,
    journalBaseSeq: number,
    generatedAt: number
  }
}
```

The current browser still consumes full `state` snapshots for compatibility, but it also tracks sequenced `room:delta` packets. Those live packets are the migration path for movement/combat/loot animation without making every visual moment depend on a whole-room snapshot.

The server emits domain events such as `commandAccepted`, `commandRejected`, `playerJoined`, `cardPlayed`, `cardDrawn`, `tileChanged`, `movementSegment`, `tileResolved`, `combatStarted`, `combatEnded`, `lootGranted`, `lapCompleted`, `tierChanged`, `roomAuthorityPaused`, `roomAuthorityResumed`, and `matchFinished`. These are emitted where the rules mutate state, then sequenced by the runtime. Diff-derived events remain only a fallback diagnostic for mutations that do not yet emit semantic events.

Snapshots are still sent after each command and after simulation steps that produce domain events, but bare server clock ticks no longer force full-room `state` packets. The runtime gives us the sequence numbers and event journal needed to later make snapshots join/reconnect/checkpoint packets instead of the normal animation feed. Clients may request `room:resume` with the last event sequence they observed; the server replays recent journal events or sends a recovery snapshot when the requested sequence has fallen out of the bounded journal.

Persistence now stores both room state and the bounded runtime journal. That is still a single-process persistence model, but it is no longer just raw room JSON; it preserves the command/event foundation needed for replay windows and future room migration.

The visual bridge remains the same: live rooms expose `moveStartedAt`, `nextMoveAt`, and per-tile `movementStopKind`. The runner renders behind server time by more than one server tick and uses the actual segment duration as its visual speed. If the server snapshot is late, the client can continue through known pass-through tiles instead of stopping at every tile boundary. Combat pushes the next `moveStartedAt` forward, so resolving combat does not produce a catch-up sprint.

Simulated balance rooms keep their old compact timing so tests and CPU economics remain comparable while the live presentation model changes. The next engine step is teaching the client to project movement/combat directly from sequenced events, then reducing routine snapshot cadence once reconnect/recovery coverage is strong.
