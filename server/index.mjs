import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 4173);

const heroes = [
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

const terrainCards = [
  {
    id: 'grove',
    name: 'Grove',
    kind: 'terrain',
    tile: 'grove',
    icon: '♣',
    text: '+XP fights, small loot chance.'
  },
  {
    id: 'meadow',
    name: 'Meadow',
    kind: 'terrain',
    tile: 'meadow',
    icon: '✦',
    text: 'Heal when crossed. Warden loves it.'
  },
  {
    id: 'crypt',
    name: 'Crypt',
    kind: 'terrain',
    tile: 'crypt',
    icon: '☗',
    text: 'Hard fight. Better loot.'
  },
  {
    id: 'forge',
    name: 'Forge',
    kind: 'terrain',
    tile: 'forge',
    icon: '⚒',
    text: 'Loot and temporary armor.'
  },
  {
    id: 'shrine',
    name: 'Shrine',
    kind: 'terrain',
    tile: 'shrine',
    icon: '✚',
    text: 'XP burst and trait tempo.'
  },
  {
    id: 'mire',
    name: 'Mire',
    kind: 'terrain',
    tile: 'mire',
    icon: '≈',
    text: 'Slows hero, but pays cards.'
  }
];

const rivalCards = [
  {
    id: 'bandits',
    name: 'Bandits',
    kind: 'rival',
    icon: '⚔',
    text: 'Adds an ambush to a rival loop.'
  },
  {
    id: 'hex',
    name: 'Hex',
    kind: 'rival',
    icon: '☾',
    text: 'Curses a rival for 3 events.'
  },
  {
    id: 'meteor',
    name: 'Meteor',
    kind: 'rival',
    icon: '☄',
    text: 'Damages a rival and scorches a tile.'
  },
  {
    id: 'tax',
    name: 'Tithe Trap',
    kind: 'rival',
    icon: '$',
    text: 'Steals tempo: rival loses a card or HP.'
  }
];

const traits = [
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

const boardPath = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 3], [0, 2], [0, 1]
];

const game = {
  status: 'lobby',
  startedAt: Date.now(),
  tick: 0,
  players: {},
  log: ['Loopduel lobby is open. Join, pick a hero, then keep up.'],
  botCounter: 1
};

function publicConfig() {
  return { heroes, cards: [...terrainCards, ...rivalCards], boardPath, traits };
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

function addLog(line) {
  game.log.unshift(line);
  game.log = game.log.slice(0, 18);
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

function score(player) {
  return player.level * 100 + player.laps * 32 + player.kos * 18 + player.loot.length * 5 + player.xp;
}

function createPlayer(id, name, heroId, isBot = false) {
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
    lastEventAt: now()
  };
}

function drawCard() {
  const pool = Math.random() < 0.7 ? terrainCards : rivalCards;
  const card = sample(pool);
  return { ...card, instanceId: crypto.randomUUID() };
}

function drawLoot(player) {
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
  addLog(`${player.name} found ${item.name}.`);
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

function addXp(player, amount) {
  player.xp += amount;
  while (player.xp >= xpNeeded(player)) {
    player.xp -= xpNeeded(player);
    player.level += 1;
    player.hp = clamp(player.hp + 10, 0, player.maxHp);
    const available = traits.filter((trait) => !player.traits.includes(trait.id) && !player.pendingTraits.includes(trait.id));
    player.pendingTraits = [sample(available), sample(available)].filter(Boolean).map((trait) => trait.id);
    player.event = `hit level ${player.level}`;
    addLog(`${player.name} reached level ${player.level}.`);
  }
}

function fight(player, label, threat, reward) {
  const cursePenalty = player.curse > 0 ? 3 : 0;
  const damage = clamp(threat + cursePenalty - Math.floor(player.guard / 2) - player.armor, 1, 18);
  player.hp -= damage;
  player.armor = Math.max(0, player.armor - 1);
  addXp(player, reward);
  player.kos += 1;
  player.event = `${label}: -${damage} hp, +${reward} xp`;
  if (Math.random() < 0.17 + player.lootLuck + reward / 180) drawLoot(player);
  if (player.curse > 0) player.curse -= 1;
}

function triggerTile(player, tile) {
  if (player.hp <= 0) return;
  if (tile.type === 'camp') {
    player.hp = clamp(player.hp + 9 + player.lapHeal, 0, player.maxHp);
    player.event = 'campfire recovery';
  } else if (tile.type === 'grove') {
    fight(player, 'wolf grove', 6, 9);
  } else if (tile.type === 'meadow') {
    const bonus = player.heroId === 'moss-warden' ? 7 : 4;
    player.hp = clamp(player.hp + bonus, 0, player.maxHp);
    player.event = `meadow bloom: +${bonus} hp`;
  } else if (tile.type === 'crypt') {
    fight(player, 'crypt duel', 11, 16);
  } else if (tile.type === 'forge') {
    player.armor += 3;
    if (Math.random() < 0.55 + player.lootLuck) drawLoot(player);
    addXp(player, 5);
    player.event = 'forge sparks: armor and loot';
  } else if (tile.type === 'shrine') {
    addXp(player, 14);
    player.hp = clamp(player.hp + 3, 0, player.maxHp);
    player.event = 'shrine surge: +14 xp';
  } else if (tile.type === 'mire') {
    player.nextMoveAt += 450;
    if (player.hand.length < 7) player.hand.push(drawCard());
    player.event = 'mire drag: slowed, drew a card';
  } else if (tile.type === 'ambush') {
    fight(player, 'bandit ambush', 13, 13);
    tile.charges -= 1;
    if (tile.charges <= 0) tile.type = 'road';
  } else if (tile.type === 'scorch') {
    player.hp -= 7;
    tile.charges -= 1;
    player.event = 'meteor scorch: -7 hp';
    if (tile.charges <= 0) tile.type = 'road';
  } else {
    const roll = Math.random();
    if (roll < 0.38) fight(player, 'road skirmish', 4, 6);
    else if (roll < 0.52) {
      player.hp = clamp(player.hp + 3, 0, player.maxHp);
      player.event = 'quiet road: +3 hp';
    } else player.event = 'sprinting';
  }

  if (player.hp <= 0) {
    player.deaths += 1;
    player.hp = Math.ceil(player.maxHp * 0.58);
    player.position = 0;
    player.hand = player.hand.slice(0, 3);
    player.event = 'fell, then revived at camp';
    addLog(`${player.name} got knocked back to camp.`);
  }
  player.lastEventAt = now();
}

function movementDelay(player) {
  const base = 1125 - player.speed * 72;
  return clamp(base, 390, 1300);
}

function advancePlayer(player) {
  player.position = (player.position + 1) % boardPath.length;
  if (player.position === 0) {
    player.laps += 1;
    player.hp = clamp(player.hp + player.lapHeal, 0, player.maxHp);
    addXp(player, 4);
    if (player.hand.length < 7) player.hand.push(drawCard());
    addLog(`${player.name} completed lap ${player.laps}.`);
  }
  triggerTile(player, player.board[player.position]);
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

function gameSnapshot() {
  const players = Object.values(game.players)
    .map((player) => ({ ...player, score: score(player) }))
    .sort((a, b) => b.score - a.score);
  return {
    status: game.status,
    tick: game.tick,
    log: game.log,
    players
  };
}

function playTerrain(player, cardInstanceId, tileIndex) {
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card || card.kind !== 'terrain') return;
  const tile = player.board[tileIndex];
  if (!tile || tile.type === 'camp') return;
  tile.type = card.tile;
  tile.charges = card.tile === 'mire' ? 5 : 0;
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.event = `placed ${card.name}`;
  addXp(player, 2);
  addLog(`${player.name} placed ${card.name}.`);
}

function playRival(player, cardInstanceId, targetId) {
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  const target = game.players[targetId];
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
  addXp(player, 4);
  player.event = `hit ${target.name} with ${card.name}`;
  addLog(`${player.name} played ${card.name} on ${target.name}.`);
}

function chooseTrait(player, traitId) {
  if (!player.pendingTraits.includes(traitId)) return;
  player.traits.push(traitId);
  player.pendingTraits = [];
  recalcStats(player);
  const trait = traits.find((item) => item.id === traitId);
  player.event = `learned ${trait?.name ?? 'a trait'}`;
}

function equip(player, itemId) {
  const item = player.loot.find((entry) => entry.id === itemId);
  if (!item) return;
  player.loadout[item.slot] = item;
  recalcStats(player);
  player.event = `equipped ${item.name}`;
}

function botThink(player) {
  if (!player.isBot || game.tick % 3 !== 0) return;
  if (player.pendingTraits.length > 0) chooseTrait(player, sample(player.pendingTraits));
  if (player.loot.length > 0 && Math.random() < 0.4) equip(player, sample(player.loot).id);
  const card = sample(player.hand);
  if (!card) return;
  if (card.kind === 'terrain') {
    const tileIndex = 1 + rand(boardPath.length - 1);
    playTerrain(player, card.instanceId, tileIndex);
  } else {
    const rivals = Object.values(game.players).filter((candidate) => candidate.id !== player.id);
    if (rivals.length > 0) playRival(player, card.instanceId, sample(rivals).id);
  }
}

function runGameStep() {
  game.tick += 1;
  for (const player of Object.values(game.players)) {
    maybeDraw(player);
    if (now() >= player.nextMoveAt) advancePlayer(player);
    botThink(player);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true }
});

if (isProduction) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);
}

io.on('connection', (socket) => {
  socket.emit('config', publicConfig());
  socket.emit('state', gameSnapshot());

  socket.on('join', ({ name, heroId } = {}) => {
    if (!game.players[socket.id]) {
      const occupied = Object.values(game.players).filter((player) => !player.isBot || player.connected).length;
      if (occupied >= 4) {
        socket.emit('notice', 'Room is full. Open another room support is next.');
        return;
      }
      game.players[socket.id] = createPlayer(socket.id, name, heroId);
      addLog(`${game.players[socket.id].name} joined as ${heroes.find((hero) => hero.id === game.players[socket.id].heroId)?.name}.`);
    }
    game.status = 'running';
    io.emit('state', gameSnapshot());
  });

  socket.on('addBot', () => {
    if (Object.keys(game.players).length >= 4) return;
    const hero = sample(heroes);
    const botId = `bot-${game.botCounter++}`;
    game.players[botId] = createPlayer(botId, `Bot ${game.botCounter - 1}`, hero.id, true);
    game.status = 'running';
    addLog(`${game.players[botId].name} entered as ${hero.name}.`);
    io.emit('state', gameSnapshot());
  });

  socket.on('placeCard', ({ cardId, tileIndex } = {}) => {
    const player = game.players[socket.id];
    if (!player) return;
    playTerrain(player, cardId, Number(tileIndex));
    io.emit('state', gameSnapshot());
  });

  socket.on('playRivalCard', ({ cardId, targetId } = {}) => {
    const player = game.players[socket.id];
    if (!player) return;
    playRival(player, cardId, targetId);
    io.emit('state', gameSnapshot());
  });

  socket.on('equip', ({ itemId } = {}) => {
    const player = game.players[socket.id];
    if (!player) return;
    equip(player, itemId);
    io.emit('state', gameSnapshot());
  });

  socket.on('chooseTrait', ({ traitId } = {}) => {
    const player = game.players[socket.id];
    if (!player) return;
    chooseTrait(player, traitId);
    io.emit('state', gameSnapshot());
  });

  socket.on('disconnect', () => {
    const player = game.players[socket.id];
    if (!player) return;
    addLog(`${player.name} left the loop.`);
    delete game.players[socket.id];
    io.emit('state', gameSnapshot());
  });
});

setInterval(runGameStep, 260);
setInterval(() => io.emit('state', gameSnapshot()), 360);

server.listen(port, '0.0.0.0', () => {
  console.log(`Loopduel listening on http://localhost:${port}`);
});
