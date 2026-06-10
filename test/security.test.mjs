import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanId, cleanTileIndex, resolveJoinIdentity } from '../server/security.mjs';

test('cleanId accepts sane ids and trims whitespace', () => {
  assert.equal(cleanId('card-123'), 'card-123');
  assert.equal(cleanId('  spaced  '), 'spaced');
});

test('cleanId rejects non-strings, empties, and oversized values', () => {
  assert.equal(cleanId(null), null);
  assert.equal(cleanId(undefined), null);
  assert.equal(cleanId(42), null);
  assert.equal(cleanId({}), null);
  assert.equal(cleanId(''), null);
  assert.equal(cleanId('   '), null);
  assert.equal(cleanId('x'.repeat(65)), null);
  assert.equal(cleanId('x'.repeat(64)), 'x'.repeat(64));
});

test('cleanTileIndex bounds the index to the board', () => {
  const board = new Array(24).fill({});
  assert.equal(cleanTileIndex(0, board), 0);
  assert.equal(cleanTileIndex(23, board), 23);
  assert.equal(cleanTileIndex('7', board), 7);
  assert.equal(cleanTileIndex(24, board), null);
  assert.equal(cleanTileIndex(-1, board), null);
  assert.equal(cleanTileIndex(2.5, board), null);
  assert.equal(cleanTileIndex(Number.NaN, board), null);
  assert.equal(cleanTileIndex('junk', board), null);
  assert.equal(cleanTileIndex(3, undefined), null);
});

function roomWith({ players = {}, playerSecrets = {} } = {}) {
  return { players, playerSecrets };
}

test('join with no token gets a fresh server-issued identity', () => {
  const identity = resolveJoinIdentity(roomWith(), undefined);
  assert.equal(identity.reconnect, false);
  assert.match(identity.playerId, /^[0-9a-f-]{36}$/);
  assert.match(identity.secret, /^[0-9a-f-]{36}$/);
  assert.notEqual(identity.playerId, identity.secret);
});

test('join with an unknown token gets a fresh identity (token is not trusted)', () => {
  const identity = resolveJoinIdentity(roomWith(), 'made-up-token');
  assert.equal(identity.reconnect, false);
  assert.notEqual(identity.playerId, 'made-up-token');
});

test("another player's PUBLIC id grants nothing — the hijack case", () => {
  const room = roomWith({
    players: { 'victim-id': { id: 'victim-id', isBot: false } },
    playerSecrets: { 'victim-id': 'victim-secret' }
  });
  const identity = resolveJoinIdentity(room, 'victim-id');
  assert.equal(identity.reconnect, false);
  assert.notEqual(identity.playerId, 'victim-id');
});

test('the matching secret reclaims the seat', () => {
  const room = roomWith({
    players: { 'p1': { id: 'p1', isBot: false } },
    playerSecrets: { 'p1': 'p1-secret' }
  });
  const identity = resolveJoinIdentity(room, 'p1-secret');
  assert.equal(identity.reconnect, true);
  assert.equal(identity.playerId, 'p1');
  assert.equal(identity.secret, 'p1-secret');
});

test('the secret reclaims the seat even when the player object is gone (rematch reset / restart)', () => {
  const room = roomWith({ playerSecrets: { 'p1': 'p1-secret' } });
  const identity = resolveJoinIdentity(room, 'p1-secret');
  assert.equal(identity.reconnect, true);
  assert.equal(identity.playerId, 'p1');
});

test('a secret somehow bound to a bot id is not honored', () => {
  const room = roomWith({
    players: { 'bot-1': { id: 'bot-1', isBot: true } },
    playerSecrets: { 'bot-1': 'bot-secret' }
  });
  const identity = resolveJoinIdentity(room, 'bot-secret');
  assert.equal(identity.reconnect, false);
  assert.notEqual(identity.playerId, 'bot-1');
});

test('resolveJoinIdentity tolerates rooms missing the secrets map (restored legacy snapshots)', () => {
  const room = { players: {} };
  const identity = resolveJoinIdentity(room, 'whatever');
  assert.equal(identity.reconnect, false);
  assert.deepEqual(room.playerSecrets, {});
});
