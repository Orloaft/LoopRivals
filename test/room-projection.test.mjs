import assert from 'node:assert/strict';
import test from 'node:test';
import { visualCursorForPlayer } from '../src/movement.ts';
import { applyRoomDelta } from '../src/room-projection.ts';

function tile(index, type = 'road', expiresOnLap = null) {
  return {
    index,
    coord: [index, 0],
    type,
    charges: 0,
    expiresOnLap,
    movementStopKind: type === 'grove' ? 'combat' : 'none',
    movementStopReason: type === 'grove' ? 'combat' : null
  };
}

function assertNear(actual, expected, tolerance = 0.005) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
}

function player(id, score = 0) {
  return {
    id,
    name: id,
    heroId: 'ember-knight',
    isBot: false,
    connected: true,
    color: '#fff',
    seatIndex: id === 'host' ? 0 : 1,
    rank: id === 'host' ? 1 : 2,
    board: [tile(0, 'camp'), tile(1), tile(2, 'grove')],
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
    moveStartedAt: 1000,
    nextMoveAt: 2000,
    arrivalMovement: null,
    nextMovement: { fromCursor: 0, toCursor: 1, departAt: 1000, arriveAt: 2000 },
    stunnedUntil: null,
    stunnedBy: null,
    score
  };
}

function state() {
  const players = [player('host', 10), player('rival', 5)];
  return {
    id: 'projection-room',
    status: 'running',
    tick: 0,
    now: 1000,
    runtime: {
      protocol: 1,
      reason: 'snapshot',
      snapshotSeq: 1,
      eventSeq: 0,
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

function event(seq, type, payload = {}) {
  return {
    seq,
    type,
    roomId: 'projection-room',
    tick: seq,
    serverTime: 1000 + seq * 100,
    payload
  };
}

test('client projection applies ordered movement and tile events', () => {
  const nextMovement = { fromCursor: 1, toCursor: 2, departAt: 2000, arriveAt: 3000 };
  const result = applyRoomDelta(state(), {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 2,
    events: [
      event(1, 'tileResolved', {
        playerId: 'host',
        tileIndex: 1,
        position: 1,
        laps: 0,
        hp: 20,
        score: 42,
        level: 2,
        event: 'quiet road',
        message: 'kept pace'
      }),
      event(2, 'movementSegment', {
        playerId: 'host',
        nextMovement
      })
    ]
  }, 5000);

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(result.needsRecovery, false);
  assert.equal(result.acceptedSeq, 2);
  assert.equal(host.position, 1);
  assert.equal(host.hp, 20);
  assert.equal(host.score, 42);
  assert.equal(host.level, 2);
  assert.deepEqual(host.nextMovement, nextMovement);
  assert.equal(result.state.leaderboard[0].id, 'host');
  assert.equal(result.state.receivedAt, 5000);
});

test('client projection anchors resolved tiles while waiting for the next movement segment', () => {
  const result = applyRoomDelta(state(), {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'tileResolved', {
        playerId: 'host',
        tileIndex: 1,
        position: 1,
        laps: 0,
        hp: 20,
        score: 42,
        level: 2,
        event: 'quiet road',
        message: 'kept pace'
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 1);
  assert.deepEqual(host.arrivalMovement, { fromCursor: 0, toCursor: 1, departAt: 1000, arriveAt: 2000 });
  assert.equal(host.nextMovement, null);
  assert.equal(visualCursorForPlayer(host, 5000, result.state.receivedAt), 1);
});

test('client projection anchors combat start on the combat tile before tile resolution arrives', () => {
  const initial = state();
  initial.receivedAt = Date.now();
  initial.now = 1100;
  initial.players[0] = {
    ...initial.players[0],
    position: 1,
    arrivalMovement: null,
    nextMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 }
  };
  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'combatStarted', {
        playerId: 'host',
        tileIndex: 2,
        position: 2,
        laps: 0,
        label: 'wolf grove',
        combat: {
          startedAt: 2000,
          expiresAt: 3200,
          heroHpAfter: 18
        }
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 2);
  assert.equal(host.nextMovement, null);
  assert.deepEqual(host.arrivalMovement, { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 });
  assertNear(visualCursorForPlayer(host, 1920, result.state.receivedAt), 1.5);
  assert.equal(visualCursorForPlayer(host, 2420, result.state.receivedAt), 2);
});

test('client projection does not replay arrival movement when combat start arrives after visual landing', () => {
  const initial = state();
  initial.receivedAt = Date.now() - 3000;
  initial.now = 1000;
  initial.players[0] = {
    ...initial.players[0],
    position: 1,
    arrivalMovement: null,
    nextMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 }
  };
  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'combatStarted', {
        playerId: 'host',
        tileIndex: 2,
        position: 2,
        laps: 0,
        label: 'wolf grove',
        combat: {
          startedAt: 2000,
          expiresAt: 3200,
          heroHpAfter: 18
        }
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 2);
  assert.equal(host.arrivalMovement, null);
  assert.equal(host.nextMovement, null);
  assert.equal(visualCursorForPlayer(host, 1100, result.state.receivedAt), 2);
});

test('client projection ignores trailing arrival movement after a visually landed combat start', () => {
  const initial = state();
  initial.receivedAt = Date.now() - 3000;
  initial.now = 1000;
  initial.players[0] = {
    ...initial.players[0],
    position: 1,
    arrivalMovement: null,
    nextMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 }
  };
  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 2,
    events: [
      event(1, 'combatStarted', {
        playerId: 'host',
        tileIndex: 2,
        position: 2,
        laps: 0,
        label: 'wolf grove',
        combat: {
          startedAt: 2000,
          expiresAt: 3200,
          heroHpAfter: 18
        }
      }),
      event(2, 'movementSegment', {
        playerId: 'host',
        nextMovement: null,
        arrivalMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 }
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 2);
  assert.equal(host.arrivalMovement, null);
  assert.equal(host.nextMovement, null);
  assert.equal(visualCursorForPlayer(host, 1100, result.state.receivedAt), 2);
});

test('client projection infers combat start from arrival movement before queued next movement', () => {
  const initial = state();
  initial.receivedAt = Date.now();
  initial.now = 1100;
  initial.players[0] = {
    ...initial.players[0],
    position: 1,
    arrivalMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 },
    nextMovement: { fromCursor: 2, toCursor: 3, departAt: 3600, arriveAt: 4600 }
  };
  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'combatStarted', {
        playerId: 'host',
        label: 'wolf grove',
        combat: {
          startedAt: 2000,
          expiresAt: 3200,
          heroHpAfter: 18
        }
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 2);
  assert.deepEqual(host.arrivalMovement, { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 });
  assert.deepEqual(host.nextMovement, { fromCursor: 2, toCursor: 3, departAt: 3600, arriveAt: 4600 });
  assertNear(visualCursorForPlayer(host, 1920, result.state.receivedAt), 1.5);
  assert.equal(visualCursorForPlayer(host, 3800, result.state.receivedAt), 2);
});

test('client projection resets expired loop tiles before projecting the next lap', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    board: [tile(0, 'camp'), tile(1, 'grove', 1), tile(2)],
    position: 2,
    laps: 0,
    arrivalMovement: null,
    nextMovement: { fromCursor: 2, toCursor: 3, departAt: 1000, arriveAt: 2000 }
  };

  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 4,
    events: [
      event(1, 'lapCompleted', { playerId: 'host', to: 1 }),
      event(2, 'tilesExpired', { playerId: 'host', count: 1, lap: 1 }),
      event(3, 'tileResolved', {
        playerId: 'host',
        tileIndex: 0,
        position: 0,
        laps: 1,
        hp: 24,
        score: 45,
        level: 1,
        event: 'lap complete',
        message: ''
      }),
      event(4, 'movementSegment', {
        playerId: 'host',
        nextMovement: { fromCursor: 3, toCursor: 4, departAt: 2000, arriveAt: 3000 },
        arrivalMovement: { fromCursor: 2, toCursor: 3, departAt: 1000, arriveAt: 2000 }
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.laps, 1);
  assert.equal(host.board[1].type, 'road');
  assert.equal(host.board[1].movementStopKind, 'none');
  assert.ok(visualCursorForPlayer(host, 3600, result.state.receivedAt) > 4);
});

test('client projection applies full boardChanged payloads from diagnostic deltas', () => {
  const replacementBoard = [tile(0, 'camp'), tile(1), tile(2)];
  const result = applyRoomDelta(state(), {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [event(1, 'boardChanged', { playerId: 'host', board: replacementBoard })]
  });

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.board[2].type, 'road');
  assert.equal(host.board[2].movementStopKind, 'none');
});

test('client projection derives combat stops from sparse live tile changes', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    board: [tile(0, 'camp'), tile(1), tile(2)],
    position: 1,
    arrivalMovement: null,
    nextMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 2000 }
  };
  const receivedAt = Date.now();
  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'tileChanged', {
        playerId: 'host',
        tileIndex: 2,
        tile: {
          index: 2,
          coord: [2, 0],
          type: 'grove',
          charges: 0,
          expiresOnLap: 1
        }
      })
    ]
  }, receivedAt);

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.board[2].movementStopKind, 'combat');
  assert.equal(host.board[2].movementStopReason, 'combat');
  assertNear(visualCursorForPlayer(host, 5000, receivedAt), 2);
});

test('client projection applies stun events so motion pauses before a recovery snapshot', () => {
  const result = applyRoomDelta(state(), {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'playerStunned', {
        playerId: 'host',
        actorId: 'rival',
        durationMs: 1200,
        stunnedUntil: 2600
      })
    ]
  });

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.stunnedUntil, 2600);
  assert.equal(host.stunnedBy, 'rival');
  assert.equal(host.stunRemainingMs, 1500);
});

test('client projection replaces stale movement when stun starts', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    position: 1,
    arrivalMovement: null,
    nextMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 1800 }
  };
  const replacementMovement = { fromCursor: 1, toCursor: 2, departAt: 2600, arriveAt: 3200 };

  const stunned = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'playerStunned', {
        playerId: 'host',
        actorId: 'rival',
        stunnedUntil: 2600,
        position: 1,
        laps: 0,
        arrivalMovement: null,
        nextMovement: replacementMovement
      })
    ]
  }, Date.now());
  const resumed = applyRoomDelta(stunned.state, {
    roomId: 'projection-room',
    firstSeq: 2,
    lastSeq: 2,
    events: [event(2, 'stunEnded', { playerId: 'host', stunnedUntil: 2600 })]
  }, Date.now());

  const host = resumed.state.players.find((item) => item.id === 'host');
  assert.equal(host.stunnedUntil, null);
  assert.deepEqual(host.nextMovement, replacementMovement);
  assert.equal(visualCursorForPlayer(host, 2500, resumed.state.receivedAt), 1);
});

test('client projection applies defeat reset movement without waiting for snapshot', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    position: 2,
    combat: { startedAt: 2000 },
    nextMovement: { fromCursor: 2, toCursor: 3, departAt: 3600, arriveAt: 4600 }
  };
  const resetBoard = [tile(0, 'camp'), tile(1), tile(2)];
  const resetMovement = { fromCursor: 0, toCursor: 1, departAt: 5000, arriveAt: 6000 };

  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'playerDefeated', {
        playerId: 'host',
        hp: 18,
        deaths: 1,
        position: 0,
        laps: 0,
        loopTier: 1,
        board: resetBoard,
        arrivalMovement: null,
        nextMovement: resetMovement
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 0);
  assert.equal(host.combat, null);
  assert.equal(host.deaths, 1);
  assert.deepEqual(host.board, resetBoard);
  assert.deepEqual(host.nextMovement, resetMovement);
  assert.equal(visualCursorForPlayer(host, 4900, result.state.receivedAt), 0);
});

test('client projection applies tier reset board and movement without waiting for snapshot', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    position: 2,
    laps: 4,
    loopTier: 1,
    board: [tile(0, 'camp'), tile(1, 'grove'), tile(2, 'grove')],
    nextMovement: { fromCursor: 5, toCursor: 6, departAt: 3600, arriveAt: 4600 }
  };
  const resetBoard = [tile(0, 'camp'), tile(1), tile(2)];
  const resetMovement = { fromCursor: 12, toCursor: 13, departAt: 5000, arriveAt: 6000 };

  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'playerTierChanged', {
        playerId: 'host',
        from: 1,
        to: 2,
        loopTier: 2,
        position: 0,
        laps: 4,
        hp: 32,
        board: resetBoard,
        arrivalMovement: null,
        nextMovement: resetMovement
      })
    ]
  }, Date.now());

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.position, 0);
  assert.equal(host.laps, 4);
  assert.equal(host.loopTier, 2);
  assert.deepEqual(host.board, resetBoard);
  assert.deepEqual(host.nextMovement, resetMovement);
  assert.equal(visualCursorForPlayer(host, 4900, result.state.receivedAt), 12);
});

test('client projection clears stun events so motion can resume on the next segment', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    stunnedUntil: 2600,
    stunnedBy: 'rival',
    stunRemainingMs: 100
  };

  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 2,
    events: [
      event(1, 'stunEnded', { playerId: 'host', stunnedUntil: 2600 }),
      event(2, 'movementSegment', {
        playerId: 'host',
        nextMovement: { fromCursor: 0, toCursor: 1, departAt: 2600, arriveAt: 3200 }
      })
    ]
  });

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.stunnedUntil, null);
  assert.equal(host.stunnedBy, null);
  assert.equal(host.stunRemainingMs, 0);
  assert.deepEqual(host.nextMovement, { fromCursor: 0, toCursor: 1, departAt: 2600, arriveAt: 3200 });
});

test('client projection clears stale movement segments when a delta explicitly sends null', () => {
  const initial = state();
  initial.players[0] = {
    ...initial.players[0],
    arrivalMovement: { fromCursor: 1, toCursor: 2, departAt: 1000, arriveAt: 1800 },
    nextMovement: { fromCursor: 2, toCursor: 3, departAt: 2600, arriveAt: 3200 }
  };

  const result = applyRoomDelta(initial, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [
      event(1, 'movementSegment', {
        playerId: 'host',
        arrivalMovement: null,
        nextMovement: null
      })
    ]
  });

  const host = result.state.players.find((item) => item.id === 'host');
  assert.equal(host.arrivalMovement, null);
  assert.equal(host.nextMovement, null);
});

test('client projection ignores duplicate or stale events', () => {
  const first = applyRoomDelta(state(), {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [event(1, 'playerProjectionChanged', { playerId: 'rival', score: 60 })]
  });
  const second = applyRoomDelta(first.state, {
    roomId: 'projection-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [event(1, 'playerProjectionChanged', { playerId: 'rival', score: 999 })]
  });

  assert.equal(second.appliedEvents, 0);
  assert.equal(second.acceptedSeq, 1);
  assert.equal(second.state.players.find((item) => item.id === 'rival').score, 60);
});

test('client projection reports recovery when a delta has a sequence gap', () => {
  const result = applyRoomDelta(state(), {
    roomId: 'projection-room',
    firstSeq: 2,
    lastSeq: 2,
    events: [event(2, 'movementSegment', { playerId: 'host' })]
  });

  assert.equal(result.needsRecovery, true);
  assert.equal(result.appliedEvents, 0);
  assert.equal(result.acceptedSeq, 0);
});
