import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { testApi } from '../server/rules.mjs';
import { runBalanceSuite, simulateMatch } from '../scripts/balance-sim.mjs';

let room;

beforeEach(() => {
  room = testApi.createRoom('test');
});

test('room capacity counts bots and human players consistently', () => {
  for (let index = 0; index < testApi.maxPlayers; index += 1) {
    room.players[`player-${index}`] = testApi.createPlayer(`player-${index}`, `Player ${index}`, 'ember-knight', index > 1);
  }

  assert.equal(testApi.activePlayerCount(room), 4);
  assert.equal(testApi.hasRoomForPlayer(room), false);
});

test('rival damage that drops a player to zero immediately revives them at camp', () => {
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer');
  const target = testApi.createPlayer('target', 'Target', 'night-vagrant');
  const meteor = {
    id: 'meteor',
    instanceId: 'meteor-1',
    name: 'Meteor',
    kind: 'rival',
    icon: '☄',
    text: 'Damages a rival and scorches a tile.'
  };

  attacker.hand = [meteor];
  target.hp = 5;
  target.position = 6;
  room.players.attacker = attacker;
  room.players.target = target;

  testApi.playRival(room, attacker, meteor.instanceId, target.id);

  assert.equal(target.deaths, 1);
  assert.equal(target.position, 0);
  assert.equal(target.hp, Math.ceil(target.maxHp * 0.58));
  assert.equal(attacker.hand.length, 0);
});

test('a player already at zero HP revives before resolving the next tile', () => {
  const player = testApi.createPlayer('runner', 'Runner', 'grave-singer');
  player.hp = 0;
  player.position = 3;

  testApi.triggerTile(room, player, player.board[player.position]);

  assert.equal(player.deaths, 1);
  assert.equal(player.position, 0);
  assert.equal(player.hp, Math.ceil(player.maxHp * 0.58));
});

test('combat events expose encounter details for the board overlay', () => {
  const player = testApi.createPlayer('fighter', 'Fighter', 'ember-knight');
  player.board[1].type = 'crypt';
  player.position = 1;

  testApi.triggerTile(room, player, player.board[player.position]);

  assert.equal(player.combat.enemyId, 'crypt-wraith');
  assert.equal(player.combat.backgroundId, 'crypt');
  assert.equal(player.combat.effect, 'spectral');
  assert.equal(player.combat.enemyHpAfter, 0);
  assert.equal(player.combat.heroHpAfter, player.hp);
  assert.ok(player.combat.damage > 0);
  assert.ok(player.combat.expiresAt > player.combat.startedAt);
});

test('joining with the same player token reconnects instead of adding a new slot', () => {
  const firstJoin = testApi.joinRoom(room, { playerId: 'stable-token', name: 'Alex', heroId: 'ember-knight' });
  firstJoin.player.connected = false;
  const secondJoin = testApi.joinRoom(room, { playerId: 'stable-token', name: 'Alex 2', heroId: 'grave-singer' });

  assert.equal(secondJoin.created, false);
  assert.equal(secondJoin.player.connected, true);
  assert.equal(testApi.activePlayerCount(room), 1);
  assert.equal(secondJoin.player.heroId, 'ember-knight');
});

test('room finishes when a player reaches the goal score', () => {
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  room.players.leader = player;
  room.status = 'running';
  player.level = 20;

  const winner = testApi.checkWinner(room);
  const snapshot = testApi.roomSnapshot(room);

  assert.equal(winner.id, player.id);
  assert.equal(snapshot.status, 'finished');
  assert.equal(snapshot.winnerId, player.id);
});

test('fillCpuOpponents fills open seats without exceeding capacity', () => {
  testApi.joinRoom(room, { playerId: 'human', name: 'Human', heroId: 'ember-knight' });
  const added = testApi.fillCpuOpponents(room);

  assert.equal(added.length, 3);
  assert.equal(testApi.activePlayerCount(room), testApi.maxPlayers);
  assert.equal(testApi.fillCpuOpponents(room).length, 0);
});

test('seeded simulations are deterministic', () => {
  const first = simulateMatch(42);
  const second = simulateMatch(42);

  assert.deepEqual(first.players, second.players);
  assert.equal(first.winnerHero, second.winnerHero);
  assert.equal(first.finished, true);
});

test('CPU balance suite keeps heroes inside a playable win-rate band', () => {
  const report = runBalanceSuite(60);
  const rates = report.heroes.map((hero) => hero.winRate);

  assert.equal(report.finishedRate, 1);
  assert.ok(report.avgSeconds >= 70 && report.avgSeconds <= 150);
  assert.ok(Math.max(...rates) <= 0.42);
  assert.ok(Math.min(...rates) >= 0.05);
});
