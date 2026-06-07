import assert from 'node:assert/strict';
import test from 'node:test';
import { commandResultFromAckPayload, createClientCommandTransport } from '../src/client-command-transport.ts';

function fakeTimers() {
  const timeouts = [];
  return {
    api: {
      setTimeout(callback, ms) {
        const timeout = { callback, ms, cancelled: false };
        timeouts.push(timeout);
        return timeout;
      },
      clearTimeout(handle) {
        if (handle) handle.cancelled = true;
      }
    },
    runNext() {
      const timeout = timeouts.find((item) => !item.cancelled);
      assert.ok(timeout, 'expected a pending timeout');
      timeout.cancelled = true;
      timeout.callback();
    },
    pendingCount() {
      return timeouts.filter((item) => !item.cancelled).length;
    }
  };
}

function delta(commandEvent) {
  return {
    roomId: 'command-room',
    firstSeq: 1,
    lastSeq: 1,
    events: [{
      seq: 1,
      type: commandEvent.type,
      roomId: 'command-room',
      tick: 1,
      serverTime: 1000,
      payload: commandEvent.payload
    }]
  };
}

test('client command transport sends generated command ids in payloads', () => {
  const timers = fakeTimers();
  const emitted = [];
  const transport = createClientCommandTransport({
    emit: (eventName, payload, ack) => emitted.push({ eventName, payload, ack }),
    makeCommandId: () => 'cmd-1',
    timers: timers.api
  });

  const commandId = transport.send('placeCard', { cardId: 'card-1', tileIndex: 2 });

  assert.equal(commandId, 'cmd-1');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].eventName, 'placeCard');
  assert.deepEqual(emitted[0].payload, { cardId: 'card-1', tileIndex: 2, commandId: 'cmd-1' });
  assert.equal(transport.pendingCount(), 1);

  emitted[0].ack({ commandId: 'cmd-1', status: 'accepted' });
  assert.equal(transport.pendingCount(), 0);
  assert.equal(timers.pendingCount(), 0);
});

test('client command transport retries ack timeouts only while authority is live', () => {
  const timers = fakeTimers();
  const emitted = [];
  let paused = true;
  const transport = createClientCommandTransport({
    emit: (eventName, payload) => emitted.push({ eventName, payload }),
    makeCommandId: () => 'cmd-paused',
    shouldRetry: () => !paused,
    timers: timers.api
  });

  transport.send('sellCard', { cardId: 'card-1' });
  assert.equal(emitted.length, 1);

  timers.runNext();
  assert.equal(emitted.length, 1);
  assert.equal(transport.pendingCount(), 1);

  paused = false;
  timers.runNext();
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted[1].payload, { cardId: 'card-1', commandId: 'cmd-paused' });
});

test('client command transport stops after the configured retry count', () => {
  const timers = fakeTimers();
  const emitted = [];
  const notices = [];
  const transport = createClientCommandTransport({
    emit: (eventName, payload) => emitted.push({ eventName, payload }),
    makeCommandId: () => 'cmd-timeout',
    maxRetries: 1,
    timers: timers.api,
    onNotice: (message) => notices.push(message)
  });

  transport.send('buyShopOffer', { offerId: 'offer-1' });
  timers.runNext();
  timers.runNext();

  assert.equal(emitted.length, 2);
  assert.equal(transport.pendingCount(), 1);
  assert.deepEqual(notices, ['Buy shop offer is waiting for server confirmation.']);
});

test('client command transport surfaces rejected command deltas as notices', () => {
  const timers = fakeTimers();
  const notices = [];
  const transport = createClientCommandTransport({
    emit: () => undefined,
    makeCommandId: () => 'cmd-reject',
    timers: timers.api,
    onNotice: (message) => notices.push(message)
  });

  transport.send('placeCard', { cardId: 'missing', tileIndex: 2 });
  transport.observeRoomDelta(delta({
    type: 'commandRejected',
    payload: {
      commandId: 'cmd-reject',
      name: 'placeCard',
      playerId: 'host',
      reason: 'no-op'
    }
  }));

  assert.equal(transport.pendingCount(), 0);
  assert.deepEqual(notices, ['Place card rejected by the server.']);
  assert.equal(timers.pendingCount(), 0);
});

test('untracked commands still get generated ids without retry bookkeeping', () => {
  const emitted = [];
  const transport = createClientCommandTransport({
    emit: (eventName, payload) => emitted.push({ eventName, payload }),
    makeCommandId: () => 'cmd-untracked'
  });

  const commandId = transport.send('addBot', undefined, { retry: false, trackAck: false });

  assert.equal(commandId, 'cmd-untracked');
  assert.deepEqual(emitted, [{ eventName: 'addBot', payload: { commandId: 'cmd-untracked' } }]);
  assert.equal(transport.pendingCount(), 0);
});

test('socket ack parser accepts future explicit command result payloads', () => {
  assert.deepEqual(commandResultFromAckPayload({
    commandId: 'cmd-ack',
    status: 'rejected',
    name: 'sellCard',
    reason: 'missing-card'
  }, 'fallback'), {
    commandId: 'cmd-ack',
    status: 'rejected',
    name: 'sellCard',
    playerId: undefined,
    reason: 'missing-card',
    message: null,
    retryable: undefined
  });
});
