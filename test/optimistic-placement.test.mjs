import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPendingTerrainPlacement,
  createPendingTerrainPlacement,
  isPendingTerrainPlacementExpired,
  optimisticTerrainPlacementTimeoutMs,
  roomDeltaClearsPendingTerrainPlacement
} from '../src/optimistic-placement.ts';

function tile(index, type = 'road') {
  return {
    index,
    coord: [index, 0],
    type,
    charges: 0,
    expiresOnLap: null,
    movementStopKind: type === 'grove' ? 'combat' : 'none',
    movementStopReason: type === 'grove' ? 'combat' : null
  };
}

function player() {
  return {
    id: 'host',
    name: 'Host',
    heroId: 'ember-knight',
    isBot: false,
    connected: true,
    color: '#fff',
    seatIndex: 0,
    rank: 1,
    board: [tile(0, 'camp'), tile(1), tile(2)],
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
    laps: 2,
    level: 1,
    xp: 0,
    kos: 0,
    rivalHits: 0,
    cardsPlayed: 0,
    tilesPlaced: 0,
    deaths: 0,
    eliminated: false,
    livesLeft: 3,
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
    nextMovement: null,
    stunnedUntil: null,
    stunnedBy: null
  };
}

function terrainCard(tileType = 'grove') {
  return {
    id: `${tileType}-card`,
    instanceId: `${tileType}-instance`,
    name: tileType,
    kind: 'terrain',
    tile: tileType,
    icon: '*',
    text: ''
  };
}

function delta(event) {
  return {
    roomId: 'room',
    firstSeq: event.seq,
    lastSeq: event.seq,
    events: [event]
  };
}

function event(seq, type, payload) {
  return {
    seq,
    type,
    roomId: 'room',
    tick: seq,
    serverTime: 1000 + seq,
    payload
  };
}

test('optimistic terrain placement appears immediately on the local board', () => {
  const host = player();
  const pending = createPendingTerrainPlacement(host, terrainCard('grove'), host.board[1], 'cmd-place', 1000);

  const displayPlayer = applyPendingTerrainPlacement(host, pending, 1000);

  assert.notEqual(displayPlayer, host);
  assert.equal(displayPlayer.board[1].type, 'grove');
  assert.equal(displayPlayer.board[1].movementStopKind, 'combat');
  assert.equal(displayPlayer.board[1].movementStopReason, 'combat');
  assert.equal(displayPlayer.board[1].expiresOnLap, 5);
  assert.equal(host.board[1].type, 'road');
});

test('optimistic terrain placement clears on matching authoritative tile change', () => {
  const host = player();
  const pending = createPendingTerrainPlacement(host, terrainCard('meadow'), host.board[1], 'cmd-place', 1000);

  assert.ok(pending);
  assert.equal(roomDeltaClearsPendingTerrainPlacement(pending, delta(event(1, 'tileChanged', {
    playerId: 'host',
    tileIndex: 1,
    tile: { ...host.board[1], type: 'meadow' }
  }))), true);
});

test('optimistic terrain placement clears on command rejection or timeout', () => {
  const host = player();
  const pending = createPendingTerrainPlacement(host, terrainCard('mire'), host.board[1], 'cmd-place', 1000);

  assert.ok(pending);
  assert.equal(roomDeltaClearsPendingTerrainPlacement(pending, delta(event(1, 'commandRejected', {
    commandId: 'cmd-place',
    name: 'placeCard',
    playerId: 'host',
    reason: 'no-op'
  }))), true);
  assert.equal(isPendingTerrainPlacementExpired(pending, 1000 + optimisticTerrainPlacementTimeoutMs - 1), false);
  assert.equal(isPendingTerrainPlacementExpired(pending, 1000 + optimisticTerrainPlacementTimeoutMs), true);
});

test('optimistic terrain placement does not survive room state replacement', () => {
  const host = player();
  const pending = createPendingTerrainPlacement(host, terrainCard('grove'), host.board[1], 'cmd-place', 1000);

  assert.ok(pending);
  const replacementPending = null;
  const displayPlayer = applyPendingTerrainPlacement(host, replacementPending, 1200);

  assert.equal(displayPlayer, host);
  assert.equal(displayPlayer.board[1].type, 'road');
});
