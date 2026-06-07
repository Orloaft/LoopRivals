import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstMovementStopCursor,
  hardVisualCorrectionCursor,
  maxVisualFrameStepMs,
  keepForwardVisualCursor,
  maxVisualAuthorityLeadCursor,
  pendingCombatStopCursor,
  playerMotionIsLocked,
  reconcileVisualCursor,
  visualCursorForPlayer,
  visualFrameCursorForPlayer
} from '../src/movement.ts';

function board(stopIndexes = []) {
  const stops = new Set(stopIndexes);
  return Array.from({ length: 16 }, (_, index) => ({
    index,
    coord: [index % 5, Math.floor(index / 5)],
    type: stops.has(index) ? 'grove' : 'road',
    charges: 0,
    movementStopKind: stops.has(index) ? 'combat' : 'none',
    movementStopReason: stops.has(index) ? 'combat' : null
  }));
}

function assertNear(actual, expected, tolerance = 0.005) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
}

test('visual reconciliation caps local runway ahead of authority', () => {
  const previousCursor = 6.1;
  const targetCursor = 6.2;
  const localCursor = 7.6;

  assert.equal(
    reconcileVisualCursor(board(), previousCursor, targetCursor, localCursor),
    targetCursor + maxVisualAuthorityLeadCursor
  );
});

test('visual reconciliation can bridge a whole ordinary tile between authority ticks', () => {
  assert.ok(maxVisualAuthorityLeadCursor > 1, 'runner should have enough local runway to avoid between-tile stalls');
  assert.equal(
    reconcileVisualCursor(board(), 6.1, 6.2, 7.25),
    7.25
  );
});

test('visual motion uses a bounded frame step for delayed animation frames', () => {
  assert.ok(maxVisualFrameStepMs > 16);
  assert.ok(maxVisualFrameStepMs < 80);
});

test('visual reconciliation does not run through deterministic combat stops', () => {
  const targetCursor = 6.7;

  assert.equal(
    reconcileVisualCursor(board([7]), 6.8, targetCursor, 8),
    7
  );
});

test('visual reconciliation freezes on an authoritative combat stop instead of running past it', () => {
  assert.equal(
    reconcileVisualCursor(board([2]), 2.35, 2, 2.45),
    2
  );
});

test('visual reconciliation accepts hard backward authority corrections', () => {
  const targetCursor = 4;
  const previousCursor = targetCursor + hardVisualCorrectionCursor + 0.01;

  assert.equal(
    reconcileVisualCursor(board(), previousCursor, targetCursor, previousCursor + 0.1),
    targetCursor
  );
});

test('visual reconciliation keeps small timing corrections bounded instead of snapping backward', () => {
  const targetCursor = 4;
  const previousCursor = targetCursor + hardVisualCorrectionCursor - 0.01;

  assert.equal(
    reconcileVisualCursor(board(), previousCursor, targetCursor, previousCursor + 0.1),
    previousCursor + 0.1
  );
});

test('visual reconciliation treats loop wrap as continuous forward travel', () => {
  assert.equal(
    reconcileVisualCursor(board(), 15.92, 16.08, 16.18),
    16.18
  );
});

test('motion clock ignores small backward authority clock regressions during running travel', () => {
  assert.equal(
    keepForwardVisualCursor(board(), 3.17, 2.01),
    3.17
  );
});

test('motion clock accepts backward correction to a newly known combat stop', () => {
  assert.equal(
    keepForwardVisualCursor(board([2]), 3.01, 2),
    2
  );
});

test('motion clock clamps backward correction at combat stop between authority and visual cursor', () => {
  assert.equal(
    keepForwardVisualCursor(board([3]), 3.4, 2.6),
    3
  );
});

test('motion clock still accepts true reset-sized backward corrections', () => {
  assert.equal(
    keepForwardVisualCursor(board(), 13.5, 2),
    2
  );
});

test('combat stop lookup returns the first deterministic stop in forward travel', () => {
  assert.equal(
    firstMovementStopCursor(board([4, 6]), 2.3, 6.2),
    4
  );
});

test('pending combat stop is known before the combat payload exists', () => {
  const player = {
    board: board([2]),
    position: 1,
    laps: 0,
    combat: null,
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 1,
      toCursor: 2,
      departAt: 1000,
      arriveAt: 1800
    },
    arrivalMovement: null
  };

  assert.equal(
    pendingCombatStopCursor(player, 1200, Date.now()),
    2
  );
});

test('pending combat stop disappears once authoritative combat is present', () => {
  const player = {
    board: board([2]),
    position: 1,
    laps: 0,
    combat: { startedAt: 2000 },
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 1,
      toCursor: 2,
      departAt: 1000,
      arriveAt: 1800
    },
    arrivalMovement: null
  };

  assert.equal(
    pendingCombatStopCursor(player, 1200, Date.now()),
    null
  );
});

test('pending combat stop ignores the already occupied combat tile after resolution', () => {
  const player = {
    board: board([2, 5]),
    position: 2,
    laps: 0,
    combat: null,
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 2,
      toCursor: 3,
      departAt: 2000,
      arriveAt: 2800
    },
    arrivalMovement: null
  };

  assert.equal(
    pendingCombatStopCursor(player, 2200, Date.now()),
    null
  );
});

test('confirmed combat keeps moving on the server arrival segment until engagement', () => {
  const player = {
    board: board([2]),
    position: 2,
    laps: 0,
    combat: { startedAt: 2000 },
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 2,
      toCursor: 3,
      departAt: 2100,
      arriveAt: 2900
    },
    arrivalMovement: {
      fromCursor: 1,
      toCursor: 2,
      departAt: 1000,
      arriveAt: 2000
    }
  };
  const receivedAt = Date.now();

  assertNear(
    visualCursorForPlayer(player, 1920, receivedAt),
    1.5
  );
  assert.equal(
    visualCursorForPlayer(player, 2420, receivedAt),
    2
  );
});

test('confirmed combat ignores queued movement and locks on combat center after engagement', () => {
  const player = {
    board: board([2]),
    position: 2,
    laps: 0,
    combat: { startedAt: 2000 },
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 2,
      toCursor: 3,
      departAt: 2100,
      arriveAt: 2900
    },
    arrivalMovement: {
      fromCursor: 1,
      toCursor: 2,
      departAt: 1000,
      arriveAt: 2000
    }
  };
  const receivedAt = Date.now();

  assert.equal(playerMotionIsLocked(player), true);
  assertNear(visualCursorForPlayer(player, 1920, receivedAt), 1.5);
  assert.equal(visualCursorForPlayer(player, 3000, receivedAt), 2);
  assert.equal(visualFrameCursorForPlayer(player, 2.64, 2.72, 3000, receivedAt), 2);
});

test('movement projection lands on combat tile center while awaiting authority', () => {
  const player = {
    board: board([2]),
    position: 1,
    laps: 0,
    combat: null,
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 1,
      toCursor: 2,
      departAt: 1000,
      arriveAt: 2000
    },
    arrivalMovement: null
  };

  assert.equal(
    visualCursorForPlayer(player, 2200, Date.now() - 2200),
    2
  );
});

test('movement frame projection does not overshoot a pending combat tile center', () => {
  const player = {
    board: board([2]),
    position: 1,
    laps: 0,
    combat: null,
    stunRemainingMs: 0,
    nextMovement: {
      fromCursor: 1,
      toCursor: 2,
      departAt: 1000,
      arriveAt: 2000
    },
    arrivalMovement: null
  };

  assert.equal(
    visualFrameCursorForPlayer(player, 2.35, 2.45, 2200, Date.now() - 2200),
    2
  );
});

test('visual cursor ignores queued movement while stun is active', () => {
  const player = {
    board: board(),
    position: 2,
    laps: 0,
    combat: null,
    stunRemainingMs: 900,
    nextMovement: {
      fromCursor: 2,
      toCursor: 3,
      departAt: 2100,
      arriveAt: 2900
    },
    arrivalMovement: null
  };

  assert.equal(
    visualCursorForPlayer(player, 2600, Date.now() - 2000),
    2
  );
});
