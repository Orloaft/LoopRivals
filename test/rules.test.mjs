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
  room.status = 'running';
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
  room.status = 'running';
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

test('common bonk cards stun the highest-score rival automatically', () => {
  room = testApi.createRoom('bonk-leader', { simulated: true, now: 1000 });
  room.status = 'running';
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'ember-knight', false, room);
  const leader = testApi.createPlayer('leader', 'Leader', 'night-vagrant', false, room);
  const trailer = testApi.createPlayer('trailer', 'Trailer', 'moss-warden', false, room);
  const bonk = {
    id: 'tin-bonk',
    instanceId: 'bonk-1',
    name: 'Tin Bonk',
    kind: 'bonk',
    rarity: 'common',
    targetMode: 'leader',
    stunSeconds: 4,
    icon: '!',
    text: 'Bonks the highest-score rival.'
  };

  attacker.hand = [bonk];
  leader.level = 5;
  trailer.level = 2;
  room.players.attacker = attacker;
  room.players.leader = leader;
  room.players.trailer = trailer;

  assert.equal(testApi.playBonk(room, attacker, bonk.instanceId, trailer.id), true);

  assert.equal(leader.stunnedBy, attacker.id);
  assert.equal(leader.stunnedUntil, 5000);
  assert.equal(trailer.stunnedUntil, null);
  assert.equal(attacker.hand.length, 0);
});

test('guided runs force Ember Knight, curate the opening, and expose coach state', () => {
  room = testApi.createRoom('guided', { simulated: true, now: 1000 });
  const result = testApi.joinRoom(room, {
    playerId: 'human',
    name: 'New Runner',
    heroId: 'grave-singer',
    guidedRun: true
  });

  assert.equal(result.player.heroId, 'ember-knight');
  assert.deepEqual(result.player.hand.map((card) => card.id), ['meadow', 'forge', 'grove']);
  assert.equal(room.settings.maxPlayers, 2);

  assert.equal(testApi.startRoom(room), true);

  const snapshot = testApi.roomSnapshot(room);
  assert.equal(snapshot.onboarding.playerId, 'human');
  assert.equal(snapshot.onboarding.step, 'place-safe');
  assert.deepEqual(snapshot.onboarding.recommendedTileIndexes, [4]);
  assert.equal(snapshot.players.some((player) => player.name === 'Vesper'), true);
  assert.equal(room.players.human.board[5].type, 'crypt');
});

test('rare bonk cards can stun a chosen rival and freeze movement until expiry', () => {
  room = testApi.createRoom('bonk-chosen', { simulated: true, now: 1000 });
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer', false, room);
  const target = testApi.createPlayer('target', 'Target', 'moss-warden', false, room);
  const bonk = {
    id: 'chosen-bonk',
    instanceId: 'bonk-rare',
    name: 'Chosen Bonk',
    kind: 'bonk',
    rarity: 'rare',
    targetMode: 'chosen',
    stunSeconds: 6,
    icon: '!',
    text: 'Choose any rival.'
  };

  attacker.hand = [bonk];
  target.nextMoveAt = room.now;
  room.status = 'running';
  room.players.attacker = attacker;
  room.players.target = target;

  assert.equal(testApi.playBonk(room, attacker, bonk.instanceId, target.id), true);
  const lockedPosition = target.position;

  testApi.runRoomStep(room, { advanceMs: 3000 });

  assert.equal(target.position, lockedPosition);
  assert.equal(target.stunnedBy, attacker.id);

  testApi.runRoomStep(room, { advanceMs: 3200 });

  assert.equal(target.stunnedUntil, null);
  assert.notEqual(target.position, lockedPosition);
});

test('bonks against combat-locked players land after combat resolves', () => {
  room = testApi.createRoom('bonk-after-combat', { simulated: true, now: 1000 });
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer', false, room);
  const target = testApi.createPlayer('target', 'Target', 'moss-warden', false, room);
  const bonk = {
    id: 'chosen-bonk',
    instanceId: 'bonk-combat',
    name: 'Chosen Bonk',
    kind: 'bonk',
    rarity: 'rare',
    targetMode: 'chosen',
    stunSeconds: 6,
    icon: '!',
    text: 'Choose any rival.'
  };

  attacker.hand = [bonk];
  target.nextMoveAt = room.now;
  target.combat = { expiresAt: 3500 };
  room.status = 'running';
  room.players.attacker = attacker;
  room.players.target = target;

  assert.equal(testApi.playBonk(room, attacker, bonk.instanceId, target.id), true);
  assert.equal(target.stunnedUntil, null);
  assert.equal(target.pendingBonks.length, 1);

  testApi.runRoomStep(room, { advanceMs: 1000 });

  assert.equal(target.combat.expiresAt, 3500);
  assert.equal(target.stunnedUntil, null);

  testApi.runRoomStep(room, { advanceMs: 1600 });

  assert.equal(target.combat, null);
  assert.equal(target.pendingBonks.length, 0);
  assert.equal(target.stunnedBy, attacker.id);
  assert.equal(target.stunnedUntil, 9600);
  assert.equal(target.position, 0);
});

test('rare bonk cards require a valid rival target', () => {
  const attacker = testApi.createPlayer('attacker', 'Attacker', 'rune-archer');
  const bonk = {
    id: 'chosen-bonk',
    instanceId: 'bonk-invalid',
    name: 'Chosen Bonk',
    kind: 'bonk',
    rarity: 'rare',
    targetMode: 'chosen',
    stunSeconds: 6,
    icon: '!',
    text: 'Choose any rival.'
  };

  attacker.hand = [bonk];
  room.players.attacker = attacker;

  assert.equal(testApi.playBonk(room, attacker, bonk.instanceId), false);
  assert.equal(attacker.hand.length, 1);
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

test('personal shops hold five offers, rotate over time, and sell into buyable stock', () => {
  room = testApi.createRoom('shop-room', { simulated: true, now: 10_000 });
  const player = testApi.createPlayer('shopper', 'Shopper', 'night-vagrant', false, room);
  room.players.shopper = player;

  assert.equal(player.shop.offers.length, testApi.shopSize);
  assert.equal(player.shop.rotatesAt, 10_000 + testApi.shopRotationMs);

  const firstOfferIds = player.shop.offers.map((offer) => offer.id);
  room.status = 'running';
  testApi.runRoomStep(room, { advanceMs: testApi.shopRotationMs + 1 });

  assert.equal(player.shop.offers.length, testApi.shopSize);
  assert.notDeepEqual(player.shop.offers.map((offer) => offer.id), firstOfferIds);

  const card = {
    id: 'tax',
    instanceId: 'tax-sale',
    name: 'Tithe Trap',
    kind: 'rival',
    icon: '$',
    text: 'Steals tempo.'
  };
  player.hand = [card];
  const saleGold = player.gold;

  assert.equal(testApi.sellCard(room, player, card.instanceId), true);
  assert.ok(player.gold > saleGold);
  player.gold += 200;

  const offer = player.shop.offers.find((item) => item.price <= player.gold);
  assert.ok(offer);
  const goldBeforeBuy = player.gold;
  const handBeforeBuy = player.hand.length;
  const lootBeforeBuy = player.loot.length;

  assert.equal(testApi.buyShopOffer(room, player, offer.id), true);
  assert.equal(player.gold, goldBeforeBuy - offer.price);
  assert.equal(player.shop.offers.some((item) => item.id === offer.id), false);
  if (offer.kind === 'card') assert.equal(player.hand.length, handBeforeBuy + 1);
  else assert.equal(player.loot.length, lootBeforeBuy + 1);
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

test('host starts rooms explicitly after lobby setup', () => {
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.addBot(room);

  assert.equal(testApi.roomSnapshot(room).status, 'lobby');
  assert.equal(testApi.startRoom(room), true);
  assert.equal(testApi.roomSnapshot(room).status, 'running');
  assert.equal(testApi.startRoom(room), false);
  assert.match(room.log[0], /started the loop/);
});

test('lobby setup blocks match actions until the host starts', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  const card = player.hand.find((item) => item.kind === 'terrain');

  testApi.playTerrain(room, player, card.instanceId, 2);
  assert.equal(player.hand.some((item) => item.instanceId === card.instanceId), true);
  assert.equal(player.board[2].type, 'road');

  testApi.startRoom(room);
  testApi.playTerrain(room, player, card.instanceId, 2);
  assert.equal(player.hand.some((item) => item.instanceId === card.instanceId), false);
  assert.equal(player.board[2].type, card.tile);
});

test('room settings are lobby-only and constrain seats and boss score', () => {
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });

  assert.equal(testApi.updateRoomSettings(room, { maxPlayers: 2, goalScore: 7200, pace: 'quick' }), true);
  assert.deepEqual(testApi.roomSnapshot(room).settings, { maxPlayers: 2, goalScore: 7200, pace: 'quick' });
  assert.equal(testApi.roomSnapshot(room).maxPlayers, 2);
  assert.equal(testApi.roomSnapshot(room).goalScore, 7200);

  testApi.joinRoom(room, { playerId: 'guest', name: 'Guest', heroId: 'night-vagrant' });
  assert.equal(testApi.hasRoomForPlayer(room), false);
  assert.equal(testApi.updateRoomSettings(room, { maxPlayers: 1 }), false);
  assert.equal(testApi.roomSnapshot(room).settings.maxPlayers, 2);

  testApi.startRoom(room);
  assert.equal(testApi.updateRoomSettings(room, { goalScore: 9600 }), false);
  assert.equal(testApi.roomSnapshot(room).goalScore, 7200);
});

test('room settings survive reset and persistence restore', () => {
  testApi.updateRoomSettings(room, { maxPlayers: 3, goalScore: 9600, pace: 'marathon' });
  testApi.resetRoom(room);

  assert.deepEqual(testApi.roomSnapshot(room).settings, { maxPlayers: 3, goalScore: 9600, pace: 'marathon' });

  const restored = testApi.restoreRoom(testApi.serializeRoom(room), { now: room.now + 1000 });
  assert.deepEqual(testApi.roomSnapshot(restored).settings, { maxPlayers: 3, goalScore: 9600, pace: 'marathon' });
});

test('host controls can remove non-host runners without losing room order', () => {
  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.joinRoom(room, { playerId: 'guest', name: 'Guest', heroId: 'night-vagrant' });
  const bot = testApi.addBot(room);

  assert.equal(testApi.kickPlayer(room, 'host'), false);
  assert.equal(testApi.kickPlayer(room, bot.id), true);
  assert.equal(testApi.kickPlayer(room, 'guest'), true);

  const snapshot = testApi.roomSnapshot(room);
  assert.deepEqual(snapshot.players.map((player) => player.id), ['host']);
  assert.equal(snapshot.hostId, 'host');
  assert.equal(testApi.activePlayerCount(room), 1);
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

test('room persistence snapshots restore active match state for token reconnects', () => {
  const firstJoin = testApi.joinRoom(room, { playerId: 'alpha-token', name: 'Alpha', heroId: 'ember-knight' });
  testApi.addBot(room);
  firstJoin.player.level = 4;
  firstJoin.player.laps = 2;
  firstJoin.player.connected = true;
  room.tick = 42;

  const snapshot = testApi.serializeRoom(room, { savedAt: 1234 });
  const restored = testApi.restoreRoom(snapshot, { now: 9000, markDisconnected: true });

  assert.equal(restored.id, room.id);
  assert.equal(restored.tick, 42);
  assert.equal(restored.players['alpha-token'].level, 4);
  assert.equal(restored.players['alpha-token'].laps, 2);
  assert.equal(restored.players['alpha-token'].connected, false);
  assert.equal(testApi.activePlayerCount(restored), 2);

  const reconnect = testApi.joinRoom(restored, { playerId: 'alpha-token', name: 'Alpha Again', heroId: 'grave-singer' });
  assert.equal(reconnect.created, false);
  assert.equal(reconnect.player.connected, true);
  assert.equal(reconnect.player.heroId, 'ember-knight');
  assert.equal(testApi.activePlayerCount(restored), 2);
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

test('placed terrain expires after its loop lifetime', () => {
  const player = testApi.createPlayer('shaper', 'Shaper', 'moss-warden');
  const card = {
    id: 'grove',
    instanceId: 'grove-expiry',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: '+XP fights.'
  };
  player.hand = [card];
  room.players.shaper = player;
  room.status = 'running';

  testApi.playTerrain(room, player, card.instanceId, 2);

  assert.equal(player.board[2].type, 'grove');
  assert.equal(player.board[2].expiresOnLap, 3);

  player.position = 15;
  player.laps = 2;
  player.nextMoveAt = room.now;
  testApi.runRoomStep(room, { advanceMs: 1 });

  assert.equal(player.laps, 3);
  assert.equal(player.board[2].type, 'road');
  assert.equal(player.board[2].expiresOnLap, undefined);
});

test('tier progression resets the player board and increases loop tier', () => {
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  const rival = testApi.createPlayer('rival', 'Rival', 'ember-knight');
  room.players.leader = player;
  room.players.rival = rival;
  room.status = 'running';
  player.level = 5;
  player.board[4].type = 'crypt';

  testApi.checkWinner(room);

  assert.equal(player.loopTier, 2);
  assert.equal(player.position, 0);
  assert.equal(player.board.every((tile, index) => tile.type === (index === 0 ? 'camp' : 'road')), true);
  assert.equal(testApi.roomSnapshot(room).tier.id, 2);
});

test('solo score gates require a gate boss before tier promotion', () => {
  const player = testApi.createPlayer('solo', 'Solo', 'ember-knight');
  room.players.solo = player;
  room.status = 'running';
  player.level = 5;
  player.maxHp = 90;
  player.hp = 90;
  player.power = 28;
  player.guard = 30;

  testApi.checkWinner(room);

  assert.equal(player.soloGatesCleared.includes(1), true);
  assert.equal(player.loopTier, 2);
  assert.equal(player.position, 0);
  assert.equal(player.board.every((tile, index) => tile.type === (index === 0 ? 'camp' : 'road')), true);
  assert.ok(player.soloCorruption >= 4);
});

test('solo gate failure adds corruption and score debt instead of brute-force promotion', () => {
  const player = testApi.createPlayer('solo', 'Solo', 'night-vagrant');
  room.players.solo = player;
  room.status = 'running';
  player.level = 5;
  player.maxHp = 12;
  player.hp = 12;
  player.power = 4;
  player.guard = 0;
  player.gold = 80;

  testApi.checkWinner(room);

  assert.equal(player.loopTier, 1);
  assert.equal(player.deaths, 1);
  assert.ok(player.soloCorruption > 0);
  assert.ok(player.scorePenalty > 0);
  assert.ok(player.gold < 80);
  assert.equal(testApi.score(player) < testApi.matchTiers[1].minScore, true);
});

test('reaching the final score in tier three culminates in a boss fight', () => {
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  room.players.leader = player;
  room.status = 'running';
  player.level = Math.ceil(testApi.goalScore / 390);
  player.maxHp = 220;
  player.hp = 220;
  player.power = 50;
  player.guard = 80;

  assert.equal(testApi.checkWinner(room), null);
  assert.equal(player.loopTier, 3);
  assert.equal(player.combat, null);

  player.laps = player.tierStartLap + 1;
  const winner = testApi.checkWinner(room);
  const snapshot = testApi.roomSnapshot(room);

  assert.equal(player.loopTier, 3);
  assert.equal(snapshot.claim, null);
  assert.equal(snapshot.tier.id, 3);
  assert.equal(player.combat.enemyName, 'The Loop Tyrant');
  assert.equal(winner?.id ?? snapshot.winnerId, player.id);
});

test('death restarts the current tier board without ending the game', () => {
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  room.players.leader = player;
  room.status = 'running';
  player.loopTier = 3;
  player.position = 7;
  player.board[4].type = 'crypt';
  player.hp = 0;

  testApi.checkWinner(room);
  testApi.triggerTile(room, player, player.board[player.position]);
  const snapshot = testApi.roomSnapshot(room);

  assert.equal(player.deaths, 1);
  assert.equal(player.loopTier, 3);
  assert.equal(player.position, 0);
  assert.equal(player.board[4].type, 'road');
  assert.equal(snapshot.status, 'running');
});

test('progressive combat pressure punishes stale heroes and rewards stat growth', () => {
  const early = testApi.createPlayer('early', 'Early', 'ember-knight', false, room);
  const late = testApi.createPlayer('late', 'Late', 'ember-knight', false, room);
  early.loopTier = 1;
  late.loopTier = 3;

  testApi.fight(room, early, 'wolf grove', 8, 10, 1);
  testApi.fight(room, late, 'wolf grove', 8, 10, 1);

  assert.ok(late.combat.damage >= early.combat.damage + 8);

  const stale = testApi.createPlayer('stale', 'Stale', 'ember-knight', false, room);
  stale.loopTier = 3;
  stale.hp = stale.maxHp;

  assert.equal(testApi.fight(room, stale, 'wyrm gate', 23, 0, 3), true);
  assert.equal(testApi.fight(room, stale, 'wyrm gate', 23, 0, 3), false);

  const grown = testApi.createPlayer('grown', 'Grown', 'ember-knight', false, room);
  grown.loopTier = 3;
  grown.level = 8;
  grown.maxHp += 32;
  grown.hp = grown.maxHp;
  grown.guard += 8;
  grown.power += 5;

  assert.equal(testApi.fight(room, grown, 'wyrm gate', 23, 0, 3), true);
  assert.equal(testApi.fight(room, grown, 'wyrm gate', 23, 0, 3), true);
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

test('tier three marks the leader before the boss race', () => {
  const player = testApi.createPlayer('solo', 'Solo', 'ember-knight');
  const rival = testApi.createPlayer('rival', 'Rival', 'moss-warden');
  room.players.solo = player;
  room.players.rival = rival;
  room.status = 'running';
  player.level = 12;

  testApi.checkWinner(room);

  assert.equal(player.loopTier, 3);
  assert.equal(testApi.roomSnapshot(room).tier.id, 3);
  assert.equal(player.marked, true);
});

test('passive solo runner stalls short of a finished clear', () => {
  room = testApi.createRoom('passive-solo', { simulated: true, now: 0, seed: 123 });
  const player = testApi.createPlayer('solo', 'Solo', 'night-vagrant', false, room);
  room.players.solo = player;
  room.status = 'running';

  for (let step = 0; step < 5200 && room.status !== 'finished'; step += 1) {
    testApi.runRoomStep(room, { advanceMs: 260 });
  }

  assert.equal(room.status, 'running');
  assert.ok(player.soloCorruption > 0);
  assert.ok(player.deaths > 0);
  assert.ok(player.loopTier < 3 || testApi.score(player) < testApi.goalScore);
});

test('active solo bot can clear when it builds and equips a run', () => {
  const result = simulateMatch(11, {
    roster: [{ id: 'night-vagrant', name: 'Night Vagrant' }],
    maxSteps: 9000
  });

  assert.equal(result.finished, true);
  assert.equal(result.players[0].loopTier, 3);
  assert.ok(result.players[0].tilesPlaced > 0);
  assert.ok(result.players[0].power + result.players[0].guard > 35);
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
  const report = runBalanceSuite(120);
  const rates = report.heroes.map((hero) => hero.winRate);

  assert.ok(report.finishedRate >= 0.95);
  assert.ok(report.avgSeconds >= 250 && report.avgSeconds <= 1000);
  assert.ok(Math.max(...rates) <= 0.36);
  assert.ok(Math.min(...rates) >= 0.08);
  assert.ok(report.winRateSpread <= 0.28);
  assert.ok(report.avgScoreSpread <= 900);
});
