import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomRuntime, roomEventBroadcastPolicy } from '../server/runtime.mjs';
import { testApi } from '../server/rules.mjs';

test('room runtime does not re-run duplicate command ids', () => {
  const room = testApi.createRoom('runtime-idempotent-command', { now: 1000, seed: 'runtime-idempotent-command' });
  const runtime = createRoomRuntime(room);
  let mutatorRuns = 0;

  const first = runtime.commitCommand('diagnosticTick', {
    playerId: 'host',
    commandId: 'cmd-1',
    payload: { amount: 1 }
  }, () => {
    mutatorRuns += 1;
    room.tick += 1;
    return true;
  });
  const duplicate = runtime.commitCommand('diagnosticTick', {
    playerId: 'host',
    commandId: 'cmd-1',
    payload: { amount: 999 }
  }, () => {
    mutatorRuns += 1;
    room.tick += 999;
    return true;
  });

  assert.equal(mutatorRuns, 1);
  assert.equal(room.tick, 1);
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.command.seq, first.command.seq);
  assert.deepEqual(duplicate.events, []);
  assert.deepEqual(duplicate.eventSeqs, first.eventSeqs);
  assert.equal(runtime.serialize().commands.length, 1);
  assert.equal(runtime.serialize().eventSeq, first.lastSeq);

  const differentCommand = runtime.commitCommand('diagnosticOther', {
    playerId: 'host',
    commandId: 'cmd-1'
  }, () => {
    mutatorRuns += 1;
    room.tick += 1;
    return true;
  });

  assert.equal(differentCommand.duplicate, false);
  assert.equal(mutatorRuns, 2);
  assert.equal(room.tick, 2);
});

test('room event broadcast policy keeps ordinary movement deltas snapshot-free', () => {
  const room = testApi.createRoom('runtime-movement-policy', { now: 1000, seed: 'runtime-movement-policy' });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.nextMoveAt = Date.now() - 1;
  player.nextDrawAt = Date.now() + 60_000;
  const events = runtime.step(260, 260);
  const policy = roomEventBroadcastPolicy(events);

  assert.equal(events.some((event) => event.type === 'movementSegment'), true);
  assert.equal(policy.delta, true);
  assert.equal(policy.snapshotRequired, false);
  assert.equal(policy.snapshot, false);
});

test('room event broadcast policy still snapshots snapshot-required events', () => {
  const room = testApi.createRoom('runtime-snapshot-policy', { now: 1000, seed: 'runtime-snapshot-policy' });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.nextMoveAt = Date.now() + 60_000;
  player.nextDrawAt = Date.now() - 1;
  const events = runtime.step(260, 260);
  const policy = roomEventBroadcastPolicy(events);

  assert.equal(events.some((event) => event.type === 'cardDrawn'), true);
  assert.equal(policy.delta, true);
  assert.equal(policy.snapshotRequired, true);
  assert.equal(policy.snapshot, true);
});

test('room event broadcast policy does not snapshot empty ticks', () => {
  assert.deepEqual(roomEventBroadcastPolicy([]), {
    delta: false,
    snapshot: false,
    snapshotRequired: false,
    eventSeqs: [],
    firstSeq: null,
    lastSeq: null
  });
});
