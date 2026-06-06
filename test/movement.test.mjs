import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hardVisualCorrectionCursor,
  maxVisualAuthorityLeadCursor,
  reconcileVisualCursor
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

test('visual reconciliation caps local runway ahead of authority', () => {
  const previousCursor = 6.1;
  const targetCursor = 6.2;
  const localCursor = 7.6;

  assert.equal(
    reconcileVisualCursor(board(), previousCursor, targetCursor, localCursor),
    targetCursor + maxVisualAuthorityLeadCursor
  );
});

test('visual reconciliation does not run through deterministic combat stops', () => {
  const targetCursor = 6.7;

  assert.equal(
    reconcileVisualCursor(board([7]), 6.8, targetCursor, 8),
    7
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
    targetCursor + maxVisualAuthorityLeadCursor
  );
});

test('visual reconciliation treats loop wrap as continuous forward travel', () => {
  assert.equal(
    reconcileVisualCursor(board(), 15.92, 16.08, 16.18),
    16.18
  );
});
