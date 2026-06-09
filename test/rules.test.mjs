import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { terrainCards, testApi } from '../server/rules.mjs';
import { runBalanceSuite, simulateMatch } from '../scripts/balance-sim.mjs';

let room;

beforeEach(() => {
  room = testApi.createRoom('test');
});

const bossLoopTileTypes = new Set([
  'rootwall',
  'bramblebloom',
  'wardensheart',
  'oldgrowth',
  'guardstance',
  'markedchallenge',
  'retaliation',
  'executionstance',
  'seal1',
  'seal2',
  'seal3',
  'innergate'
]);

function clearBossPhase(room, player) {
  while (player.bossPhase) {
    const phaseId = player.bossPhase.id;
    const tile = player.board.find((item) => item.bossPhaseId === phaseId && bossLoopTileTypes.has(item.type));
    assert.ok(tile, 'boss phase should expose an uncleared boss tile');
    player.position = tile.index;
    player.nextMoveAt = Number.POSITIVE_INFINITY;
    testApi.triggerTile(room, player, tile);
    assert.ok(player.combat || player.pendingBossOutcome, 'boss tile should create a visible combat outcome');
    if (player.combat) {
      room.now = player.combat.expiresAt;
      testApi.runRoomStep(room, { advanceMs: 0 });
    } else {
      testApi.checkWinner(room);
    }
  }
}

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

test('oblivion purges one owned non-camp tile back to road', () => {
  room.status = 'running';
  const player = testApi.createPlayer('purger', 'Purger', 'night-vagrant');
  const oblivion = {
    id: 'oblivion',
    instanceId: 'oblivion-owned',
    name: 'Oblivion',
    kind: 'rival',
    icon: 'O',
    text: 'Purge one of your non-camp tiles back to road.'
  };
  player.hand = [oblivion];
  player.board[4].type = 'bloomgrove';
  player.board[4].expiresOnLap = 3;
  player.board[4].charges = 1;
  room.players[player.id] = player;

  assert.equal(testApi.playRival(room, player, oblivion.instanceId, player.id, 4), true);

  assert.equal(player.board[4].type, 'road');
  assert.equal(player.board[4].charges, 0);
  assert.equal(player.board[4].expiresOnLap, undefined);
  assert.equal(player.hand.length, 0);
  assert.equal(player.event, 'purged tile 4 to road');

  const events = testApi.drainRoomEvents(room);
  assert.equal(events.some((event) => event.type === 'cardPlayed' && event.payload.cardId === 'oblivion'), true);
  assert.equal(events.some((event) => (
    event.type === 'tileChanged' &&
    event.payload.cause === 'purgeCard' &&
    event.payload.previousType === 'bloomgrove' &&
    event.payload.tile.type === 'road'
  )), true);
});

test('oblivion only targets owned non-road non-boss tiles', () => {
  room.status = 'running';
  const player = testApi.createPlayer('purger', 'Purger', 'night-vagrant');
  const rival = testApi.createPlayer('rival', 'Rival', 'ember-knight');
  const card = (instanceId) => ({
    id: 'oblivion',
    instanceId,
    name: 'Oblivion',
    kind: 'rival',
    icon: 'O',
    text: 'Purge one of your non-camp tiles back to road.'
  });
  room.players[player.id] = player;
  room.players[rival.id] = rival;
  rival.board[4].type = 'grove';
  player.board[4].type = 'road';
  player.board[5].type = 'camp';
  player.board[6].type = 'rootwall';

  player.hand = [card('oblivion-rival')];
  assert.equal(testApi.playRival(room, player, 'oblivion-rival', rival.id, 4), false);
  assert.equal(rival.board[4].type, 'grove');
  assert.equal(player.hand.length, 1);

  player.hand = [card('oblivion-road')];
  assert.equal(testApi.playRival(room, player, 'oblivion-road', player.id, 4), false);
  assert.equal(player.hand.length, 1);

  player.hand = [card('oblivion-camp')];
  assert.equal(testApi.playRival(room, player, 'oblivion-camp', player.id, 5), false);
  assert.equal(player.hand.length, 1);

  player.hand = [card('oblivion-boss')];
  assert.equal(testApi.playRival(room, player, 'oblivion-boss', player.id, 6), false);
  assert.equal(player.board[6].type, 'rootwall');
  assert.equal(player.hand.length, 1);
});

test('snapshots expose visible movement stop semantics for loop tiles', () => {
  const player = testApi.createPlayer('runner', 'Runner', 'ember-knight');
  player.board[1].type = 'road';
  player.board[2].type = 'grove';
  player.board[3].type = 'obelisk';
  player.board[4].type = 'meadow';
  room.players.runner = player;

  const tiles = testApi.roomSnapshot(room).players[0].board;

  assert.equal(tiles[1].movementStopKind, 'none');
  assert.equal(tiles[2].movementStopKind, 'combat');
  assert.equal(tiles[2].movementStopReason, 'combat');
  assert.equal(tiles[3].movementStopKind, 'none');
  assert.equal(tiles[4].movementStopKind, 'none');
});

test('plain road is a known pass-through tile, not hidden random combat', () => {
  const player = testApi.createPlayer('runner', 'Runner', 'ember-knight');
  player.position = 1;
  player.board[1].type = 'road';
  room.players.runner = player;

  for (let index = 0; index < 20; index += 1) {
    player.combat = null;
    testApi.triggerTile(room, player, player.board[1]);
    assert.equal(player.combat, null);
  }
});

test('deterministic combat tiles advertise the same stop kind that triggerTile uses', () => {
  const player = testApi.createPlayer('runner', 'Runner', 'ember-knight');
  player.position = 2;
  player.board[2].type = 'grove';
  room.players.runner = player;

  const tile = testApi.roomSnapshot(room).players[0].board[2];
  assert.equal(tile.movementStopKind, 'combat');

  testApi.triggerTile(room, player, player.board[2]);

  assert.ok(player.combat);
});

test('terrain deck has a broad set of unique board tiles', () => {
  assert.ok(terrainCards.length >= 26);
  assert.equal(new Set(terrainCards.map((card) => card.id)).size, terrainCards.length);
  assert.equal(new Set(terrainCards.map((card) => card.tile)).size, terrainCards.length);
  assert.ok(terrainCards.every((card) => card.kind === 'terrain'));
});

test('adjacent terrain combos change full tile identities after placement', () => {
  const player = testApi.createPlayer('combo', 'Combo', 'ember-knight');
  room.players.combo = player;
  room.status = 'running';
  player.position = 0;
  player.hand = [
    { id: 'meadow', instanceId: 'meadow-combo', name: 'Meadow', kind: 'terrain', tile: 'meadow', icon: '*', text: 'Heal.' },
    { id: 'village', instanceId: 'village-combo', name: 'Village', kind: 'terrain', tile: 'village', icon: 'H', text: 'Rest.' },
    { id: 'wyrm-gate', instanceId: 'gate-combo', name: 'Wyrm Gate', kind: 'terrain', tile: 'wyrmgate', icon: 'G', text: 'Gate.' }
  ];
  player.board[5].type = 'grove';
  player.board[7].type = 'crypt';
  player.board[9].type = 'forge';

  assert.equal(testApi.playTerrain(room, player, 'meadow-combo', 4), true);
  assert.equal(testApi.playTerrain(room, player, 'village-combo', 6), true);
  assert.equal(testApi.playTerrain(room, player, 'gate-combo', 10), true);

  assert.equal(player.board[5].type, 'bloomgrove');
  assert.equal(player.board[6].type, 'ransackedvillage');
  assert.equal(player.board[10].type, 'embergate');
  assert.equal(player.board[5].expiresOnLap, player.board[4].expiresOnLap);
  assert.equal(player.board[6].expiresOnLap, player.laps + 3);

  const events = testApi.drainRoomEvents(room).filter((event) => event.type === 'tileChanged' && event.payload.cause === 'tileCombo');
  assert.deepEqual(events.map((event) => event.payload.comboId), ['meadow-grove', 'village-crypt', 'forge-wyrmgate']);
  assert.deepEqual(events.map((event) => event.payload.tile.type), ['bloomgrove', 'ransackedvillage', 'embergate']);

  const snapshotTiles = testApi.roomSnapshot(room).players[0].board;
  assert.equal(snapshotTiles[5].movementStopKind, 'combat');
  assert.equal(snapshotTiles[6].movementStopKind, 'combat');
  assert.equal(snapshotTiles[10].movementStopKind, 'combat');
});

test('combo terrain resolves through distinct combat behaviors', () => {
  const player = testApi.createPlayer('combo-fighter', 'Combo Fighter', 'ember-knight');
  room.players[player.id] = player;
  room.status = 'running';
  player.maxHp = 180;
  player.hp = 150;
  player.power = 60;
  player.guard = 90;

  player.position = 2;
  player.board[2].type = 'bloomgrove';
  testApi.triggerTile(room, player, player.board[2]);
  assert.equal(player.combat.label, 'bloom grove');
  assert.equal(player.armor, 1);
  assert.ok(player.hp > player.combat.heroHpAfter);

  player.combat = null;
  player.position = 3;
  player.board[3].type = 'ransackedvillage';
  testApi.triggerTile(room, player, player.board[3]);
  assert.equal(player.combat.label, 'ransacked village');
  assert.ok(player.gold > 0);

  player.combat = null;
  player.position = 4;
  player.board[4].type = 'embergate';
  testApi.triggerTile(room, player, player.board[4]);
  assert.equal(player.combat.label, 'ember gate');
  assert.ok(player.combat.reward >= 48);
});

test('new combat terrain advertises and resolves combat stops', () => {
  for (const tileType of ['spidernest', 'tollgate', 'thornmaze', 'graveyard', 'dragonroost']) {
    const player = testApi.createPlayer(`runner-${tileType}`, 'Runner', 'ember-knight');
    player.position = 2;
    player.hp = player.maxHp = 120;
    player.board[2].type = tileType;
    room.players[player.id] = player;

    const tile = testApi.roomSnapshot(room).players.find((item) => item.id === player.id).board[2];
    assert.equal(tile.movementStopKind, 'combat', `${tileType} should stop for combat`);

    testApi.triggerTile(room, player, player.board[2]);
    assert.ok(player.combat, `${tileType} should start combat`);
  }
});

test('new utility terrain creates distinct noncombat payoffs', () => {
  const player = testApi.createPlayer('utility', 'Utility', 'moss-warden');
  room.players.utility = player;

  player.position = 2;
  player.hp = 20;
  player.curse = 3;
  player.board[2].type = 'chapel';
  testApi.triggerTile(room, player, player.board[2]);
  assert.equal(player.combat, null);
  assert.ok(player.hp > 20);
  assert.equal(player.curse, 1);

  player.position = 3;
  player.hand = [];
  player.board[3].type = 'scriptorium';
  testApi.triggerTile(room, player, player.board[3]);
  assert.equal(player.combat, null);
  assert.equal(player.hand.length, 1);
  assert.equal(player.hand[0].kind, 'terrain');
  assert.equal(player.curse, 2);

  player.position = 4;
  player.gold = 0;
  player.board[4].type = 'market';
  testApi.triggerTile(room, player, player.board[4]);
  assert.equal(player.combat, null);
  assert.ok(player.gold > 0);
  assert.ok(player.shop?.offers.length > 0);
});

test('obelisk is deterministic utility and never rolls hidden combat', () => {
  const player = testApi.createPlayer('runner', 'Runner', 'ember-knight');
  player.position = 3;
  player.board[3].type = 'obelisk';
  room.players.runner = player;

  const tile = testApi.roomSnapshot(room).players[0].board[3];
  assert.equal(tile.movementStopKind, 'none');

  for (let index = 0; index < 20; index += 1) {
    player.combat = null;
    const lootCount = player.loot.length;
    testApi.triggerTile(room, player, player.board[3]);
    assert.equal(player.combat, null);
    assert.equal(player.event, 'obelisk surge: power in the stones');
    assert.ok(player.loot.length >= lootCount);
  }
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

  const offer = player.shop.offers.find((item) => item.kind !== 'potion' && item.price <= player.gold);
  assert.ok(offer);
  const goldBeforeBuy = player.gold;
  const handBeforeBuy = player.hand.length;
  const lootBeforeBuy = player.loot.length;

  assert.equal(testApi.buyShopOffer(room, player, offer.id), true);
  assert.equal(player.gold, goldBeforeBuy - offer.price);
  assert.equal(player.shop.offers.some((item) => item.id === offer.id), false);
  if (offer.kind === 'card') assert.equal(player.hand.length, handBeforeBuy + 1);
  else if (offer.kind === 'loot') assert.equal(player.loot.length, lootBeforeBuy + 1);
});

test('shop health potion restores health immediately', () => {
  room = testApi.createRoom('shop-potion-room', { simulated: true, now: 10_000 });
  const player = testApi.createPlayer('potion-shopper', 'Potion Shopper', 'ember-knight', false, room);
  room.players[player.id] = player;
  room.status = 'running';
  player.gold = 80;
  player.hp = player.maxHp - 11;

  const potion = player.shop.offers.find((offer) => offer.kind === 'potion');
  assert.ok(potion);
  assert.equal(testApi.buyShopOffer(room, player, potion.id), true);
  assert.equal(player.hp, player.maxHp);
  assert.equal(player.gold, 80 - potion.price);
});

test('hero abilities use loop cooldowns and expose ready state in snapshots', () => {
  room = testApi.createRoom('ability-room', { simulated: true, now: 10_000 });
  room.status = 'running';
  const player = testApi.createPlayer('ember', 'Ember', 'ember-knight', false, room);
  room.players.ember = player;
  player.hp = 20;
  player.loopTier = 2;

  assert.equal(testApi.activateHeroAbility(room, player), true);
  assert.ok(player.heroHeat > 0);
  assert.ok(player.armor > 0);
  assert.equal(player.abilityReadyLap, player.laps + 2);

  let snapshotPlayer = testApi.roomSnapshot(room).players.find((item) => item.id === player.id);
  assert.equal(snapshotPlayer.ability.ready, false);
  assert.equal(snapshotPlayer.ability.remainingLoops, 2);

  assert.equal(testApi.activateHeroAbility(room, player), false);
  player.laps = player.abilityReadyLap;

  snapshotPlayer = testApi.roomSnapshot(room).players.find((item) => item.id === player.id);
  assert.equal(snapshotPlayer.ability.ready, true);
  assert.equal(testApi.activateHeroAbility(room, player), true);
});

test('board-shaping hero abilities change future tiles authoritatively', () => {
  room = testApi.createRoom('moss-ability-room', { simulated: true, now: 10_000 });
  room.status = 'running';
  const player = testApi.createPlayer('moss', 'Moss', 'moss-warden', false, room);
  room.players.moss = player;
  player.position = 4;
  player.loopTier = 3;
  const targetIndex = 5;

  assert.equal(player.board[targetIndex].type, 'road');
  assert.equal(testApi.activateHeroAbility(room, player), true);
  assert.equal(player.board[targetIndex].type, 'village');
  assert.ok(player.board[targetIndex].expiresOnLap > player.laps);
  assert.equal(testApi.drainRoomEvents(room).some((event) => event.type === 'tileChanged' && event.payload.tileIndex === targetIndex), true);
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

  assert.equal(player.combat.enemyId, 'crypt-skeleton');
  assert.equal(player.combat.enemyName, 'Crypt Skeleton');
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
  assert.ok(player.combat.beats.every((beat) => beat.text));
  assert.ok(player.combat.beats.every((beat) => Number.isInteger(beat.enemyIndex)));
  assert.ok(player.combat.beats.every((beat) => beat.enemyIndex >= 0 && beat.enemyIndex < player.combat.enemyCount));
  assert.ok(new Set(player.combat.beats.filter((beat) => beat.attacker === 'enemy').map((beat) => beat.enemyIndex)).size > 1);
  assert.equal(player.combat.durationMs, 410 + player.combat.beats.length * 339);
  assert.equal(player.combat.beats[0].atMs, 262);
  assert.equal(player.combat.beats[1].atMs - player.combat.beats[0].atMs, 339);
  assert.equal(player.combat.enemyName, 'Skeleton Pit');
  assert.equal(player.combat.enemyId, 'crypt-skeleton');
  assert.equal(player.combat.enemyIds.length, player.combat.enemyCount);
  assert.ok(player.combat.enemyIds.includes('crypt-wraith'));
  assert.equal(player.combat.enemyNames[0], 'Crypt Skeleton');
});

test('combat roster replaces basic enemies with elites as loop pressure rises', () => {
  const fresh = testApi.createPlayer('fresh', 'Fresh', 'ember-knight', false, room);
  testApi.fight(room, fresh, 'wolf grove', 8, 10, 1);

  assert.equal(fresh.combat.label, 'rat grove');
  assert.equal(fresh.combat.enemyId, 'plague-rat');
  assert.ok(fresh.combat.damage <= 5);

  const practiced = testApi.createPlayer('practiced', 'Practiced', 'ember-knight', false, room);
  practiced.laps = 2;
  testApi.fight(room, practiced, 'wolf grove', 8, 10, 1);

  assert.equal(practiced.combat.label, 'wolf grove');
  assert.equal(practiced.combat.enemyId, 'dusk-wolf');
  assert.ok(practiced.combat.damage >= fresh.combat.damage);

  const veteran = testApi.createPlayer('veteran', 'Veteran', 'ember-knight', false, room);
  veteran.loopTier = 2;
  veteran.tierStartLap = 4;
  testApi.fight(room, veteran, 'wolf grove', 8, 10, 1);

  assert.equal(veteran.combat.label, 'thorn grove');
  assert.equal(veteran.combat.enemyId, 'thorn-wolf');
  assert.ok(veteran.combat.damage > practiced.combat.damage);

  const dyingLoop = testApi.createPlayer('dying-loop', 'Dying Loop', 'ember-knight', false, room);
  dyingLoop.loopTier = 3;
  dyingLoop.tierStartLap = 9;
  testApi.fight(room, dyingLoop, 'ruined keep', 18, 24, 3);

  assert.equal(dyingLoop.combat.label, 'ruined keep');
  assert.equal(dyingLoop.combat.enemyId, 'keep-reaver');
  assert.ok(dyingLoop.combat.enemyIds.includes('grave-knight'));
});

test('combat pressure advances in readable loop bands inside each tier', () => {
  const opening = testApi.createPlayer('opening', 'Opening', 'ember-knight', false, room);
  opening.laps = 0;
  testApi.fight(room, opening, 'ruined keep', 18, 24, 2);

  assert.equal(opening.combat.label, 'bandit camp');
  assert.equal(opening.combat.enemyId, 'road-bandit');
  assert.ok(opening.combat.damage <= 20);

  const tierOneLate = testApi.createPlayer('tier-one-late', 'Tier One Late', 'ember-knight', false, room);
  tierOneLate.laps = 3;
  testApi.fight(room, tierOneLate, 'ruined keep', 18, 24, 2);

  assert.equal(tierOneLate.combat.label, 'goblin camp');
  assert.equal(tierOneLate.combat.enemyId, 'goblin-cutthroat');
  assert.ok(tierOneLate.combat.damage > opening.combat.damage);

  const tierTwoEarly = testApi.createPlayer('tier-two-early', 'Tier Two Early', 'ember-knight', false, room);
  tierTwoEarly.loopTier = 2;
  tierTwoEarly.tierStartLap = 4;
  tierTwoEarly.laps = 4;
  testApi.fight(room, tierTwoEarly, 'ruined keep', 18, 24, 2);

  assert.equal(tierTwoEarly.combat.label, 'brigand keep');
  assert.equal(tierTwoEarly.combat.enemyId, 'brigand');

  const tierTwoLate = testApi.createPlayer('tier-two-late', 'Tier Two Late', 'ember-knight', false, room);
  tierTwoLate.loopTier = 2;
  tierTwoLate.tierStartLap = 4;
  tierTwoLate.laps = 7;
  testApi.fight(room, tierTwoLate, 'ruined keep', 18, 24, 2);

  assert.equal(tierTwoLate.combat.label, 'ruined keep');
  assert.equal(tierTwoLate.combat.enemyId, 'keep-reaver');
  assert.ok(tierTwoLate.combat.damage > tierTwoEarly.combat.damage);

  const tierThreeEarly = testApi.createPlayer('tier-three-early', 'Tier Three Early', 'ember-knight', false, room);
  tierThreeEarly.loopTier = 3;
  tierThreeEarly.tierStartLap = 9;
  tierThreeEarly.laps = 9;
  testApi.fight(room, tierThreeEarly, 'ruined keep', 18, 24, 2);

  const tierThreeLate = testApi.createPlayer('tier-three-late', 'Tier Three Late', 'ember-knight', false, room);
  tierThreeLate.loopTier = 3;
  tierThreeLate.tierStartLap = 9;
  tierThreeLate.laps = 10;
  testApi.fight(room, tierThreeLate, 'ruined keep', 18, 24, 2);

  assert.equal(tierThreeLate.combat.label, 'ruined keep');
  assert.ok(tierThreeLate.combat.damage > tierThreeEarly.combat.damage);
});

test('moss warden deep path adds finish power instead of more safety', () => {
  const player = testApi.createPlayer('moss-finisher', 'Moss Finisher', 'moss-warden');
  const startingPower = player.power;
  const startingGuard = player.guard;
  const path = ['warden-root', 'path-sower', 'briar-compass', 'wild-cartographer'];

  for (const traitId of path) {
    player.talentPoints = 1;
    assert.equal(testApi.chooseTrait(player, traitId), true);
  }

  assert.equal(player.power, startingPower + 2);
  assert.equal(player.guard, startingGuard);
  assert.ok(player.terrainScore > 6);
});

test('moss warden overgrowth converts into late combat power', () => {
  const plain = testApi.createPlayer('plain-moss', 'Plain Moss', 'moss-warden', false, room);
  plain.loopTier = 3;
  plain.tierStartLap = 9;
  plain.laps = 10;
  plain.level = 8;
  testApi.fight(room, plain, 'ruined keep', 18, 24, 2);

  const grown = testApi.createPlayer('grown-moss', 'Grown Moss', 'moss-warden', false, room);
  grown.loopTier = 3;
  grown.tierStartLap = 9;
  grown.laps = 10;
  grown.level = 8;
  grown.wardenOvergrowth = 5;
  testApi.fight(room, grown, 'ruined keep', 18, 24, 2);

  assert.ok(grown.combat.rounds <= plain.combat.rounds);
  assert.ok(grown.combat.power >= plain.combat.power + 3);
});

test('night vagrant vanish pays score and tempo when it prevents lethal combat', () => {
  const player = testApi.createPlayer('vanish-cost', 'Vanish Cost', 'night-vagrant', false, room);
  player.loopTier = 2;
  player.hp = 3;
  player.gold = 40;

  const survived = testApi.fight(room, player, 'ruined keep', 24, 24, 3);

  assert.equal(survived, true);
  assert.ok(player.hp > 0);
  assert.equal(player.vagrantEscapeTier, 2);
  assert.match(player.event, /vanished at 1 hp/);
  assert.ok(player.gold < 40);
  assert.ok(player.scorePenalty > 0);
  assert.ok(player.vagrantVanishDelayMs > 0);
});

test('rune archer marks convert into late combat survivability', () => {
  const unmarked = testApi.createPlayer('unmarked', 'Unmarked', 'rune-archer', false, room);
  unmarked.loopTier = 3;
  unmarked.tierStartLap = 9;
  unmarked.laps = 9;
  testApi.fight(room, unmarked, 'wyrm gate', 23, 34, 3);

  const marked = testApi.createPlayer('marked', 'Marked', 'rune-archer', false, room);
  marked.loopTier = 3;
  marked.tierStartLap = 9;
  marked.laps = 9;
  marked.runeMarkCount = 6;
  testApi.fight(room, marked, 'wyrm gate', 23, 34, 3);

  assert.ok(marked.combat.damage <= unmarked.combat.damage - 4);
  assert.ok(marked.combat.rounds <= unmarked.combat.rounds);
  assert.ok(marked.hp > unmarked.hp);
});

test('simulated combat timing stays compact for balance runs', () => {
  const simRoom = testApi.createRoom('simulated-combat-timing', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('fighter', 'Fighter', 'ember-knight');
  simRoom.players[player.id] = player;
  player.board[1].type = 'crypt';
  player.position = 1;

  testApi.triggerTile(simRoom, player, player.board[player.position]);

  assert.ok(player.combat);
  assert.equal(player.combat.beats[0].atMs, 180);
  assert.equal(player.combat.beats[1].atMs - player.combat.beats[0].atMs, 203);
  assert.equal(player.combat.durationMs, 360 + player.combat.beats.length * 203);
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
  assert.equal(player.moveStartedAt > lockedUntil, true);
  assert.equal(player.nextMoveAt, player.moveStartedAt + testApi.movementDelay(room, player));

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

test('running rooms pause on the server when all human hosts disconnect', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.addBot(room);
  testApi.startRoom(room);
  const tickBefore = room.tick;
  const nextMoveBefore = player.nextMoveAt;

  testApi.disconnectPlayer(room, player.id);
  const pausedSnapshot = testApi.roomSnapshot(room);

  assert.equal(pausedSnapshot.authority.paused, true);
  assert.equal(pausedSnapshot.authority.reason, 'waiting-for-host');
  testApi.runRoomStep(room);
  assert.equal(room.tick, tickBefore);
  assert.equal(player.nextMoveAt, nextMoveBefore);
});

test('host reconnect resumes from the paused timeline instead of catching up', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  testApi.disconnectPlayer(room, player.id);
  testApi.roomSnapshot(room);
  const nextMoveBefore = player.nextMoveAt;
  room.authorityPause.startedAt = Date.now() - 2000;

  testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  const resumedSnapshot = testApi.roomSnapshot(room);

  assert.equal(resumedSnapshot.authority.paused, false);
  assert.equal(player.nextMoveAt >= nextMoveBefore + 1900, true);
});

test('server clock drift is absorbed into movement timers before simulation catches up', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  player.moveStartedAt = Date.now();
  player.nextMoveAt = Date.now() + 500;
  player.nextMovement = {
    fromCursor: player.position,
    toCursor: player.position + 1,
    departAt: player.moveStartedAt,
    arriveAt: player.nextMoveAt
  };
  const nextMoveBefore = player.nextMoveAt;

  assert.equal(testApi.absorbRoomClockDrift(room, 1300, 260), true);
  testApi.runRoomStep(room);

  assert.equal(player.position, 0);
  assert.equal(player.nextMoveAt >= nextMoveBefore + 1000, true);
  assert.equal(player.nextMovement.arriveAt, player.nextMoveAt);
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

test('placing combat terrain on the authoritative current tile resolves combat immediately', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  const grove = {
    id: 'grove',
    instanceId: 'grove-current',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: 'Reliable XP fight.'
  };
  player.hand = [grove];
  player.position = 2;
  player.laps = 0;
  player.moveStartedAt = Date.now() - 400;
  player.nextMoveAt = Date.now() + 500;
  player.nextMovement = {
    fromCursor: 2,
    toCursor: 3,
    departAt: player.moveStartedAt,
    arriveAt: player.nextMoveAt
  };

  assert.equal(testApi.playTerrain(room, player, grove.instanceId, 2), true);

  assert.equal(player.board[2].type, 'grove');
  assert.ok(player.combat);
  assert.equal(player.position, 2);
  assert.equal(player.nextMovement.fromCursor, 2);
  assert.equal(player.nextMovement.departAt >= player.combat.expiresAt, true);
  assert.equal(testApi.roomSnapshot(room).players.find((item) => item.id === player.id).nextMovement, null);
});

test('combat terrain cannot be placed on the authoritative next tile', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  const grove = {
    id: 'grove',
    instanceId: 'grove-next',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: 'Reliable XP fight.'
  };
  player.hand = [grove];
  player.position = 2;

  assert.equal(testApi.playTerrain(room, player, grove.instanceId, 3), false);

  assert.equal(player.board[3].type, 'road');
  assert.equal(player.hand.some((item) => item.instanceId === grove.instanceId), true);
  assert.equal(player.combat, null);
});

test('combat terrain can be placed two authoritative steps ahead', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  const grove = {
    id: 'grove',
    instanceId: 'grove-two-ahead',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: 'Reliable XP fight.'
  };
  player.hand = [grove];
  player.position = 2;

  assert.equal(testApi.playTerrain(room, player, grove.instanceId, 4), true);

  assert.equal(player.board[4].type, 'grove');
  assert.equal(player.hand.some((item) => item.instanceId === grove.instanceId), false);
  assert.equal(player.combat, null);
});

test('terrain placement settles due movement before checking combat lead time', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  const grove = {
    id: 'grove',
    instanceId: 'grove-stale-position',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: 'Reliable XP fight.'
  };
  player.hand = [grove];
  player.position = 2;
  player.laps = 0;
  player.moveStartedAt = Date.now() - 1200;
  player.nextMoveAt = Date.now() - 1;
  player.nextMovement = {
    fromCursor: 2,
    toCursor: 3,
    departAt: player.moveStartedAt,
    arriveAt: player.nextMoveAt
  };

  assert.equal(testApi.playTerrain(room, player, grove.instanceId, 4), false);

  assert.equal(player.position, 3);
  assert.equal(player.board[4].type, 'road');
  assert.equal(player.hand.some((item) => item.instanceId === grove.instanceId), true);
  assert.equal(player.combat, null);
});

test('terrain placement on a newly reached combat tile resolves immediately after catch-up', () => {
  const { player } = testApi.joinRoom(room, { playerId: 'host', name: 'Host', heroId: 'ember-knight' });
  testApi.startRoom(room);
  const grove = {
    id: 'grove',
    instanceId: 'grove-stale-current',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: 'Reliable XP fight.'
  };
  player.hand = [grove];
  player.position = 2;
  player.laps = 0;
  player.moveStartedAt = Date.now() - 1200;
  player.nextMoveAt = Date.now() - 1;
  player.nextMovement = {
    fromCursor: 2,
    toCursor: 3,
    departAt: player.moveStartedAt,
    arriveAt: player.nextMoveAt
  };

  assert.equal(testApi.playTerrain(room, player, grove.instanceId, 3), true);

  assert.equal(player.position, 3);
  assert.equal(player.board[3].type, 'grove');
  assert.ok(player.combat);
  assert.equal(player.hand.some((item) => item.instanceId === grove.instanceId), false);
  assert.equal(testApi.roomSnapshot(room).players.find((item) => item.id === player.id).nextMovement, null);
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
  assert.deepEqual(new Set(player.pendingTraits), new Set(['ember-oath', 'cinder-step', 'shield-heat', 'ash-tithe']));
  player.talentPoints = 2;
  assert.equal(testApi.chooseTrait(player, 'ember-oath'), true);
  assert.equal(testApi.chooseTrait(player, 'ember-oath'), true);
  assert.equal(testApi.traitRank(player, 'ember-oath'), 3);
  player.talentPoints = 1;
  testApi.refreshPendingTraits(player);
  assert.equal(player.pendingTraits.includes('ember-oath'), false);
});

test('talent tree budgets stay in intentional hero bands', () => {
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
  const ranges = {
    'ember-knight': [45, 51],
    'moss-warden': [47, 53],
    'night-vagrant': [27, 32],
    'rune-archer': [45, 51],
    'grave-singer': [43, 49]
  };

  assert.equal(budgets.size, 5);
  for (const [heroId, budget] of budgets) {
    const nodeCount = testApi.traits.filter((trait) => trait.heroId === heroId).length;
    const [minBudget, maxBudget] = ranges[heroId];
    assert.equal(nodeCount, 11);
    assert.ok(budget >= minBudget && budget <= maxBudget, `${heroId} budget ${budget.toFixed(2)} is outside the target band`);
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

  testApi.playTerrain(room, player, card.instanceId, 4);

  assert.equal(player.board[4].type, 'grove');
  assert.equal(player.board[4].expiresOnLap, 3);

  player.position = 15;
  player.laps = 2;
  player.nextMoveAt = room.now;
  testApi.runRoomStep(room, { advanceMs: 1 });

  assert.equal(player.laps, 3);
  assert.equal(player.board[4].type, 'road');
  assert.equal(player.board[4].expiresOnLap, undefined);
});

test('act one progression waits for the visible boss fight before tier advance', () => {
  room = testApi.createRoom('act-one-boss-visible', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  const rival = testApi.createPlayer('rival', 'Rival', 'ember-knight');
  room.players.leader = player;
  room.players.rival = rival;
  room.status = 'running';
  player.level = 5;
  player.maxHp = 90;
  player.hp = 90;
  player.power = 28;
  player.guard = 30;
  player.laps = testApi.matchTiers[1].minLoops;
  player.board[4].type = 'crypt';

  testApi.drainRoomEvents(room);
  testApi.checkWinner(room);
  const startEvents = testApi.drainRoomEvents(room);

  assert.equal(player.loopTier, 1);
  assert.equal(player.soloGatesCleared.includes(1), false);
  assert.equal(player.combat, null);
  assert.equal(player.bossPhase.label, 'briar warden');
  assert.deepEqual(player.bossPhase.tileIndexes.map((index) => player.board[index].type), ['rootwall', 'bramblebloom', 'wardensheart', 'oldgrowth']);
  assert.equal(player.board[4].type, 'road');
  assert.ok(startEvents.some((event) => event.type === 'bossBoardReset'), 'boss entry should reset placed terrain before staging');
  assert.equal(startEvents.some((event) => event.type === 'playerTierChanged'), false);

  clearBossPhase(room, player);
  const endEvents = testApi.drainRoomEvents(room);

  assert.equal(player.combat, null);
  assert.equal(player.bossPhase, null);
  assert.equal(player.loopTier, 2);
  assert.equal(player.soloGatesCleared.includes(1), true);
  assert.equal(player.position, 0);
  assert.equal(player.board.every((tile, index) => tile.type === (index === 0 ? 'camp' : 'road')), true);
  assert.equal(testApi.roomSnapshot(room).tier.id, 2);
  const combatEndedIndex = endEvents.findIndex((event) => event.type === 'combatEnded');
  const tierChangedIndex = endEvents.findIndex((event) => event.type === 'playerTierChanged');
  assert.notEqual(combatEndedIndex, -1);
  assert.notEqual(tierChangedIndex, -1);
  assert.ok(combatEndedIndex < tierChangedIndex);
});

test('boss entry resets saturated side lanes before placing boss tiles', () => {
  room = testApi.createRoom('boss-reset-saturated-board', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('leader', 'Leader', 'ember-knight');
  room.players.leader = player;
  room.status = 'running';
  player.level = 7;
  player.maxHp = 130;
  player.hp = 130;
  player.power = 38;
  player.guard = 48;
  player.laps = testApi.matchTiers[1].minLoops;
  player.tilesPlaced = 8;
  for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    player.board[index].type = 'crypt';
    player.board[index].expiresOnLap = player.laps + 2;
  }

  testApi.drainRoomEvents(room);
  testApi.checkWinner(room);
  const events = testApi.drainRoomEvents(room);

  assert.equal(player.bossPhase.label, 'briar warden');
  assert.deepEqual(player.bossPhase.tileIndexes, [2, 6, 10, 14]);
  assert.deepEqual(player.bossPhase.tileIndexes.map((index) => player.board[index].type), ['rootwall', 'bramblebloom', 'wardensheart', 'oldgrowth']);
  assert.equal(player.board[1].type, 'road');
  assert.equal(player.board[15].type, 'road');
  const resetEvent = events.find((event) => event.type === 'bossBoardReset');
  assert.ok(resetEvent, 'boss entry should emit board reset event');
  assert.equal(resetEvent.payload.board.every((tile, index) => tile.type === (index === 0 ? 'camp' : 'road')), true);
  assert.equal(events.some((event) => event.type === 'bossPhaseBlocked'), false);
});

test('solo act bosses still gate tier promotion', () => {
  room = testApi.createRoom('solo-act-boss-visible', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('solo', 'Solo', 'ember-knight');
  room.players.solo = player;
  room.status = 'running';
  player.level = 5;
  player.maxHp = 90;
  player.hp = 90;
  player.power = 28;
  player.guard = 30;
  player.laps = testApi.matchTiers[1].minLoops;
  player.tilesPlaced = 1;

  testApi.checkWinner(room);

  assert.equal(player.soloGatesCleared.includes(1), false);
  assert.equal(player.loopTier, 1);
  assert.equal(player.combat, null);
  assert.equal(player.bossPhase.label, 'briar warden');

  clearBossPhase(room, player);

  assert.equal(player.soloGatesCleared.includes(1), true);
  assert.equal(player.loopTier, 2);
  assert.equal(player.combat, null);
  assert.equal(player.position, 0);
  assert.equal(player.board.every((tile, index) => tile.type === (index === 0 ? 'camp' : 'road')), true);
  assert.ok(player.soloCorruption >= 4);
});

test('act boss failure adds corruption and score debt instead of brute-force promotion', () => {
  const player = testApi.createPlayer('solo', 'Solo', 'night-vagrant');
  room.players.solo = player;
  room.status = 'running';
  player.level = 5;
  player.maxHp = 12;
  player.hp = 1;
  player.power = 4;
  player.guard = 0;
  player.gold = 80;
  player.laps = testApi.matchTiers[1].minLoops;
  player.tilesPlaced = 1;

  testApi.checkWinner(room);

  assert.equal(player.loopTier, 1);
  assert.equal(player.deaths, 0);
  assert.equal(player.bossPhase !== null, true);

  const tile = player.board.find((item) => item.bossPhaseId === player.bossPhase.id);
  player.position = tile.index;
  testApi.triggerTile(room, player, tile);
  player.combat.expiresAt = room.now - 1;
  testApi.runRoomStep(room, { advanceMs: 0 });

  assert.equal(player.deaths, 1);
  assert.ok(player.soloCorruption > 0);
  assert.ok(player.scorePenalty > 0);
  assert.ok(player.gold < 80);
  assert.equal(player.loopTier, 1);
});

test('underbuilt act boss challengers die before clearing the full boss loop', () => {
  room = testApi.createRoom('underbuilt-act-boss', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('solo', 'Solo', 'night-vagrant');
  room.players.solo = player;
  room.status = 'running';
  player.level = 1;
  player.hp = player.maxHp;
  player.power = 7;
  player.guard = 2;
  player.laps = testApi.matchTiers[1].minLoops;
  player.tilesPlaced = 1;

  testApi.checkWinner(room);

  assert.equal(player.bossPhase?.label, 'briar warden');
  assert.equal(player.deaths, 0);

  for (let attempts = 0; attempts < 4 && player.bossPhase && player.deaths === 0; attempts += 1) {
    const phaseId = player.bossPhase.id;
    const tile = player.board.find((item) => item.bossPhaseId === phaseId && bossLoopTileTypes.has(item.type));
    assert.ok(tile, 'boss phase should expose a live boss tile');
    player.position = tile.index;
    testApi.triggerTile(room, player, tile);
    assert.ok(player.combat, 'boss tile should create visible combat');
    room.now = player.combat.expiresAt;
    testApi.runRoomStep(room, { advanceMs: 0 });
  }

  assert.equal(player.deaths, 1);
  assert.equal(player.loopTier, 1);
});

test('underbuilt final boss challengers die to the loop tyrant opener', () => {
  room = testApi.createRoom('underbuilt-loop-tyrant', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('solo', 'Solo', 'ember-knight');
  room.players.solo = player;
  room.status = 'running';
  player.loopTier = 3;
  player.soloGatesCleared = [1, 2];
  player.level = 1;
  player.hp = player.maxHp;
  player.power = 9;
  player.guard = 5;
  player.laps = testApi.matchTiers[2].minLoops + 4;
  player.tierStartLap = testApi.matchTiers[2].minLoops;
  player.tilesPlaced = 1;

  testApi.checkWinner(room);

  assert.equal(player.bossPhase?.label, 'loop tyrant');

  const tile = player.board.find((item) => item.bossPhaseId === player.bossPhase.id && bossLoopTileTypes.has(item.type));
  assert.ok(tile, 'loop tyrant should expose a live boss tile');
  player.position = tile.index;
  testApi.triggerTile(room, player, tile);
  assert.ok(player.combat, 'loop tyrant opener should create visible combat');
  assert.equal(player.combat.label, 'loop tyrant');
  assert.ok(player.combat.damage >= player.maxHp, 'underbuilt challenger should take lethal boss damage');
  assert.ok(player.combat.heroHpAfter <= 0, 'hero should be visibly dead in the combat payload');
  assert.ok(player.combat.enemyHpAfter > 0, 'lethal boss combat should not pretend the boss was killed');
  assert.equal(player.combat.beats.at(-1).attacker, 'enemy', 'lethal boss combat should end on the killing enemy beat');
  room.now = player.combat.expiresAt;
  testApi.runRoomStep(room, { advanceMs: 0 });

  assert.equal(player.deaths, 1);
  assert.equal(player.loopTier, 3);
});

test('loop tyrant chunks keep boss pressure after a cleared chunk', () => {
  room = testApi.createRoom('loop-tyrant-pressure', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('solo', 'Solo', 'ember-knight');
  room.players.solo = player;
  room.status = 'running';
  Object.assign(player, {
    loopTier: 3,
    soloGatesCleared: [1, 2],
    level: 18,
    maxHp: 320,
    hp: 320,
    power: 95,
    guard: 80,
    armor: 20,
    laps: testApi.matchTiers[2].minLoops + 4,
    tierStartLap: testApi.matchTiers[2].minLoops,
    tilesPlaced: 12
  });

  testApi.checkWinner(room);
  assert.equal(player.bossPhase?.label, 'loop tyrant');

  const firstTile = player.board.find((item) => item.bossPhaseId === player.bossPhase.id && bossLoopTileTypes.has(item.type));
  assert.ok(firstTile, 'loop tyrant should expose a first boss tile');
  player.position = firstTile.index;
  testApi.triggerTile(room, player, firstTile);
  assert.ok(player.combat, 'first loop tyrant chunk should create visible combat');
  assert.equal(player.combat.enemyCount, 5);
  room.now = player.combat.expiresAt;
  testApi.runRoomStep(room, { advanceMs: 0 });

  assert.equal(player.deaths, 0, 'geared challenger should survive the first chunk');
  assert.equal(player.bossPhase?.remainingChunks, 3);

  const secondTile = player.board.find((item) => item.bossPhaseId === player.bossPhase.id && bossLoopTileTypes.has(item.type));
  assert.ok(secondTile, 'loop tyrant should expose another boss tile');
  player.position = secondTile.index;
  testApi.triggerTile(room, player, secondTile);
  assert.ok(player.combat, 'second loop tyrant chunk should create visible combat');
  assert.equal(player.combat.enemyCount, 5, 'loop tyrant should not get easier after a cleared chunk');
});

test('act two progression waits for the crown sentinel before the final act', () => {
  room = testApi.createRoom('act-two-boss-visible', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('leader', 'Leader', 'ember-knight');
  const rival = testApi.createPlayer('rival', 'Rival', 'moss-warden');
  room.players.leader = player;
  room.players.rival = rival;
  room.status = 'running';
  player.loopTier = 2;
  player.level = 7;
  player.maxHp = 130;
  player.hp = 130;
  player.power = 38;
  player.guard = 48;
  player.tierStartLap = testApi.matchTiers[1].minLoops;
  player.laps = testApi.matchTiers[2].minLoops;

  testApi.checkWinner(room);

  assert.equal(player.soloGatesCleared.includes(2), false);
  assert.equal(player.loopTier, 2);
  assert.equal(player.combat, null);
  assert.equal(player.bossPhase.label, 'crown sentinel');
  assert.deepEqual(player.bossPhase.tileIndexes.map((index) => player.board[index].type), ['guardstance', 'markedchallenge', 'retaliation', 'executionstance']);

  clearBossPhase(room, player);

  assert.equal(player.soloGatesCleared.includes(2), true);
  assert.equal(player.loopTier, 3);
  assert.equal(player.combat, null);
});

test('reaching the final act loop target culminates in a boss fight', () => {
  room = testApi.createRoom('loop-tyrant-visible', { simulated: true, now: 1000 });
  const player = testApi.createPlayer('leader', 'Leader', 'night-vagrant');
  room.players.leader = player;
  room.status = 'running';
  player.level = Math.ceil(testApi.goalScore / 390);
  player.maxHp = 220;
  player.hp = 220;
  player.power = 50;
  player.guard = 80;
  player.loopTier = 3;
  player.soloGatesCleared = [1, 2];
  player.laps = testApi.matchTiers[2].minLoops;
  player.tierStartLap = testApi.matchTiers[2].minLoops;
  player.tilesPlaced = 1;

  assert.equal(testApi.checkWinner(room), null);
  assert.equal(player.loopTier, 3);
  assert.equal(player.combat, null);

  player.laps = player.tierStartLap + 4;
  const winner = testApi.checkWinner(room);
  const snapshot = testApi.roomSnapshot(room);

  assert.equal(player.loopTier, 3);
  assert.equal(snapshot.claim, null);
  assert.equal(snapshot.tier.id, 3);
  assert.equal(player.combat, null);
  assert.equal(player.bossPhase.label, 'loop tyrant');
  assert.deepEqual(player.bossPhase.tileIndexes.map((index) => player.board[index].type), ['seal1', 'seal2', 'seal3', 'innergate']);
  assert.equal(winner, null);
  assert.equal(snapshot.winnerId, null);

  clearBossPhase(room, player);
  const resolvedSnapshot = testApi.roomSnapshot(room);

  assert.equal(player.combat, null);
  assert.equal(resolvedSnapshot.winnerId, player.id);
  assert.equal(resolvedSnapshot.status, 'finished');
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
  leader.power = 45;
  leader.guard = 60;
  leader.maxHp = 180;
  leader.hp = 180;
  leader.laps = testApi.matchTiers[2].minLoops;
  leader.soloGatesCleared = [1, 2];
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
  player.power = 45;
  player.guard = 60;
  player.maxHp = 180;
  player.hp = 180;
  player.laps = testApi.matchTiers[2].minLoops;
  player.soloGatesCleared = [1, 2];

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
  assert.ok(player.loopTier < 3 || player.laps < player.tierStartLap + 4);
});

test('active solo bot builds into boss gates without a guaranteed clear', () => {
  const result = simulateMatch(5, {
    roster: [{ id: 'night-vagrant', name: 'Night Vagrant' }],
    maxSteps: 9000
  });

  assert.equal(result.finished, false);
  assert.ok(result.players[0].loopTier >= 2);
  assert.ok(result.players[0].tilesPlaced > 0);
  assert.ok(result.players[0].deaths > 0);
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
  assert.equal(first.finished, second.finished);
  assert.ok(first.players.some((player) => player.loopTier >= 3));
});

test('CPU balance suite keeps a demanding but finishable win-rate band', () => {
  const report = runBalanceSuite(120);
  const rates = report.heroes.map((hero) => hero.winRate);
  const deaths = report.heroes.map((hero) => hero.avgDeaths);
  const loopTiers = report.heroes.map((hero) => hero.avgLoopTier);

  // Upper bound raised from 0.85 after bots learned to use hero abilities:
  // competent bots survive and resolve more matches, so a higher finish rate
  // is expected and healthy (fewer stalemates), not a difficulty regression.
  assert.ok(report.finishedRate >= 0.55 && report.finishedRate <= 0.92);
  assert.ok(report.avgSeconds >= 900 && report.avgSeconds <= 1800);
  assert.ok(Math.max(...rates) <= 0.65);
  assert.ok(Math.min(...rates) >= 0.03);
  assert.ok(report.winRateSpread <= 0.6);
  assert.ok(report.avgScoreSpread <= 35000);
  assert.ok(Math.min(...deaths) >= 12);
  assert.ok(Math.min(...loopTiers) >= 2.35);
});
