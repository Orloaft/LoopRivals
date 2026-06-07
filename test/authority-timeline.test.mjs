import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorityStateStale } from '../src/authority-timeline.ts';

function player(overrides = {}) {
  return {
    id: 'host',
    nextMovement: null,
    combat: null,
    stunnedUntil: null,
    ...overrides
  };
}

function state(overrides = {}) {
  return {
    now: 1000,
    receivedAt: 1000,
    players: [player()],
    ...overrides
  };
}

test('authority timeline stays fresh while projected movement is still active', () => {
  const room = state({
    players: [
      player({
        nextMovement: {
          fromCursor: 1,
          toCursor: 2,
          departAt: 1200,
          arriveAt: 3600
        }
      })
    ]
  });

  assert.equal(isAuthorityStateStale(room, 2800, 1800), false);
});

test('authority timeline becomes stale after projected movement expires', () => {
  const room = state({
    players: [
      player({
        nextMovement: {
          fromCursor: 1,
          toCursor: 2,
          departAt: 1200,
          arriveAt: 1800
        }
      })
    ]
  });

  assert.equal(isAuthorityStateStale(room, 3200, 1800), true);
});

test('authority timeline stays fresh while combat is still active', () => {
  const room = state({
    players: [
      player({
        combat: {
          expiresAt: 3600
        }
      })
    ]
  });

  assert.equal(isAuthorityStateStale(room, 2800, 1800), false);
});
