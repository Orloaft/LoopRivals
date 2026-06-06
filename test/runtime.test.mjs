import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomRuntime } from '../server/runtime.mjs';
import { testApi } from '../server/rules.mjs';

test('room runtime wraps authoritative snapshots with recovery sequencing', () => {
  const room = testApi.createRoom('runtime-seq', { now: 1000, seed: 'runtime-seq' });
  const runtime = createRoomRuntime(room);

  const first = runtime.snapshot('connect');
  const second = runtime.snapshot('recovery');

  assert.equal(first.runtime.protocol, 1);
  assert.equal(first.runtime.reason, 'connect');
  assert.equal(first.runtime.snapshotSeq, 1);
  assert.equal(second.runtime.snapshotSeq, 2);
  assert.equal(second.runtime.eventSeq, 0);
});

test('room runtime records commands and emits sequenced domain events', () => {
  const room = testApi.createRoom('runtime-events', { now: 1000, seed: 'runtime-events' });
  const runtime = createRoomRuntime(room);

  const { events } = runtime.commitCommand('join', {
    playerId: 'host',
    commandId: 'join-1',
    payload: { heroId: 'ember-knight' }
  }, () => {
    testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  });

  assert.deepEqual(events.map((event) => event.seq), [1, 2]);
  assert.equal(events[0].type, 'commandAccepted');
  assert.equal(events[1].type, 'playerJoined');
  assert.equal(events[1].payload.cause, 'join');
  assert.equal(runtime.serialize().commands[0].commandId, 'join-1');
});

test('room runtime rejects no-op commands instead of recording fake acceptance', () => {
  const room = testApi.createRoom('runtime-reject', { now: 1000, seed: 'runtime-reject' });
  const runtime = createRoomRuntime(room);

  const { events } = runtime.commitCommand('placeCard', {
    playerId: 'missing',
    commandId: 'bad-card'
  }, () => false);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'commandRejected');
  assert.equal(events[0].payload.commandId, 'bad-card');
  assert.equal(runtime.serialize().eventSeq, 1);
});

test('room runtime replays recent events and refuses expired replay windows', () => {
  const room = testApi.createRoom('runtime-replay', { now: 1000, seed: 'runtime-replay' });
  const runtime = createRoomRuntime(room, { journalLimit: 8 });

  runtime.commitCommand('join', { playerId: 'host' }, () => (
    testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' })
  ));
  runtime.commitCommand('startRoom', { playerId: 'host' }, () => testApi.startRoom(room));

  assert.equal(runtime.eventsSince(1).length > 0, true);
  const tinyRuntime = createRoomRuntime(room, { journalLimit: 2 });
  tinyRuntime.appendEvent('a');
  tinyRuntime.appendEvent('b');
  tinyRuntime.appendEvent('c');
  assert.equal(tinyRuntime.eventsSince(0), null);
});

test('room runtime turns simulation changes into live movement events', () => {
  const room = testApi.createRoom('runtime-step', { now: 1000, seed: 'runtime-step' });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.nextMoveAt = room.now;
  const events = runtime.step(260, 260);

  assert.equal(events.some((event) => event.type === 'movementSegment'), true);
  assert.equal(events.some((event) => event.type === 'tileResolved'), true);
  assert.equal(runtime.snapshot('simulation').runtime.eventSeq, runtime.serialize().eventSeq);
});

test('room runtime does not emit heartbeat events for bare simulation ticks', () => {
  const room = testApi.createRoom('runtime-idle-tick', { now: 1000, seed: 'runtime-idle-tick' });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  const futureAt = Date.now() + 60_000;
  player.nextMoveAt = futureAt;
  player.nextDrawAt = futureAt;

  const events = runtime.step(260, 260);

  assert.deepEqual(events, []);
  assert.equal(room.tick, 1);
  assert.equal(runtime.serialize().eventSeq, 0);
});

test('room runtime emits semantic events for simulation state changes between movements', () => {
  const room = testApi.createRoom('runtime-sim-events', { now: 1000, seed: 'runtime-sim-events' });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.nextMoveAt = Date.now() + 60_000;
  player.nextDrawAt = Date.now() - 1;

  const events = runtime.step(260, 260);

  assert.equal(events.some((event) => event.type === 'cardDrawn'), true);
});

test('room runtime emits authority pause events without relying on tick snapshots', () => {
  const room = testApi.createRoom('runtime-authority', { now: 1000, seed: 'runtime-authority' });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  room.players.host.connected = false;

  const events = runtime.step(260, 260);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'roomAuthorityPaused');
  assert.equal(room.authorityPause.reason, 'waiting-for-host');
});
