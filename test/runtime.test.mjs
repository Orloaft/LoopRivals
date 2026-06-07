import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomRuntime, eventsRequireSnapshot } from '../server/runtime.mjs';
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

test('room runtime identifies replay events that need an authoritative snapshot', () => {
  assert.equal(eventsRequireSnapshot([
    { type: 'movementSegment' },
    { type: 'tileResolved' }
  ]), false);
  assert.equal(eventsRequireSnapshot([
    { type: 'movementSegment' },
    { type: 'cardDrawn' }
  ]), true);
  assert.equal(eventsRequireSnapshot([
    { type: 'roomReset' }
  ]), true);
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

test('room runtime diagnostic combat events carry the stop tile position', () => {
  const room = testApi.createRoom('runtime-combat-diagnostic', { now: 1000, seed: 'runtime-combat-diagnostic' });
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  const runtime = createRoomRuntime(room);
  const player = room.players.host;
  player.board[2].type = 'crypt';

  const { events } = runtime.commitCommand('diagnosticCombat', { playerId: 'host' }, () => {
    player.position = 2;
    player.arrivalMovement = { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 };
    player.nextMovement = { fromCursor: 2, toCursor: 3, departAt: 3600, arriveAt: 4600 };
    player.combat = {
      label: 'crypt',
      enemyId: 'ash-imp',
      enemyName: 'Ash Imp',
      enemyIds: ['ash-imp'],
      enemyNames: ['Ash Imp'],
      backgroundId: 'crypt',
      effect: 'ember',
      damage: 1,
      reward: 1,
      enemyCount: 1,
      rounds: 1,
      heroHpBefore: 24,
      heroHpAfter: 23,
      heroMaxHp: 32,
      enemyHpBefore: 8,
      enemyHpAfter: 0,
      enemyMaxHp: 8,
      beats: [],
      startedAt: 2000,
      expiresAt: 3200,
      durationMs: 1200
    };
  });

  const combatStarted = events.find((event) => event.type === 'combatStarted');
  const tileResolved = events.find((event) => event.type === 'tileResolved');
  assert.equal(combatStarted.payload.position, 2);
  assert.equal(combatStarted.payload.tileIndex, 2);
  assert.equal(combatStarted.payload.laps, 0);
  assert.equal(combatStarted.payload.tileType, 'crypt');
  assert.equal(tileResolved.payload.position, 2);
  assert.equal(tileResolved.payload.tileIndex, 2);
});

test('room runtime hides queued movement when combat starts on a movement tile', () => {
  const room = testApi.createRoom('runtime-combat-stop', { now: 1000, seed: 'runtime-combat-stop', simulated: true });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.board[1].type = 'grove';
  player.nextMoveAt = room.now - 10_000;
  player.nextMovement = { fromCursor: 0, toCursor: 1, departAt: room.now - 11_000, arriveAt: room.now - 10_000 };

  const events = runtime.step(260, 260);
  const movement = events.findLast((event) => event.type === 'movementSegment' && event.payload.playerId === 'host');

  assert.equal(room.players.host.position, 1);
  assert.equal(room.players.host.combat !== null, true);
  assert.equal(room.players.host.nextMovement.fromCursor, 1);
  assert.equal(runtime.snapshot('combat').players.find((player) => player.id === 'host').nextMovement, null);
  assert.equal(events.some((event) => event.type === 'tileResolved' && event.payload.position > 1), false);
  assert.equal(movement.payload.nextMovement, null);
});

test('room runtime reveals queued movement only after combat ends', () => {
  const room = testApi.createRoom('runtime-combat-resume', { now: 1000, seed: 'runtime-combat-resume', simulated: true });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.board[1].type = 'grove';
  player.nextMoveAt = room.now;
  runtime.step(260, 260);

  const expiresAt = room.players.host.combat.expiresAt;
  room.now = expiresAt;
  const events = runtime.step(260, 260);
  const movement = events.find((event) => event.type === 'movementSegment' && event.payload.playerId === 'host');

  assert.equal(events.some((event) => event.type === 'combatEnded'), true);
  assert.equal(room.players.host.combat, null);
  assert.equal(room.players.host.position, 1);
  assert.equal(movement.payload.nextMovement.fromCursor, 1);
  assert.equal(movement.payload.nextMovement.departAt >= expiresAt, true);
  assert.equal(events.some((event) => event.type === 'tileResolved' && event.payload.position > 1), false);
});

test('room runtime keeps lethal combat visible until the combat expires', () => {
  const room = testApi.createRoom('runtime-lethal-combat-visible', { now: 1000, seed: 'runtime-lethal-combat-visible', simulated: true });
  const runtime = createRoomRuntime(room);
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);

  const player = room.players.host;
  player.board[1].type = 'crypt';
  player.hp = 1;
  player.nextMoveAt = room.now;

  const startEvents = runtime.step(260, 260);
  const combatStarted = startEvents.find((event) => event.type === 'combatStarted' && event.payload.playerId === 'host');

  assert.equal(Boolean(combatStarted), true);
  assert.equal(startEvents.some((event) => event.type === 'playerDefeated'), false);
  assert.equal(room.players.host.position, 1);
  assert.equal(room.players.host.deaths, 0);
  assert.equal(room.players.host.combat !== null, true);
  assert.equal(combatStarted.payload.combat.heroHpAfter <= 0, true);

  room.now = room.players.host.combat.expiresAt;
  const endEvents = runtime.step(0, 260);
  const defeated = endEvents.find((event) => event.type === 'playerDefeated' && event.payload.playerId === 'host');

  assert.equal(endEvents.some((event) => event.type === 'combatEnded'), true);
  assert.equal(Boolean(defeated), true);
  assert.equal(room.players.host.position, 0);
  assert.equal(room.players.host.deaths, 1);
  assert.equal(room.players.host.combat, null);
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

test('room runtime stun events carry the replacement movement segment', () => {
  const room = testApi.createRoom('runtime-stun-movement', { now: 1000, seed: 'runtime-stun-movement', simulated: true });
  const runtime = createRoomRuntime(room);
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer', false, room);
  const target = testApi.createPlayer('target', 'Target', 'moss-warden', false, room);
  const bonk = {
    id: 'chosen-bonk',
    instanceId: 'bonk-runtime',
    name: 'Chosen Bonk',
    kind: 'bonk',
    rarity: 'rare',
    targetMode: 'chosen',
    stunSeconds: 6,
    icon: '!',
    text: 'Choose any rival.'
  };

  room.status = 'running';
  attacker.hand = [bonk];
  target.position = 1;
  target.moveStartedAt = 1000;
  target.nextMoveAt = 2000;
  target.nextMovement = { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 };
  room.players.attacker = attacker;
  room.players.target = target;

  const { events } = runtime.commitCommand('playBonkCard', { playerId: 'attacker' }, () => (
    testApi.playBonk(room, attacker, bonk.instanceId, target.id)
  ));

  const stunned = events.find((event) => event.type === 'playerStunned');
  assert.equal(stunned.payload.playerId, 'target');
  assert.equal(stunned.payload.position, 1);
  assert.equal(stunned.payload.laps, 0);
  assert.deepEqual(stunned.payload.nextMovement, room.players.target.nextMovement);
  assert.deepEqual(stunned.payload.arrivalMovement, room.players.target.arrivalMovement);
});

test('room runtime emits movement segment when rival effects retime a target', () => {
  const room = testApi.createRoom('runtime-rival-retime', { now: 1000, seed: 'runtime-rival-retime', simulated: true });
  const runtime = createRoomRuntime(room);
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer', false, room);
  const target = testApi.createPlayer('target', 'Target', 'moss-warden', false, room);
  const hex = {
    id: 'hex',
    instanceId: 'hex-runtime',
    name: 'Hex',
    kind: 'rival',
    icon: '!',
    text: 'Curse a rival.'
  };

  room.status = 'running';
  attacker.hand = [hex];
  target.moveStartedAt = 1000;
  target.nextMoveAt = 2000;
  target.nextMovement = { fromCursor: 0, toCursor: 1, departAt: 1000, arriveAt: 2000 };
  room.players.attacker = attacker;
  room.players.target = target;

  const { events } = runtime.commitCommand('playRivalCard', { playerId: 'attacker' }, () => (
    testApi.playRival(room, attacker, hex.instanceId, target.id)
  ));

  const movement = events.find((event) => event.type === 'movementSegment' && event.payload.playerId === 'target');
  assert.deepEqual(movement.payload.nextMovement, room.players.target.nextMovement);
});

test('room runtime resolves lethal combat before any post-combat movement', () => {
  const room = testApi.createRoom('runtime-lethal-combat', { now: 1000, seed: 'runtime-lethal-combat', simulated: true });
  const runtime = createRoomRuntime(room);
  const player = testApi.createPlayer('host', 'Host', 'ember-knight', false, room);
  room.status = 'running';
  room.players.host = player;
  player.position = 2;
  player.hp = 1;
  player.moveStartedAt = 1000;
  player.nextMoveAt = 2000;
  player.nextMovement = { fromCursor: 2, toCursor: 3, departAt: 1000, arriveAt: 2000 };

  testApi.fight(room, player, 'crypt duel', 60, 1, 1);
  room.now = player.combat.expiresAt;
  const events = runtime.step(0, 260);

  const defeated = events.find((event) => event.type === 'playerDefeated');
  assert.equal(defeated.payload.position, 0);
  assert.equal(room.players.host.position, 0);
  assert.equal(room.players.host.nextMovement.fromCursor, 0);
  assert.equal(events.some((event) => event.type === 'tileResolved' && event.payload.position !== 0), false);
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
