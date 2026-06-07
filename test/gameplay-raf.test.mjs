import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameplayRafScheduler } from '../src/gameplay-raf.ts';

function manualRafDriver() {
  let nextHandle = 1;
  const requests = [];
  const cancelled = [];
  const driver = {
    requestAnimationFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      requests.push({ handle, callback });
      return handle;
    },
    cancelAnimationFrame(handle) {
      cancelled.push(handle);
    }
  };

  return {
    driver,
    requests,
    cancelled,
    flush(frameAt) {
      const request = requests.shift();
      assert.ok(request, 'expected a queued RAF callback');
      request.callback(frameAt);
      return request.handle;
    }
  };
}

test('gameplay RAF scheduler uses one underlying frame loop for multiple subscribers', () => {
  const raf = manualRafDriver();
  const scheduler = createGameplayRafScheduler(raf.driver);
  const firstFrames = [];
  const secondFrames = [];

  const unsubscribeFirst = scheduler.subscribe((frame) => firstFrames.push(frame));
  const unsubscribeSecond = scheduler.subscribe((frame) => secondFrames.push(frame));

  assert.equal(scheduler.subscriberCount, 2);
  assert.equal(raf.requests.length, 1, 'multiple subscribers should share one requested frame');

  raf.flush(100);
  assert.equal(firstFrames.length, 1);
  assert.equal(secondFrames.length, 1);
  assert.equal(firstFrames[0].deltaMs, 0);
  assert.equal(raf.requests.length, 1, 'scheduler should keep one frame queued while subscribers remain');

  unsubscribeFirst();
  raf.flush(116);
  assert.equal(firstFrames.length, 1);
  assert.equal(secondFrames.length, 2);
  assert.equal(secondFrames[1].deltaMs, 16);

  unsubscribeSecond();
  assert.equal(scheduler.subscriberCount, 0);
  assert.equal(scheduler.running, false);
  assert.deepEqual(raf.cancelled, [3]);
});

test('gameplay RAF scheduler can unsubscribe itself during a frame without queuing another frame', () => {
  const raf = manualRafDriver();
  const scheduler = createGameplayRafScheduler(raf.driver);
  let frames = 0;
  let unsubscribe = () => {};

  unsubscribe = scheduler.subscribe(() => {
    frames += 1;
    unsubscribe();
  });

  raf.flush(10);
  assert.equal(frames, 1);
  assert.equal(scheduler.subscriberCount, 0);
  assert.equal(scheduler.running, false);
  assert.equal(raf.requests.length, 0);
});
