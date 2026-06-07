export const maxPlayers = 4;
export const goalScore = 12600;
export const roomSettingOptions = {
  maxPlayers: [2, 3, 4],
  goalScore: [7200, 9600, 12600],
  pace: ['steady', 'quick', 'marathon']
};

const guidedDrawSequence = ['meadow', 'forge', 'grove', 'watchtower', 'hex', 'village', 'crypt', 'blood-moon', 'wyrm-gate'];
const guidedRecapLimit = 5;
export const defaultRoomSettings = {
  maxPlayers,
  goalScore,
  pace: 'steady'
};
// Global pacing multiplier. >1 slows the game down (all timed delays get longer).
// 3.2 gives movement enough room to read without making the automatic loop feel
// like it is racing past the outcome.
const timeScale = 3.2;
const ruleEventsKey = Symbol('loopduelRuleEvents');

function ruleEventQueue(room) {
  if (!room) return [];
  if (!room[ruleEventsKey]) {
    Object.defineProperty(room, ruleEventsKey, {
      value: [],
      enumerable: false,
      writable: true
    });
  }
  return room[ruleEventsKey];
}

function emitRuleEvent(room, type, payload = {}) {
  ruleEventQueue(room).push({ type, payload: cloneJson(payload) });
}

export function drainRoomEvents(room) {
  const queue = ruleEventQueue(room);
  return queue.splice(0, queue.length);
}

export const matchTiers = [
  { id: 1, name: 'Tier I: Opening Loop', minScore: 0, minLoops: 0, text: 'Complete four loops to reach the first gate.' },
  { id: 2, name: 'Tier II: Hungry Loop', minScore: 1800, minLoops: 4, text: 'Complete five more loops to wake the crown gate.' },
  { id: 3, name: 'Tier III: Dying Loop', minScore: 4500, minLoops: 9, text: 'Complete four loops in tier III to challenge the Loop Tyrant.' }
];
const bossLoopRequirement = 4;
const tileLoopLifeByTier = { 1: 3, 2: 2, 3: 2 };
function roomGoalScore(room) {
  return room?.settings?.goalScore ?? goalScore;
}

function roomMaxPlayers(room) {
  return room?.settings?.maxPlayers ?? maxPlayers;
}

function roomTimeScale(room) {
  if (room?.simulated) return 2.4;
  const pace = room?.settings?.pace ?? defaultRoomSettings.pace;
  if (pace === 'quick') return timeScale * 0.82;
  if (pace === 'marathon') return timeScale * 1.18;
  return timeScale;
}
const soloGateByTier = {
  1: { label: 'gate warden', threat: 26, reward: 70, enemyCount: 2, nextTier: 2 },
  2: { label: 'crown gate', threat: 34, reward: 105, enemyCount: 3, nextTier: 3 }
};

const combatEncounters = {
  'wolf grove': {
    enemyId: 'thorn-wolf',
    enemyName: 'Thorn Wolf',
    enemyIds: ['thorn-wolf'],
    enemyNames: ['Thorn Wolf'],
    backgroundId: 'grove',
    effect: 'claw'
  },
  'crypt duel': {
    enemyId: 'crypt-wraith',
    enemyName: 'Crypt Wraith',
    enemyIds: ['crypt-wraith'],
    enemyNames: ['Crypt Wraith'],
    backgroundId: 'crypt',
    effect: 'spectral'
  },
  'bone pit': {
    enemyId: 'bone-host',
    enemyName: 'Bone Host',
    enemyIds: ['bone-host', 'crypt-wraith', 'grave-knight'],
    enemyNames: ['Bone Host', 'Crypt Wraith', 'Grave Knight'],
    backgroundId: 'crypt',
    effect: 'spectral'
  },
  'wolf den': {
    enemyId: 'dire-thorn',
    enemyName: 'Wolf Pack',
    enemyIds: ['dire-thorn', 'thorn-wolf', 'thorn-wolf'],
    enemyNames: ['Dire Thorn', 'Thorn Wolf', 'Thorn Wolf'],
    backgroundId: 'grove',
    effect: 'claw'
  },
  'ruined keep': {
    enemyId: 'keep-reaver',
    enemyName: 'Keep Reavers',
    enemyIds: ['keep-reaver', 'brigand', 'grave-knight'],
    enemyNames: ['Keep Reaver', 'Road Brigand', 'Grave Knight'],
    backgroundId: 'road',
    effect: 'sword'
  },
  'blood moon': {
    enemyId: 'moon-fiend',
    enemyName: 'Moonbound Fiend',
    enemyIds: ['moon-fiend', 'ash-imp'],
    enemyNames: ['Moonbound Fiend', 'Ash Imp'],
    backgroundId: 'forge',
    effect: 'ember'
  },
  'wyrm gate': {
    enemyId: 'gate-wyrm',
    enemyName: 'Gate Wyrm',
    enemyIds: ['gate-wyrm', 'crown-gate', 'ash-imp'],
    enemyNames: ['Gate Wyrm', 'Crown Gate', 'Ash Imp'],
    backgroundId: 'forge',
    effect: 'ember'
  },
  'bandit ambush': {
    enemyId: 'brigand',
    enemyName: 'Road Brigand',
    enemyIds: ['brigand', 'keep-reaver'],
    enemyNames: ['Road Brigand', 'Keep Reaver'],
    backgroundId: 'road',
    effect: 'sword'
  },
  'road skirmish': {
    enemyId: 'brigand',
    enemyName: 'Road Brigand',
    enemyIds: ['brigand'],
    enemyNames: ['Road Brigand'],
    backgroundId: 'road',
    effect: 'sword'
  },
  'gate warden': {
    enemyId: 'loop-warden',
    enemyName: 'Loop Warden',
    enemyIds: ['loop-warden', 'grave-knight'],
    enemyNames: ['Loop Warden', 'Grave Knight'],
    backgroundId: 'crypt',
    effect: 'spectral'
  },
  'crown gate': {
    enemyId: 'crown-gate',
    enemyName: 'Crown Gate',
    enemyIds: ['crown-gate', 'gate-wyrm', 'moon-fiend'],
    enemyNames: ['Crown Gate', 'Gate Wyrm', 'Moonbound Fiend'],
    backgroundId: 'forge',
    effect: 'ember'
  },
  'loop tyrant': {
    enemyId: 'loop-tyrant',
    enemyName: 'The Loop Tyrant',
    enemyIds: ['loop-tyrant', 'loop-warden', 'crown-gate'],
    enemyNames: ['The Loop Tyrant', 'Loop Warden', 'Crown Gate'],
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
    text: 'A direct fighter who builds Heat through consecutive fights, then burns it into faster clears.'
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
    text: 'A resilient shaper whose havens overgrow nearby road and make risky loops survivable.'
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
    text: 'A fast looter who can vanish from one lethal hit each tier, then race the reset.'
  },
  {
    id: 'rune-archer',
    name: 'Rune Archer',
    title: 'rival control',
    icon: '🏹',
    color: '#4ab9ef',
    maxHp: 56,
    power: 10,
    guard: 9,
    speed: 5,
    sabotage: 2,
    text: 'A control specialist whose rival cards pin marks and punish the leader with precise disruption.'
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
    text: 'A risky XP engine that turns stacked deaths, crypt chains, and dangerous fights into momentum.'
  }
];

export const terrainCards = [
  { id: 'grove', name: 'Grove', kind: 'terrain', tile: 'grove', icon: '♣', text: 'Reliable XP fight. Safer near Meadow, scarier beside Blood Moon.' },
  { id: 'meadow', name: 'Meadow', kind: 'terrain', tile: 'meadow', icon: '✦', text: 'Heal tile. Place before danger or let Moss Warden overgrow adjacent road.' },
  { id: 'crypt', name: 'Crypt', kind: 'terrain', tile: 'crypt', icon: '☗', text: 'Hard fight with better loot. Grave Singer and Blood Moon chains love it.' },
  { id: 'wolf-den', name: 'Wolf Den', kind: 'terrain', tile: 'wolfden', icon: '♣', text: 'Pack fight. Put beside danger when you want a bigger enemy stack.' },
  { id: 'bone-pit', name: 'Bone Pit', kind: 'terrain', tile: 'bonepit', icon: '☗', text: 'Two-enemy undead fight. Strong near Crypt, risky near Blood Moon.' },
  { id: 'ruined-keep', name: 'Ruined Keep', kind: 'terrain', tile: 'ruinedkeep', icon: '⚔', text: 'Elite raider fight. High XP and loot odds when your gear is ready.' },
  { id: 'blood-moon', name: 'Blood Moon', kind: 'terrain', tile: 'bloodmoon', icon: '☾', text: 'Danger aura. Nearby fights stack larger, making greed obvious and lethal.' },
  { id: 'wyrm-gate', name: 'Wyrm Gate', kind: 'terrain', tile: 'wyrmgate', icon: '◆', text: 'Boss-class tile. Place after a safe reset or armor spike for huge rewards.' },
  { id: 'forge', name: 'Forge', kind: 'terrain', tile: 'forge', icon: '⚒', text: 'Armor and loot tempo. Stabilizes danger clusters before the next lap.' },
  { id: 'shrine', name: 'Shrine', kind: 'terrain', tile: 'shrine', icon: '✚', text: 'XP burst and trait tempo. Great before a planned gate push.' },
  { id: 'mire', name: 'Mire', kind: 'terrain', tile: 'mire', icon: '≈', text: 'Slows movement but draws cards. Use before a dangerous future tile.' },
  { id: 'village', name: 'Village', kind: 'terrain', tile: 'village', icon: '⌂', text: 'Safe heal, XP, and supply chance. Stabilizes greed-heavy loops.' },
  { id: 'obelisk', name: 'Obelisk', kind: 'terrain', tile: 'obelisk', icon: '◆', text: 'Armor, HP, XP, and loot without stopping movement.' },
  { id: 'watchtower', name: 'Watchtower', kind: 'terrain', tile: 'watchtower', icon: '◈', text: 'Draws rival cards. Use when another runner is about to spike.' }
];

export const rivalCards = [
  { id: 'bandits', name: 'Bandits', kind: 'rival', icon: '⚔', text: 'Adds an ambush to a rival loop.' },
  { id: 'hex', name: 'Hex', kind: 'rival', icon: '☾', text: 'Curses a rival for 3 events.' },
  { id: 'meteor', name: 'Meteor', kind: 'rival', icon: '☄', text: 'Damages a rival and scorches a tile.' },
  { id: 'tax', name: 'Tithe Trap', kind: 'rival', icon: '$', text: 'Steals tempo: rival loses a card or HP.' },
  { id: 'landslide', name: 'Landslide', kind: 'rival', icon: '⬖', text: 'Turns an upcoming rival tile into mire.' },
  { id: 'cutpurse', name: 'Cutpurse', kind: 'rival', icon: '✂', text: 'Steals a loose loot tempo or wounds instead.' }
];

const combatBlockingTileTypes = new Set([
  'grove',
  'crypt',
  'wolfden',
  'bonepit',
  'ruinedkeep',
  'bloodmoon',
  'wyrmgate',
  'ambush'
]);

function tileMovementStop(tile) {
  if (combatBlockingTileTypes.has(tile.type)) {
    return {
      movementStopKind: 'combat',
      movementStopReason: 'combat'
    };
  }
  return {
    movementStopKind: 'none',
    movementStopReason: null
  };
}

function boardStepsAhead(player, tileIndex) {
  const boardLength = player.board.length;
  if (!boardLength || !Number.isInteger(tileIndex)) return null;
  return (tileIndex - player.position + boardLength) % boardLength;
}

function isCombatTerrainCard(card) {
  return card?.kind === 'terrain' && combatBlockingTileTypes.has(card.tile);
}

function isBlockedCombatTerrainPlacement(player, card, tile) {
  if (player.isBot) return false;
  if (!isCombatTerrainCard(card) || !tile) return false;
  const stepsAhead = boardStepsAhead(player, tile.index);
  return stepsAhead === 1;
}

function visibleBoard(player) {
  return player.board.map((tile) => ({
    ...tile,
    ...tileMovementStop(tile)
  }));
}

function visibleTile(tile) {
  return {
    ...tile,
    ...tileMovementStop(tile)
  };
}

export const bonkCards = [
  { id: 'tin-bonk', name: 'Tin Bonk', kind: 'bonk', rarity: 'common', targetMode: 'leader', stunSeconds: 4, icon: '!', text: 'Bonks the highest-score rival, stunning them for 4 seconds.' },
  { id: 'crown-bonk', name: 'Crown Bonk', kind: 'bonk', rarity: 'common', targetMode: 'leader', stunSeconds: 5, icon: '!', text: 'Bonks the highest-score rival, stunning them for 5 seconds.' },
  { id: 'chosen-bonk', name: 'Chosen Bonk', kind: 'bonk', rarity: 'rare', targetMode: 'chosen', stunSeconds: 6, icon: '!', text: 'Choose any rival and stun them for 6 seconds.' }
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
export const shopSize = 5;
export const shopRotationMs = 60 * 1000;
const combatWindupMs = 400;
const combatBeatMs = 440;
const combatTailMs = 650;
const simulatedCombatWindupMs = 180;
const simulatedCombatBeatMs = 203;
const simulatedCombatTailMs = 360;

function scaledCombatMs(baseMs, scale, minMs, maxMs) {
  return Math.round(Math.max(minMs, Math.min(maxMs, baseMs * scale)));
}

function combatTiming(room) {
  if (room?.simulated) {
    return {
      windupMs: simulatedCombatWindupMs,
      beatMs: simulatedCombatBeatMs,
      tailMs: simulatedCombatTailMs,
      entryLeadMs: 0
    };
  }
  const scale = roomTimeScale(room);
  return {
    windupMs: scaledCombatMs(combatWindupMs, scale, 240, 760),
    beatMs: scaledCombatMs(combatBeatMs, scale, 260, 860),
    tailMs: scaledCombatMs(combatTailMs, scale, 360, 1120),
    entryLeadMs: 0
  };
}

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
  return { heroes, cards: [...terrainCards, ...rivalCards, ...bonkCards], boardPath, traits, talentTrees, maxPlayers, goalScore, matchTiers, roomSettingOptions };
}

function normalizeRoomSettings(settings = {}, fallback = defaultRoomSettings) {
  const maxPlayerValue = Number(settings.maxPlayers);
  const goalScoreValue = Number(settings.goalScore);
  const paceValue = String(settings.pace ?? fallback.pace);
  return {
    maxPlayers: roomSettingOptions.maxPlayers.includes(maxPlayerValue) ? maxPlayerValue : fallback.maxPlayers,
    goalScore: roomSettingOptions.goalScore.includes(goalScoreValue) ? goalScoreValue : fallback.goalScore,
    pace: roomSettingOptions.pace.includes(paceValue) ? paceValue : fallback.pace
  };
}

function createGuidedRun(startedAt = Date.now()) {
  return {
    enabled: true,
    playerId: null,
    rivalId: null,
    step: 'welcome',
    title: 'First guided duel',
    prompt: 'Pick Ember Knight, start the loop, and place the road that keeps your first danger readable.',
    detail: 'This run uses real rules with kinder opening draws and clearer cause-and-effect notes.',
    recommendedTileIndexes: [4],
    recaps: [],
    completed: false,
    startedAt,
    completedAt: null
  };
}

function guidedCard(room, cardId) {
  const card = [...terrainCards, ...rivalCards, ...bonkCards].find((item) => item.id === cardId) ?? terrainCards[0];
  return { ...card, instanceId: randomId(room, 'card') };
}

function pushGuidedRecap(room, line) {
  if (!room.guidedRun?.enabled || !line) return;
  const recaps = room.guidedRun.recaps ?? [];
  if (recaps[0] === line) return;
  room.guidedRun.recaps = [line, ...recaps].slice(0, guidedRecapLimit);
}

function guidedHuman(room) {
  const guide = room.guidedRun;
  if (!guide?.enabled || !guide.playerId) return null;
  return room.players[guide.playerId] ?? null;
}

function isGuidedHuman(room, player) {
  return Boolean(room.guidedRun?.enabled && room.guidedRun.playerId === player?.id);
}

function setupGuidedPlayer(room, player) {
  room.guidedRun.playerId = player.id;
  player.heroId = 'ember-knight';
  player.color = heroes.find((hero) => hero.id === 'ember-knight')?.color ?? player.color;
  player.hand = ['meadow', 'forge', 'grove'].map((cardId) => guidedCard(room, cardId));
  player.event = 'guided duel ready';
  player.message = 'guided duel ready';
  player.hp = player.maxHp;
}

function ensureGuidedRival(room) {
  const guide = room.guidedRun;
  if (!guide?.enabled) return null;
  if (guide.rivalId && room.players[guide.rivalId]) return room.players[guide.rivalId];
  if (!hasRoomForPlayer(room)) return null;
  const player = guidedHuman(room);
  const drawIndex = player?.guidedDrawIndex ?? 0;
  const rival = createPlayer(`guide-vesper-${room.id}`, 'Vesper', 'rune-archer', true, room);
  if (player) player.guidedDrawIndex = drawIndex;
  rival.guidedDormant = true;
  rival.event = 'watching your loop';
  rival.lastMoveAt = now(room);
  rival.moveStartedAt = now(room);
  rival.nextMoveAt = now(room) + 45_000 * roomTimeScale(room);
  rival.nextMovement = movementSegmentForPlayer(rival);
  rival.hand = ['hex', 'bandits', 'tin-bonk'].map((cardId) => guidedCard(room, cardId));
  room.players[rival.id] = rival;
  guide.rivalId = rival.id;
  addLog(room, 'Vesper waits across the loop as your first rival lesson.');
  return rival;
}

function setupGuidedOpening(room) {
  const player = guidedHuman(room);
  if (!player) return;
  const crypt = player.board[5];
  if (crypt && crypt.type === 'road') {
    crypt.type = 'crypt';
    crypt.expiresOnLap = player.laps + 3;
  }
  const road = player.board[9];
  if (road && road.type === 'road') {
    road.type = 'bloodmoon';
    road.expiresOnLap = player.laps + 3;
  }
  player.hp = player.maxHp;
  player.armor = Math.max(player.armor, 1);
  player.lastMoveAt = now(room);
  player.moveStartedAt = now(room);
  player.nextMoveAt = now(room) + 2800 * roomTimeScale(room);
  player.nextMovement = movementSegmentForPlayer(player);
  player.nextDrawAt = now(room) + 5200 * roomTimeScale(room);
  ensureGuidedRival(room);
  updateGuidedRun(room);
}

function updateGuidedRun(room) {
  const guide = room.guidedRun;
  const player = guidedHuman(room);
  if (!guide?.enabled || !player) return;

  if (room.status === 'finished') {
    guide.step = 'debrief';
    guide.title = room.winnerId === player.id ? 'You claimed the loop' : 'Run debrief';
    guide.prompt = room.winnerId === player.id
      ? `You built ${player.heroHeat ?? 0} Heat and turned the first duel into a real win.`
      : `You reached level ${player.level}, played ${player.cardsPlayed} cards, and learned where the loop got dangerous.`;
    guide.detail = player.deaths > 0
      ? `Biggest lesson: danger stacks punish recovery gaps. ${player.deaths} collapse${player.deaths === 1 ? '' : 's'} marked the run.`
      : 'Biggest lesson: Heat and safe tiles can carry a greedy road when they are planned before danger.';
    guide.completed = true;
    guide.completedAt = guide.completedAt ?? now(room);
    guide.recommendedTileIndexes = [];
    return;
  }

  if (player.cardsPlayed === 0) {
    guide.step = 'place-safe';
    guide.title = 'Beat 1: shape the road';
    guide.prompt = 'Place Meadow before the visible Crypt so your first dangerous fight has recovery nearby.';
    guide.detail = 'The loop is the battlefield. Cards change future laps, not just the tile under your feet.';
    guide.recommendedTileIndexes = [4];
    return;
  }

  if (player.cardsPlayed < 2) {
    guide.step = 'prep-threat';
    guide.title = 'Beat 2: prepare for danger';
    guide.prompt = 'A Crypt and Blood Moon are already visible. Add Forge or Grove where the next-five preview makes the risk legible.';
    guide.detail = 'Safe tiles buy survival; danger tiles pay XP, loot, and Heat when Ember Knight survives them.';
    guide.recommendedTileIndexes = [6, 8];
    return;
  }

  if (player.cardsPlayed < 4 && player.rivalHits === 0) {
    const rival = ensureGuidedRival(room);
    if (rival?.guidedDormant && player.cardsPlayed >= 3) {
      rival.guidedDormant = false;
      rival.lastMoveAt = now(room);
      rival.moveStartedAt = now(room);
      rival.nextMoveAt = now(room) + 1600 * roomTimeScale(room);
      rival.nextMovement = movementSegmentForPlayer(rival);
      rival.event = 'building a curse chain';
      addLog(room, 'Vesper starts moving; watch their next five tiles before striking.');
    }
    guide.step = 'build-fork';
    guide.title = 'Beat 3: choose a plan';
    guide.prompt = 'Your next picks are a fork: stabilize with Village/Forge, or lean into Blood Moon and fight for Heat.';
    guide.detail = 'Good Loopduel picks should feel like build decisions, not random card use.';
    guide.recommendedTileIndexes = [7, 10];
    return;
  }

  if (player.rivalHits === 0) {
    guide.step = 'rival';
    guide.title = 'Rival lesson: Vesper';
    guide.prompt = 'Vesper is a named threat now. Use a rival or bonk card when their next-five preview shows a payoff tile.';
    guide.detail = 'Rivals are competing engines. You are not just racing the road; you are disrupting another plan.';
    guide.recommendedTileIndexes = [];
    return;
  }

  guide.step = 'free-run';
  guide.title = 'Finish the duel';
  guide.prompt = 'You have seen placement, threat prep, build forks, and rival pressure. Push for tier II and read why each fight happened.';
  guide.detail = 'From here the guide stays quiet unless the run ends. The rules are real.';
  guide.recommendedTileIndexes = [];
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
    settings: normalizeRoomSettings(options.settings),
    log: ['Loopduel lobby is open. Join, pick a hero, then keep up.'],
    botCounter: 1,
    nextSeatIndex: 0,
    winnerId: null,
    tier: matchTiers[0],
    claim: null,
    authorityPause: null,
    guidedRun: options.guidedRun ? createGuidedRun(startTime) : null
  };
}

export const roomSnapshotVersion = 1;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function movementKey(value) {
  return value ? JSON.stringify(value) : null;
}

export function serializeRoom(room, options = {}) {
  return {
    version: roomSnapshotVersion,
    savedAt: options.savedAt ?? Date.now(),
    room: cloneJson(room)
  };
}

export function restoreRoom(snapshot, options = {}) {
  const envelope = snapshot?.room ? snapshot : { room: snapshot };
  const raw = envelope.room;
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id ?? options.fallbackId ?? 'main').trim().slice(0, 20) || 'main';
  const restoredAt = options.now ?? Date.now();
  const room = createRoom(id, { now: restoredAt, seed: raw.rngState ?? id });
  const status = ['lobby', 'running', 'finished'].includes(raw.status) ? raw.status : room.status;

  Object.assign(room, {
    status,
    startedAt: Number.isFinite(raw.startedAt) ? raw.startedAt : room.startedAt,
    lastActivityAt: restoredAt,
    finishedAt: Number.isFinite(raw.finishedAt) ? raw.finishedAt : null,
    now: restoredAt,
    simulated: false,
    rngState: Number.isFinite(raw.rngState) ? raw.rngState : room.rngState,
    tick: Number.isFinite(raw.tick) ? raw.tick : room.tick,
    hostId: typeof raw.hostId === 'string' ? raw.hostId : null,
    settings: normalizeRoomSettings(raw.settings),
    log: Array.isArray(raw.log) ? raw.log.filter((line) => typeof line === 'string').slice(0, 18) : room.log,
    botCounter: Number.isFinite(raw.botCounter) ? raw.botCounter : room.botCounter,
    nextSeatIndex: Number.isFinite(raw.nextSeatIndex) ? raw.nextSeatIndex : room.nextSeatIndex,
    winnerId: typeof raw.winnerId === 'string' ? raw.winnerId : null,
    tier: matchTiers.find((tier) => tier.id === raw.tier?.id) ?? room.tier,
    claim: raw.claim && typeof raw.claim === 'object' ? cloneJson(raw.claim) : null,
    authorityPause: null,
    guidedRun: raw.guidedRun && typeof raw.guidedRun === 'object' ? cloneJson(raw.guidedRun) : null,
    players: {}
  });

  const rawPlayers = raw.players && typeof raw.players === 'object' ? raw.players : {};
  for (const [playerId, rawPlayer] of Object.entries(rawPlayers)) {
    if (!rawPlayer || typeof rawPlayer !== 'object') continue;
    const player = createPlayer(playerId, rawPlayer.name, rawPlayer.heroId, Boolean(rawPlayer.isBot));
    Object.assign(player, cloneJson(rawPlayer), {
      id: playerId,
      isBot: Boolean(rawPlayer.isBot),
      connected: rawPlayer.isBot ? false : !options.markDisconnected
    });
    room.players[playerId] = player;
  }

  const seatIndexes = Object.values(room.players)
    .map((player) => player.seatIndex)
    .filter(Number.isFinite);
  room.nextSeatIndex = Math.max(room.nextSeatIndex, seatIndexes.length > 0 ? Math.max(...seatIndexes) + 1 : 0);

  if (room.hostId && !room.players[room.hostId]) room.hostId = null;
  if (!room.hostId) room.hostId = Object.values(room.players).find((player) => !player.isBot)?.id ?? null;
  if (room.winnerId && !room.players[room.winnerId]) room.winnerId = null;
  addLog(room, 'Room restored after server restart. Human runners can reconnect with their saved browser tokens.');
  return room;
}

export function resetRoom(room) {
  const id = room.id;
  const hostId = room.hostId;
  const settings = room.settings;
  Object.assign(room, createRoom(id, { seed: room.rngState, simulated: room.simulated, now: now(room), settings }));
  room.hostId = hostId;
  emitRuleEvent(room, 'roomReset', { hostId });
}

export function updateRoomSettings(room, nextSettings = {}) {
  if (room.status !== 'lobby') return false;
  const previous = room.settings;
  const normalized = normalizeRoomSettings({ ...room.settings, ...nextSettings }, room.settings);
  const activeCount = activePlayerCount(room);
  if (normalized.maxPlayers < activeCount) normalized.maxPlayers = activeCount;
  const changed = JSON.stringify(normalized) !== JSON.stringify(room.settings);
  room.settings = normalized;
  if (!changed) return false;
  room.lastActivityAt = now(room);
  addLog(room, `Room settings updated: ${normalized.maxPlayers} seats, ${normalized.goalScore} boss score, ${normalized.pace} pace.`);
  emitRuleEvent(room, 'roomSettingsChanged', { from: previous, to: normalized });
  return true;
}

export function startRoom(room) {
  if (room.status !== 'lobby') return false;
  if (activePlayerCount(room) === 0) return false;
  room.status = 'running';
  room.lastActivityAt = now(room);
  room.authorityPause = null;
  for (const player of Object.values(room.players)) {
    if (player.guidedDormant) continue;
    player.lastMoveAt = now(room);
    player.moveStartedAt = now(room);
    player.nextMoveAt = now(room) + movementDelay(room, player);
    player.nextMovement = movementSegmentForPlayer(player);
  }
  if (room.guidedRun?.enabled) {
    setupGuidedOpening(room);
    addLog(room, 'The guided duel began with a visible Crypt and a waiting rival.');
  } else {
    addLog(room, 'The host started the loop.');
  }
  emitRuleEvent(room, 'roomStatusChanged', { from: 'lobby', to: 'running' });
  for (const player of Object.values(room.players)) {
    emitRuleEvent(room, 'movementSegment', {
      playerId: player.id,
      nextMovement: player.nextMovement,
      arrivalMovement: player.arrivalMovement
    });
  }
  return true;
}

function timestampPlus(value, deltaMs) {
  return Number.isFinite(value) ? value + deltaMs : value;
}

function shiftRoomTimers(room, deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  room.lastActivityAt = timestampPlus(room.lastActivityAt, deltaMs);
  if (room.claim) {
    room.claim.startedAt = timestampPlus(room.claim.startedAt, deltaMs);
    room.claim.expiresAt = timestampPlus(room.claim.expiresAt, deltaMs);
  }
  if (room.guidedRun) {
    room.guidedRun.startedAt = timestampPlus(room.guidedRun.startedAt, deltaMs);
    room.guidedRun.completedAt = timestampPlus(room.guidedRun.completedAt, deltaMs);
  }
  for (const player of Object.values(room.players)) {
    player.lastEventAt = timestampPlus(player.lastEventAt, deltaMs);
    player.lastMoveAt = timestampPlus(player.lastMoveAt, deltaMs);
    player.moveStartedAt = timestampPlus(player.moveStartedAt, deltaMs);
    player.nextMoveAt = timestampPlus(player.nextMoveAt, deltaMs);
    player.nextDrawAt = timestampPlus(player.nextDrawAt, deltaMs);
    player.stunnedUntil = timestampPlus(player.stunnedUntil, deltaMs);
    if (player.shop) player.shop.rotatesAt = timestampPlus(player.shop.rotatesAt, deltaMs);
    if (player.combat) {
      player.combat.startedAt = timestampPlus(player.combat.startedAt, deltaMs);
      player.combat.expiresAt = timestampPlus(player.combat.expiresAt, deltaMs);
    }
    if (player.arrivalMovement) {
      player.arrivalMovement.departAt = timestampPlus(player.arrivalMovement.departAt, deltaMs);
      player.arrivalMovement.arriveAt = timestampPlus(player.arrivalMovement.arriveAt, deltaMs);
    }
    if (player.nextMovement) {
      player.nextMovement.departAt = timestampPlus(player.nextMovement.departAt, deltaMs);
      player.nextMovement.arriveAt = timestampPlus(player.nextMovement.arriveAt, deltaMs);
    }
  }
}

function connectedHumanPlayers(room) {
  return Object.values(room.players).filter((player) => !player.isBot && player.connected);
}

export function refreshRoomAuthority(room) {
  if (!room || room.status !== 'running' || room.simulated) {
    if (room) room.authorityPause = null;
    return room?.authorityPause ?? null;
  }

  const liveHumans = connectedHumanPlayers(room);
  const reason = liveHumans.length === 0 ? 'waiting-for-host' : null;
  if (reason) {
    if (!room.authorityPause || room.authorityPause.reason !== reason) {
      room.authorityPause = {
        reason,
        startedAt: now(room)
      };
      addLog(room, 'Movement paused while waiting for a human host.');
      emitRuleEvent(room, 'roomAuthorityPaused', {
        reason,
        startedAt: room.authorityPause.startedAt
      });
    }
    return room.authorityPause;
  }

  if (room.authorityPause) {
    const previous = room.authorityPause;
    const pausedForMs = Math.max(0, now(room) - room.authorityPause.startedAt);
    shiftRoomTimers(room, pausedForMs);
    addLog(room, 'Host returned. Movement resumed from the paused timeline.');
    room.authorityPause = null;
    emitRuleEvent(room, 'roomAuthorityResumed', {
      reason: previous.reason,
      pausedForMs
    });
  }
  return null;
}

export function absorbRoomClockDrift(room, elapsedMs, expectedMs = 260) {
  if (!room || room.status !== 'running' || room.simulated) return false;
  const driftMs = elapsedMs - expectedMs;
  if (driftMs < 520) return false;
  shiftRoomTimers(room, driftMs);
  room.lastActivityAt = now(room);
  addLog(room, 'Server timing hiccup absorbed; movement timeline held steady.');
  emitRuleEvent(room, 'roomClockDriftAbsorbed', { driftMs });
  return true;
}

export function activePlayerCount(room) {
  return Object.keys(room.players).length;
}

export function hasRoomForPlayer(room) {
  return activePlayerCount(room) < roomMaxPlayers(room);
}

export function score(player) {
  return Math.max(0, (
    player.level * 390 +
    player.laps * 130 +
    player.kos * 64 +
    player.rivalHits * (72 + player.sabotage * 8) +
    player.tilesPlaced * 44 +
    player.cardsPlayed * 9 +
    player.loot.length * 24 +
    (player.heroId === 'grave-singer' ? (player.graveEcho ?? 0) * 48 : 0) +
    (player.gold ?? 0) +
    player.xp -
    (player.scorePenalty ?? 0)
  ));
}

function heroSignature(player) {
  if (player.heroId === 'ember-knight') {
    return {
      label: 'Heat',
      value: player.heroHeat ?? 0,
      max: 3,
      text: 'Fights build Heat. Each Heat adds power during combat.'
    };
  }
  if (player.heroId === 'moss-warden') {
    return {
      label: 'Overgrow',
      value: player.wardenOvergrowth ?? 0,
      max: 5,
      text: 'Safe terrain can bloom adjacent road into Grove.'
    };
  }
  if (player.heroId === 'night-vagrant') {
    const tier = player.loopTier ?? 1;
    return {
      label: 'Vanish',
      value: player.vagrantEscapeTier === tier ? 0 : 1,
      max: 1,
      text: player.vagrantEscapeTier === tier ? 'Tier escape spent.' : 'Next lethal hit this tier leaves 1 HP.'
    };
  }
  if (player.heroId === 'rune-archer') {
    return {
      label: 'Marks',
      value: player.runeMarkCount ?? 0,
      max: 5,
      text: 'Rival cards add extra curse pressure and pin targets.'
    };
  }
  if (player.heroId === 'grave-singer') {
    return {
      label: 'Dirge',
      value: player.graveEcho ?? 0,
      max: 8,
      text: 'Dangerous kills feed bonus XP and comeback pressure.'
    };
  }
  return null;
}

export function roomSnapshot(room) {
  refreshRoomAuthority(room);
  for (const player of Object.values(room.players)) refreshShop(room, player);
  const scoredPlayers = Object.values(room.players).map((player) => ({
    ...player,
    board: visibleBoard(player),
    nextMovement: player.combat ? null : player.nextMovement,
    signature: heroSignature(player),
    shop: player.shop ? {
      ...player.shop,
      remainingMs: Math.max(0, player.shop.rotatesAt - now(room))
    } : null,
    score: score(player),
    stunRemainingMs: player.stunnedUntil ? Math.max(0, player.stunnedUntil - now(room)) : 0
  }));
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
    now: now(room),
    authority: room.authorityPause ? {
      paused: true,
      reason: room.authorityPause.reason,
      startedAt: room.authorityPause.startedAt
    } : {
      paused: false,
      reason: null,
      startedAt: null
    },
    log: room.log,
    maxPlayers: roomMaxPlayers(room),
    goalScore: roomGoalScore(room),
    settings: room.settings,
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
    onboarding: room.guidedRun?.enabled ? {
      ...room.guidedRun,
      recaps: room.guidedRun.recaps ?? []
    } : null,
    players
  };
}

export function createPlayer(id, name, heroId, isBot = false, room = null) {
  const hero = heroes.find((item) => item.id === heroId) ?? sample(room, heroes);
  const player = {
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
    heroHeat: 0,
    wardenOvergrowth: 0,
    vagrantEscapeTier: 0,
    runeMarkCount: 0,
    graveEcho: 0,
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
    soloCorruption: 0,
    soloGateAttempts: 0,
    deathsThisTier: 0,
    scorePenalty: 0,
    claimStartedAt: null,
    claimStartLap: null,
    claimDeathsAtStart: 0,
    marked: false,
    curse: 0,
    armor: 0,
    nextMoveAt: now(room) + 1000 * roomTimeScale(room),
    nextDrawAt: now(room) + 3600 * roomTimeScale(room),
    event: 'entered the loop',
    message: 'entered the loop',
    lastEventAt: now(room),
    combat: null,
    lastMoveAt: now(room),
    moveStartedAt: now(room),
    arrivalMovement: null,
    nextMovement: null,
    stunnedUntil: null,
    stunnedBy: null,
    pendingBonks: []
  };
  player.nextMovement = movementSegmentForPlayer(player);
  player.shop = createShop(room, player);
  return player;
}

export function addLog(room, line) {
  room.log.unshift(line);
  room.log = room.log.slice(0, 18);
}

export function joinRoom(room, { playerId, name, heroId, guidedRun = false }) {
  if (guidedRun && room.status === 'lobby' && activePlayerCount(room) === 0 && !room.guidedRun) {
    room.guidedRun = createGuidedRun(now(room));
    room.settings = normalizeRoomSettings({ maxPlayers: 2, goalScore: 7200, pace: 'quick' });
  }
  const existing = room.players[playerId];
  if (existing) {
    existing.connected = true;
    existing.name = name?.trim().slice(0, 20) || existing.name;
    existing.event = 'reconnected';
    if (!room.hostId && !existing.isBot) room.hostId = existing.id;
    room.lastActivityAt = now(room);
    addLog(room, `${existing.name} reconnected.`);
    emitRuleEvent(room, 'playerReconnected', { playerId: existing.id, name: existing.name });
    return { player: existing, created: false };
  }

  if (!hasRoomForPlayer(room)) {
    return { player: null, created: false, full: true };
  }

  const player = createPlayer(playerId, name, room.guidedRun?.enabled ? 'ember-knight' : heroId, false, room);
  if (room.guidedRun?.enabled && !room.guidedRun.playerId) setupGuidedPlayer(room, player);
  room.players[player.id] = player;
  if (!room.hostId) room.hostId = player.id;
  room.lastActivityAt = now(room);
  addLog(room, `${player.name} joined as ${heroes.find((hero) => hero.id === player.heroId)?.name}.`);
  emitRuleEvent(room, 'playerJoined', {
    playerId: player.id,
    name: player.name,
    heroId: player.heroId,
    seatIndex: player.seatIndex,
    isBot: player.isBot
  });
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
  emitRuleEvent(room, 'playerDisconnected', { playerId: player.id, hostId: room.hostId });
  return true;
}

export function kickPlayer(room, targetId) {
  const target = room.players[targetId];
  if (!target || target.id === room.hostId) return false;
  delete room.players[target.id];
  room.lastActivityAt = now(room);
  if (room.winnerId === target.id) room.winnerId = null;
  if (room.claim?.playerId === target.id) room.claim = null;
  if (room.hostId && !room.players[room.hostId]) {
    room.hostId = Object.values(room.players).find((candidate) => !candidate.isBot && candidate.connected)?.id ?? null;
  }
  if (activePlayerCount(room) === 0) room.status = 'lobby';
  addLog(room, `${target.name} left the room.`);
  emitRuleEvent(room, 'playerRemoved', { playerId: target.id, hostId: room.hostId });
  return true;
}

export function addBot(room) {
  if (!hasRoomForPlayer(room) || room.status === 'finished') return null;
  const hero = sample(room, heroes);
  const botId = `bot-${room.botCounter++}`;
  const botNames = ['Cinder CPU', 'Mire CPU', 'Hex CPU', 'Grove CPU'];
  const bot = createPlayer(botId, botNames[(room.botCounter - 2) % botNames.length], hero.id, true, room);
  room.players[botId] = bot;
  room.lastActivityAt = now(room);
  addLog(room, `${bot.name} entered as ${hero.name}.`);
  emitRuleEvent(room, 'playerJoined', {
    playerId: bot.id,
    name: bot.name,
    heroId: bot.heroId,
    seatIndex: bot.seatIndex,
    isBot: true
  });
  return bot;
}

export function fillCpuOpponents(room, targetCount = roomMaxPlayers(room)) {
  const added = [];
  while (activePlayerCount(room) < Math.min(targetCount, roomMaxPlayers(room))) {
    const bot = addBot(room);
    if (!bot) break;
    added.push(bot);
  }
  if (added.length > 0) addLog(room, `CPU opponents filled ${added.length} open seat${added.length === 1 ? '' : 's'}.`);
  return added;
}

export function playTerrain(room, player, cardInstanceId, tileIndex) {
  if (room.status !== 'running') return false;
  if (isStunned(room, player)) return false;
  settleDueMovementBeforeTerrainPlacement(room, player);
  if (isStunned(room, player) || isCombatLocked(room, player)) return false;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card || card.kind !== 'terrain') return false;
  const tile = player.board[tileIndex];
  if (!tile || tile.type === 'camp') return false;
  if (isBlockedCombatTerrainPlacement(player, card, tile)) return false;
  tile.type = card.tile;
  tile.charges = card.tile === 'mire' ? 5 : 0;
  tile.expiresOnLap = player.laps + tileLoopLife(player);
  let overgrown = null;
  if (player.heroId === 'moss-warden' && ['meadow', 'village'].includes(card.tile)) {
    const neighbors = [
      player.board[(tile.index - 1 + player.board.length) % player.board.length],
      player.board[(tile.index + 1) % player.board.length]
    ].filter((candidate) => candidate?.type === 'road' && !isBlockedCombatTerrainPlacement(player, { kind: 'terrain', tile: 'grove' }, candidate));
    overgrown = neighbors[0] ?? null;
    if (overgrown) {
      overgrown.type = 'grove';
      overgrown.charges = 0;
      overgrown.expiresOnLap = tile.expiresOnLap;
      player.wardenOvergrowth = (player.wardenOvergrowth ?? 0) + 1;
    }
  }
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.cardsPlayed += 1;
  player.tilesPlaced += 1;
  player.event = overgrown ? `placed ${card.name}; road overgrew` : `placed ${card.name}`;
  room.lastActivityAt = now(room);
  addXp(room, player, 3 + player.terrainScore);
  addLog(room, overgrown ? `${player.name} placed ${card.name}; nearby road overgrew into Grove.` : `${player.name} placed ${card.name}.`);
  emitRuleEvent(room, 'cardPlayed', {
    playerId: player.id,
    cardId: card.id,
    cardInstanceId,
    kind: card.kind,
    targetPlayerId: player.id
  });
  emitRuleEvent(room, 'tileChanged', {
    playerId: player.id,
    tileIndex: tile.index,
    tile: cloneJson(visibleTile(tile)),
    cause: 'terrainCard'
  });
  if (overgrown) {
    emitRuleEvent(room, 'tileChanged', {
      playerId: player.id,
      tileIndex: overgrown.index,
      tile: cloneJson(visibleTile(overgrown)),
      cause: 'mossWardenOvergrowth'
    });
  }
  resolveCurrentCombatTileIfArmed(room, player, tile);
  if (overgrown) resolveCurrentCombatTileIfArmed(room, player, overgrown);
  if (isGuidedHuman(room, player)) {
    pushGuidedRecap(room, overgrown
      ? `${card.name} changed two future stops: the placed tile and a free Grove from Moss Warden.`
      : `${card.name} changed the future loop at tile ${tile.index}; the next-five preview now tells you when it matters.`);
    updateGuidedRun(room);
  }
  checkWinner(room);
  return true;
}

function settleDueMovementBeforeTerrainPlacement(room, player) {
  if (player.isBot) return;
  if (player.guidedDormant) return;
  let transitions = 0;
  while (
    now(room) >= player.nextMoveAt &&
    !player.combat &&
    !isStunned(room, player) &&
    transitions < boardPath.length
  ) {
    advancePlayer(room, player);
    transitions += 1;
  }
}

function scheduleNextMovementFromCurrentTile(room, player, options = {}) {
  const boardLength = boardPath.length;
  const resumeAt = player.combat
    ? player.combat.expiresAt + Math.round(320 * roomTimeScale(room))
    : options.preserveResumeAt
      ? Math.max(now(room), player.moveStartedAt ?? now(room))
      : now(room);
  const delay = movementDelay(room, player);
  player.moveStartedAt = resumeAt;
  player.nextMoveAt = room.simulated ? Math.max(now(room) + delay, resumeAt) : resumeAt + delay;
  const fromCursor = player.laps * boardLength + player.position;
  player.nextMovement = {
    fromCursor,
    toCursor: fromCursor + 1,
    departAt: player.moveStartedAt,
    arriveAt: player.nextMoveAt
  };
  emitRuleEvent(room, 'movementSegment', {
    playerId: player.id,
    nextMovement: player.combat ? null : player.nextMovement,
    arrivalMovement: player.arrivalMovement
  });
}

function resolveCurrentCombatTileIfArmed(room, player, tile) {
  if (player.isBot) return false;
  if (!tile || tile.index !== player.position) return false;
  if (!combatBlockingTileTypes.has(tile.type)) return false;
  if (isCombatLocked(room, player) || isStunned(room, player)) return false;

  triggerTile(room, player, tile);
  emitRuleEvent(room, 'tileResolved', {
    playerId: player.id,
    tileIndex: player.position,
    tileType: player.board[player.position]?.type ?? null,
    position: player.position,
    laps: player.laps,
    hp: player.hp,
    score: score(player),
    level: player.level,
    deaths: player.deaths,
    event: player.event,
    message: player.message,
    cause: 'armedCurrentCombatTile'
  });
  scheduleNextMovementFromCurrentTile(room, player);
  return true;
}

export function playRival(room, player, cardInstanceId, targetId, tileIndex = null) {
  if (room.status !== 'running') return false;
  if (isStunned(room, player)) return false;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  const target = room.players[targetId];
  if (!card || card.kind !== 'rival' || !target || target.id === player.id) return false;
  const hasTileTarget = Number.isInteger(tileIndex);
  const targetedTile = hasTileTarget ? target.board[tileIndex] : null;
  if (hasTileTarget && (!targetedTile || targetedTile.type !== 'road' || targetedTile.index === target.position)) return false;
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  const targetMovementBefore = movementKey(target.nextMovement);
  const markedBonus = target.marked ? 3 : 0;
  const runeBonus = player.heroId === 'rune-archer' ? 2 : 0;
  const bonus = player.sabotage + markedBonus + runeBonus;

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
    target.event = `${player.name} armed ${card.name} ahead`;
  } else if (card.id === 'bandits') {
    const tile = target.board[(target.position + 3 + rand(room, 5)) % target.board.length];
    if (tile.type !== 'camp') {
      tile.type = 'ambush';
      tile.charges = 2;
    }
    target.event = `${player.name} sent bandits ahead`;
  } else if (card.id === 'hex') {
    target.curse += 3;
    target.hp -= bonus;
    target.event = `${player.name} cursed you`;
  } else if (card.id === 'meteor') {
    target.hp -= 8 + bonus;
    const tile = target.board[(target.position + 2) % target.board.length];
    if (tile.type !== 'camp') {
      tile.type = 'scorch';
      tile.charges = 2;
    }
    target.event = `${player.name} called a meteor`;
  } else if (card.id === 'tax') {
    if (target.hand.length > 0) target.hand.splice(rand(room, target.hand.length), 1);
    else target.hp -= 5 + bonus;
    target.event = `${player.name} stole tempo`;
  } else if (card.id === 'landslide') {
    const tile = target.board[(target.position + 1 + rand(room, 6)) % target.board.length];
    if (tile.type !== 'camp') {
      tile.type = 'mire';
      tile.charges = 4;
    }
    target.event = `${player.name} dropped a landslide`;
  } else if (card.id === 'cutpurse') {
    const unequipped = target.loot.filter((item) => !Object.values(normalizeLoadout(target)).some((equipped) => equipped?.id === item.id));
    if (unequipped.length > 0) {
      const stolen = unequipped[rand(room, unequipped.length)];
      target.loot = target.loot.filter((item) => item.id !== stolen.id);
      player.loot.unshift(stolen);
      player.loot = player.loot.slice(0, 10);
      target.event = `${player.name} stole loot`;
    } else {
      target.hp -= 6 + bonus;
      target.event = `${player.name} cutpurse wound`;
    }
  }
  target.lastEventAt = now(room);
  player.cardsPlayed += 1;
  player.rivalHits += 1;
  if (player.heroId === 'rune-archer') {
    target.curse += 1;
    target.nextMoveAt += 180 * roomTimeScale(room);
    target.nextMovement = movementSegmentForPlayer(target);
    player.runeMarkCount = (player.runeMarkCount ?? 0) + 1;
  }
  if (target.marked) {
    target.nextMoveAt += 420 * roomTimeScale(room);
    target.nextMovement = movementSegmentForPlayer(target);
    if (room.claim?.playerId === target.id) room.claim.expiresAt -= 2600;
  }
  room.lastActivityAt = now(room);
  const defeated = resolveDefeat(room, target);
  const targetMovementChanged = targetMovementBefore !== movementKey(target.nextMovement);
  addXp(room, player, 7);
  player.event = targetedTile ? `armed ${card.name} on ${target.name}'s road` : `hit ${target.name} with ${card.name}`;
  if (player.heroId === 'rune-archer') player.event += '; rune mark pinned';
  addLog(room, targetedTile
    ? `${player.name} armed ${card.name} on ${target.name}'s road.`
    : `${player.name} played ${card.name} on ${target.name}.`);
  emitRuleEvent(room, 'cardPlayed', {
    playerId: player.id,
    cardId: card.id,
    cardInstanceId,
    kind: card.kind,
    targetPlayerId: target.id,
    tileIndex: targetedTile?.index ?? null
  });
  if (targetMovementChanged && !defeated) {
    emitRuleEvent(room, 'movementSegment', {
      playerId: target.id,
      nextMovement: target.nextMovement,
      arrivalMovement: target.arrivalMovement
    });
  }
  if (targetedTile) {
    emitRuleEvent(room, 'tileChanged', {
      playerId: target.id,
      tileIndex: targetedTile.index,
      tile: cloneJson(visibleTile(targetedTile)),
      cause: 'rivalCard',
      actorId: player.id
    });
  }
  emitRuleEvent(room, 'playerProjectionChanged', {
    playerId: target.id,
    hp: target.hp,
    score: score(target),
    level: target.level,
    cause: 'rivalCard',
    actorId: player.id
  });
  if (isGuidedHuman(room, player)) {
    pushGuidedRecap(room, `${card.name} mattered because ${target.name}'s engine was visible before it paid out.`);
    updateGuidedRun(room);
  }
  checkWinner(room);
  return true;
}

function highestScoreRival(room, player) {
  return Object.values(room.players)
    .filter((candidate) => candidate.id !== player.id)
    .sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.seatIndex ?? 0) - (b.seatIndex ?? 0);
    })[0] ?? null;
}

export function playBonk(room, player, cardInstanceId, targetId = null) {
  if (room.status !== 'running') return false;
  if (isStunned(room, player)) return false;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card || card.kind !== 'bonk') return false;

  const target = card.targetMode === 'chosen'
    ? room.players[targetId]
    : highestScoreRival(room, player);
  if (!target || target.id === player.id) return false;

  const durationMs = Math.round((card.stunSeconds ?? 4) * 1000);
  const queuedForCombat = isCombatLocked(room, target);
  if (queuedForCombat) {
    target.pendingBonks = [...(target.pendingBonks ?? []), {
      by: player.id,
      byName: player.name,
      cardName: card.name,
      durationMs
    }];
    target.event = `${player.name} queued ${card.name}`;
    target.lastEventAt = now(room);
  } else {
    applyBonkStun(room, target, {
      by: player.id,
      byName: player.name,
      cardName: card.name,
      durationMs
    });
  }

  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.cardsPlayed += 1;
  player.rivalHits += 1;
  player.event = `bonked ${target.name}`;
  room.lastActivityAt = now(room);
  addXp(room, player, card.targetMode === 'chosen' ? 8 : 6);
  addLog(room, `${player.name} bonked ${target.name} with ${card.name}${isCombatLocked(room, target) ? '; it lands after combat.' : '.'}`);
  emitRuleEvent(room, 'cardPlayed', {
    playerId: player.id,
    cardId: card.id,
    cardInstanceId,
    kind: card.kind,
    targetPlayerId: target.id
  });
  if (queuedForCombat) emitRuleEvent(room, 'stunQueued', { playerId: target.id, actorId: player.id, durationMs });
  if (isGuidedHuman(room, player)) {
    pushGuidedRecap(room, `${card.name} froze ${target.name}; rival cards are timing tools, not just damage buttons.`);
    updateGuidedRun(room);
  }
  checkWinner(room);
  return true;
}

export function chooseTrait(player, traitId, room = null) {
  refreshPendingTraits(player);
  if (!player.pendingTraits.includes(traitId)) return false;
  player.traits.push(traitId);
  player.talentPoints = Math.max(0, player.talentPoints - 1);
  player.pendingTraits = [];
  recalcStats(player);
  const trait = traits.find((item) => item.id === traitId);
  player.event = `learned ${trait?.name ?? 'a trait'}`;
  refreshPendingTraits(player);
  if (room) emitRuleEvent(room, 'traitChosen', { playerId: player.id, traitId, traitName: trait?.name ?? null });
  return true;
}

export function equip(player, itemId, room = null) {
  const item = player.loot.find((entry) => entry.id === itemId);
  if (!item) return false;
  normalizeLoadout(player)[item.slot] = item;
  recalcStats(player);
  player.event = `equipped ${item.name}`;
  if (room) emitRuleEvent(room, 'lootEquipped', { playerId: player.id, itemId, slot: item.slot, item: cloneJson(item) });
  return true;
}

export function sellCard(room, player, cardInstanceId) {
  if (!player) return false;
  const card = player.hand.find((item) => item.instanceId === cardInstanceId);
  if (!card) return false;
  const value = cardSellValue(card);
  player.hand = player.hand.filter((item) => item.instanceId !== cardInstanceId);
  player.gold = (player.gold ?? 0) + value;
  player.event = `sold ${card.name} for ${value} gold`;
  room.lastActivityAt = now(room);
  addLog(room, `${player.name} sold ${card.name} for ${value} gold.`);
  emitRuleEvent(room, 'cardSold', { playerId: player.id, cardId: card.id, cardInstanceId, value, gold: player.gold });
  checkWinner(room);
  return true;
}

export function sellLoot(room, player, itemId) {
  if (!player) return false;
  const item = player.loot.find((entry) => entry.id === itemId);
  if (!item) return false;
  if (Object.values(normalizeLoadout(player)).some((equipped) => equipped?.id === item.id)) return false;
  const value = lootSellValue(item);
  player.loot = player.loot.filter((entry) => entry.id !== itemId);
  player.gold = (player.gold ?? 0) + value;
  player.event = `sold ${item.name} for ${value} gold`;
  room.lastActivityAt = now(room);
  addLog(room, `${player.name} sold ${item.name} for ${value} gold.`);
  emitRuleEvent(room, 'lootSold', { playerId: player.id, itemId, value, gold: player.gold });
  checkWinner(room);
  return true;
}

export function buyShopOffer(room, player, offerId) {
  if (!player || room.status !== 'running') return false;
  refreshShop(room, player);
  const shop = player.shop;
  const offer = shop?.offers.find((item) => item.id === offerId);
  if (!offer) return false;
  if ((player.gold ?? 0) < offer.price) return false;
  if (offer.kind === 'card' && player.hand.length >= 7) return false;
  if (offer.kind === 'loot' && player.loot.length >= 10) return false;

  player.gold = (player.gold ?? 0) - offer.price;
  if (offer.kind === 'card') {
    player.hand.push({ ...offer.card, instanceId: randomId(room, 'card') });
    player.event = `bought ${offer.card.name}`;
    addLog(room, `${player.name} bought ${offer.card.name} for ${offer.price} gold.`);
  } else {
    player.loot.unshift({ ...offer.loot, id: randomId(room, 'loot') });
    player.event = `bought ${offer.loot.name}`;
    addLog(room, `${player.name} bought ${offer.loot.name} for ${offer.price} gold.`);
  }
  shop.offers = shop.offers.filter((item) => item.id !== offer.id);
  room.lastActivityAt = now(room);
  emitRuleEvent(room, 'shopOfferBought', {
    playerId: player.id,
    offerId,
    kind: offer.kind,
    price: offer.price,
    gold: player.gold
  });
  checkWinner(room);
  return true;
}

export function runRoomStep(room, options = {}) {
  if (room.status !== 'running') return;
  if (refreshRoomAuthority(room)) return;
  if (room.simulated || options.advanceMs) room.now += options.advanceMs ?? 260;
  room.tick += 1;
  for (const player of Object.values(room.players)) {
    refreshShop(room, player);
    clearExpiredCombat(room, player);
    clearExpiredStun(room, player);
    if (isStunned(room, player)) {
      continue;
    }
    if (isCombatLocked(room, player)) {
      botThink(room, player);
      continue;
    }
    if (player.guidedDormant) continue;
    maybeDraw(room, player);
    let transitions = 0;
    while (
      now(room) >= player.nextMoveAt &&
      !player.combat &&
      !isStunned(room, player) &&
      transitions < boardPath.length
    ) {
      advancePlayer(room, player);
      transitions += 1;
    }
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

function loopTierForLaps(laps) {
  if (laps >= matchTiers[2].minLoops) return 3;
  if (laps >= matchTiers[1].minLoops) return 2;
  return 1;
}

function updateTier(room) {
  const top = leader(room);
  const nextTier = matchTiers[(top?.loopTier ?? 1) - 1] ?? matchTiers[(loopTierForLaps(top?.laps ?? 0)) - 1] ?? matchTiers[0];
  if ((room.tier?.id ?? 1) === nextTier.id) return;
  const previousTier = room.tier?.id ?? null;
  room.tier = nextTier;
  addLog(room, `${nextTier.name}: ${nextTier.text}`);
  emitRuleEvent(room, 'tierChanged', { from: previousTier, to: nextTier.id, leaderId: top?.id ?? null });
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
  emitRuleEvent(room, 'matchFinished', { winnerId: player.id, score: score(player) });
  if (isGuidedHuman(room, player)) {
    pushGuidedRecap(room, `Final lesson: your earlier road, Heat, gear, and recovery all compounded into the Tyrant fight.`);
    updateGuidedRun(room);
  }
  return player;
}

function updateEndgame(room) {
  if (room.status !== 'running') return null;
  for (const player of Object.values(room.players)) promotePlayerIfReady(room, player);
  updateTier(room);
  updateMarks(room);

  const contender = Object.values(room.players)
    .filter((player) => (player.loopTier ?? 1) >= 3 && player.laps >= (player.tierStartLap ?? 0) + bossLoopRequirement && !isCombatLocked(room, player))
    .sort((a, b) => score(b) - score(a))[0];
  if (!contender) return null;
  return challengeLoopBoss(room, contender);
}

function isSoloPlayer(room, player) {
  return Boolean(player && activePlayerCount(room) === 1);
}

function tileLoopLife(player) {
  return tileLoopLifeByTier[player.loopTier ?? 1] ?? 2;
}

function resetTile(tile) {
  tile.type = tile.index === 0 ? 'camp' : 'road';
  tile.charges = 0;
  delete tile.expiresOnLap;
}

function resetPlayerBoard(room, player) {
  for (const tile of player.board) resetTile(tile);
  player.position = 0;
  player.lastMoveAt = now(room);
  player.moveStartedAt = now(room);
  player.nextMoveAt = now(room) + movementDelay(room, player);
  player.arrivalMovement = null;
  player.nextMovement = movementSegmentForPlayer(player);
}

function promotePlayerIfReady(room, player) {
  const currentTier = player.loopTier ?? 1;
  const nextTier = loopTierForLaps(player.laps ?? 0);
  if (nextTier <= currentTier) return false;
  if (isSoloPlayer(room, player) && !player.soloGatesCleared.includes(currentTier)) {
    return challengeSoloGate(room, player, currentTier);
  }
  player.loopTier = Math.min(3, currentTier + 1);
  player.tierStartScore = score(player);
  player.tierStartLap = player.laps;
  player.deathsThisTier = 0;
  resetPlayerBoard(room, player);
  player.hp = player.maxHp;
  player.armor = Math.max(player.armor, player.loopTier);
  player.combat = null;
  if (isSoloPlayer(room, player)) {
    player.soloCorruption = (player.soloCorruption ?? 0) + 4;
  }
  player.event = player.loopTier >= 3 ? `entered tier ${player.loopTier}; Tyrant wakes in ${bossLoopRequirement} loops` : `entered tier ${player.loopTier}`;
  addLog(room, `${player.name} entered tier ${player.loopTier}; their loop collapsed into fresh road.`);
  emitRuleEvent(room, 'playerTierChanged', {
    playerId: player.id,
    from: currentTier,
    to: player.loopTier,
    position: player.position,
    laps: player.laps,
    hp: player.hp,
    loopTier: player.loopTier,
    board: cloneJson(visibleBoard(player)),
    nextMovement: player.nextMovement,
    arrivalMovement: player.arrivalMovement
  });
  if (player.loopTier >= 3) addLog(room, `The Loop Tyrant is stirring. ${player.name} must survive ${bossLoopRequirement} tier III loops.`);
  if (loopTierForLaps(player.laps ?? 0) > player.loopTier) return promotePlayerIfReady(room, player);
  return true;
}

function challengeSoloGate(room, player, tier) {
  if (isCombatLocked(room, player)) return false;
  const gate = soloGateByTier[tier];
  if (!gate) return false;
  if (isSoloPlayer(room, player) && (player.tilesPlaced ?? 0) <= 0) {
    player.hp = 0;
    resolveDefeat(room, player);
    addLog(room, `${player.name} reached the ${gate.label} with an unchanged road and was forced back to camp.`);
    return false;
  }
  player.soloGateAttempts = (player.soloGateAttempts ?? 0) + 1;
  player.hp = player.maxHp;
  player.armor = Math.max(player.armor, tier + 1);
  const corruptionPressure = Math.floor((player.soloCorruption ?? 0) * 0.35);
  const survived = fight(
    room,
    player,
    gate.label,
    gate.threat + corruptionPressure + player.soloGateAttempts * 2,
    gate.reward,
    gate.enemyCount
  );
  if (!survived) {
    resolveDefeat(room, player);
    addLog(room, `${player.name} failed the ${gate.label}; corruption thickens around tier ${tier}.`);
    return false;
  }
  player.soloGatesCleared = [...new Set([...(player.soloGatesCleared ?? []), tier])];
  player.event = `cleared the ${gate.label}`;
  addLog(room, `${player.name} broke the ${gate.label} and unlocked tier ${gate.nextTier}.`);
  return promotePlayerIfReady(room, player);
}

function challengeLoopBoss(room, player) {
  if (isSoloPlayer(room, player) && (player.tilesPlaced ?? 0) <= 0) {
    player.hp = 0;
    resolveDefeat(room, player);
    addLog(room, `${player.name} reached the Loop Tyrant with an unchanged road and was forced back to camp.`);
    return null;
  }
  player.bossAttempts = (player.bossAttempts ?? 0) + 1;
  player.hp = player.maxHp;
  player.armor = Math.max(player.armor, 3);
  const corruptionPressure = isSoloPlayer(room, player) ? Math.floor((player.soloCorruption ?? 0) * 0.45) : 0;
  const survived = fight(room, player, 'loop tyrant', 42 + corruptionPressure + player.bossAttempts * 3, 160, 5);
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
    emitRuleEvent(room, 'tilesExpired', { playerId: player.id, count: expired, lap: player.laps });
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
  const combat = player.combat;
  player.combat = null;
  emitRuleEvent(room, 'combatEnded', { playerId: player.id, combat: cloneJson(combat) });
  const defeated = resolveDefeat(room, player);
  applyPendingBonks(room, player);
  if (!defeated && !player.combat && !isStunned(room, player)) {
    emitRuleEvent(room, 'movementSegment', {
      playerId: player.id,
      nextMovement: player.nextMovement,
      arrivalMovement: player.arrivalMovement
    });
  }
}

function isCombatLocked(room, player) {
  return Boolean(player.combat && now(room) < player.combat.expiresAt);
}

function clearExpiredStun(room, player) {
  if (!player.stunnedUntil || now(room) < player.stunnedUntil) return;
  const stunnedUntil = player.stunnedUntil;
  player.stunnedUntil = null;
  player.stunnedBy = null;
  if (player.event.includes('stunned')) player.event = 'shook off the bonk';
  emitRuleEvent(room, 'stunEnded', { playerId: player.id, stunnedUntil });
}

function isStunned(room, player) {
  return Boolean(player.stunnedUntil && now(room) < player.stunnedUntil);
}

function applyBonkStun(room, player, bonk) {
  const stunnedUntil = now(room) + bonk.durationMs;
  player.stunnedUntil = Math.max(player.stunnedUntil ?? 0, stunnedUntil);
  player.stunnedBy = bonk.by;
  player.moveStartedAt = player.stunnedUntil;
  player.nextMoveAt = Math.max(player.nextMoveAt ?? now(room), player.stunnedUntil);
  player.nextMovement = movementSegmentForPlayer(player);
  player.nextDrawAt = Math.max(player.nextDrawAt ?? now(room), player.stunnedUntil);
  player.event = `${bonk.byName ?? 'Rival'} bonked you with ${bonk.cardName}`;
  player.lastEventAt = now(room);
  emitRuleEvent(room, 'playerStunned', {
    playerId: player.id,
    actorId: bonk.by,
    durationMs: bonk.durationMs,
    stunnedUntil: player.stunnedUntil,
    position: player.position,
    laps: player.laps,
    nextMovement: player.nextMovement,
    arrivalMovement: player.arrivalMovement
  });
}

function applyPendingBonks(room, player) {
  const pendingBonks = player.pendingBonks ?? [];
  if (!pendingBonks.length) return;
  player.pendingBonks = [];
  for (const bonk of pendingBonks) applyBonkStun(room, player, bonk);
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

function cardSellValue(card) {
  if (card.kind === 'bonk') return card.rarity === 'rare' ? 28 : 22;
  if (card.kind === 'rival') return 22;
  return 16;
}

function cardBuyValue(card) {
  return cardSellValue(card) + (card.kind === 'terrain' ? 14 : 18);
}

function lootSellValue(item) {
  return Math.max(18, Math.round(bestItemScore(item) * 4));
}

function lootBuyValue(item) {
  return Math.max(32, Math.round(lootSellValue(item) * 1.65));
}

function createShop(room, player = null) {
  const rotation = room ? Math.floor(now(room) / shopRotationMs) : Math.floor(Date.now() / shopRotationMs);
  const shopRoom = room
    ? {
        ...room,
        rngState: normalizeSeed(`${room.id}:${player?.id ?? 'shop'}:${player?.heroId ?? 'hero'}:${rotation}`),
        tick: rotation
      }
    : null;
  const offers = Array.from({ length: shopSize }, (_, index) => createShopOffer(shopRoom, player?.heroId, index));
  return {
    offers,
    rotatesAt: now(room) + shopRotationMs
  };
}

function refreshShop(room, player) {
  if (!player.shop || now(room) >= player.shop.rotatesAt) {
    player.shop = createShop(room, player);
  }
  return player.shop;
}

function createShopOffer(room, heroId, index) {
  const wantsCard = index < 2 || random(room) < 0.45;
  if (wantsCard) {
    const card = drawCard(room, index === 0 ? 'terrain' : null);
    return {
      id: randomId(room, 'offer'),
      kind: 'card',
      card,
      price: cardBuyValue(card)
    };
  }

  const hero = heroes.find((item) => item.id === heroId);
  const shopBuyer = {
    level: Math.max(1, Math.floor(((hero?.speed ?? 5) + (hero?.power ?? 7)) / 4)),
    lootLuck: hero?.lootLuck ?? 0
  };
  const loot = createLoot(room, shopBuyer);
  return {
    id: randomId(room, 'offer'),
    kind: 'loot',
    loot,
    price: lootBuyValue(loot)
  };
}

function xpNeeded(player) {
  return 24 + player.level * 13;
}

function drawCard(room = null, preferredKind = null, player = null) {
  if (room?.guidedRun?.enabled && player && isGuidedHuman(room, player) && preferredKind !== 'rival' && preferredKind !== 'bonk') {
    const index = Math.max(0, (player.guidedDrawIndex ?? 0));
    const cardId = guidedDrawSequence[index % guidedDrawSequence.length];
    player.guidedDrawIndex = index + 1;
    return guidedCard(room, cardId);
  }
  const soloPool = room ? activePlayerCount(room) <= 1 : false;
  const tierId = room?.tier?.id ?? 1;
  const rivalChance = tierId >= 3 ? 0.44 : tierId === 2 ? 0.38 : 0.3;
  const rivalPool = [...rivalCards, ...bonkCards];
  const pool = preferredKind === 'terrain'
    ? terrainCards
    : preferredKind === 'rival'
      ? soloPool ? terrainCards : rivalPool
      : preferredKind === 'bonk'
        ? soloPool ? terrainCards : bonkCards
      : random(room) < 1 - rivalChance
        ? terrainCards
        : soloPool ? terrainCards : rivalPool;
  const card = sample(room, pool);
  return { ...card, instanceId: randomId(room, 'card') };
}

function createLoot(room, player) {
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
  return {
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
}

function drawLoot(room, player) {
  const item = createLoot(room, player);
  player.loot.unshift(item);
  player.loot = player.loot.slice(0, 10);
  player.event = `found ${item.name}`;
  addLog(room, `${player.name} found ${item.name}.`);
  emitRuleEvent(room, 'lootGranted', { playerId: player.id, itemId: item.id, item: cloneJson(item) });
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
    emitRuleEvent(room, 'levelReached', {
      playerId: player.id,
      level: player.level,
      talentPoints: player.talentPoints,
      pendingTraits: player.pendingTraits
    });
  }
}

const dangerTiles = new Set(['grove', 'crypt', 'wolfden', 'bonepit', 'ruinedkeep', 'bloodmoon', 'wyrmgate', 'obelisk', 'ambush', 'scorch']);
const stackAuraTiles = new Set(['bloodmoon', 'bonepit', 'wolfden', 'wyrmgate']);
const stabilizerTiles = new Set(['meadow', 'village', 'forge', 'shrine', 'mire']);

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

function encounterLineup(encounter, enemyCount) {
  const ids = encounter.enemyIds?.length ? encounter.enemyIds : [encounter.enemyId];
  const names = encounter.enemyNames?.length ? encounter.enemyNames : [encounter.enemyName];
  const lineupSize = clamp(enemyCount, 1, 5);
  return Array.from({ length: lineupSize }, (_, index) => ({
    id: ids[index % ids.length],
    name: names[index % names.length] ?? encounter.enemyName
  }));
}

function fight(room, player, label, threat, reward, enemyCount = 1) {
  const hpBefore = player.hp;
  const tier = player.loopTier ?? room.tier?.id ?? 1;
  const tierThreat = (tier - 1) * 5;
  const tierReward = 1 + (tier - 1) * 0.28;
  const corruption = isSoloPlayer(room, player) ? player.soloCorruption ?? 0 : 0;
  const cursePenalty = player.curse > 0 ? 3 : 0;
  const emberHeat = player.heroId === 'ember-knight' ? clamp(player.heroHeat ?? 0, 0, 3) : 0;
  const graveDirge = player.heroId === 'grave-singer' ? clamp(player.graveEcho ?? 0, 0, 8) : 0;
  const heroBonus = player.heroId === 'ember-knight' && player.hp < player.maxHp * 0.45 ? 2 + emberHeat : emberHeat;
  const graveBonus = player.heroId === 'grave-singer' && threat >= 10 ? 4 : 0;
  const power = Math.max(4, player.power + emberHeat + Math.floor(graveDirge / 2) + (isSoloPlayer(room, player) ? 0 : Math.floor(player.level / 3)));
  const scaledThreat = threat + tierThreat + Math.floor(corruption * 0.18);
  const enemyMaxHp = clamp(scaledThreat * 2 + reward + player.level * 3 + enemyCount * 12 + Math.floor(corruption * 0.65), 24, label === 'loop tyrant' ? 320 : 210);
  const rounds = clamp(Math.ceil(enemyMaxHp / power), enemyCount, enemyCount + 5);
  const stackedPressure = (enemyCount - 1) * 2 + Math.max(0, rounds - 2);
  const graveWard = player.heroId === 'grave-singer' && threat >= 10 ? Math.min(5, enemyCount + 1 + Math.floor(graveDirge / 4)) : 0;
  const damage = clamp(scaledThreat + stackedPressure + cursePenalty + Math.floor(corruption / 16) - Math.floor(player.guard / 1.7) - player.armor - graveWard, 2, label === 'loop tyrant' ? 56 : 38);
  player.hp -= damage;
  let vanished = false;
  const canVanish = !['gate warden', 'crown gate', 'loop tyrant'].includes(label);
  if (player.hp <= 0 && canVanish && player.heroId === 'night-vagrant' && player.vagrantEscapeTier !== tier) {
    player.vagrantEscapeTier = tier;
    player.hp = 1;
    vanished = true;
  }
  player.armor = Math.max(0, player.armor - 1);
  const xpReward = Math.round((reward + heroBonus + graveBonus + (enemyCount - 1) * 5 + Math.max(0, rounds - enemyCount) * 2) * tierReward);
  addXp(room, player, xpReward);
  player.kos += enemyCount;
  if (player.heroId === 'ember-knight') player.heroHeat = clamp((player.heroHeat ?? 0) + 1, 0, 3);
  if (player.heroId === 'grave-singer' && threat >= 10) player.graveEcho = Math.min(8, (player.graveEcho ?? 0) + enemyCount);
  player.event = `${label}: ${enemyCount} foe${enemyCount === 1 ? '' : 's'}, -${damage} hp, +${xpReward} xp`;
  if (emberHeat > 0) player.event += `, heat ${emberHeat}`;
  if (vanished) player.event += ', vanished at 1 hp';
  if (isGuidedHuman(room, player)) {
    const heatLine = emberHeat > 0 ? ` Heat added ${emberHeat} power to the exchange.` : '';
    const survivalLine = player.hp > 0 ? ` You survived with ${Math.ceil(player.hp)} HP.` : ' The chain was lethal, so the loop forced a reset.';
    pushGuidedRecap(room, `${label} happened because this tile was on your road: ${enemyCount} foe${enemyCount === 1 ? '' : 's'}, ${damage} damage, ${xpReward} XP.${heatLine}${survivalLine}`);
  }
  const encounter = combatEncounters[label] ?? {
    enemyId: 'ash-imp',
    enemyName: 'Ash Imp',
    enemyIds: ['ash-imp'],
    enemyNames: ['Ash Imp'],
    backgroundId: 'forge',
    effect: 'ember'
  };
  const lineup = encounterLineup(encounter, enemyCount);
  const timestamp = now(room);
  const timing = combatTiming(room);
  const beats = combatBeats({
    rounds,
    enemyMaxHp,
    enemyCount,
    heroHpBefore: hpBefore,
    heroHpAfter: player.hp,
    heroDamage: damage,
    power,
    enemyName: encounter.enemyName,
    timing
  });
  const durationMs = timing.entryLeadMs + timing.tailMs + beats.length * timing.beatMs;
  player.combat = {
    ...encounter,
    enemyIds: lineup.map((enemy) => enemy.id),
    enemyNames: lineup.map((enemy) => enemy.name),
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
  emitRuleEvent(room, 'combatStarted', {
    playerId: player.id,
    tileIndex: player.position,
    position: player.position,
    laps: player.laps,
    tileType: player.board[player.position]?.type ?? null,
    label,
    enemyCount,
    damage,
    reward: xpReward,
    combat: cloneJson(player.combat)
  });
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

function activeEnemySlot(totalHp, enemyMaxHp, enemyCount) {
  const count = Math.max(1, enemyCount);
  const perEnemyMax = Math.max(1, Math.ceil(enemyMaxHp / count));
  const remaining = Math.max(0, totalHp);
  if (remaining <= 0) return count - 1;
  return Math.max(0, Math.min(count - 1, count - Math.ceil(remaining / perEnemyMax)));
}

function combatBeats({ rounds, enemyMaxHp, enemyCount, heroHpBefore, heroHpAfter, heroDamage, power, enemyName, timing }) {
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
      atMs: timing.windupMs + beats.length * timing.beatMs,
      damage: strikeDamage,
      enemyIndex: activeEnemySlot(enemyHp + strikeDamage, enemyMaxHp, enemyCount),
      heroHp,
      enemyHp,
      text: `You hit ${enemyName} for ${strikeDamage}`
    });

    if (enemyHp <= 0 || counterIndex >= counterDamages.length) continue;
    const counterDamage = counterDamages[counterIndex];
    counterIndex += 1;
    heroHp = Math.max(heroHpAfter, heroHp - counterDamage);
    beats.push({
      attacker: 'enemy',
      atMs: timing.windupMs + beats.length * timing.beatMs,
      damage: counterDamage,
      enemyIndex: activeEnemySlot(enemyHp, enemyMaxHp, enemyCount),
      heroHp,
      enemyHp,
      text: `${enemyName} hits you for ${counterDamage}`
    });
  }

  const lastBeat = beats.at(-1);
  if (!lastBeat || lastBeat.enemyHp !== 0) {
    beats.push({
      attacker: 'hero',
      atMs: timing.windupMs + beats.length * timing.beatMs,
      damage: enemyHp,
      enemyIndex: activeEnemySlot(enemyHp, enemyMaxHp, enemyCount),
      heroHp,
      enemyHp: 0,
      text: `You finish ${enemyName}`
    });
  }

  const finalBeat = beats.at(-1);
  if (finalBeat && finalBeat.heroHp !== heroHpAfter) finalBeat.heroHp = heroHpAfter;
  return beats;
}

function revivePlayer(room, player) {
  player.deaths += 1;
  player.deathsThisTier = (player.deathsThisTier ?? 0) + 1;
  const solo = isSoloPlayer(room, player);
  player.hp = Math.ceil(player.maxHp * 0.58);
  if (!solo) player.power += player.revivePower;
  resetPlayerBoard(room, player);
  player.tierStartLap = player.laps;
  player.combat = null;
  player.hand = player.hand.slice(0, 3);
  if (solo) applySoloDeathPenalty(room, player);
  player.event = `fell, then restarted tier ${player.loopTier ?? 1}`;
  player.lastEventAt = now(room);
  addLog(room, `${player.name} got knocked back to the start of tier ${player.loopTier ?? 1}.`);
  emitRuleEvent(room, 'playerDefeated', {
    playerId: player.id,
    deaths: player.deaths,
    loopTier: player.loopTier ?? 1,
    hp: player.hp,
    position: player.position,
    laps: player.laps,
    board: cloneJson(visibleBoard(player)),
    nextMovement: player.nextMovement,
    arrivalMovement: player.arrivalMovement
  });
  if (isGuidedHuman(room, player)) {
    pushGuidedRecap(room, `You fell because the danger chain beat your recovery. Next time, place safety before the stack, not after it.`);
    updateGuidedRun(room);
  }
}

function applySoloDeathPenalty(room, player) {
  const deathCount = player.deathsThisTier ?? 1;
  const goldLoss = Math.min(player.gold ?? 0, 18 + deathCount * 7);
  player.gold = Math.max(0, (player.gold ?? 0) - goldLoss);
  player.soloCorruption = (player.soloCorruption ?? 0) + 4 + Math.min(4, deathCount);
  player.scorePenalty = (player.scorePenalty ?? 0) + 120 + deathCount * 35;
  const nextTier = matchTiers[player.loopTier ?? 1];
  const setbackThreshold = nextTier?.minScore ?? ((player.loopTier ?? 1) >= 3 ? roomGoalScore(room) : null);
  if (setbackThreshold && score(player) >= setbackThreshold) {
    player.scorePenalty += score(player) - setbackThreshold + 220;
  }
  player.shop = createShop(room, player);

  const equippedIds = new Set(Object.values(normalizeLoadout(player)).filter(Boolean).map((item) => item.id));
  const looseLoot = player.loot.filter((item) => !equippedIds.has(item.id));
  if (looseLoot.length > 0 && random(room) < 0.55) {
    const lost = sample(room, looseLoot);
    player.loot = player.loot.filter((item) => item.id !== lost.id);
    addLog(room, `${player.name} lost ${lost.name} in the collapse.`);
  }
  if (goldLoss > 0) addLog(room, `${player.name} dropped ${goldLoss} gold to the hungry loop.`);
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
    const corruptionTax = isSoloPlayer(room, player) ? Math.floor((player.soloCorruption ?? 0) / 10) : 0;
    const heal = Math.max(2, 9 + player.lapHeal - corruptionTax);
    player.hp = clamp(player.hp + heal, 0, player.maxHp);
    player.event = 'campfire recovery';
  } else if (tile.type === 'grove') {
    fight(room, player, 'wolf grove', 8, 10, encounterStack(room, player, tile));
  } else if (tile.type === 'meadow') {
    const bonus = player.heroId === 'moss-warden' ? 7 : 4;
    player.hp = clamp(player.hp + bonus, 0, player.maxHp);
    if (isSoloPlayer(room, player)) player.soloCorruption = Math.max(0, (player.soloCorruption ?? 0) - 1);
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
    if (isSoloPlayer(room, player)) player.soloCorruption = Math.max(0, (player.soloCorruption ?? 0) - 1);
    if (random(room) < 0.55 + player.lootLuck) drawLoot(room, player);
    addXp(room, player, 5);
    player.event = 'forge sparks: armor and loot';
  } else if (tile.type === 'shrine') {
    addXp(room, player, 14);
    if (isSoloPlayer(room, player)) player.soloCorruption = Math.max(0, (player.soloCorruption ?? 0) - 2);
    player.hp = clamp(player.hp + 3, 0, player.maxHp);
    player.event = 'shrine surge: +14 xp';
  } else if (tile.type === 'mire') {
    player.nextMoveAt += 450 * roomTimeScale(room);
    player.nextMovement = movementSegmentForPlayer(player);
    if (player.hand.length < 7) player.hand.push(drawCard(room));
    player.event = 'mire drag: slowed, drew a card';
  } else if (tile.type === 'village') {
    player.hp = clamp(player.hp + 7, 0, player.maxHp);
    if (isSoloPlayer(room, player)) {
      player.soloCorruption = Math.max(0, (player.soloCorruption ?? 0) - 3);
      player.deathsThisTier = Math.max(0, (player.deathsThisTier ?? 0) - 1);
    }
    addXp(room, player, 6);
    if (random(room) < 0.2 + player.lootLuck) drawLoot(room, player);
    player.event = 'village rest: healed and supplied';
  } else if (tile.type === 'obelisk') {
    player.armor += 1;
    player.hp = clamp(player.hp + 4, 0, player.maxHp);
    addXp(room, player, player.heroId === 'grave-singer' ? 18 : 12);
    if (isSoloPlayer(room, player)) player.soloCorruption = Math.max(0, (player.soloCorruption ?? 0) - 2);
    drawLoot(room, player);
    player.event = 'obelisk surge: power in the stones';
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
    if (roll < 0.3) {
      player.hp -= 6;
      player.event = 'road fatigue: -6 hp';
    } else if (roll < 0.52) {
      player.hp = clamp(player.hp + 3, 0, player.maxHp);
      player.event = 'quiet road: +3 hp';
    } else player.event = 'sprinting';
  }

  resolveDefeat(room, player);
  player.lastEventAt = now(room);
  if (isGuidedHuman(room, player)) updateGuidedRun(room);
}

function movementDelay(room, player) {
  const base = 1125 - player.speed * 72;
  return clamp(base, 390, 1300) * roomTimeScale(room);
}

function movementSegmentForPlayer(player) {
  const boardLength = boardPath.length;
  const fromCursor = (player.laps ?? 0) * boardLength + (player.position ?? 0);
  return {
    fromCursor,
    toCursor: fromCursor + 1,
    departAt: player.moveStartedAt ?? player.lastMoveAt ?? 0,
    arriveAt: player.nextMoveAt ?? player.moveStartedAt ?? player.lastMoveAt ?? 0
  };
}

function advancePlayer(room, player) {
  const boardLength = boardPath.length;
  const fromCursor = player.laps * boardLength + player.position;
  const departAt = player.moveStartedAt ?? player.lastMoveAt ?? now(room);
  player.position = (player.position + 1) % boardPath.length;
  const arrivedAt = now(room);
  player.lastMoveAt = arrivedAt;
  player.arrivalMovement = {
    fromCursor,
    toCursor: fromCursor + 1,
    departAt,
    arriveAt: arrivedAt
  };
  if (player.position === 0) {
    player.laps += 1;
    if (isSoloPlayer(room, player)) {
      player.soloCorruption = (player.soloCorruption ?? 0) + 1;
    }
    expireLoopTiles(room, player);
    player.hp = clamp(player.hp + player.lapHeal, 0, player.maxHp);
    addXp(room, player, 4);
    if (player.hand.length < 7 && random(room) < 0.38) player.hand.push(drawCard(room));
    addLog(room, `${player.name} completed lap ${player.laps}.`);
    emitRuleEvent(room, 'lapCompleted', { playerId: player.id, laps: player.laps });
    if ((player.loopTier ?? 1) >= 3) {
      const loopsToTyrant = Math.max(0, (player.tierStartLap ?? 0) + bossLoopRequirement - player.laps);
      if (loopsToTyrant === 1) {
        player.event = 'Loop Tyrant wakes next loop';
        addLog(room, `The Loop Tyrant is close. ${player.name} has one loop before the final fight.`);
      }
    }
  }
  triggerTile(room, player, player.board[player.position]);
  emitRuleEvent(room, 'tileResolved', {
    playerId: player.id,
    tileIndex: player.position,
    tileType: player.board[player.position]?.type ?? null,
    position: player.position,
    laps: player.laps,
    hp: player.hp,
    score: score(player),
    level: player.level,
    deaths: player.deaths,
    event: player.event,
    message: player.message
  });
  const nextDepartAt = player.combat ? player.combat.expiresAt + Math.round(320 * roomTimeScale(room)) : arrivedAt;
  const delay = movementDelay(room, player);
  player.moveStartedAt = nextDepartAt;
  player.nextMoveAt = room.simulated ? Math.max(arrivedAt + delay, nextDepartAt) : nextDepartAt + delay;
  const nextFromCursor = player.laps * boardLength + player.position;
  player.nextMovement = {
    fromCursor: nextFromCursor,
    toCursor: nextFromCursor + 1,
    departAt: player.moveStartedAt,
    arriveAt: player.nextMoveAt
  };
  emitRuleEvent(room, 'movementSegment', {
    playerId: player.id,
    nextMovement: player.combat ? null : player.nextMovement,
    arrivalMovement: player.arrivalMovement
  });
}

function maybeDraw(room, player) {
  if (now(room) < player.nextDrawAt) return;
  if (player.hand.length < 7) {
    const card = drawCard(room, null, player);
    player.hand.push(card);
    player.event = 'drew a card';
    emitRuleEvent(room, 'cardDrawn', {
      playerId: player.id,
      cardId: card.id,
      cardInstanceId: card.instanceId,
      kind: card.kind
    });
    if (isGuidedHuman(room, player)) updateGuidedRun(room);
  }
  player.nextDrawAt = now(room) + Math.round((6500 + rand(room, 1400)) * player.drawRate * roomTimeScale(room));
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
  const candidates = player.board.filter((tile) => tile.type !== 'camp' && !isBlockedCombatTerrainPlacement(player, card, tile));
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
  if (player.guidedDormant) return;
  if (player.pendingTraits.length > 0) chooseTrait(player, chooseBotTrait(player));

  for (const slot of equipmentSlots) {
    const current = normalizeLoadout(player)[slot];
    const best = player.loot
      .filter((item) => item.slot === slot)
      .sort((a, b) => bestItemScore(b) - bestItemScore(a))[0];
    if (best && (!current || bestItemScore(best) > bestItemScore(current))) equip(player, best.id);
  }

  const soloCrisis = isSoloPlayer(room, player) && (player.hp < player.maxHp * 0.68 || (player.soloCorruption ?? 0) > 24 || (player.deathsThisTier ?? 0) > 1);
  const wantsAttack = !soloCrisis && (random(room) < 0.52 || score(player) < Math.max(...Object.values(room.players).map(score)) - 250);
  const stabilizer = player.hand.find((item) => item.kind === 'terrain' && stabilizerTiles.has(item.tile));
  const card = wantsAttack
    ? player.hand.find((item) => item.kind === 'bonk' || item.kind === 'rival') ?? player.hand.find((item) => item.kind === 'terrain')
    : stabilizer ?? player.hand.find((item) => item.kind === 'terrain') ?? player.hand.find((item) => item.kind === 'bonk' || item.kind === 'rival');
  if (!card) return;
  if (card.kind === 'terrain') {
    const tileIndex = chooseBotTerrainTile(room, player, card)?.index ?? (1 + rand(room, boardPath.length - 1));
    playTerrain(room, player, card.instanceId, tileIndex);
  } else if (card.kind === 'bonk') {
    const target = card.targetMode === 'chosen' ? chooseRivalTarget(room, player) : null;
    playBonk(room, player, card.instanceId, target?.id);
  } else {
    const target = chooseRivalTarget(room, player);
    if (target) playRival(room, player, card.instanceId, target.id);
  }
}

export const testApi = {
  absorbRoomClockDrift,
  activePlayerCount,
  addBot,
  availableTraits,
  buyShopOffer,
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
  kickPlayer,
  matchTiers,
  maxPlayers,
  movementDelay,
  goalScore,
  fight,
  playRival,
  playBonk,
  playTerrain,
  resetRoom,
  refreshPendingTraits,
  refreshRoomAuthority,
  restoreRoom,
  roomSnapshot,
  runRoomStep,
  score,
  serializeRoom,
  sellCard,
  sellLoot,
  shopRotationMs,
  shopSize,
  startRoom,
  updateRoomSettings,
  traits,
  triggerTile
};
