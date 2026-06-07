import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDurationMetrics,
  createFrameGapMetrics,
  createSocketMetrics,
  summarizeSamples
} from '../src/smoothness-metrics.ts';

test('smoothness percentile summaries include p50 p95 p99 and max', () => {
  assert.deepEqual(summarizeSamples([]), { samples: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  assert.deepEqual(
    summarizeSamples([8, 16, 20, 34, 50]),
    { samples: 5, avg: 25.6, p50: 20, p95: 50, p99: 50, max: 50 }
  );
});

test('RAF frame-gap metrics ignore idle time after clock reset', () => {
  const metrics = createFrameGapMetrics();

  metrics.recordFrame(100);
  metrics.recordFrame(116);
  metrics.recordFrame(150);
  metrics.resetClock();
  metrics.recordFrame(1000);
  metrics.recordFrame(1016);

  assert.deepEqual(metrics.snapshot(), { samples: 3, avg: 22, p50: 16, p95: 34, p99: 34, max: 34 });
});

test('socket metrics split inbound and outbound payload volume by event', () => {
  const metrics = createSocketMetrics();

  metrics.record('state', { id: 'room', players: [{ id: 'a' }] });
  metrics.record('room:delta', { roomId: 'room', events: [{ type: 'movementSegment' }] });
  metrics.record('placeCard', { cardId: 'c1', tileIndex: 2 }, 'outbound');

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.count, 3);
  assert.equal(snapshot.inbound.count, 2);
  assert.equal(snapshot.outbound.count, 1);
  assert.ok(snapshot.bytes > 0);
  assert.deepEqual(
    snapshot.events.map((event) => `${event.direction}:${event.eventName}`).sort(),
    ['inbound:room:delta', 'inbound:state', 'outbound:placeCard']
  );
});

test('duration metrics can wrap delta application work', () => {
  const metrics = createDurationMetrics();

  const result = metrics.measure(() => 42);

  assert.equal(result, 42);
  assert.equal(metrics.snapshot().samples, 1);
});
