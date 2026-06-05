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

test('rival cards can be armed on unoccupied enemy road tiles only', () => {
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer');
  const target = testApi.createPlayer('target', 'Target', 'moss-warden');
  const meteor = {
    id: 'meteor',
    instanceId: 'meteor-road',
    name: 'Meteor',
    kind: 'rival',
    icon: '☄',
    text: 'Damages a rival and scorches a tile.'
  };

  attacker.hand = [meteor];
  target.position = 2;
  room.players.attacker = attacker;
  room.players.target = target;

  testApi.playRival(room, attacker, meteor.instanceId, target.id, 4);

  assert.equal(target.board[4].type, 'scorch');
  assert.equal(target.board[4].charges, 2);
  assert.equal(attacker.hand.length, 0);

  const hex = {
    id: 'hex',
    instanceId: 'hex-road',
    name: 'Hex',
    kind: 'rival',
    icon: '☾',
    text: 'Curses a rival for 3 events.'
  };
  attacker.hand = [hex];

  testApi.playRival(room, attacker, hex.instanceId, target.id, target.position);

  assert.equal(attacker.hand.length, 1);
  assert.equal(target.board[target.position].type, 'road');
});

test('selling hand cards and loose loot banks gold into score', () => {
  const player = testApi.createPlayer('seller', 'Seller', 'night-vagrant');
  const card = {
    id: 'tax',
    instanceId: 'tax-sale',
    name: 'Tithe Trap',
    kind: 'rival',
    icon: '$',
    text: 'Steals tempo.'
  };
  const looseLoot = { id: 'loose-loot', slot: 'weapon', name: 'Glass Pike', rarity: 'rare', power: 3, guard: 0, speed: 0, maxHp: 0 };
  const equippedLoot = { id: 'worn-loot', slot: 'armor', name: 'Tin Aegis', rarity: 'common', power: 0, guard: 2, speed: 0, maxHp: 3 };

  player.hand = [card];
  player.loot = [looseLoot, equippedLoot];
  player.loadout.armor = equippedLoot;
  room.players.seller = player;
  const scoreBefore = testApi.roomSnapshot(room).players[0].score;

  assert.equal(testApi.sellCard(room, player, card.instanceId), true);
  assert.equal(player.gold, 22);
  assert.equal(player.hand.length, 0);
  assert.ok(testApi.roomSnapshot(room).players[0].score > scoreBefore);

  assert.equal(testApi.sellLoot(room, player, equippedLoot.id), false);
  assert.equal(player.loot.some((item) => item.id === equippedLoot.id), true);

  assert.equal(testApi.sellLoot(room, player, looseLoot.id), true);
  assert.equal(player.loot.some((item) => item.id === looseLoot.id), false);
  assert.ok(player.gold > 22);
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

test('danger terrain can stack multiple enemies into one longer combat lock', () => {
  const player = testApi.createPlayer('fighter', 'Fighter', 'ember-knight');
  player.board[1].type = 'bonepit';
  player.board[2].type = 'bloodmoon';
  player.board[15].type = 'wolfden';
  player.position = 1;

  testApi.triggerTile(room, player, player.board[player.position]);

  assert.ok(player.combat.enemyCount >= 3);
  assert.ok(player.combat.rounds >= player.combat.enemyCount);
  assert.ok(player.combat.beats.length >= player.combat.rounds);
  assert.ok(player.combat.beats.some((beat) => beat.attacker === 'hero'));
  assert.ok(player.combat.beats.some((beat) => beat.attacker === 'enemy'));
  assert.ok(player.combat.durationMs >= 360 + player.combat.beats.length * 203);
  assert.ok(player.combat.durationMs < 1600 + player.combat.enemyCount * 390 + player.combat.rounds * 135);
  assert.equal(player.combat.enemyName, 'Bone Host');
});

test('players have a complete paperdoll loadout with varied equipment slots', () => {
  const player = testApi.createPlayer('gear-test', 'Gear Test', 'ember-knight');

  assert.deepEqual(Object.keys(player.loadout), testApi.equipmentSlots);

  const boots = { id: 'swift-boots', slot: 'boots', name: 'Quick Road Boots', rarity: 'rare', role: 'Scout', power: 0, guard: 0, speed: 2, maxHp: 0, drawRate: -0.02 };
  player.loot = [boots];

  testApi.equip(player, boots.id);

  assert.equal(player.loadout.boots.id, boots.id);
  assert.equal(player.speed, 7);
  assert.ok(player.drawRate < 1);
});

test('active combat stops runner movement until the bespoke combat beat expires', () => {
  const player = testApi.createPlayer('fighter', 'Fighter', 'ember-knight');
  room.players[player.id] = player;
  room.status = 'running';
  player.board[1].type = 'crypt';
  player.nextMoveAt = room.now;

  testApi.runRoomStep(room, { advanceMs: 1 });

  assert.equal(player.position, 1);
  assert.ok(player.combat);
  const lockedPosition = player.position;
  const lockedUntil = player.combat.expiresAt;

  testApi.runRoomStep(room, { advanceMs: 1000 });

  assert.equal(player.position, lockedPosition);
  assert.ok(room.now < lockedUntil);
});

test('passive card draw has slower pacing than the opening prototype', () => {
  const player = testApi.createPlayer('draws', 'Draws', 'ember-knight');
  room.players[player.id] = player;
  room.status = 'running';
  player.hand = [];
  player.nextDrawAt = room.now;

  testApi.runRoomStep(room, { advanceMs: 1 });

  assert.equal(player.hand.length, 1);
  assert.ok(player.nextDrawAt - room.now >= 6500 * 2.4);
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

test('first human becomes room host and host migrates to connected humans', () => {
  const firstJoin = testApi.joinRoom(room, { playerId: 'alpha', name: 'Alpha', heroId: 'ember-knight' });
  const secondJoin = testApi.joinRoom(room, { playerId: 'bravo', name: 'Bravo', heroId: 'night-vagrant' });

  assert.equal(firstJoin.player.id, 'alpha');
  assert.equal(testApi.roomSnapshot(room).hostId, 'alpha');

  testApi.disconnectPlayer(room, firstJoin.player.id);

  assert.equal(secondJoin.player.connected, true);
  assert.equal(testApi.roomSnapshot(room).hostId, 'bravo');
});

test('snapshot keeps board seats stable while ranks follow score', () => {
  const firstJoin = testApi.joinRoom(room, { playerId: 'alpha', name: 'Alpha', heroId: 'ember-knight' });
  const secondJoin = testApi.joinRoom(room, { playerId: 'bravo', name: 'Bravo', heroId: 'night-vagrant' });

  assert.deepEqual(testApi.roomSnapshot(room).players.map((player) => player.id), ['alpha', 'bravo']);

  secondJoin.player.level = firstJoin.player.level + 8;
  const snapshot = testApi.roomSnapshot(room);

  assert.deepEqual(snapshot.players.map((player) => player.id), ['alpha', 'bravo']);
  assert.equal(snapshot.players.find((player) => player.id === 'alpha').rank, 2);
  assert.equal(snapshot.players.find((player) => player.id === 'bravo').rank, 1);
  assert.deepEqual(snapshot.leaderboard.map((player) => player.id), ['bravo', 'alpha']);
});

test('hero talent trees gate choices by hero and prerequisites', () => {
  const player = testApi.createPlayer('talent-test', 'Talent Test', 'ember-knight');

  player.talentPoints = 1;
  testApi.refreshPendingTraits(player);

  assert.deepEqual(player.pendingTraits, ['ember-oath']);
  assert.equal(player.pendingTraits.some((traitId) => traitId.startsWith('moon-')), false);

  testApi.chooseTrait(player, 'shield-heat');
  assert.deepEqual(player.traits, []);

  testApi.chooseTrait(player, 'ember-oath');
  assert.deepEqual(player.traits, ['ember-oath']);
  assert.equal(player.power, 10);
  assert.equal(player.maxHp, 50);

  player.talentPoints = 1;
  testApi.refreshPendingTraits(player);
  assert.deepEqual(new Set(player.pendingTraits), new Set(['cinder-step', 'shield-heat']));
});

test('talent tree budgets stay in a tight balance band', () => {
  function budgetValue(bonus) {
    return (
      (bonus.maxHp ?? 0) * 0.35 +
      (bonus.power ?? 0) * 2.4 +
      (bonus.guard ?? 0) * 1.8 +
      (bonus.speed ?? 0) * 2.4 +
      (1 - (bonus.drawRate ?? 1)) * 18 +
      (bonus.sabotage ?? 0) * 1.15 +
      (bonus.lootLuck ?? 0) * 18 +
      (bonus.lapHeal ?? 0) * 0.7 +
      (bonus.terrainScore ?? 0) * 0.75 +
      (bonus.revivePower ?? 0) * 1.2
    );
  }

  const budgets = new Map();
  for (const trait of testApi.traits) {
    budgets.set(trait.heroId, (budgets.get(trait.heroId) ?? 0) + budgetValue(trait.bonus));
  }

  assert.equal(budgets.size, 5);
  for (const [heroId, budget] of budgets) {
    const nodeCount = testApi.traits.filter((trait) => trait.heroId === heroId).length;
    assert.equal(nodeCount, 7);
    assert.ok(budget >= 26 && budget <= 33, `${heroId} budget ${budget.toFixed(2)} is outside the target band`);
  }
});

test('reaching the goal score starts a claim lap instead of ending immediately', () => {
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  room.players.leader = player;
  room.status = 'running';
  player.level = Math.ceil(testApi.goalScore / 390);

  const winner = testApi.checkWinner(room);
  const snapshot = testApi.roomSnapshot(room);

  assert.equal(winner, null);
  assert.equal(snapshot.status, 'running');
  assert.equal(snapshot.winnerId, null);
  assert.equal(snapshot.claim.playerId, player.id);
  assert.equal(snapshot.tier.id, 4);
  assert.equal(player.marked, true);
});

test('claim lap finishes after the claimant completes another lap', () => {
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  room.players.leader = player;
  room.status = 'running';
  player.level = Math.ceil(testApi.goalScore / 390);
  player.laps = 3;

  testApi.checkWinner(room);
  player.laps = 4;
  const winner = testApi.checkWinner(room);
  const snapshot = testApi.roomSnapshot(room);

  assert.equal(winner.id, player.id);
  assert.equal(snapshot.status, 'finished');
  assert.equal(snapshot.winnerId, player.id);
});

test('unstable loop marks the leader and rival cards hit marked runners harder', () => {
  const leader = testApi.createPlayer('leader', 'Leader', 'moss-warden');
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'ember-knight');
  const meteor = {
    id: 'meteor',
    instanceId: 'marked-meteor',
    name: 'Meteor',
    kind: 'rival',
    icon: '☄',
    text: 'Damages a rival and scorches a tile.'
  };

  leader.level = 12;
  attacker.hand = [meteor];
  room.players.leader = leader;
  room.players.attacker = attacker;
  room.status = 'running';

  testApi.checkWinner(room);

  assert.equal(testApi.roomSnapshot(room).tier.id, 3);
  assert.equal(leader.marked, true);

  const hpBefore = leader.hp;
  testApi.playRival(room, attacker, meteor.instanceId, leader.id);

  assert.equal(leader.hp, hpBefore - 11);
});

test('solo tier gates trigger before the crown claim', () => {
  const player = testApi.createPlayer('solo', 'Solo', 'ember-knight');
  room.players.solo = player;
  room.status = 'running';
  player.level = 5;

  testApi.checkWinner(room);

  assert.deepEqual(player.soloGatesCleared, [1800]);
  assert.equal(player.combat.enemyName, 'Loop Warden');
});

test('solo rooms draw terrain cards instead of unusable rival cards', () => {
  const join = testApi.joinRoom(room, { playerId: 'solo', name: 'Solo', heroId: 'ember-knight' });
  const player = join.player;

  assert.equal(player.hand.every((card) => card.kind === 'terrain'), true);

  player.hand = [];
  room.status = 'running';
  player.nextDrawAt = room.now;
  for (let index = 0; index < 12; index += 1) {
    player.nextDrawAt = room.now;
    testApi.runRoomStep(room, { advanceMs: 1 });
  }

  assert.ok(player.hand.length > 0);
  assert.equal(player.hand.every((card) => card.kind === 'terrain'), true);

  player.hand = [];
  player.board[1].type = 'watchtower';
  player.position = 1;
  testApi.triggerTile(room, player, player.board[player.position]);

  assert.equal(player.hand.length, 1);
  assert.equal(player.hand[0].kind, 'terrain');
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

  assert.ok(report.finishedRate >= 0.8);
  assert.ok(report.avgSeconds >= 250 && report.avgSeconds <= 1000);
  assert.ok(Math.max(...rates) <= 0.42);
  assert.ok(Math.min(...rates) >= 0.05);
});
