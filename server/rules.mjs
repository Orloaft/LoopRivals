export const maxPlayers = 4;
export const goalScore = 12600;
// Global pacing multiplier. >1 slows the game down (all timed delays get longer).
// 2.4 keeps the board readable while restoring the "always moving" pressure.
const timeScale = 2.4;
export const matchTiers = [
  { id: 1, name: 'Tier I: Opening Loop', minScore: 0, text: 'Build a temporary road and get strong enough to ascend.' },
  { id: 2, name: 'Tier II: Hungry Loop', minScore: 1800, text: 'The board resets, enemies hit harder, and rewards climb.' },
  { id: 3, name: 'Tier III: Dying Loop', minScore: 4500, text: 'The board resets again. Survive long enough to challenge the loop boss.' }
];
const tileLoopLifeByTier = { 1: 3, 2: 2, 3: 2 };
const finalBossScore = goalScore;

const combatEncounters = {
  'wolf grove': {
    enemyId: 'thorn-wolf',
    enemyName: 'Thorn Wolf',
    backgroundId: 'grove',
    effect: 'claw'
  },
  'crypt duel': {
    enemyId: 'crypt-wraith',
    enemyName: 'Crypt Wraith',
    backgroundId: 'crypt',
    effect: 'spectral'
  },
  'bone pit': {
    enemyId: 'crypt-wraith',
    enemyName: 'Bone Host',
    backgroundId: 'crypt',
    effect: 'spectral'
  },
  'wolf den': {
    enemyId: 'thorn-wolf',
    enemyName: 'Wolf Pack',
    backgroundId: 'grove',
    effect: 'claw'
  },
  'ruined keep': {
    enemyId: 'brigand',
    enemyName: 'Keep Reavers',
    backgroundId: 'road',
    effect: 'sword'
  },
  'blood moon': {
    enemyId: 'ash-imp',
    enemyName: 'Moonbound Fiend',
    backgroundId: 'forge',
    effect: 'ember'
  },
  'wyrm gate': {
    enemyId: 'ash-imp',
    enemyName: 'Gate Wyrm',
    backgroundId: 'forge',
    effect: 'ember'
  },
  'bandit ambush': {
    enemyId: 'brigand',
    enemyName: 'Road Brigand',
    backgroundId: 'road',
    effect: 'sword'
  },
  'road skirmish': {
    enemyId: 'brigand',
    enemyName: 'Road Brigand',
    backgroundId: 'road',
    effect: 'sword'
  },
  'obelisk shade': {
    enemyId: 'ash-imp',
    enemyName: 'Obelisk Shade',
    backgroundId: 'forge',
    effect: 'ember'
  },
  'gate warden': {
    enemyId: 'crypt-wraith',
    enemyName: 'Loop Warden',
    backgroundId: 'crypt',
    effect: 'spectral'
  },
  'crown gate': {
    enemyId: 'ash-imp',
    enemyName: 'Crown Gate',
    backgroundId: 'forge',
    effect: 'ember'
  },
  'loop tyrant': {
    enemyId: 'crypt-wraith',
    enemyName: 'The Loop Tyrant',
    backgroundId: 'crypt',
    effect: 'spectral'
  }
};

export const heroes = [
  {
    id: 'ember-knight',
    name: 'Ember Knight',
    title: 'tempo bruiser',
    icon: '🔥',
    color: '#f45d43',
    maxHp: 46,
    power: 9,
    guard: 5,
    speed: 5,
    revivePower: 1,
    text: 'A direct fighter with steady tempo and bonus pressure after knockdowns.'
  },
  {
    id: 'moss-warden',
    name: 'Moss Warden',
    title: 'board shaper',
    icon: '🌿',
    color: '#45b36b',
    maxHp: 50,
    power: 7,
    guard: 6,
    speed: 5,
    lapHeal: 4,
    terrainScore: 6,
    text: 'A resilient shaper who converts healing terrain into reliable scoring.'
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
    speed: 5,
    lootLuck: 0.06,
    text: 'A fast looter with the best lap economy but fragile under focused attacks.'
  },
  {
    id: 'rune-archer',
    name: 'Rune Archer',
    title: 'rival control',
    icon: '🏹',
    color: '#4ab9ef',
    maxHp: 45,
    power: 8,
    guard: 5,
    speed: 5,
    sabotage: 1,
    text: 'A control specialist who scores by disrupting whoever is leading.'
  },
  {
    id: 'grave-singer',
    name: 'Grave Singer',
    title: 'risk engine',
    icon: '💀',
    color: '#d8d1b0',
    maxHp: 39,
    power: 9,
    guard: 2,
    speed: 5,
    revivePower: 1,
    terrainScore: 2,
    text: 'A risky XP engine that thrives on dangerous tiles and comeback traits.'
  }
];

export const terrainCards = [
  { id: 'grove', name: 'Grove', kind: 'terrain', tile: 'grove', icon: '♣', text: '+XP fights, small loot chance.' },
  { id: 'meadow', name: 'Meadow', kind: 'terrain', tile: 'meadow', icon: '✦', text: 'Heal when crossed. Warden loves it.' },
  { id: 'crypt', name: 'Crypt', kind: 'terrain', tile: 'crypt', icon: '☗', text: 'Hard fight. Better loot.' },
  { id: 'wolf-den', name: 'Wolf Den', kind: 'terrain', tile: 'wolfden', icon: '♣', text: 'Pack fight. Stacks hard beside danger.' },
  { id: 'bone-pit', name: 'Bone Pit', kind: 'terrain', tile: 'bonepit', icon: '☗', text: 'Two-enemy undead fight with better loot.' },
  { id: 'ruined-keep', name: 'Ruined Keep', kind: 'terrain', tile: 'ruinedkeep', icon: '⚔', text: 'Elite raider fight. High XP and loot odds.' },
  { id: 'blood-moon', name: 'Blood Moon', kind: 'terrain', tile: 'bloodmoon', icon: '☾', text: 'Danger aura: nearby fights stack larger.' },
  { id: 'wyrm-gate', name: 'Wyrm Gate', kind: 'terrain', tile: 'wyrmgate', icon: '◆', text: 'Boss tile. Big rewards if you can survive.' },
  { id: 'forge', name: 'Forge', kind: 'terrain', tile: 'forge', icon: '⚒', text: 'Loot and temporary armor.' },
  { id: 'shrine', name: 'Shrine', kind: 'terrain', tile: 'shrine', icon: '✚', text: 'XP burst and trait tempo.' },
  { id: 'mire', name: 'Mire', kind: 'terrain', tile: 'mire', icon: '≈', text: 'Slows hero, but pays cards.' },
  { id: 'village', name: 'Village', kind: 'terrain', tile: 'village', icon: '⌂', text: 'Safe heal, small score, small loot chance.' },
  { id: 'obelisk', name: 'Obelisk', kind: 'terrain', tile: 'obelisk', icon: '◆', text: 'Power spike and XP, but attracts fights.' },
  { id: 'watchtower', name: 'Watchtower', kind: 'terrain', tile: 'watchtower', icon: '◈', text: 'Draws rival cards and grants control score.' }
];

export const rivalCards = [
  { id: 'bandits', name: 'Bandits', kind: 'rival', icon: '⚔', text: 'Adds an ambush to a rival loop.' },
  { id: 'hex', name: 'Hex', kind: 'rival', icon: '☾', text: 'Curses a rival for 3 events.' },
  { id: 'meteor', name: 'Meteor', kind: 'rival', icon: '☄', text: 'Damages a rival and scorches a tile.' },
  { id: 'tax', name: 'Tithe Trap', kind: 'rival', icon: '$', text: 'Steals tempo: rival loses a card or HP.' },
  { id: 'landslide', name: 'Landslide', kind: 'rival', icon: '⬖', text: 'Turns an upcoming rival tile into mire.' },
  { id: 'cutpurse', name: 'Cutpurse', kind: 'rival', icon: '✂', text: 'Steals a loose loot tempo or wounds instead.' }
];

function talent(heroId, id, name, text, tier, x, y, bonus, prereqs = []) {
  return { id, heroId, name, text, tier, x, y, bonus, prereqs };
}

export const talentTrees = {
  'ember-knight': [
    talent('ember-knight', 'ember-oath', 'Ember Oath', '+1 power, +4 max HP.', 1, 50, 12, { power: 1, maxHp: 4 }),
    talent('ember-knight', 'cinder-step', 'Cinder Step', '+1 speed, draw faster.', 2, 28, 34, { speed: 1, drawRate: 0.92 }, ['ember-oath']),
    talent('ember-knight', 'shield-heat', 'Shield Heat', '+2 guard, +3 max HP.', 2, 72, 34, { guard: 2, maxHp: 3 }, ['ember-oath']),
    talent('ember-knight', 'red-riposte', 'Red Riposte', '+3 rival damage, +1 power.', 3, 20, 58, { sabotage: 3, power: 1 }, ['cinder-step']),
    talent('ember-knight', 'hearthguard', 'Hearthguard', '+1 guard, heal more on laps.', 3, 80, 58, { guard: 1, lapHeal: 3 }, ['shield-heat']),
    talent('ember-knight', 'overheat', 'Overheat', '+2 power after revives.', 4, 35, 82, { revivePower: 2 }, ['red-riposte']),
    talent('ember-knight', 'loopforged', 'Loopforged', '+1 power, +1 guard, +1 speed, terrain scores more.', 4, 65, 82, { power: 1, guard: 1, speed: 1, terrainScore: 2 }, ['hearthguard'])
  ],
  'moss-warden': [
    talent('moss-warden', 'warden-root', 'Warden Root', '+2 lap heal, terrain scores more.', 1, 50, 12, { lapHeal: 2, terrainScore: 2 }),
    talent('moss-warden', 'greenwall', 'Greenwall', '+2 guard, +5 max HP.', 2, 28, 34, { guard: 2, maxHp: 5 }, ['warden-root']),
    talent('moss-warden', 'path-sower', 'Path Sower', 'Terrain cards score more.', 2, 72, 34, { terrainScore: 4 }, ['warden-root']),
    talent('moss-warden', 'meadowbind', 'Meadowbind', '+4 lap heal, +2 max HP.', 3, 20, 58, { lapHeal: 4, maxHp: 2 }, ['greenwall']),
    talent('moss-warden', 'seed-cache', 'Seed Cache', 'Draw faster and find loot slightly more often.', 3, 80, 58, { drawRate: 0.94, lootLuck: 0.08 }, ['path-sower']),
    talent('moss-warden', 'old-bark', 'Old Bark', '+2 guard, +4 max HP.', 4, 35, 82, { guard: 2, maxHp: 4 }, ['meadowbind']),
    talent('moss-warden', 'wild-cartographer', 'Wild Cartographer', '+1 speed, terrain scores more.', 4, 65, 82, { speed: 1, terrainScore: 3 }, ['seed-cache'])
  ],
  'night-vagrant': [
    talent('night-vagrant', 'moon-pocket', 'Moon Pocket', 'Find loot more often, draw slightly faster.', 1, 50, 12, { lootLuck: 0.06, drawRate: 0.97 }),
    talent('night-vagrant', 'softstep', 'Softstep', '+1 speed, +1 guard.', 2, 28, 34, { speed: 1, guard: 1 }, ['moon-pocket']),
    talent('night-vagrant', 'black-market', 'Black Market', 'Find better loot more often.', 2, 72, 34, { lootLuck: 0.1 }, ['moon-pocket']),
    talent('night-vagrant', 'knife-rhythm', 'Knife Rhythm', '+1 power, draw faster.', 3, 20, 58, { power: 1, drawRate: 0.94 }, ['softstep']),
    talent('night-vagrant', 'smoke-veil', 'Smoke Veil', '+8 max HP, +2 guard.', 3, 80, 58, { maxHp: 8, guard: 2 }, ['black-market']),
    talent('night-vagrant', 'night-haul', 'Night Haul', '+1 speed and stronger loot odds.', 4, 35, 82, { speed: 1, lootLuck: 0.08 }, ['knife-rhythm']),
    talent('night-vagrant', 'vanish-loop', 'Vanish Loop', '+1 speed, +1 power, +4 max HP.', 4, 65, 82, { speed: 1, power: 1, maxHp: 4 }, ['smoke-veil'])
  ],
  'rune-archer': [
    talent('rune-archer', 'rune-string', 'Rune String', '+2 rival damage, draw faster.', 1, 50, 12, { sabotage: 2, drawRate: 0.94 }),
    talent('rune-archer', 'blue-fletching', 'Blue Fletching', '+1 power, +1 speed.', 2, 28, 34, { power: 1, speed: 1 }, ['rune-string']),
    talent('rune-archer', 'markbreaker', 'Markbreaker', '+4 rival damage.', 2, 72, 34, { sabotage: 4 }, ['rune-string']),
    talent('rune-archer', 'watcher-code', 'Watcher Code', 'Terrain scores more, draw faster.', 3, 20, 58, { terrainScore: 4, drawRate: 0.93 }, ['blue-fletching']),
    talent('rune-archer', 'hex-line', 'Hex Line', '+2 rival damage, +1 guard.', 3, 80, 58, { sabotage: 2, guard: 1 }, ['markbreaker']),
    talent('rune-archer', 'split-shot', 'Split Shot', '+1 power and stronger rival damage.', 4, 35, 82, { power: 1, sabotage: 3 }, ['watcher-code']),
    talent('rune-archer', 'sky-sigil', 'Sky Sigil', '+1 speed, +8 max HP.', 4, 65, 82, { speed: 1, maxHp: 8 }, ['hex-line'])
  ],
  'grave-singer': [
    talent('grave-singer', 'bone-chorus', 'Bone Chorus', '+1 power, revives hit harder.', 1, 50, 12, { power: 1, revivePower: 1 }),
    talent('grave-singer', 'crypt-hunger', 'Crypt Hunger', '+2 power, +2 terrain score.', 2, 28, 34, { power: 2, terrainScore: 2 }, ['bone-chorus']),
    talent('grave-singer', 'last-verse', 'Last Verse', '+7 max HP, revives hit harder.', 2, 72, 34, { maxHp: 7, revivePower: 1 }, ['bone-chorus']),
    talent('grave-singer', 'dirge-step', 'Dirge Step', '+1 speed, draw faster.', 3, 20, 58, { speed: 1, drawRate: 0.94 }, ['crypt-hunger']),
    talent('grave-singer', 'bone-plate', 'Bone Plate', '+2 guard, +4 max HP.', 3, 80, 58, { guard: 2, maxHp: 4 }, ['last-verse']),
    talent('grave-singer', 'hollow-gold', 'Hollow Gold', 'Find loot more often, +1 power.', 4, 35, 82, { lootLuck: 0.14, power: 1 }, ['dirge-step']),
    talent('grave-singer', 'requiem-loop', 'Requiem Loop', '+2 revive power, +1 guard.', 4, 65, 82, { revivePower: 2, guard: 1 }, ['bone-plate'])
  ]
};

export const traits = Object.values(talentTrees).flat();

export const equipmentSlots = ['weapon', 'shield', 'helm', 'armor', 'gloves', 'boots', 'ring', 'charm'];
const combatWindupMs = 180;
const combatBeatMs = 203;
const combatTailMs = 360;

const lootNames = {
  weapon: ['Glass Pike', 'Moonblade', 'Ash Bow', 'Thorn Mace', 'Cinder Wand'],
  shield: ['Tin Aegis', 'Root Buckler', 'Mirror Ward', 'Crypt Kite', 'Cinder Guard'],
  helm: ['Crowncap Helm', 'Ashen Sallet', 'Moon Hood', 'Bone Visor', 'Rune Circlet'],
  armor: ['Patchwork Mail', 'Duel Cloak', 'Grave Harness', 'Briar Plate', 'Loop Hauberk'],
  gloves: ['Mire Grips', 'Duelist Wraps', 'Ember Gaunts', 'Thorn Claws', 'Hex Mitts'],
  boots: ['Road Boots', 'Softstep Greaves', 'Moss Treads', 'Spur Sabatons', 'Wyrm Soles'],
  ring: ['Red Loop Ring', 'Lucky Band', 'Vow Signet', 'Black Market Seal', 'Grove Coil'],
  charm: ['Lucky Tooth', 'War Drum', 'Soft Lantern', 'Hex Needle', 'Green Sigil']
};

const lootRoles = {
  duelist: {
    label: 'Duelist',
    prefix: ['Keen', 'Red', 'Vowbound'],
    stat: { power: 1 },
    bonus: { sabotage: 1 },
    slots: ['weapon', 'gloves', 'ring']
  },
  bulwark: {
    label: 'Bulwark',
    prefix: ['Iron', 'Rooted', 'Citadel'],
    stat: { guard: 1, maxHp: 2 },
    bonus: { lapHeal: 1 },
    slots: ['shield', 'helm', 'armor']
  },
  scout: {
    label: 'Scout',
    prefix: ['Quick', 'Roadwise', 'Lanternlit'],
    stat: { speed: 1 },
    bonus: { drawRate: -0.02 },
    slots: ['boots', 'gloves', 'charm']
  },
  harvest: {
    label: 'Harvest',
    prefix: ['Lucky', 'Gilded', 'Black-Market'],
    stat: { maxHp: 1 },
    bonus: { lootLuck: 0.03 },
    slots: ['ring', 'charm', 'helm']
  },
  ritual: {
    label: 'Ritual',
    prefix: ['Hexed', 'Grave', 'Moon-Rune'],
    stat: { power: 1 },
    bonus: { terrainScore: 2, revivePower: 1 },
    slots: ['weapon', 'armor', 'charm']
  }
};

export const boardPath = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 3], [0, 2], [0, 1]
];

export function publicConfig() {
  return { heroes, cards: [...terrainCards, ...rivalCards], boardPath, traits, talentTrees, maxPlayers, goalScore, matchTiers };
}

export function createRoom(id, options = {}) {
  const startTime = options.now ?? Date.now();
  return {
    id,
    status: 'lobby',
    startedAt: startTime,
    lastActivityAt: startTime,
    finishedAt: null,
    now: startTime,
    simulated: Boolean(options.simulated),
    rngState: normalizeSeed(options.seed ?? id),
    tick: 0,
    players: {},
    hostId: null,
    log: ['Loopduel lobby is open. Join, pick a hero, then keep up.'],
    botCounter: 1,
    nextSeatIndex: 0,
    winnerId: null,
    tier: matchTiers[0],
    claim: null
  };
}

export function resetRoom(room) {
  const id = room.id;
  const hostId = room.hostId;
  Object.assign(room, createRoom(id, { seed: room.rngState, simulated: room.simulated, now: now(room) }));
  room.hostId = hostId;
}

export function activePlayerCount(room) {
  return Object.keys(room.players).length;
}

export function hasRoomForPlayer(room) {
  return activePlayerCount(room) < maxPlayers;
}

export function score(player) {
  return (
    player.level * 390 +
    player.laps * 130 +
    player.kos * 64 +
    player.rivalHits * 72 +
    player.tilesPlaced * 44 +
    player.cardsPlayed * 9 +
    player.loot.length * 24 +
    (player.gold ?? 0) +
    player.xp
  );
}

export function roomSnapshot(room) {
  const scoredPlayers = Object.values(room.players).map((player) => ({ ...player, score: score(player) }));
  const ranked = [...scoredPlayers].sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return (a.seatIndex ?? 0) - (b.seatIndex ?? 0);
  });
  const ranks = new Map(ranked.map((player, index) => [player.id, index + 1]));
  const players = scoredPlayers
    .map((player) => ({ ...player, rank: ranks.get(player.id) ?? 1 }))
    .sort((a, b) => {
      const seatDiff = (a.seatIndex ?? 0) - (b.seatIndex ?? 0);
      if (seatDiff !== 0) return seatDiff;
      return a.id.localeCompare(b.id);
    });
  return {
    id: room.id,
    status: room.status,
    tick: room.tick,
    log: room.log,
    maxPlayers,
    goalScore,
    hostId: room.hostId,
    winnerId: room.winnerId,
    winner: room.winnerId ? players.find((player) => player.id === room.winnerId) ?? null : null,
    leaderboard: ranked.map((player, index) => ({
      id: player.id,
      name: player.name,
      heroId: player.heroId,
      color: player.color,
      score: player.score,
      rank: index + 1,
      hp: player.hp,
      maxHp: player.maxHp,
      level: player.level,
      laps: player.laps
    })),
    tier: room.tier ?? matchTiers[0],
    claim: room.claim ? {
      ...room.claim,
      remainingMs: Math.max(0, room.claim.expiresAt - now(room)),
      claimantName: room.players[room.claim.playerId]?.name ?? 'Runner',
      claimantColor: room.players[room.claim.playerId]?.color ?? '#d2b15c'
    } : null,
    players
  };
}

export function createPlayer(id, name, heroId, isBot = false, room = null) {
  const hero = heroes.find((item) => item.id === heroId) ?? sample(room, heroes);
  return {
    id,
    name: name?.trim().slice(0, 20) || hero.name,
    heroId: hero.id,
    isBot,
    connected: !isBot,
    color: hero.color,
    seatIndex: room ? room.nextSeatIndex++ : 0,
    board: blankBoard(),
    hand: [drawCard(room, 'terrain'), drawCard(room, 'terrain')],
    loot: [],
    loadout: emptyLoadout(),
    gold: 0,
    traits: [],
    pendingTraits: [],
    talentPoints: 0,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    power: hero.power,
    guard: hero.guard,
    speed: hero.speed,
    drawRate: 1,
    sabotage: hero.sabotage ?? 0,
    lootLuck: hero.lootLuck ?? 0,
    lapHeal: hero.lapHeal ?? 0,
    terrainScore: hero.terrainScore ?? 0,
    revivePower: hero.revivePower ?? 0,
    position: 0,
    laps: 0,
    level: 1,
    xp: 0,
    kos: 0,
    rivalHits: 0,
    cardsPlayed: 0,
    tilesPlaced: 0,
    deaths: 0,
    loopTier: 1,
    tierStartScore: 0,
    tierStartLap: 0,
    bossAttempts: 0,
    soloGatesCleared: [],
    claimStartedAt: null,
    claimStartLap: null,
    claimDeathsAtStart: 0,
    marked: false,
    curse: 0,
    armor: 0,
    nextMoveAt: now(room) + 1000 * timeScale,
    nextDrawAt: now(room) + 3600 * timeScale,
    event: 'entered the loop',
    message: 'entered the loop',
    lastEventAt: now(room),
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
    if (!room.hostId && !existing.isBot) room.hostId = existing.id;
    room.lastActivityAt = now(room);
    addLog(room, `${existing.name} reconnected.`);
    return { player: existing, created: false };
  }

  if (!hasRoomForPlayer(room)) {
    return { player: null, created: false, full: true };
  }

  const player = createPlayer(playerId, name, heroId, false, room);
  room.players[player.id] = player;
  if (!room.hostId) room.hostId = player.id;
  room.lastActivityAt = now(room);
  room.status = room.status === 'finished' ? 'finished' : 'running';
  addLog(room, `${player.name} joined as ${heroes.find((hero) => hero.id === player.heroId)?.name}.`);
  return { player, created: true };
}

export function disconnectPlayer(room, playerId) {
  const player = room.players[playerId];
  if (!player || player.isBot) return;
  player.connected = false;
  player.event = 'disconnected';
  room.lastActivityAt = now(room);
  if (room.hostId === playerId) {
    room.hostId = Object.values(room.players).find((candidate) => !candidate.isBot && candidate.connected)?.id ?? null;
    if (room.hostId) addLog(room, `${room.players[room.hostId].name} is now room host.`);
  }
  addLog(room, `${player.name} disconnected.`);
}

export function addBot(room) {
  if (!hasRoomForPlayer(room) || room.status === 'finished') return null;
  const hero = sample(room, heroes);
  const botId = `bot-${room.botCounter++}`;
  const botNames = ['Cinder CPU', 'Mire CPU', 'Hex CPU', 'Grove CPU'];
  const bot = createPlayer(botId, botNames[(room.botCounter - 2) % botNames.length], hero.id, true, room);
  room.players[botId] = bot;
  room.lastActivityAt = now(room);
  room.status = 'running';
  addLog(room, `${bot.name} entered as ${hero.name}.`);
  return bot;
}

export function fillCpuOpponents(room, targetCount = maxPlayers) {
  const added = [];
  while (activePlayerCount(room) < Math.min(targetCount, maxPlayers)) {
    const bot = addBot(room);
    if (!bot) break;
    added.push(bot);
  }
  if (added.length > 0) addLog(room, `CPU opponents filled ${added.length} open seat${added.length === 1 ? '' : 's'}.`);
  return added;
}

export function playTerrain(room, player, cardInstanceId, tileIndex) {
  if (room.status === 'finished') return;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card || card.kind !== 'terrain') return;
  const tile = player.board[tileIndex];
  if (!tile || tile.type === 'camp') return;
  tile.type = card.tile;
  tile.charges = card.tile === 'mire' ? 5 : 0;
  tile.expiresOnLap = player.laps + tileLoopLife(player);
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.cardsPlayed += 1;
  player.tilesPlaced += 1;
  player.event = `placed ${card.name}`;
  room.lastActivityAt = now(room);
  addXp(room, player, 3 + player.terrainScore);
  addLog(room, `${player.name} placed ${card.name}.`);
  checkWinner(room);
}

export function playRival(room, player, cardInstanceId, targetId, tileIndex = null) {
  if (room.status === 'finished') return;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  const target = room.players[targetId];
  if (!card || card.kind !== 'rival' || !target || target.id === player.id) return;
  const hasTileTarget = Number.isInteger(tileIndex);
  const targetedTile = hasTileTarget ? target.board[tileIndex] : null;
  if (hasTileTarget && (!targetedTile || targetedTile.type !== 'road' || targetedTile.index === target.position)) return;
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  const markedBonus = target.marked ? 3 : 0;
  const bonus = player.sabotage + markedBonus;

  if (targetedTile) {
    if (card.id === 'meteor') {
      targetedTile.type = 'scorch';
      targetedTile.charges = 2;
    } else if (card.id === 'hex' || card.id === 'landslide') {
      targetedTile.type = 'mire';
      targetedTile.charges = card.id === 'hex' ? 3 : 4;
    } else {
      targetedTile.type = 'ambush';
      targetedTile.charges = card.id === 'bandits' ? 2 : 1;
    }
    target.event = `${card.name} armed on the road`;
  } else if (card.id === 'bandits') {
    const tile = target.board[(target.position + 3 + rand(room, 5)) % target.board.length];
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
    if (target.hand.length > 0) target.hand.splice(rand(room, target.hand.length), 1);
    else target.hp -= 5 + bonus;
    target.event = 'tempo stolen';
  } else if (card.id === 'landslide') {
    const tile = target.board[(target.position + 1 + rand(room, 6)) % target.board.length];
    if (tile.type !== 'camp') {
      tile.type = 'mire';
      tile.charges = 4;
    }
    target.event = 'landslide on the path';
  } else if (card.id === 'cutpurse') {
    const unequipped = target.loot.filter((item) => !Object.values(normalizeLoadout(target)).some((equipped) => equipped?.id === item.id));
    if (unequipped.length > 0) {
      const stolen = unequipped[rand(room, unequipped.length)];
      target.loot = target.loot.filter((item) => item.id !== stolen.id);
      player.loot.unshift(stolen);
      player.loot = player.loot.slice(0, 10);
      target.event = 'loot stolen';
    } else {
      target.hp -= 6 + bonus;
      target.event = 'cutpurse wound';
    }
  }
  player.cardsPlayed += 1;
  player.rivalHits += 1;
  if (target.marked) {
    target.nextMoveAt += 420 * timeScale;
    if (room.claim?.playerId === target.id) room.claim.expiresAt -= 2600;
  }
  room.lastActivityAt = now(room);
  resolveDefeat(room, target);
  addXp(room, player, 7);
  player.event = targetedTile ? `armed ${card.name} on ${target.name}'s road` : `hit ${target.name} with ${card.name}`;
  addLog(room, targetedTile
    ? `${player.name} armed ${card.name} on ${target.name}'s road.`
    : `${player.name} played ${card.name} on ${target.name}.`);
  checkWinner(room);
}

export function chooseTrait(player, traitId) {
  refreshPendingTraits(player);
  if (!player.pendingTraits.includes(traitId)) return;
  player.traits.push(traitId);
  player.talentPoints = Math.max(0, player.talentPoints - 1);
  player.pendingTraits = [];
  recalcStats(player);
  const trait = traits.find((item) => item.id === traitId);
  player.event = `learned ${trait?.name ?? 'a trait'}`;
  refreshPendingTraits(player);
}

export function equip(player, itemId) {
  const item = player.loot.find((entry) => entry.id === itemId);
  if (!item) return;
  normalizeLoadout(player)[item.slot] = item;
  recalcStats(player);
  player.event = `equipped ${item.name}`;
}

export function sellCard(room, player, cardInstanceId) {
  if (!player) return false;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card) return false;
  const value = card.kind === 'rival' ? 22 : 16;
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.gold = (player.gold ?? 0) + value;
  player.event = `sold ${card.name} for ${value} gold`;
  room.lastActivityAt = now(room);
  addLog(room, `${player.name} sold ${card.name} for ${value} gold.`);
  checkWinner(room);
  return true;
}

export function sellLoot(room, player, itemId) {
  if (!player) return false;
  const item = player.loot.find((entry) => entry.id === itemId);
  if (!item) return false;
  if (Object.values(normalizeLoadout(player)).some((equipped) => equipped?.id === item.id)) return false;
  const value = Math.max(18, Math.round(bestItemScore(item) * 4));
  player.loot = player.loot.filter((entry) => entry.id !== itemId);
  player.gold = (player.gold ?? 0) + value;
  player.event = `sold ${item.name} for ${value} gold`;
  room.lastActivityAt = now(room);
  addLog(room, `${player.name} sold ${item.name} for ${value} gold.`);
  checkWinner(room);
  return true;
}

export function runRoomStep(room, options = {}) {
  if (room.status !== 'running') return;
  if (room.simulated || options.advanceMs) room.now += options.advanceMs ?? 260;
  room.tick += 1;
  for (const player of Object.values(room.players)) {
    clearExpiredCombat(room, player);
    if (isCombatLocked(room, player)) {
      botThink(room, player);
      continue;
    }
    maybeDraw(room, player);
    if (now(room) >= player.nextMoveAt) advancePlayer(room, player);
    botThink(room, player);
  }
  updateEndgame(room);
}

export function checkWinner(room) {
  return updateEndgame(room);
}

function leader(room) {
  return Object.values(room.players)
    .sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.seatIndex ?? 0) - (b.seatIndex ?? 0);
    })[0] ?? null;
}

function tierForScore(value) {
  return [...matchTiers].reverse().find((tier) => value >= tier.minScore) ?? matchTiers[0];
}

function updateTier(room) {
  const top = leader(room);
  const nextTier = matchTiers[(top?.loopTier ?? 1) - 1] ?? tierForScore(top ? score(top) : 0);
  if ((room.tier?.id ?? 1) === nextTier.id) return;
  room.tier = nextTier;
  addLog(room, `${nextTier.name}: ${nextTier.text}`);
}

function updateMarks(room) {
  const top = leader(room);
  for (const player of Object.values(room.players)) {
    player.marked = Boolean(top && room.tier?.id >= 3 && player.id === top.id);
  }
}

function finishClaim(room, player) {
  room.status = 'finished';
  room.finishedAt = now(room);
  room.winnerId = player.id;
  player.marked = false;
  player.event = 'defeated the Loop Tyrant';
  addLog(room, `${player.name} defeated the Loop Tyrant and won with ${score(player)} points.`);
  return player;
}

function updateEndgame(room) {
  if (room.status !== 'running') return null;
  for (const player of Object.values(room.players)) promotePlayerIfReady(room, player);
  updateTier(room);
  updateMarks(room);

  const contender = Object.values(room.players)
    .filter((player) => (player.loopTier ?? 1) >= 3 && player.laps > (player.tierStartLap ?? 0) && score(player) >= finalBossScore && !isCombatLocked(room, player))
    .sort((a, b) => score(b) - score(a))[0];
  if (!contender) return null;
  return challengeLoopBoss(room, contender);
}

function loopTierForScore(value) {
  if (value >= matchTiers[2].minScore) return 3;
  if (value >= matchTiers[1].minScore) return 2;
  return 1;
}

function tileLoopLife(player) {
  return tileLoopLifeByTier[player.loopTier ?? 1] ?? 2;
}

function resetTile(tile) {
  tile.type = tile.index === 0 ? 'camp' : 'road';
  tile.charges = 0;
  delete tile.expiresOnLap;
}

function resetPlayerBoard(player) {
  for (const tile of player.board) resetTile(tile);
  player.position = 0;
}

function promotePlayerIfReady(room, player) {
  const currentTier = player.loopTier ?? 1;
  const nextTier = loopTierForScore(score(player));
  if (nextTier <= currentTier) return false;
  player.loopTier = Math.min(3, currentTier + 1);
  player.tierStartScore = score(player);
  player.tierStartLap = player.laps;
  resetPlayerBoard(player);
  player.hp = player.maxHp;
  player.armor = Math.max(player.armor, player.loopTier);
  player.combat = null;
  player.event = `entered tier ${player.loopTier}`;
  addLog(room, `${player.name} entered tier ${player.loopTier}; their loop collapsed into fresh road.`);
  if (loopTierForScore(score(player)) > player.loopTier) return promotePlayerIfReady(room, player);
  return true;
}

function challengeLoopBoss(room, player) {
  player.bossAttempts = (player.bossAttempts ?? 0) + 1;
  player.hp = player.maxHp;
  player.armor = Math.max(player.armor, 3);
  const survived = fight(room, player, 'loop tyrant', 42 + player.bossAttempts * 3, 160, 5);
  if (!survived) {
    resolveDefeat(room, player);
    addLog(room, `${player.name} was broken by the Loop Tyrant and must rebuild tier 3.`);
    return null;
  }
  return finishClaim(room, player);
}

function expireLoopTiles(room, player) {
  let expired = 0;
  for (const tile of player.board) {
    if (tile.type === 'camp' || tile.type === 'road' || !tile.expiresOnLap) continue;
    if (player.laps < tile.expiresOnLap) continue;
    resetTile(tile);
    expired += 1;
  }
  if (expired > 0) {
    player.event = `${expired} tile${expired === 1 ? '' : 's'} expired`;
    addLog(room, `${player.name}'s loop shed ${expired} expired tile${expired === 1 ? '' : 's'}.`);
  }
  updateMarks(room);
  return null;
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const text = String(seed ?? 'loopduel');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random(room = null) {
  if (!room) return Math.random();
  room.rngState = (Math.imul(room.rngState, 1664525) + 1013904223) >>> 0;
  return room.rngState / 4294967296;
}

function rand(room, max) {
  return Math.floor(random(room) * max);
}

function sample(room, list) {
  if (!list || list.length === 0) return null;
  return list[rand(room, list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function now(room = null) {
  return room?.simulated ? room.now : Date.now();
}

function randomId(room, prefix = 'id') {
  if (!room) return crypto.randomUUID();
  return `${prefix}-${room.tick}-${Math.floor(random(room) * 1e12).toString(36)}`;
}

function clearExpiredCombat(room, player) {
  if (!player.combat || now(room) < player.combat.expiresAt) return;
  player.combat = null;
}

function isCombatLocked(room, player) {
  return Boolean(player.combat && now(room) < player.combat.expiresAt);
}

function blankBoard() {
  return boardPath.map((coord, index) => ({
    index,
    coord,
    type: index === 0 ? 'camp' : 'road',
    charges: 0,
    expiresOnLap: null
  }));
}

function emptyLoadout() {
  return Object.fromEntries(equipmentSlots.map((slot) => [slot, null]));
}

function normalizeLoadout(player) {
  player.loadout = { ...emptyLoadout(), ...(player.loadout ?? {}) };
  return player.loadout;
}

function xpNeeded(player) {
  return 24 + player.level * 13;
}

function drawCard(room = null, preferredKind = null) {
  const soloPool = room ? activePlayerCount(room) <= 1 : false;
  const tierId = room?.tier?.id ?? 1;
  const rivalChance = tierId >= 3 ? 0.44 : tierId === 2 ? 0.38 : 0.3;
  const pool = preferredKind === 'terrain'
    ? terrainCards
    : preferredKind === 'rival'
      ? soloPool ? terrainCards : rivalCards
      : random(room) < 1 - rivalChance
        ? terrainCards
        : soloPool ? terrainCards : rivalCards;
  const card = sample(room, pool);
  return { ...card, instanceId: randomId(room, 'card') };
}

function drawLoot(room, player) {
  const slot = sample(room, equipmentSlots);
  const rarityRoll = random(room) + player.level * 0.04 + player.lootLuck;
  const rarity = rarityRoll > 1.08 ? 'relic' : rarityRoll > 0.76 ? 'rare' : 'common';
  const scale = rarity === 'relic' ? 3 : rarity === 'rare' ? 2 : 1;
  const secondary = rand(room, 2);
  const rolePool = Object.entries(lootRoles).filter(([, role]) => role.slots.includes(slot));
  const [, role] = sample(room, rolePool);
  const namePrefix = sample(room, role.prefix);
  const itemName = sample(room, lootNames[slot]);
  const bonusScale = rarity === 'relic' ? 2 : 1;
  const statScale = rarity === 'relic' ? 1 : 0;
  const item = {
    id: randomId(room, 'loot'),
    slot,
    name: `${rarity === 'relic' ? 'Relic ' : rarity === 'rare' ? 'Bright ' : ''}${namePrefix} ${itemName}`,
    rarity,
    role: role.label,
    power: (['weapon', 'gloves', 'ring'].includes(slot) ? scale + secondary : slot === 'helm' ? rand(room, 2) : 0) + (role.stat.power ?? 0) * statScale,
    guard: (['shield', 'armor', 'helm'].includes(slot) ? scale + secondary : slot === 'boots' ? rand(room, 2) : 0) + (role.stat.guard ?? 0) * statScale,
    speed: (['boots', 'charm', 'gloves'].includes(slot) ? Math.max(1, scale - (slot === 'gloves' ? 1 : 0)) : 0) + (role.stat.speed ?? 0) * statScale,
    maxHp: (['armor', 'shield', 'helm'].includes(slot) ? scale * (slot === 'armor' ? 3 : 2) : slot === 'ring' || slot === 'charm' ? scale : 0) + (role.stat.maxHp ?? 0) * scale,
    drawRate: role.bonus.drawRate ? Number((role.bonus.drawRate * bonusScale).toFixed(2)) : undefined,
    sabotage: role.bonus.sabotage ? role.bonus.sabotage * bonusScale : undefined,
    lootLuck: role.bonus.lootLuck ? Number((role.bonus.lootLuck * bonusScale).toFixed(2)) : undefined,
    lapHeal: role.bonus.lapHeal ? role.bonus.lapHeal * bonusScale : undefined,
    terrainScore: role.bonus.terrainScore ? role.bonus.terrainScore * bonusScale : undefined,
    revivePower: role.bonus.revivePower ? role.bonus.revivePower * bonusScale : undefined
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
  let sabotage = hero.sabotage ?? 0;
  let lootLuck = hero.lootLuck ?? 0;
  let lapHeal = hero.lapHeal ?? 0;
  let terrainScore = hero.terrainScore ?? 0;
  let revivePower = hero.revivePower ?? 0;

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
    terrainScore += trait.bonus.terrainScore ?? 0;
    revivePower += trait.bonus.revivePower ?? 0;
  }

  for (const item of Object.values(normalizeLoadout(player))) {
    if (!item) continue;
    maxHp += item.maxHp ?? 0;
    power += item.power ?? 0;
    guard += item.guard ?? 0;
    speed += item.speed ?? 0;
    drawRate *= Math.max(0.72, 1 + (item.drawRate ?? 0));
    sabotage += item.sabotage ?? 0;
    lootLuck += item.lootLuck ?? 0;
    lapHeal += item.lapHeal ?? 0;
    terrainScore += item.terrainScore ?? 0;
    revivePower += item.revivePower ?? 0;
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
  player.terrainScore = terrainScore;
  player.revivePower = revivePower;
  if (hpGain > 0) player.hp += hpGain;
  player.hp = clamp(player.hp, 0, player.maxHp);
}

function availableTraits(player) {
  if ((player.talentPoints ?? 0) <= 0) return [];
  return (talentTrees[player.heroId] ?? [])
    .filter((trait) => !player.traits.includes(trait.id))
    .filter((trait) => trait.prereqs.every((prereq) => player.traits.includes(prereq)));
}

function refreshPendingTraits(player) {
  player.pendingTraits = availableTraits(player).map((trait) => trait.id);
  return player.pendingTraits;
}

function addXp(room, player, amount) {
  player.xp += amount;
  while (player.xp >= xpNeeded(player)) {
    player.xp -= xpNeeded(player);
    player.level += 1;
    player.hp = clamp(player.hp + 10, 0, player.maxHp);
    if (player.traits.length + player.talentPoints < (talentTrees[player.heroId] ?? []).length) {
      player.talentPoints += 1;
      refreshPendingTraits(player);
    }
    player.event = `hit level ${player.level}`;
    addLog(room, `${player.name} reached level ${player.level}.`);
  }
}

const dangerTiles = new Set(['grove', 'crypt', 'wolfden', 'bonepit', 'ruinedkeep', 'bloodmoon', 'wyrmgate', 'obelisk', 'ambush', 'scorch']);
const stackAuraTiles = new Set(['bloodmoon', 'bonepit', 'wolfden', 'wyrmgate']);

function encounterStack(room, player, tile, baseCount = 1) {
  const previous = player.board[(tile.index - 1 + player.board.length) % player.board.length];
  const next = player.board[(tile.index + 1) % player.board.length];
  const nearbyDanger = [previous, next].filter((candidate) => dangerTiles.has(candidate?.type)).length;
  const auraPressure = player.board.filter((candidate) => {
    if (!stackAuraTiles.has(candidate.type)) return false;
    const distance = Math.min(
      Math.abs(candidate.index - tile.index),
      player.board.length - Math.abs(candidate.index - tile.index)
    );
    return distance > 0 && distance <= 2;
  }).length;
  const bloodMoonHere = tile.type === 'bloodmoon' ? 1 : 0;
  return clamp(baseCount + nearbyDanger + auraPressure + bloodMoonHere, 1, 5);
}

function fight(room, player, label, threat, reward, enemyCount = 1) {
  const hpBefore = player.hp;
  const tier = player.loopTier ?? room.tier?.id ?? 1;
  const tierThreat = (tier - 1) * 5;
  const tierReward = 1 + (tier - 1) * 0.28;
  const cursePenalty = player.curse > 0 ? 3 : 0;
  const heroBonus = player.heroId === 'ember-knight' && player.hp < player.maxHp * 0.45 ? 2 : 0;
  const graveBonus = player.heroId === 'grave-singer' && threat >= 10 ? 4 : 0;
  const power = Math.max(4, player.power + Math.floor(player.level / 3));
  const scaledThreat = threat + tierThreat;
  const enemyMaxHp = clamp(scaledThreat * 2 + reward + player.level * 4 + enemyCount * 12, 24, label === 'loop tyrant' ? 260 : 180);
  const rounds = clamp(Math.ceil(enemyMaxHp / power), enemyCount, enemyCount + 5);
  const stackedPressure = (enemyCount - 1) * 2 + Math.max(0, rounds - 2);
  const damage = clamp(scaledThreat + stackedPressure + cursePenalty - Math.floor(player.guard / 1.7) - player.armor, 2, label === 'loop tyrant' ? 48 : 32);
  player.hp -= damage;
  player.armor = Math.max(0, player.armor - 1);
  const xpReward = Math.round((reward + heroBonus + graveBonus + (enemyCount - 1) * 5 + Math.max(0, rounds - enemyCount) * 2) * tierReward);
  addXp(room, player, xpReward);
  player.kos += enemyCount;
  player.event = `${label}: ${enemyCount} foe${enemyCount === 1 ? '' : 's'}, -${damage} hp, +${xpReward} xp`;
  const encounter = combatEncounters[label] ?? {
    enemyId: 'ash-imp',
    enemyName: 'Ash Imp',
    backgroundId: 'forge',
    effect: 'ember'
  };
  const timestamp = now(room);
  const beats = combatBeats({
    rounds,
    enemyMaxHp,
    heroHpBefore: hpBefore,
    heroHpAfter: player.hp,
    heroDamage: damage,
    power
  });
  const durationMs = combatTailMs + beats.length * combatBeatMs;
  player.combat = {
    ...encounter,
    label,
    damage,
    reward: xpReward,
    enemyCount,
    rounds,
    heroHpBefore: hpBefore,
    heroHpAfter: player.hp,
    heroMaxHp: player.maxHp,
    enemyHpBefore: enemyMaxHp,
    enemyHpAfter: 0,
    enemyMaxHp,
    beats,
    startedAt: timestamp,
    expiresAt: timestamp + durationMs,
    durationMs
  };
  const vagrantLuck = player.heroId === 'night-vagrant' ? 0.1 : 0;
  if (random(room) < 0.17 + player.lootLuck + vagrantLuck + xpReward / 220) drawLoot(room, player);
  if (player.curse > 0) player.curse -= 1;
  return player.hp > 0;
}

function splitDamage(total, parts) {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  let remainder = total % parts;
  return Array.from({ length: parts }, () => {
    const damage = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return damage;
  }).filter((damage) => damage > 0);
}

function combatBeats({ rounds, enemyMaxHp, heroHpBefore, heroHpAfter, heroDamage, power }) {
  const counterDamages = splitDamage(heroDamage, Math.min(rounds, Math.max(1, heroDamage)));
  let enemyHp = enemyMaxHp;
  let heroHp = heroHpBefore;
  let counterIndex = 0;
  const beats = [];

  for (let round = 0; round < rounds && enemyHp > 0; round += 1) {
    const isFinisher = round === rounds - 1;
    const strikeDamage = isFinisher ? enemyHp : Math.min(enemyHp, Math.max(1, power + (round % 2)));
    enemyHp = Math.max(0, enemyHp - strikeDamage);
    beats.push({
      attacker: 'hero',
      atMs: combatWindupMs + beats.length * combatBeatMs,
      damage: strikeDamage,
      heroHp,
      enemyHp
    });

    if (enemyHp <= 0 || counterIndex >= counterDamages.length) continue;
    const counterDamage = counterDamages[counterIndex];
    counterIndex += 1;
    heroHp = Math.max(heroHpAfter, heroHp - counterDamage);
    beats.push({
      attacker: 'enemy',
      atMs: combatWindupMs + beats.length * combatBeatMs,
      damage: counterDamage,
      heroHp,
      enemyHp
    });
  }

  const lastBeat = beats.at(-1);
  if (!lastBeat || lastBeat.enemyHp !== 0) {
    beats.push({
      attacker: 'hero',
      atMs: combatWindupMs + beats.length * combatBeatMs,
      damage: enemyHp,
      heroHp,
      enemyHp: 0
    });
  }

  const finalBeat = beats.at(-1);
  if (finalBeat && finalBeat.heroHp !== heroHpAfter) finalBeat.heroHp = heroHpAfter;
  return beats;
}

function revivePlayer(room, player) {
  player.deaths += 1;
  player.hp = Math.ceil(player.maxHp * 0.58);
  player.power += player.revivePower;
  resetPlayerBoard(player);
  player.tierStartLap = player.laps;
  player.combat = null;
  player.hand = player.hand.slice(0, 3);
  player.event = `fell, then restarted tier ${player.loopTier ?? 1}`;
  player.lastEventAt = now(room);
  addLog(room, `${player.name} got knocked back to the start of tier ${player.loopTier ?? 1}.`);
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
    fight(room, player, 'wolf grove', 8, 10, encounterStack(room, player, tile));
  } else if (tile.type === 'meadow') {
    const bonus = player.heroId === 'moss-warden' ? 7 : 4;
    player.hp = clamp(player.hp + bonus, 0, player.maxHp);
    player.event = `meadow bloom: +${bonus} hp`;
  } else if (tile.type === 'crypt') {
    fight(room, player, 'crypt duel', 14, 18, encounterStack(room, player, tile));
  } else if (tile.type === 'wolfden') {
    fight(room, player, 'wolf den', 13, 17, encounterStack(room, player, tile, 2));
  } else if (tile.type === 'bonepit') {
    fight(room, player, 'bone pit', 16, 22, encounterStack(room, player, tile, 2));
  } else if (tile.type === 'ruinedkeep') {
    fight(room, player, 'ruined keep', 18, 24, encounterStack(room, player, tile, 2));
  } else if (tile.type === 'bloodmoon') {
    fight(room, player, 'blood moon', 15, 18, encounterStack(room, player, tile, 1));
  } else if (tile.type === 'wyrmgate') {
    fight(room, player, 'wyrm gate', 23, 34, encounterStack(room, player, tile, 3));
  } else if (tile.type === 'forge') {
    player.armor += 3;
    if (random(room) < 0.55 + player.lootLuck) drawLoot(room, player);
    addXp(room, player, 5);
    player.event = 'forge sparks: armor and loot';
  } else if (tile.type === 'shrine') {
    addXp(room, player, 14);
    player.hp = clamp(player.hp + 3, 0, player.maxHp);
    player.event = 'shrine surge: +14 xp';
  } else if (tile.type === 'mire') {
    player.nextMoveAt += 450 * timeScale;
    if (player.hand.length < 7) player.hand.push(drawCard(room));
    player.event = 'mire drag: slowed, drew a card';
  } else if (tile.type === 'village') {
    player.hp = clamp(player.hp + 7, 0, player.maxHp);
    addXp(room, player, 6);
    if (random(room) < 0.2 + player.lootLuck) drawLoot(room, player);
    player.event = 'village rest: healed and supplied';
  } else if (tile.type === 'obelisk') {
    player.armor += 1;
    addXp(room, player, player.heroId === 'grave-singer' ? 18 : 12);
    if (random(room) < 0.62) fight(room, player, 'obelisk shade', 12, 13, encounterStack(room, player, tile));
    else player.event = 'obelisk surge: power in the stones';
  } else if (tile.type === 'watchtower') {
    if (player.hand.length < 7) player.hand.push(drawCard(room, 'rival'));
    addXp(room, player, 7);
    player.event = 'watchtower spotted a rival opening';
  } else if (tile.type === 'ambush') {
    fight(room, player, 'bandit ambush', 16, 15, encounterStack(room, player, tile));
    tile.charges -= 1;
    if (tile.charges <= 0) tile.type = 'road';
  } else if (tile.type === 'scorch') {
    player.hp -= 7;
    tile.charges -= 1;
    player.event = 'meteor scorch: -7 hp';
    if (tile.charges <= 0) tile.type = 'road';
  } else {
    const roll = random(room);
    if (roll < 0.3) fight(room, player, 'road skirmish', 6, 7);
    else if (roll < 0.52) {
      player.hp = clamp(player.hp + 3, 0, player.maxHp);
      player.event = 'quiet road: +3 hp';
    } else player.event = 'sprinting';
  }

  resolveDefeat(room, player);
  player.lastEventAt = now(room);
}

function movementDelay(player) {
  const base = 1125 - player.speed * 72;
  return clamp(base, 390, 1300) * timeScale;
}

function advancePlayer(room, player) {
  player.position = (player.position + 1) % boardPath.length;
  if (player.position === 0) {
    player.laps += 1;
    expireLoopTiles(room, player);
    player.hp = clamp(player.hp + player.lapHeal, 0, player.maxHp);
    addXp(room, player, 4);
    if (player.hand.length < 7 && random(room) < 0.38) player.hand.push(drawCard(room));
    addLog(room, `${player.name} completed lap ${player.laps}.`);
  }
  triggerTile(room, player, player.board[player.position]);
  const combatHold = player.combat ? player.combat.expiresAt + Math.round(320 * timeScale) : now(room);
  player.nextMoveAt = Math.max(now(room) + movementDelay(player), combatHold);
}

function maybeDraw(room, player) {
  if (now(room) < player.nextDrawAt) return;
  if (player.hand.length < 7) {
    player.hand.push(drawCard(room));
    player.event = 'drew a card';
  }
  player.nextDrawAt = now(room) + Math.round((6500 + rand(room, 1400)) * player.drawRate * timeScale);
}

function bestItemScore(item) {
  return (
    item.power * 4 +
    item.guard * 3 +
    item.speed * 4 +
    item.maxHp * 0.7 +
    (item.sabotage ?? 0) * 2.6 +
    (item.lapHeal ?? 0) * 2.2 +
    (item.terrainScore ?? 0) * 1.6 +
    (item.revivePower ?? 0) * 2.8 +
    (item.lootLuck ?? 0) * 72 +
    Math.max(0, -(item.drawRate ?? 0)) * 140 +
    (item.rarity === 'relic' ? 8 : item.rarity === 'rare' ? 4 : 0)
  );
}

function chooseBotTrait(player) {
  const priorities = {
    'night-vagrant': ['moon-pocket', 'black-market', 'softstep', 'knife-rhythm', 'night-haul', 'smoke-veil', 'vanish-loop'],
    'moss-warden': ['warden-root', 'path-sower', 'greenwall', 'seed-cache', 'wild-cartographer', 'meadowbind', 'old-bark'],
    'rune-archer': ['rune-string', 'markbreaker', 'blue-fletching', 'hex-line', 'split-shot', 'watcher-code', 'sky-sigil'],
    'grave-singer': ['bone-chorus', 'crypt-hunger', 'last-verse', 'dirge-step', 'hollow-gold', 'bone-plate', 'requiem-loop'],
    'ember-knight': ['ember-oath', 'cinder-step', 'shield-heat', 'red-riposte', 'loopforged', 'hearthguard', 'overheat']
  }[player.heroId] ?? [];
  refreshPendingTraits(player);
  return priorities.find((traitId) => player.pendingTraits.includes(traitId)) ?? player.pendingTraits[0];
}

function chooseBotTerrainTile(room, player, card) {
  const candidates = player.board.filter((tile) => tile.type !== 'camp');
  const emptyRoads = candidates.filter((tile) => tile.type === 'road');
  const ahead = emptyRoads.find((tile) => tile.index > player.position) ?? emptyRoads[0] ?? candidates[rand(room, candidates.length)];
  if (card.tile === 'crypt' && player.hp < player.maxHp * 0.55) {
    return emptyRoads.find((tile) => tile.index > player.position + 5) ?? ahead;
  }
  if (card.tile === 'meadow' || card.tile === 'village') {
    return emptyRoads.find((tile) => Math.abs(tile.index - player.position) <= 4) ?? ahead;
  }
  return ahead;
}

function chooseRivalTarget(room, player) {
  const rivals = Object.values(room.players).filter((candidate) => candidate.id !== player.id);
  if (rivals.length === 0) return null;
  return rivals
    .map((candidate) => ({ candidate, value: score(candidate) + (candidate.hp / candidate.maxHp) * 80 - candidate.deaths * 40 }))
    .sort((a, b) => b.value - a.value)[0].candidate;
}

function botThink(room, player) {
  if (!player.isBot || room.tick % 3 !== 0 || room.status === 'finished') return;
  if (player.pendingTraits.length > 0) chooseTrait(player, chooseBotTrait(player));

  for (const slot of equipmentSlots) {
    const current = normalizeLoadout(player)[slot];
    const best = player.loot
      .filter((item) => item.slot === slot)
      .sort((a, b) => bestItemScore(b) - bestItemScore(a))[0];
    if (best && (!current || bestItemScore(best) > bestItemScore(current))) equip(player, best.id);
  }

  const wantsAttack = random(room) < 0.52 || score(player) < Math.max(...Object.values(room.players).map(score)) - 250;
  const card = wantsAttack
    ? player.hand.find((item) => item.kind === 'rival') ?? player.hand.find((item) => item.kind === 'terrain')
    : player.hand.find((item) => item.kind === 'terrain') ?? player.hand.find((item) => item.kind === 'rival');
  if (!card) return;
  if (card.kind === 'terrain') {
    const tileIndex = chooseBotTerrainTile(room, player, card)?.index ?? (1 + rand(room, boardPath.length - 1));
    playTerrain(room, player, card.instanceId, tileIndex);
  } else {
    const target = chooseRivalTarget(room, player);
    if (target) playRival(room, player, card.instanceId, target.id);
  }
}

export const testApi = {
  activePlayerCount,
  addBot,
  availableTraits,
  checkWinner,
  chooseTrait,
  createPlayer,
  createRoom,
  disconnectPlayer,
  equipmentSlots,
  equip,
  fillCpuOpponents,
  hasRoomForPlayer,
  joinRoom,
  matchTiers,
  maxPlayers,
  goalScore,
  playRival,
  playTerrain,
  resetRoom,
  refreshPendingTraits,
  roomSnapshot,
  runRoomStep,
  sellCard,
  sellLoot,
  traits,
  triggerTile
};
