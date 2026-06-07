import assert from 'node:assert/strict';
import test from 'node:test';
import { applyQueuedRoomAuthorityMessages, createRoomAuthorityBatcher } from '../src/client-authority-batcher.ts';
import { applyRoomDelta } from '../src/room-projection.ts';

function tile(index) {
  return {
    index,
    coord: [index, 0],
    type: index === 0 ? 'camp' : 'road',
    charges: 0,
    expiresOnLap: null,
    movementStopKind: 'none',
    movementStopReason: null
  };
}

function player(id, score = 0) {
  return {
    id,
    name: id,
    heroId: 'ember-knight',
    isBot: false,
    connected: true,
    color: '#fff',
    seatIndex: 0,
    rank: 1,
    board: [tile(0), tile(1), tile(2)],
    hand: [],
    loot: [],
    loadout: {},
    gold: 0,
    traits: [],
    pendingTraits: [],
    talentPoints: 0,
    hp: 24,
    maxHp: 32,
    power: 5,
    guard: 2,
    speed: 4,
    drawRate: 1,
    sabotage: 0,
    lootLuck: 0,
    lapHeal: 0,
    terrainScore: 0,
    revivePower: 0,
    position: 0,
    laps: 0,
    level: 1,
    xp: 0,
    kos: 0,
    rivalHits: 0,
    cardsPlayed: 0,
    tilesPlaced: 0,
    deaths: 0,
    loopTier: 1,
    tierStartScore: 0,
    tierStartLap: 0,
    bossAttempts: 0,
    soloGatesCleared: [],
    soloCorruption: 0,
    soloGateAttempts: 0,
    deathsThisTier: 0,
    scorePenalty: 0,
    marked: false,
    curse: 0,
    armor: 0,
    event: 'waiting',
    message: '',
    combat: null,
    nextMovement: null,
    arrivalMovement: null,
    stunnedUntil: null,
    stunnedBy: null,
    score
  };
}

function state(eventSeq = 0, score = 0) {
  const players = [player('host', score)];
  return {
    id: 'batch-room',
    status: 'running',
    tick: eventSeq,
    now: 1000 + eventSeq,
    runtime: {
      protocol: 1,
      reason: 'snapshot',
      snapshotSeq: 1,
      eventSeq,
      journalBaseSeq: 1,
      generatedAt: 1000
    },
    authority: { paused: false, reason: null, startedAt: null },
    receivedAt: 1,
    log: [],
    maxPlayers: 4,
    goalScore: 1200,
    settings: { maxPlayers: 4, goalScore: 1200, pace: 'steady' },
    tier: { id: 1, name: 'Tier I', minScore: 0, minLoops: 0, text: '' },
    claim: null,
    onboarding: null,
    hostId: 'host',
    winnerId: null,
    winner: null,
    leaderboard: players.map((item) => ({
      id: item.id,
      name: item.name,
      heroId: item.heroId,
      color: item.color,
      score: item.score,
      rank: item.rank,
      hp: item.hp,
      maxHp: item.maxHp,
      level: item.level,
      laps: item.laps
    })),
    players
  };
}

function event(seq, payload) {
  return {
    seq,
    type: 'playerProjectionChanged',
    roomId: 'batch-room',
    tick: seq,
    serverTime: 1000 + seq,
    payload: { playerId: 'host', ...payload }
  };
}

function delta(seq, payload) {
  return {
    roomId: 'batch-room',
    firstSeq: seq,
    lastSeq: seq,
    events: [event(seq, payload)]
  };
}

test('room authority batcher applies queued deltas once in sequence order', () => {
  let current = state();
  const scheduled = [];
  const commits = [];
  const acceptedSeqs = [];
  const batcher = createRoomAuthorityBatcher({
    getState: () => current,
    commitState: (next) => {
      current = next;
      commits.push(next);
    },
    applyDelta: applyRoomDelta,
    onAcceptedSeq: (seq) => acceptedSeqs.push(seq),
    now: () => 4321,
    schedule: (callback) => {
      scheduled.push(callback);
      return callback;
    }
  });

  batcher.enqueueDelta(delta(2, { score: 70 }));
  batcher.enqueueDelta(delta(1, { score: 40 }));

  assert.equal(commits.length, 0);
  assert.equal(scheduled.length, 1);
  scheduled[0]();

  assert.equal(commits.length, 1);
  assert.equal(current.players[0].score, 70);
  assert.equal(current.runtime.eventSeq, 2);
  assert.equal(current.receivedAt, 4321);
  assert.deepEqual(acceptedSeqs, [2]);
});

test('room authority batcher preserves recovery when a sequence gap remains', () => {
  let current = state();
  const recoveries = [];
  const batcher = createRoomAuthorityBatcher({
    getState: () => current,
    commitState: (next) => {
      current = next;
    },
    applyDelta: applyRoomDelta,
    onRecovery: (request) => recoveries.push(request),
    now: () => 1234,
    schedule: (callback) => {
      callback();
      return callback;
    }
  });

  batcher.enqueueDelta(delta(2, { score: 70 }));

  assert.equal(current.runtime.eventSeq, 0);
  assert.deepEqual(recoveries, [{ roomId: 'batch-room', fromSeq: 0, targetSeq: 2 }]);
});

test('queued snapshot cancels recovery for a gap it covers', () => {
  const snapshot = state(2, 99);
  const result = applyQueuedRoomAuthorityMessages(state(), [
    { type: 'delta', payload: delta(2, { score: 70 }) },
    { type: 'state', payload: snapshot }
  ], applyRoomDelta, 2222);

  assert.equal(result.recovery, null);
  assert.equal(result.committed, true);
  assert.equal(result.state.runtime.eventSeq, 2);
  assert.equal(result.state.players[0].score, 99);
  assert.equal(result.state.receivedAt, 2222);
});

test('queued stale snapshot does not roll back an applied delta', () => {
  const staleSnapshot = state(1, 20);
  const result = applyQueuedRoomAuthorityMessages(state(1, 20), [
    { type: 'delta', payload: delta(2, { score: 70 }) },
    { type: 'state', payload: staleSnapshot }
  ], applyRoomDelta, 3333);

  assert.equal(result.recovery, null);
  assert.equal(result.committed, true);
  assert.equal(result.acceptedSeq, 2);
  assert.equal(result.state.runtime.eventSeq, 2);
  assert.equal(result.state.players[0].score, 70);
  assert.equal(result.state.receivedAt, 3333);
});
