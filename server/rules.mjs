export const maxPlayers = 4;
export const goalScore = 600;
const combatDisplayMs = 1800;

const combatEncounters = {
  'wolf grove': {
    enemyId: 'thorn-wolf',
    enemyName: 'Thorn Wolf',
    backgroundId: 'grove'
  },
  'crypt duel': {
    enemyId: 'crypt-wraith',
    enemyName: 'Crypt Wraith',
    backgroundId: 'crypt'
  },
  'bandit ambush': {
    enemyId: 'brigand',
    enemyName: 'Road Brigand',
    backgroundId: 'road'
  },
  'road skirmish': {
    enemyId: 'brigand',
    enemyName: 'Road Brigand',
    backgroundId: 'road'
  }
};

export const heroes = [
  {
    id: 'ember-knight',
    name: 'Ember Knight',
    title: 'tempo bruiser',
    icon: '🔥',
    color: '#f45d43',
    maxHp: 42,
    power: 8,
    guard: 4,
    speed: 5,
    text: 'Burns through weak encounters and spikes after taking damage.'
  },
  {
    id: 'moss-warden',
    name: 'Moss Warden',
    title: 'board shaper',
    icon: '🌿',
    color: '#45b36b',
    maxHp: 52,
    power: 6,
    guard: 6,
    speed: 3,
    text: 'Heals from land cards and turns long loops into pressure.'
  },
  {
    id: 'night-vagrant',
    name: 'Night Vagrant',
    title: 'loot sprinter',
    icon: '🌙',
    color: '#8f7cff',
    maxHp: 36,
    power: 7,
    guard: 2,
    speed: 8,
    text: 'Fast laps, more loot rolls, fragile under direct sabotage.'
  },
  {
    id: 'rune-archer',
    name: 'Rune Archer',
    title: 'rival control',
    icon: '🏹',
    color: '#4ab9ef',
    maxHp: 38,
    power: 7,
    guard: 3,
    speed: 6,
    text: 'Scores bonus damage when rivals are slowed or cursed.'
  },
  {
    id: 'grave-singer',
    name: 'Grave Singer',
    title: 'risk engine',
    icon: '💀',
    color: '#d8d1b0',
    maxHp: 34,
    power: 9,
    guard: 1,
    speed: 5,
    text: 'Turns danger into XP and recovers when crossing ruins.'
  }
];

export const terrainCards = [
  { id: 'grove', name: 'Grove', kind: 'terrain', tile: 'grove', icon: '♣', text: '+XP fights, small loot chance.' },
  { id: 'meadow', name: 'Meadow', kind: 'terrain', tile: 'meadow', icon: '✦', text: 'Heal when crossed. Warden loves it.' },
  { id: 'crypt', name: 'Crypt', kind: 'terrain', tile: 'crypt', icon: '☗', text: 'Hard fight. Better loot.' },
  { id: 'forge', name: 'Forge', kind: 'terrain', tile: 'forge', icon: '⚒', text: 'Loot and temporary armor.' },
  { id: 'shrine', name: 'Shrine', kind: 'terrain', tile: 'shrine', icon: '✚', text: 'XP burst and trait tempo.' },
  { id: 'mire', name: 'Mire', kind: 'terrain', tile: 'mire', icon: '≈', text: 'Slows hero, but pays cards.' }
];

export const rivalCards = [
  { id: 'bandits', name: 'Bandits', kind: 'rival', icon: '⚔', text: 'Adds an ambush to a rival loop.' },
  { id: 'hex', name: 'Hex', kind: 'rival', icon: '☾', text: 'Curses a rival for 3 events.' },
  { id: 'meteor', name: 'Meteor', kind: 'rival', icon: '☄', text: 'Damages a rival and scorches a tile.' },
  { id: 'tax', name: 'Tithe Trap', kind: 'rival', icon: '$', text: 'Steals tempo: rival loses a card or HP.' }
];

export const traits = [
  { id: 'quick-circuit', name: 'Quick Circuit', text: '+1 speed, +1 power.', bonus: { speed: 1, power: 1 } },
  { id: 'iron-will', name: 'Iron Will', text: '+8 max HP, +2 guard.', bonus: { maxHp: 8, guard: 2 } },
  { id: 'cardsharp', name: 'Cardsharp', text: 'Draw cards faster.', bonus: { drawRate: 0.82 } },
  { id: 'duelist', name: 'Duelist', text: '+3 rival damage.', bonus: { sabotage: 3 } },
  { id: 'reclaimer', name: 'Reclaimer', text: 'Heal after every lap.', bonus: { lapHeal: 6 } },
  { id: 'prospector', name: 'Prospector', text: 'More loot from fights.', bonus: { lootLuck: 0.22 } }
];

const lootNames = {
  weapon: ['Glass Pike', 'Moonblade', 'Ash Bow', 'Thorn Mace', 'Cinder Wand'],
  charm: ['Lucky Tooth', 'War Drum', 'Soft Lantern', 'Hex Needle', 'Green Sigil'],
  armor: ['Patchwork Mail', 'Duel Cloak', 'Tin Aegis', 'Mire Boots', 'Bone Plate']
};

export const boardPath = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 3], [0, 2], [0, 1]
];

export function publicConfig() {
  return { heroes, cards: [...terrainCards, ...rivalCards], boardPath, traits, maxPlayers, goalScore };
}

export function createRoom(id) {
  return {
    id,
    status: 'lobby',
    startedAt: Date.now(),
    finishedAt: null,
    tick: 0,
    players: {},
    log: ['Loopduel lobby is open. Join, pick a hero, then keep up.'],
    botCounter: 1,
    winnerId: null
  };
}

export function resetRoom(room) {
  const id = room.id;
  Object.assign(room, createRoom(id));
}

export function activePlayerCount(room) {
  return Object.keys(room.players).length;
}

export function hasRoomForPlayer(room) {
  return activePlayerCount(room) < maxPlayers;
}

export function score(player) {
  return player.level * 100 + player.laps * 32 + player.kos * 18 + player.loot.length * 5 + player.xp;
}

export function roomSnapshot(room) {
  const players = Object.values(room.players)
    .map((player) => ({ ...player, score: score(player) }))
    .sort((a, b) => b.score - a.score);
  return {
    id: room.id,
    status: room.status,
    tick: room.tick,
    log: room.log,
    maxPlayers,
    goalScore,
    winnerId: room.winnerId,
    winner: room.winnerId ? players.find((player) => player.id === room.winnerId) ?? null : null,
    players
  };
}

export function createPlayer(id, name, heroId, isBot = false) {
  const hero = heroes.find((item) => item.id === heroId) ?? sample(heroes);
  return {
    id,
    name: name?.trim().slice(0, 20) || hero.name,
    heroId: hero.id,
    isBot,
    connected: !isBot,
    color: hero.color,
    board: blankBoard(),
    hand: [drawCard(), drawCard(), drawCard()],
    loot: [],
    loadout: { weapon: null, charm: null, armor: null },
    traits: [],
    pendingTraits: [],
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    power: hero.power,
    guard: hero.guard,
    speed: hero.speed,
    drawRate: 1,
    sabotage: 0,
    lootLuck: 0,
    lapHeal: 0,
    position: 0,
    laps: 0,
    level: 1,
    xp: 0,
    kos: 0,
    deaths: 0,
    curse: 0,
    armor: 0,
    nextMoveAt: now() + 1000,
    nextDrawAt: now() + 2200,
    event: 'entered the loop',
    message: 'entered the loop',
    lastEventAt: now(),
    combat: null
  };
}

export function addLog(room, line) {
  room.log.unshift(line);
  room.log = room.log.slice(0, 18);
}

export function joinRoom(room, { playerId, name, heroId }) {
  const existing = room.players[playerId];
  if (existing) {
    existing.connected = true;
    existing.name = name?.trim().slice(0, 20) || existing.name;
    existing.event = 'reconnected';
    addLog(room, `${existing.name} reconnected.`);
    return { player: existing, created: false };
  }

  if (!hasRoomForPlayer(room)) {
    return { player: null, created: false, full: true };
  }

  const player = createPlayer(playerId, name, heroId);
  room.players[player.id] = player;
  room.status = room.status === 'finished' ? 'finished' : 'running';
  addLog(room, `${player.name} joined as ${heroes.find((hero) => hero.id === player.heroId)?.name}.`);
  return { player, created: true };
}

export function disconnectPlayer(room, playerId) {
  const player = room.players[playerId];
  if (!player || player.isBot) return;
  player.connected = false;
  player.event = 'disconnected';
  addLog(room, `${player.name} disconnected.`);
}

export function addBot(room) {
  if (!hasRoomForPlayer(room) || room.status === 'finished') return null;
  const hero = sample(heroes);
  const botId = `bot-${room.botCounter++}`;
  const bot = createPlayer(botId, `Bot ${room.botCounter - 1}`, hero.id, true);
  room.players[botId] = bot;
  room.status = 'running';
  addLog(room, `${bot.name} entered as ${hero.name}.`);
  return bot;
}

export function playTerrain(room, player, cardInstanceId, tileIndex) {
  if (room.status === 'finished') return;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card || card.kind !== 'terrain') return;
  const tile = player.board[tileIndex];
  if (!tile || tile.type === 'camp') return;
  tile.type = card.tile;
  tile.charges = card.tile === 'mire' ? 5 : 0;
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.event = `placed ${card.name}`;
  addXp(room, player, 2);
  addLog(room, `${player.name} placed ${card.name}.`);
  checkWinner(room);
}

export function playRival(room, player, cardInstanceId, targetId) {
  if (room.status === 'finished') return;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  const target = room.players[targetId];
  if (!card || card.kind !== 'rival' || !target || target.id === player.id) return;
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  const bonus = player.sabotage;
  if (card.id === 'bandits') {
    const tile = target.board[(target.position + 3 + rand(5)) % target.board.length];
    if (tile.type !== 'camp') {
      tile.type = 'ambush';
      tile.charges = 2;
    }
    target.event = 'rival bandits ahead';
  } else if (card.id === 'hex') {
    target.curse += 3;
    target.hp -= bonus;
    target.event = 'cursed by rival';
  } else if (card.id === 'meteor') {
    target.hp -= 8 + bonus;
    const tile = target.board[(target.position + 2) % target.board.length];
    if (tile.type !== 'camp') {
      tile.type = 'scorch';
      tile.charges = 2;
    }
    target.event = 'meteor strike';
  } else if (card.id === 'tax') {
    if (target.hand.length > 0) target.hand.splice(rand(target.hand.length), 1);
    else target.hp -= 5 + bonus;
    target.event = 'tempo stolen';
  }
  resolveDefeat(room, target);
  addXp(room, player, 4);
  player.event = `hit ${target.name} with ${card.name}`;
  addLog(room, `${player.name} played ${card.name} on ${target.name}.`);
  checkWinner(room);
}

export function chooseTrait(player, traitId) {
  if (!player.pendingTraits.includes(traitId)) return;
  player.traits.push(traitId);
  player.pendingTraits = [];
  recalcStats(player);
  const trait = traits.find((item) => item.id === traitId);
  player.event = `learned ${trait?.name ?? 'a trait'}`;
}

export function equip(player, itemId) {
  const item = player.loot.find((entry) => entry.id === itemId);
  if (!item) return;
  player.loadout[item.slot] = item;
  recalcStats(player);
  player.event = `equipped ${item.name}`;
}

export function runRoomStep(room) {
  if (room.status !== 'running') return;
  room.tick += 1;
  for (const player of Object.values(room.players)) {
    clearExpiredCombat(player);
    maybeDraw(player);
    if (now() >= player.nextMoveAt) advancePlayer(room, player);
    botThink(room, player);
  }
  checkWinner(room);
}

export function checkWinner(room) {
  if (room.status !== 'running') return null;
  const winner = Object.values(room.players).find((player) => score(player) >= goalScore);
  if (!winner) return null;
  room.status = 'finished';
  room.finishedAt = Date.now();
  room.winnerId = winner.id;
  winner.event = 'claimed the loop';
  addLog(room, `${winner.name} won the duel with ${score(winner)} points.`);
  return winner;
}

function rand(max) {
  return Math.floor(Math.random() * max);
}

function sample(list) {
  return list[rand(list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function now() {
  return Date.now();
}

function clearExpiredCombat(player) {
  if (!player.combat || now() < player.combat.expiresAt) return;
  player.combat = null;
}

function blankBoard() {
  return boardPath.map((coord, index) => ({
    index,
    coord,
    type: index === 0 ? 'camp' : 'road',
    charges: 0
  }));
}

function xpNeeded(player) {
  return 24 + player.level * 13;
}

function drawCard() {
  const pool = Math.random() < 0.7 ? terrainCards : rivalCards;
  const card = sample(pool);
  return { ...card, instanceId: crypto.randomUUID() };
}

function drawLoot(room, player) {
  const slot = sample(['weapon', 'charm', 'armor']);
  const rarityRoll = Math.random() + player.level * 0.04 + player.lootLuck;
  const rarity = rarityRoll > 1.08 ? 'relic' : rarityRoll > 0.76 ? 'rare' : 'common';
  const scale = rarity === 'relic' ? 3 : rarity === 'rare' ? 2 : 1;
  const item = {
    id: crypto.randomUUID(),
    slot,
    name: `${rarity === 'relic' ? 'Relic ' : rarity === 'rare' ? 'Bright ' : ''}${sample(lootNames[slot])}`,
    rarity,
    power: slot === 'weapon' ? scale + rand(2) : rand(2),
    guard: slot === 'armor' ? scale + rand(2) : rand(2),
    speed: slot === 'charm' ? scale : 0,
    maxHp: slot === 'armor' ? scale * 3 : 0
  };
  player.loot.unshift(item);
  player.loot = player.loot.slice(0, 10);
  player.event = `found ${item.name}`;
  addLog(room, `${player.name} found ${item.name}.`);
}

function recalcStats(player) {
  const hero = heroes.find((item) => item.id === player.heroId);
  let maxHp = hero.maxHp;
  let power = hero.power;
  let guard = hero.guard;
  let speed = hero.speed;
  let drawRate = 1;
  let sabotage = 0;
  let lootLuck = 0;
  let lapHeal = 0;

  for (const traitId of player.traits) {
    const trait = traits.find((item) => item.id === traitId);
    if (!trait) continue;
    maxHp += trait.bonus.maxHp ?? 0;
    power += trait.bonus.power ?? 0;
    guard += trait.bonus.guard ?? 0;
    speed += trait.bonus.speed ?? 0;
    drawRate *= trait.bonus.drawRate ?? 1;
    sabotage += trait.bonus.sabotage ?? 0;
    lootLuck += trait.bonus.lootLuck ?? 0;
    lapHeal += trait.bonus.lapHeal ?? 0;
  }

  for (const item of Object.values(player.loadout)) {
    if (!item) continue;
    maxHp += item.maxHp ?? 0;
    power += item.power ?? 0;
    guard += item.guard ?? 0;
    speed += item.speed ?? 0;
  }

  const hpGain = maxHp - player.maxHp;
  player.maxHp = maxHp;
  player.power = power;
  player.guard = guard;
  player.speed = speed;
  player.drawRate = drawRate;
  player.sabotage = sabotage;
  player.lootLuck = lootLuck;
  player.lapHeal = lapHeal;
  if (hpGain > 0) player.hp += hpGain;
  player.hp = clamp(player.hp, 0, player.maxHp);
}

function addXp(room, player, amount) {
  player.xp += amount;
  while (player.xp >= xpNeeded(player)) {
    player.xp -= xpNeeded(player);
    player.level += 1;
    player.hp = clamp(player.hp + 10, 0, player.maxHp);
    const available = traits.filter((trait) => !player.traits.includes(trait.id) && !player.pendingTraits.includes(trait.id));
    player.pendingTraits = [sample(available), sample(available)].filter(Boolean).map((trait) => trait.id);
    player.event = `hit level ${player.level}`;
    addLog(room, `${player.name} reached level ${player.level}.`);
  }
}

function fight(room, player, label, threat, reward) {
  const hpBefore = player.hp;
  const cursePenalty = player.curse > 0 ? 3 : 0;
  const damage = clamp(threat + cursePenalty - Math.floor(player.guard / 2) - player.armor, 1, 18);
  player.hp -= damage;
  player.armor = Math.max(0, player.armor - 1);
  addXp(room, player, reward);
  player.kos += 1;
  player.event = `${label}: -${damage} hp, +${reward} xp`;
  const encounter = combatEncounters[label] ?? {
    enemyId: 'ash-imp',
    enemyName: 'Ash Imp',
    backgroundId: 'forge'
  };
  const enemyMaxHp = clamp(threat + reward + player.level * 3, 16, 64);
  const timestamp = now();
  player.combat = {
    ...encounter,
    label,
    damage,
    reward,
    heroHpBefore: hpBefore,
    heroHpAfter: player.hp,
    heroMaxHp: player.maxHp,
    enemyHpBefore: enemyMaxHp,
    enemyHpAfter: 0,
    enemyMaxHp,
    startedAt: timestamp,
    expiresAt: timestamp + combatDisplayMs
  };
  if (Math.random() < 0.17 + player.lootLuck + reward / 180) drawLoot(room, player);
  if (player.curse > 0) player.curse -= 1;
}

function revivePlayer(room, player) {
  player.deaths += 1;
  player.hp = Math.ceil(player.maxHp * 0.58);
  player.position = 0;
  player.hand = player.hand.slice(0, 3);
  player.event = 'fell, then revived at camp';
  player.lastEventAt = now();
  addLog(room, `${player.name} got knocked back to camp.`);
}

function resolveDefeat(room, player) {
  if (player.hp > 0) return false;
  revivePlayer(room, player);
  return true;
}

function triggerTile(room, player, tile) {
  if (resolveDefeat(room, player)) return;
  player.combat = null;
  if (tile.type === 'camp') {
    player.hp = clamp(player.hp + 9 + player.lapHeal, 0, player.maxHp);
    player.event = 'campfire recovery';
  } else if (tile.type === 'grove') {
    fight(room, player, 'wolf grove', 6, 9);
  } else if (tile.type === 'meadow') {
    const bonus = player.heroId === 'moss-warden' ? 7 : 4;
    player.hp = clamp(player.hp + bonus, 0, player.maxHp);
    player.event = `meadow bloom: +${bonus} hp`;
  } else if (tile.type === 'crypt') {
    fight(room, player, 'crypt duel', 11, 16);
  } else if (tile.type === 'forge') {
    player.armor += 3;
    if (Math.random() < 0.55 + player.lootLuck) drawLoot(room, player);
    addXp(room, player, 5);
    player.event = 'forge sparks: armor and loot';
  } else if (tile.type === 'shrine') {
    addXp(room, player, 14);
    player.hp = clamp(player.hp + 3, 0, player.maxHp);
    player.event = 'shrine surge: +14 xp';
  } else if (tile.type === 'mire') {
    player.nextMoveAt += 450;
    if (player.hand.length < 7) player.hand.push(drawCard());
    player.event = 'mire drag: slowed, drew a card';
  } else if (tile.type === 'ambush') {
    fight(room, player, 'bandit ambush', 13, 13);
    tile.charges -= 1;
    if (tile.charges <= 0) tile.type = 'road';
  } else if (tile.type === 'scorch') {
    player.hp -= 7;
    tile.charges -= 1;
    player.event = 'meteor scorch: -7 hp';
    if (tile.charges <= 0) tile.type = 'road';
  } else {
    const roll = Math.random();
    if (roll < 0.38) fight(room, player, 'road skirmish', 4, 6);
    else if (roll < 0.52) {
      player.hp = clamp(player.hp + 3, 0, player.maxHp);
      player.event = 'quiet road: +3 hp';
    } else player.event = 'sprinting';
  }

  resolveDefeat(room, player);
  player.lastEventAt = now();
}

function movementDelay(player) {
  const base = 1125 - player.speed * 72;
  return clamp(base, 390, 1300);
}

function advancePlayer(room, player) {
  player.position = (player.position + 1) % boardPath.length;
  if (player.position === 0) {
    player.laps += 1;
    player.hp = clamp(player.hp + player.lapHeal, 0, player.maxHp);
    addXp(room, player, 4);
    if (player.hand.length < 7) player.hand.push(drawCard());
    addLog(room, `${player.name} completed lap ${player.laps}.`);
  }
  triggerTile(room, player, player.board[player.position]);
  player.nextMoveAt = now() + movementDelay(player);
}

function maybeDraw(player) {
  if (now() < player.nextDrawAt) return;
  if (player.hand.length < 7) {
    player.hand.push(drawCard());
    player.event = 'drew a card';
  }
  player.nextDrawAt = now() + Math.round((3600 + rand(1000)) * player.drawRate);
}

function botThink(room, player) {
  if (!player.isBot || room.tick % 3 !== 0 || room.status === 'finished') return;
  if (player.pendingTraits.length > 0) chooseTrait(player, sample(player.pendingTraits));
  if (player.loot.length > 0 && Math.random() < 0.4) equip(player, sample(player.loot).id);
  const card = sample(player.hand);
  if (!card) return;
  if (card.kind === 'terrain') {
    const tileIndex = 1 + rand(boardPath.length - 1);
    playTerrain(room, player, card.instanceId, tileIndex);
  } else {
    const rivals = Object.values(room.players).filter((candidate) => candidate.id !== player.id);
    if (rivals.length > 0) playRival(room, player, card.instanceId, sample(rivals).id);
  }
}

export const testApi = {
  activePlayerCount,
  addBot,
  checkWinner,
  createPlayer,
  createRoom,
  hasRoomForPlayer,
  joinRoom,
  maxPlayers,
  playRival,
  resetRoom,
  roomSnapshot,
  runRoomStep,
  triggerTile
};
