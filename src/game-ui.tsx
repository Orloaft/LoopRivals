import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Bot, ChevronDown, ChevronUp, Coins, Crown, Footprints, Gauge, Gem, Hand, HardHat, HelpCircle, Play, RotateCcw, ScrollText, Settings, Shield, Shirt, ShoppingBag, Sparkles, Swords, UserX, Users, Volume2, VolumeX, Zap } from 'lucide-react';
import {
  combatBackgroundUrl,
  combatEnemySize,
  combatEnemyUrl,
  healthPotionSpriteUrl,
  heroPortraitUrl,
  heroSpriteUrl,
  itemSpriteUrl,
  talentArtUrl,
  talentIconUrl
} from './game-assets';
import { sfx, isSfxEnabled, setSfxEnabled } from './audio';
import { prefersReducedMotion } from './motion-prefs';
import { shake, isShakeEnabled, setShakeEnabled } from './screen-shake';
import { getQualityPref, setQualityPref, type QualityPref } from './quality-mode';
import { useBakedSprite, spriteBakeUnsupported } from './sprite-bake';
import { configureGameplayRafMetrics, gameplayRaf, type GameplayRafFrame } from './gameplay-raf';
import { authoritativeCursor, clampCursorAtMovementStop, combatEngageIsPending, maxVisualFrameStepMs, pendingCombatStopCursor, playerMotionIsLocked, pointAlongBoard, serverPresentationClock, tileCenter, visualCursorForPlayer, visualFrameCursorForPlayer, visualSegmentDurationMs, type RunnerPoint } from './movement';
import { loopduelSmoothnessMetrics } from './smoothness-metrics';
import type { Card, Combat, CombatBeat, EquipmentSlot, GameConfig, GameState, Loot, OnboardingState, Player, ProjectedMechanicHint, RoomSettings, ShopOffer, Tile, Trait } from './types';

configureGameplayRafMetrics(loopduelSmoothnessMetrics);

type LocalProfile = {
  matches: number;
  wins: number;
  bestScore: number;
  bestLevel: number;
};

type RunnerFloater = {
  value: number;
  suffix: string;
  tone: 'gain' | 'loss' | 'health' | 'gold' | 'xp' | 'loop' | 'level';
  lane: number;
};

type LiveFloater = {
  node: HTMLElement;
  value: number;
  suffix: string;
  at: number;
};

// Rapid same-tone floaters merge into one node instead of stacking new ones —
// every extra floater is a fresh animated, shadowed layer, and bursts of them
// were the single worst frame-spike source on weak machines (see
// docs/frame-consistency-appraisal.md).
const floaterMergeWindowMs = 900;
const maxFloaterNodes = 4;

function formatFloaterText(value: number, suffix: string) {
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

const equipmentSlots: EquipmentSlot[] = ['weapon', 'shield', 'helm', 'armor', 'gloves', 'boots', 'ring', 'charm'];
const equipmentLabels: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  shield: 'Shield',
  helm: 'Helm',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  ring: 'Ring',
  charm: 'Charm'
};
const bossLoopRequirement = 4;

const tileNames: Record<string, string> = {
  road: 'Road',
  camp: 'Camp',
  grove: 'Grove',
  bloomgrove: 'Bloom Grove',
  meadow: 'Meadow',
  crypt: 'Crypt',
  wolfden: 'Wolf Den',
  bonepit: 'Bone Pit',
  ruinedkeep: 'Ruined Keep',
  ransackedvillage: 'Ransacked Village',
  bloodmoon: 'Blood Moon',
  wyrmgate: 'Wyrm Gate',
  embergate: 'Ember Gate',
  forge: 'Forge',
  shrine: 'Shrine',
  mire: 'Mire',
  village: 'Village',
  obelisk: 'Obelisk',
  watchtower: 'Watchtower',
  orchard: 'Orchard',
  chapel: 'Chapel',
  market: 'Black Market',
  armory: 'Armory',
  waystone: 'Waystone',
  scriptorium: 'Scriptorium',
  spidernest: 'Spider Nest',
  tollgate: 'Tollgate',
  thornmaze: 'Thorn Maze',
  graveyard: 'Graveyard',
  reliquary: 'Reliquary',
  dragonroost: 'Dragon Roost',
  ambush: 'Ambush',
  scorch: 'Scorch',
  rootwall: 'Root Wall',
  bramblebloom: 'Bramble Bloom',
  wardensheart: "Warden's Heart",
  oldgrowth: 'Old Growth',
  wyrmhead: 'Wyrm Head',
  wyrmclaw: 'Wyrm Claw',
  wyrmcoil: 'Wyrm Coil',
  wyrmtail: 'Wyrm Tail',
  guardstance: 'Guard Stance',
  markedchallenge: 'Marked Challenge',
  retaliation: 'Retaliation',
  executionstance: 'Execution Stance',
  seal1: 'Seal I',
  seal2: 'Seal II',
  seal3: 'Seal III',
  innergate: 'Inner Gate'
};

const tileGlyphs: Record<string, string> = {
  road: '',
  camp: '⌂',
  grove: '♣',
  bloomgrove: '✿',
  meadow: '✦',
  crypt: '☗',
  wolfden: '♣',
  bonepit: '☗',
  ruinedkeep: '⚔',
  ransackedvillage: '⚔',
  bloodmoon: '☾',
  wyrmgate: '◆',
  embergate: '◆',
  forge: '⚒',
  shrine: '✚',
  mire: '≈',
  village: '⌂',
  obelisk: '◆',
  watchtower: '◈',
  orchard: '✿',
  chapel: '✚',
  market: '$',
  armory: '▣',
  waystone: '◇',
  scriptorium: '✧',
  spidernest: '♣',
  tollgate: '$',
  thornmaze: '✣',
  graveyard: '☗',
  reliquary: '◆',
  dragonroost: '▲',
  ambush: '⚔',
  scorch: '☄',
  rootwall: '✣',
  bramblebloom: '✿',
  wardensheart: '♥',
  oldgrowth: '◎',
  wyrmhead: '▲',
  wyrmclaw: '〳',
  wyrmcoil: '◎',
  wyrmtail: '⌁',
  guardstance: '▣',
  markedchallenge: '◈',
  retaliation: '⚔',
  executionstance: '†',
  seal1: 'I',
  seal2: 'II',
  seal3: 'III',
  innergate: '▥'
};

function combatFxClass(effect: Combat['effect']) {
  return `combat-fx-sprite combat-fx-${effect}`;
}

function roadShapeClass(board: Tile[], tile: Tile) {
  const previous = board[(tile.index - 1 + board.length) % board.length];
  const next = board[(tile.index + 1) % board.length];
  const connections = [previous, next].map((neighbor) => {
    const dx = neighbor.coord[0] - tile.coord[0];
    const dy = neighbor.coord[1] - tile.coord[1];

    if (dx === 1) return 'e';
    if (dx === -1) return 'w';
    if (dy === 1) return 's';
    if (dy === -1) return 'n';
    return '';
  }).filter(Boolean).sort().join('');

  return `road-shape-${connections}`;
}

function tileDescription(tile: Tile) {
  const descriptions: Record<string, string> = {
    road: 'Can trigger a skirmish, a breather, or a sprint.',
    camp: 'Safe reset point. Crossing camp heals the runner.',
    grove: 'A steady fight tile with XP and loot pressure.',
    bloomgrove: 'A transformed Grove that fights, then mends survivors.',
    meadow: 'Healing terrain. Moss Warden gains extra value here.',
    crypt: 'Dangerous fight tile with better loot odds.',
    wolfden: 'A pack fight tile that stacks hard beside danger.',
    bonepit: 'A two-enemy undead fight with stronger loot pressure.',
    ruinedkeep: 'An elite raider encounter with high XP and loot odds.',
    ransackedvillage: 'A Village-Crypt transformation with danger and recovered gold.',
    bloodmoon: 'A danger aura that makes nearby fights stack larger.',
    wyrmgate: 'A boss-class fight tile for powered-up runners.',
    embergate: 'A Forge-stoked Wyrm Gate with harsher threat and richer spoils.',
    forge: 'Grants armor and has strong loot tempo.',
    shrine: 'XP burst that accelerates trait choices.',
    mire: 'Slows movement but draws cards.',
    village: 'Safe heal, small XP, and supply chance.',
    obelisk: 'XP spike that may wake a hard encounter.',
    watchtower: 'Draws rival cards and enables control play.',
    orchard: 'Recovery tile with a strong chance to draw terrain.',
    chapel: 'Cleanses curse while healing and granting XP.',
    market: 'Gold and shop tempo without a combat stop.',
    armory: 'Armor prep with a small loot roll.',
    waystone: 'Accelerates the next draw window and grants XP.',
    scriptorium: 'Terrain draw and XP with curse pressure.',
    spidernest: 'Pack fight that can refill your hand.',
    tollgate: 'Bandit fight with a gold payout.',
    thornmaze: 'High-pressure grove fight that stacks hard.',
    graveyard: 'Medium undead fight with Grave Singer upside.',
    reliquary: 'Guaranteed loot and XP, with curse risk while healthy.',
    dragonroost: 'Boss-class fight with hoard rewards.',
    ambush: 'Temporary rival trap that creates a hard fight.',
    scorch: 'Temporary hazard left by a meteor strike.'
  };
  return descriptions[tile.type] ?? 'Unknown loop tile.';
}

const dangerousTileTypes = new Set(['grove', 'bloomgrove', 'crypt', 'wolfden', 'bonepit', 'ruinedkeep', 'ransackedvillage', 'bloodmoon', 'wyrmgate', 'embergate', 'obelisk', 'spidernest', 'tollgate', 'thornmaze', 'graveyard', 'reliquary', 'dragonroost', 'ambush', 'scorch']);
const combatPlacementTileTypes = new Set(['grove', 'bloomgrove', 'crypt', 'wolfden', 'bonepit', 'ruinedkeep', 'ransackedvillage', 'bloodmoon', 'wyrmgate', 'embergate', 'spidernest', 'tollgate', 'thornmaze', 'graveyard', 'dragonroost', 'ambush']);
const stabilizerTileTypes = new Set(['camp', 'meadow', 'village', 'forge', 'shrine', 'mire', 'orchard', 'chapel', 'armory', 'waystone']);
const payoffTileTypes = new Set(['bloomgrove', 'crypt', 'bonepit', 'ruinedkeep', 'ransackedvillage', 'bloodmoon', 'wyrmgate', 'embergate', 'obelisk', 'forge', 'watchtower', 'market', 'armory', 'waystone', 'scriptorium', 'tollgate', 'reliquary', 'dragonroost']);
const defaultTalentMaxRanks = 3;

function traitMaxRanks(trait: Trait) {
  return Math.max(1, trait.maxRanks ?? defaultTalentMaxRanks);
}

function traitRank(player: Player, traitId: string) {
  return player.traits.filter((id) => id === traitId).length;
}

function totalTalentRanks(tree: Trait[]) {
  return tree.reduce((total, trait) => total + traitMaxRanks(trait), 0);
}

function boardStepsAhead(player: Player, tile: Tile) {
  if (player.board.length === 0) return null;
  return (tile.index - player.position + player.board.length) % player.board.length;
}

function boardStepsAheadOfCursor(player: Player, tile: Tile, cursor: number) {
  if (player.board.length === 0) return null;
  const visualPosition = Math.floor(cursor + 0.0001) % player.board.length;
  return (tile.index - visualPosition + player.board.length) % player.board.length;
}

function combatPlacementBlocked(
  player: Player,
  tile: Tile,
  card: Card | null,
  serverNow: number,
  receivedAt?: number,
  authorityPaused = false
) {
  if (card?.kind !== 'terrain' || !combatPlacementTileTypes.has(card.tile ?? '')) return false;
  if (boardStepsAhead(player, tile) === 1) return true;
  const visualCursor = visualCursorForPlayer(player, serverNow, receivedAt, authorityPaused);
  const visualStepsAhead = boardStepsAheadOfCursor(player, tile, visualCursor);
  return visualStepsAhead !== null && visualStepsAhead <= 1;
}

function terrainPlacementHint(
  player: Player,
  tile: Tile,
  card: Card | null,
  serverNow: number,
  receivedAt?: number,
  authorityPaused = false
) {
  if (combatPlacementBlocked(player, tile, card, serverNow, receivedAt, authorityPaused)) return 'Place combat tiles at least 2 tiles ahead, so you have time to prepare.';
  if (card?.kind === 'terrain') return `Drop ${card.name} here`;
  return undefined;
}

function upcomingTiles(player: Player, count = 5) {
  return Array.from({ length: Math.min(count, player.board.length) }, (_, index) => {
    const step = index + 1;
    return {
      step,
      tile: player.board[(player.position + step) % player.board.length]
    };
  });
}

function tileRisk(tile: Tile) {
  if (tile.type === 'wyrmgate' || tile.type === 'dragonroost') return 5;
  if (tile.type === 'bloodmoon' || tile.type === 'ruinedkeep' || tile.type === 'bonepit' || tile.type === 'thornmaze') return 4;
  if (tile.type === 'crypt' || tile.type === 'wolfden' || tile.type === 'spidernest' || tile.type === 'tollgate' || tile.type === 'graveyard' || tile.type === 'ambush' || tile.type === 'scorch') return 3;
  if (tile.type === 'obelisk' || tile.type === 'reliquary' || tile.type === 'grove') return 2;
  if (stabilizerTileTypes.has(tile.type)) return -1;
  return 0;
}

function tacticalLabel(player: Player) {
  const next = upcomingTiles(player, 5);
  const spike = next.find(({ tile }) => tileRisk(tile) >= 3);
  const stabilizer = next.find(({ tile }) => stabilizerTileTypes.has(tile.type));
  if (spike) return `${spike.step} to ${tileNames[spike.tile.type] ?? spike.tile.type}`;
  if (stabilizer) return `${stabilizer.step} to ${tileNames[stabilizer.tile.type] ?? stabilizer.tile.type}`;
  return 'roads ahead';
}

function eventImpact(event: string) {
  const lower = event.toLowerCase();
  if (/(bonk|stun|meteor|curse|bandit|landslide|tempo|loot stolen|stole loot|cutpurse|wound|armed|ambush|scorch)/.test(lower)) {
    if (lower.includes('bonk') || lower.includes('stun')) return { tone: 'bonk', title: 'BONKED', detail: event };
    if (lower.includes('meteor') || lower.includes('scorch')) return { tone: 'meteor', title: 'METEOR', detail: event };
    if (lower.includes('curse')) return { tone: 'curse', title: 'CURSED', detail: event };
    if (lower.includes('landslide')) return { tone: 'landslide', title: 'ROAD HIT', detail: event };
    if (lower.includes('tempo') || lower.includes('loot') || lower.includes('cutpurse')) return { tone: 'steal', title: 'STOLEN', detail: event };
    return { tone: 'rival', title: 'RIVAL HIT', detail: event };
  }
  if (lower.includes('briar warden')) return { tone: 'danger', title: 'ACT BOSS', detail: event };
  if (lower.includes('crown sentinel')) return { tone: 'danger', title: 'ACT BOSS', detail: event };
  if (lower.includes('loop tyrant')) return { tone: 'danger', title: 'TYRANT', detail: event };
  if (lower.includes('out of lives')) return { tone: 'danger', title: 'ELIMINATED', detail: event };
  if (/(failed|broken|defeated|died|knock)/.test(lower)) return { tone: 'danger', title: 'DOWN', detail: event };
  return null;
}

function runnerStatusLabel(player: Player) {
  if (player.eliminated) return 'Eliminated';
  if (player.combat) return 'Combat';
  if ((player.stunRemainingMs ?? 0) > 0) return 'Stunned';
  const currentTile = player.board[player.position] ?? player.board[0];
  return tileNames[currentTile?.type ?? 'road'] ?? 'Loop';
}

function comboHint(card: Card) {
  if (card.combo?.text) return card.combo.text;
  if (card.kind === 'rival') return 'Best when a rival is near a danger tile or marked as leader.';
  if (card.kind === 'bonk') return card.targetMode === 'chosen' ? 'Save for a gate push or a rival about to cash out.' : 'Tempo answer when the leader is about to spike.';
  if (card.tile === 'bloodmoon') return 'Place within two tiles of Crypt, Wolf Den, or Bone Pit to grow enemy stacks.';
  if (card.tile === 'meadow' || card.tile === 'village' || card.tile === 'orchard' || card.tile === 'chapel') return 'Place before danger so the next lap has a recovery window.';
  if (card.tile === 'forge' || card.tile === 'shrine' || card.tile === 'armory') return 'Place just before a gate push for armor, XP, or trait tempo.';
  if (card.tile === 'mire') return 'Place before a hard fight when you need one more card first.';
  if (card.tile === 'watchtower') return 'Use when the leader is close to a payoff tile.';
  if (card.tile === 'market') return 'Use when shop offers matter or you need gold before dying costs bite.';
  if (card.tile === 'waystone' || card.tile === 'scriptorium') return 'Use when your hand needs more options before the next route decision.';
  if (card.tile === 'spidernest' || card.tile === 'tollgate' || card.tile === 'graveyard') return 'Medium danger with an extra payoff; safer after armor or healing.';
  if (card.tile === 'thornmaze' || card.tile === 'dragonroost') return 'Treat as a serious fight and build a recovery tile nearby first.';
  if (card.tile === 'reliquary') return 'Cash out when you can absorb curse pressure or need guaranteed loot.';
  if (payoffTileTypes.has(card.tile ?? '')) return 'Pair with safe terrain nearby before stacking more danger.';
  return 'Road shaping card.';
}

function cardSuit(card: Card) {
  if (card.kind === 'bonk') return card.rarity === 'rare' ? 'Rare control' : 'Common control';
  if (card.kind === 'rival') return 'Doom';
  if (card.tile === 'meadow' || card.tile === 'village' || card.tile === 'orchard' || card.tile === 'chapel') return 'Haven';
  if (card.tile === 'crypt' || card.tile === 'obelisk' || card.tile === 'wolfden' || card.tile === 'bonepit' || card.tile === 'ruinedkeep' || card.tile === 'bloodmoon' || card.tile === 'wyrmgate' || card.tile === 'spidernest' || card.tile === 'tollgate' || card.tile === 'thornmaze' || card.tile === 'graveyard' || card.tile === 'reliquary' || card.tile === 'dragonroost') return 'Peril';
  if (card.tile === 'forge' || card.tile === 'watchtower' || card.tile === 'market' || card.tile === 'armory' || card.tile === 'waystone' || card.tile === 'scriptorium') return 'Engine';
  return 'Path';
}

function cardFaceClass(card: Card) {
  if (card.kind === 'rival') return 'rival';
  if (card.kind === 'bonk') return `bonk ${card.rarity ?? 'common'}`;
  return `terrain ${card.tile ?? 'road'}`;
}

type CoachLesson = {
  speaker: string;
  title: string;
  prompt: string;
  detail: string;
};

const guidedLessons: Record<string, CoachLesson> = {
  welcome: {
    speaker: 'The Warden',
    title: 'At the thorn gate',
    prompt: 'Runner, the loop remembers every kindness and every wound you lay into its road.',
    detail: 'Place terrain for future laps. Havens keep breath in your ribs; peril pays only if you survive it.'
  },
  'place-safe': {
    speaker: 'The Warden',
    title: 'First mercy',
    prompt: 'Set a haven before the Crypt. A brave road without recovery is only a prettier grave.',
    detail: 'Drop Meadow on the marked tile. The lesson is timing: healing belongs before danger, not after panic.'
  },
  'prep-threat': {
    speaker: 'The Warden',
    title: 'Sharpen the road',
    prompt: 'The Crypt and Blood Moon are awake. Add steel, moss, or a readable fight while the path is still yours.',
    detail: 'Engines like Forge and controlled peril like Grove turn survival into XP, loot, and build momentum.'
  },
  'build-fork': {
    speaker: 'The Warden',
    title: 'Choose your hunger',
    prompt: 'Every card is a bargain: shelter the runner, feed the engine, or let danger grow teeth.',
    detail: 'Good placement creates a plan you can read on the next lap. Bad greed creates a funeral procession.'
  },
  rival: {
    speaker: 'The Warden',
    title: 'A second shadow',
    prompt: 'Vesper has started their own engine. Strike when their next steps point at payoff.',
    detail: 'Rival and bonk cards are timing tools. Use them from portrait chips or the rival board, never from guesswork.'
  },
  'free-run': {
    speaker: 'The Warden',
    title: 'The leash is cut',
    prompt: 'You know the first laws now. Build toward the next act boss and read the log when the loop bites back.',
    detail: 'Bosses test the whole road: stats, recovery, danger spacing, and whether your greed can pay its debt.'
  },
  debrief: {
    speaker: 'The Warden',
    title: 'Ashes counted',
    prompt: 'The duel is over. Keep the lesson that hurt the most; the loop will ask for it again.',
    detail: 'Deaths, missed recovery, and late rival cards are clues, not scolding. Shape the next run around them.'
  }
};

const coreMechanicRunes: ProjectedMechanicHint[] = [
  {
    label: 'Combos',
    value: 'shape',
    tone: 'arcane',
    text: 'Some card pairings combine into stronger effects. Place a haven before a peril, or an engine before a boss, so each lap sets up the next.'
  },
  {
    label: 'Blood Moon',
    value: 'danger aura',
    tone: 'danger',
    text: 'A Blood Moon tile is a danger aura: fights placed near it stack more enemies. Bigger risk, bigger payoff — keep recovery close before you lean in.'
  },
  {
    label: 'Purge',
    value: 'reset',
    tone: 'safe',
    text: 'A purge is a deliberate reset. Spend it to clear a poisoned plan before the board snowballs.'
  },
  {
    label: 'Wager',
    value: 'boss',
    tone: 'danger',
    text: 'A boss fight costs an ante — HP, time, or gold. Only challenge one when your stats and health can survive it.'
  },
  {
    label: 'Relics',
    value: 'best loot',
    tone: 'gold',
    text: 'Relics are the rarest, strongest loot tier. Equip them in your gear slots for a big stat jump over common and rare drops.'
  }
];

function onboardingLesson(onboarding: OnboardingState): CoachLesson {
  // Prefer the server's contextual text (tile-specific prompts, the personalized
  // debrief). The scripted table is only a fallback if the server left a field blank.
  const scripted = guidedLessons[onboarding.completed ? 'debrief' : onboarding.step] ?? guidedLessons.welcome;
  return {
    speaker: onboarding.speaker ?? scripted.speaker,
    title: onboarding.title || scripted.title,
    prompt: onboarding.prompt || scripted.prompt,
    detail: onboarding.detail || scripted.detail
  };
}

// During the guided run, only surface runes relevant to the current beat so early
// lessons aren't buried under boss-wager / relic lectures the player can't use yet.
// `null` = no gating (show everything). The held-card hints are always allowed since
// they explain the card the player is about to play.
const guidedRuneAllow: Record<string, Set<string> | null> = {
  welcome: new Set(),
  'place-safe': new Set(),
  'prep-threat': new Set(['Combos', 'Blood Moon']),
  'build-fork': new Set(['Combos', 'Blood Moon', 'Purge']),
  rival: new Set(['Combos', 'Blood Moon', 'Purge']),
  'free-run': null
};
const alwaysGuidedRunes = new Set(['Held terrain', 'Held bonk', 'Held rival']);

function gateGuidedMechanics(onboarding: OnboardingState, hints: ProjectedMechanicHint[]): ProjectedMechanicHint[] {
  if (!onboarding.enabled || onboarding.completed) return hints;
  if (!(onboarding.step in guidedRuneAllow)) return hints;
  const allow = guidedRuneAllow[onboarding.step];
  if (allow === null) return hints;
  return hints.filter((hint) => allow.has(hint.label) || alwaysGuidedRunes.has(hint.label));
}

function coreMechanics(config: GameConfig): ProjectedMechanicHint[] {
  const haven = config.cards.find((card) => card.kind === 'terrain' && stabilizerTileTypes.has(card.tile ?? ''));
  const peril = config.cards.find((card) => card.kind === 'terrain' && dangerousTileTypes.has(card.tile ?? ''));
  return coreMechanicRunes.map((hint) => (
    hint.label === 'Combos' && haven && peril
      ? { ...hint, text: `${haven.name} near ${peril.name} is the shape of the lesson: safety, engine, and danger become readable before they become lethal.` }
      : hint
  ));
}

function projectedMechanics(player: Player, activeCard: Card | null, config: GameConfig): ProjectedMechanicHint[] {
  const boardOmen = player.board.find((tile) => tile.omen)?.omen ?? null;
  const activeCombo = activeCard ? {
    label: activeCard.kind === 'terrain' ? 'Held terrain' : activeCard.kind === 'bonk' ? 'Held bonk' : 'Held rival',
    value: activeCard.name,
    tone: activeCard.kind === 'terrain' && dangerousTileTypes.has(activeCard.tile ?? '') ? 'danger' : 'arcane',
    text: comboHint(activeCard)
  } satisfies ProjectedMechanicHint : null;
  const bossWager = player.bossWager ?? (player.bossPhase ? {
    label: 'Boss wager',
    value: player.bossPhase.label,
    tone: 'danger',
    text: `${player.bossPhase.remainingChunks} seal${player.bossPhase.remainingChunks === 1 ? '' : 's'} remain. Treat each attempt as an ante against your whole build.`
  } satisfies ProjectedMechanicHint : null);
  const relicTrigger = player.relicTriggers?.[0] ?? (player.loot.some((item) => item.rarity === 'relic') ? {
    label: 'Relic',
    value: 'best loot',
    tone: 'gold',
    text: "You're carrying relic-grade loot — the strongest tier. Make sure it's equipped in the matching gear slot."
  } satisfies ProjectedMechanicHint : null);

  return [
    activeCombo,
    boardOmen,
    player.purge,
    bossWager,
    relicTrigger,
    ...coreMechanics(config)
  ].filter((hint): hint is ProjectedMechanicHint => Boolean(hint));
}

function OnboardingCoach({
  onboarding,
  player,
  config,
  activeCard,
  onOpenRules
}: {
  onboarding: OnboardingState;
  player: Player;
  config: GameConfig;
  activeCard: Card | null;
  onOpenRules: () => void;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('loopduel.coachCollapsed') === 'yes';
    } catch {
      return false;
    }
  });
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('loopduel.coachCollapsed', next ? 'yes' : 'no');
      } catch {
        /* storage unavailable — keep the in-memory value */
      }
      return next;
    });
  }
  const lesson = onboardingLesson(onboarding);
  const recommendedNames = onboarding.recommendedTileIndexes
    .map((index) => player.board[index])
    .filter((tile): tile is Tile => Boolean(tile))
    .map((tile) => tileNames[tile.type] ?? `Tile ${tile.index + 1}`)
    .slice(0, 3);
  const mechanics = gateGuidedMechanics(onboarding, [
    ...(onboarding.mechanics ?? []),
    ...projectedMechanics(player, activeCard, config)
  ]).slice(0, 5);
  const facts = [
    recommendedNames.length > 0 ? `Marked: ${recommendedNames.join(', ')}` : `Lap ${player.laps}`,
    `${player.hand.length} cards in hand`,
    player.pendingTraits.length > 0 ? `${player.pendingTraits.length} trait choice${player.pendingTraits.length === 1 ? '' : 's'}` : `${Math.ceil(player.hp)}/${player.maxHp} HP`
  ];

  return (
    <section className={`onboarding-coach ${onboarding.completed ? 'debrief' : ''} ${collapsed ? 'collapsed' : ''}`} aria-live="polite">
      <button
        type="button"
        className="coach-collapse"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        title={collapsed ? 'Show the guide' : 'Hide the guide'}
      >
        {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        <span>{collapsed ? 'Guide' : 'Hide'}</span>
      </button>
      <div className="coach-copy">
        <span>{lesson.speaker}</span>
        <strong>{lesson.title}</strong>
        {!collapsed && <p>{lesson.prompt}</p>}
        {!collapsed && <small>{lesson.detail}</small>}
      </div>
      {!collapsed && (
        <>
          <div className="coach-facts" aria-label="Current tutorial status">
            {facts.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
          <div className="coach-runes" aria-label="Loop lessons">
            {mechanics.map((hint, index) => (
              <article key={`${hint.label}-${hint.value ?? index}`} className={`coach-rune ${hint.tone ?? 'arcane'}`}>
                <strong>{hint.label}</strong>
                {hint.value && <span>{hint.value}</span>}
                <p>{hint.text}</p>
              </article>
            ))}
          </div>
          {onboarding.recaps.length > 0 && (
            <div className="coach-recaps" aria-label="Recent tutorial lessons">
              {onboarding.recaps.slice(0, 2).map((line) => <span key={line}>{line}</span>)}
            </div>
          )}
          <div className="coach-actions">
            <button className="icon-action" onClick={onOpenRules}>
              <HelpCircle size={17} />
              Rules
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function InfoPopover({
  title,
  eyebrow,
  body,
  lines,
  hint,
  className = ''
}: {
  title: string;
  eyebrow?: string;
  body?: string;
  lines?: string[];
  hint?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // The popover is centered above its trigger via pure CSS, so near a screen
  // edge it spills off and gets clipped. On hover/focus, measure it and nudge it
  // back inside the viewport (horizontal clamp) or flip it below (vertical), via
  // a CSS var + class the stylesheet consumes. Runs only on the user's
  // hover/focus, so the forced layout read is negligible.
  useLayoutEffect(() => {
    const el = ref.current;
    const trigger = el?.parentElement;
    if (!el || !trigger) return;
    const reposition = () => {
      el.style.setProperty('--pop-shift-x', '0px');
      el.classList.remove('pop-flip-below');
      const rect = el.getBoundingClientRect();
      // Skip popovers that aren't laid out (display:none at this breakpoint) —
      // a 0×0 rect would otherwise yield a bogus shift.
      if (rect.width === 0 && rect.height === 0) return;
      const margin = 8;
      let shift = 0;
      if (rect.left < margin) shift = margin - rect.left;
      else if (rect.right > window.innerWidth - margin) shift = window.innerWidth - margin - rect.right;
      if (shift !== 0) el.style.setProperty('--pop-shift-x', `${Math.round(shift)}px`);
      if (rect.top < margin) el.classList.add('pop-flip-below');
    };
    trigger.addEventListener('pointerenter', reposition);
    trigger.addEventListener('focusin', reposition);
    return () => {
      trigger.removeEventListener('pointerenter', reposition);
      trigger.removeEventListener('focusin', reposition);
    };
  }, []);
  return (
    <span ref={ref} className={`hover-pop ${className}`}>
      {eyebrow && <em>{eyebrow}</em>}
      <strong>{title}</strong>
      {body && <span>{body}</span>}
      {lines?.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
      {hint && <small>{hint}</small>}
    </span>
  );
}

function tierLoopTarget(config: GameConfig, player: Player) {
  const nextTier = config.matchTiers.find((tier) => tier.id > player.loopTier);
  if (nextTier) return { label: `Act ${nextTier.id} Boss`, target: nextTier.minLoops, remaining: Math.max(0, nextTier.minLoops - player.laps) };
  return { label: 'Tyrant', target: (player.tierStartLap ?? 0) + bossLoopRequirement, remaining: Math.max(0, (player.tierStartLap ?? 0) + bossLoopRequirement - player.laps) };
}

function livesLeft(game: GameState, player: Player) {
  return player.livesLeft ?? Math.max(0, (game.maxLives ?? 3) - (player.deaths ?? 0));
}

function tierLoopProgress(config: GameConfig, player: Player) {
  const target = tierLoopTarget(config, player);
  const start = player.loopTier >= 3 ? (player.tierStartLap ?? 0) : (config.matchTiers.find((tier) => tier.id === player.loopTier)?.minLoops ?? 0);
  const span = Math.max(1, target.target - start);
  return Math.max(0, Math.min(100, ((player.laps - start) / span) * 100));
}

function setRunnerMotionTransform(runner: HTMLElement | null, highlight: HTMLElement | null, point: RunnerPoint) {
  const transform = `translate3d(${point.left}%, ${point.top}%, 0)`;
  if (runner) runner.style.transform = transform;
  if (highlight) highlight.style.transform = transform;
}

function useRunnerMotion(
  runnerRef: RefObject<HTMLElement | null>,
  highlightRef: RefObject<HTMLElement | null>,
  player: Player,
  gameStatus: GameState['status'],
  serverNow: number,
  receivedAt?: number,
  authorityPaused = false,
  onCombatStopReached?: (cursor: number | null) => void
) {
  const cursorRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const clockRef = useRef({ serverNow, receivedAt });
  const playerRef = useRef(player);
  const guidedDormant = Boolean((player as Player & { guidedDormant?: boolean }).guidedDormant);
  const moving = gameStatus === 'running' && !player.stunRemainingMs && !guidedDormant;
  const combatMotionKey = player.combat ? `combat:${player.combat.startedAt}:${player.combat.expiresAt}` : 'travel';
  const boardGeometryKey = useMemo(
    () => player.board.map((tile) => `${tile.index}:${tile.coord[0]},${tile.coord[1]}`).join('|'),
    [player.board]
  );

  useLayoutEffect(() => {
    clockRef.current = { serverNow, receivedAt };
  }, [receivedAt, serverNow]);

  useLayoutEffect(() => {
    playerRef.current = player;
  }, [player]);

  useLayoutEffect(() => {
    if (!moving || authorityPaused) {
      const cursor = visualCursorForPlayer(player, serverNow, receivedAt, authorityPaused);
      cursorRef.current = cursor;
      lastFrameAtRef.current = null;
      setRunnerMotionTransform(runnerRef.current, highlightRef.current, pointAlongBoard(player.board, cursor));
      onCombatStopReached?.(null);
    }
  }, [authorityPaused, highlightRef, moving, onCombatStopReached, player, receivedAt, runnerRef, serverNow]);

  useLayoutEffect(() => {
    const currentPlayer = playerRef.current;
    const currentTile = currentPlayer.board[currentPlayer.position] ?? currentPlayer.board[0];
    if (authorityPaused) return undefined;
    if (!moving || !currentPlayer.board.length || !currentTile) {
      cursorRef.current = authoritativeCursor(currentPlayer);
      lastFrameAtRef.current = null;
      setRunnerMotionTransform(runnerRef.current, highlightRef.current, tileCenter(currentTile ?? currentPlayer.board[0]));
      return undefined;
    }

    let unsubscribe: (() => void) | null = null;
    const tick = (frame: GameplayRafFrame) => {
      const frameAt = frame.now;
      const clock = clockRef.current;
      const currentPlayer = playerRef.current;
      if (playerMotionIsLocked(currentPlayer, authorityPaused)) {
        const cursor = visualCursorForPlayer(currentPlayer, clock.serverNow, clock.receivedAt, authorityPaused);
        cursorRef.current = cursor;
        lastFrameAtRef.current = null;
        setRunnerMotionTransform(runnerRef.current, highlightRef.current, pointAlongBoard(currentPlayer.board, cursor));
        if (!combatEngageIsPending(currentPlayer, clock.serverNow, clock.receivedAt, authorityPaused)) {
          unsubscribe?.();
          unsubscribe = null;
        }
        return;
      }
      const previousCursor = cursorRef.current;
      const elapsedMs = lastFrameAtRef.current === null ? 0 : Math.min(maxVisualFrameStepMs, frameAt - lastFrameAtRef.current);
      const segment = currentPlayer.nextMovement ?? currentPlayer.arrivalMovement;
      const segmentDurationMs = visualSegmentDurationMs(segment);
      const localStepCursor = previousCursor === null
        ? visualFrameCursorForPlayer(currentPlayer, previousCursor, authoritativeCursor(currentPlayer), clock.serverNow, clock.receivedAt, authorityPaused)
        : clampCursorAtMovementStop(currentPlayer.board, previousCursor, previousCursor + elapsedMs / segmentDurationMs);
      const nextCursor = visualFrameCursorForPlayer(currentPlayer, previousCursor, localStepCursor, clock.serverNow, clock.receivedAt, authorityPaused);
      lastFrameAtRef.current = frameAt;
      cursorRef.current = nextCursor;
      setRunnerMotionTransform(runnerRef.current, highlightRef.current, pointAlongBoard(currentPlayer.board, nextCursor));

      const pendingCursor = pendingCombatStopCursor(currentPlayer, clock.serverNow, clock.receivedAt, authorityPaused);
      onCombatStopReached?.(pendingCursor !== null && nextCursor >= pendingCursor - 0.001 ? pendingCursor : null);
    };
    unsubscribe = gameplayRaf.subscribe(tick);
    return () => {
      unsubscribe?.();
      unsubscribe = null;
    };
  }, [authorityPaused, boardGeometryKey, combatMotionKey, gameStatus, highlightRef, moving, onCombatStopReached, runnerRef]);
}

function PhaseStrip({ game, player, config }: { game: GameState; player?: Player; config?: GameConfig }) {
  const claim = game.claim;
  const progress = player && config ? tierLoopProgress(config, player) : Math.max(0, Math.min(100, ((game.tier?.minScore ?? 0) / game.goalScore) * 100));
  const tierTarget = player && config ? tierLoopTarget(config, player) : null;
  const claimRemaining = claim ? Math.ceil(claim.remainingMs / 1000) : null;
  const isLobby = game.status === 'lobby';

  return (
    <section
      className={`phase-strip ${claim ? 'claiming' : ''} ${player ? 'player-phase' : ''}`}
      style={{ '--hero-color': claim?.claimantColor ?? player?.color ?? '#d2b15c', '--phase-progress': `${progress}%` } as CSSProperties}
    >
      <div className="phase-copy">
        <strong>{isLobby ? 'Lobby' : claim ? 'Claim the Loop' : game.tier.name}</strong>
        <span>{isLobby ? 'Invite runners, add CPU opponents, then the host starts the loop.' : claim ? `${claim.claimantName} must complete one marked lap` : tierTarget ? `${tierTarget.remaining} loop${tierTarget.remaining === 1 ? '' : 's'} to ${tierTarget.label}` : game.tier.text}</span>
      </div>
      <div className="phase-meter" aria-hidden="true"><i /></div>
      {player && (
        <div className="phase-player-score">
          <Sparkles size={18} />
          <strong>{player.score}</strong>
          <span>score</span>
        </div>
      )}
      <div className="phase-meta">
        {claim ? (
          <>
            <Crown size={16} />
            <span>{claimRemaining}s</span>
          </>
        ) : (
          <>
            <Footprints size={16} />
            <span>{player ? `Lap ${player.laps}` : `${game.leaderboard[0]?.score ?? 0}/${game.goalScore}`}</span>
          </>
        )}
      </div>
    </section>
  );
}

function MobileRivalStrip({
  players,
  focusedId,
  activeCard,
  onFocus,
  onTarget
}: {
  players: Player[];
  focusedId: string;
  activeCard: Card | null;
  onFocus: (id: string) => void;
  onTarget: (id: string) => void;
}) {
  if (players.length === 0) return null;

  return (
    <section className="mobile-rival-strip" aria-label="Rivals">
      {players.map((player) => {
        const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
        const plan = tacticalLabel(player);
        return (
          <button
            key={player.id}
            className={`mobile-rival-chip ${focusedId === player.id ? 'selected' : ''} ${activeCard ? 'armed' : ''}`}
            style={{ '--hero-color': player.color, '--hp-ratio': `${hpRatio}%` } as CSSProperties}
            onClick={() => activeCard ? onTarget(player.id) : onFocus(player.id)}
          >
            <img src={heroPortraitUrl(player.heroId)} alt="" />
            <span>
              <strong>{player.name}</strong>
              <small>{activeCard ? (activeCard.kind === 'bonk' ? 'bonk target' : 'target') : `${player.score} pts · ${plan}`}</small>
            </span>
            {player.rank === 1 && <Crown size={13} />}
          </button>
        );
      })}
    </section>
  );
}

function SfxToggle() {
  const [on, setOn] = useState(isSfxEnabled());
  return (
    <button
      className="menu-item"
      onClick={() => {
        const next = !on;
        setSfxEnabled(next);
        setOn(next);
        if (next) sfx.cardPlay();
      }}
      aria-pressed={on}
    >
      {on ? <Volume2 size={20} /> : <VolumeX size={20} />}
      Effects {on ? 'On' : 'Off'}
    </button>
  );
}

function ShakeToggle() {
  const [on, setOn] = useState(isShakeEnabled());
  return (
    <button
      className="menu-item"
      onClick={(event) => {
        const next = !on;
        setShakeEnabled(next);
        setOn(next);
        // Preview the new state on the menu button itself.
        if (next) shake(event.currentTarget, { magnitude: 1 });
      }}
      aria-pressed={on}
    >
      <Zap size={20} />
      Screen shake {on ? 'On' : 'Off'}
    </button>
  );
}

const qualityLabels: Record<QualityPref, string> = {
  auto: 'Auto',
  high: 'High',
  low: 'Low'
};

function QualityToggle() {
  const [pref, setPref] = useState<QualityPref>(getQualityPref());
  return (
    <button
      className="menu-item"
      onClick={() => {
        const order: QualityPref[] = ['auto', 'high', 'low'];
        const next = order[(order.indexOf(pref) + 1) % order.length];
        setQualityPref(next);
        setPref(next);
      }}
      aria-pressed={pref === 'low'}
      title="Auto drops to low when this machine can't hold the frame rate"
    >
      <Gauge size={20} />
      Render quality {qualityLabels[pref]}
    </button>
  );
}

function GameMenu({
  game,
  isHost,
  onAddBot,
  onFillCpu,
  onStartRoom,
  onKickPlayer,
  onSettings,
  inviteUrl,
  profile,
  bgmOn,
  onToggleBgm,
  onReset,
  onRules,
  onClose
}: {
  game: GameState;
  isHost: boolean;
  onAddBot: () => void;
  onFillCpu: () => void;
  onStartRoom: () => void;
  onKickPlayer: (playerId: string) => void;
  onSettings: (settings: Partial<RoomSettings>) => void;
  inviteUrl: string;
  profile: LocalProfile;
  bgmOn: boolean;
  onToggleBgm: () => void;
  onReset: () => void;
  onRules: () => void;
  onClose: () => void;
}) {
  const settingsLocked = !isHost || game.status !== 'lobby';

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="help-panel menu-panel" onClick={(event) => event.stopPropagation()}>
        <div className="help-head">
          <div>
            <strong>Menu</strong>
            <span>Room {game.id} · {game.players.length}/{game.maxPlayers} runners · {game.tier.name} · {isHost ? 'host controls' : 'guest view'} · tick {game.tick}</span>
          </div>
          <button className="icon-action" onClick={onClose}>Close · Esc</button>
        </div>
        <div className="menu-actions">
          <section className="menu-settings" aria-label="Room settings">
            <div className="menu-section-title">
              <Settings size={17} />
              <span>Room Settings</span>
            </div>
            <label>
              Seats
              <select
                value={game.settings.maxPlayers}
                disabled={settingsLocked}
                onChange={(event) => onSettings({ maxPlayers: Number(event.target.value) })}
              >
                {[2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Score Scale
              <select
                value={game.settings.goalScore}
                disabled={settingsLocked}
                onChange={(event) => onSettings({ goalScore: Number(event.target.value) })}
              >
                {[7200, 9600, 12600].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Pace
              <select
                value={game.settings.pace}
                disabled={settingsLocked}
                onChange={(event) => onSettings({ pace: event.target.value as RoomSettings['pace'] })}
              >
                <option value="quick">quick</option>
                <option value="steady">steady</option>
                <option value="marathon">marathon</option>
              </select>
            </label>
          </section>
          <section className="menu-qr-profile">
            <div className="menu-qr" aria-label={`QR invite for room ${game.id}`}>
              <QRCodeSVG value={inviteUrl} size={112} marginSize={1} />
              <span>Scan to join room {game.id}</span>
            </div>
            <div className="menu-profile" aria-label="Local profile">
              <strong>Profile</strong>
              <span>{profile.matches} matches</span>
              <span>{profile.wins} wins</span>
              <span>{profile.bestScore} best score</span>
              <span>Lv {profile.bestLevel} best</span>
            </div>
          </section>
          <button className="menu-item" onClick={onAddBot} disabled={!isHost}>
            <Bot size={20} />
            Add Bot
          </button>
          <button className="menu-item" onClick={onFillCpu} disabled={!isHost}>
            <Users size={20} />
            Fill CPU Match
          </button>
          <button className="menu-item" onClick={onStartRoom} disabled={!isHost || game.status !== 'lobby' || game.players.length === 0}>
            <Play size={20} />
            Start Match
          </button>
          <div className="menu-roster" aria-label="Room roster">
            {game.players.map((player) => (
              <button
                key={player.id}
                className="menu-roster-row"
                style={{ '--hero-color': player.color } as CSSProperties}
                onClick={() => onKickPlayer(player.id)}
                disabled={!isHost || player.id === game.hostId}
              >
                <img src={heroPortraitUrl(player.heroId)} alt="" />
                <span>
                  <strong>{player.name}</strong>
                  <small>{player.id === game.hostId ? 'host' : player.isBot ? 'bot' : player.connected ? 'connected' : 'disconnected'}</small>
                </span>
                {player.id !== game.hostId && <UserX size={17} />}
              </button>
            ))}
          </div>
          <button className="menu-item" onClick={onToggleBgm} aria-pressed={bgmOn}>
            {bgmOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            Music {bgmOn ? 'On' : 'Off'}
          </button>
          <SfxToggle />
          <ShakeToggle />
          <QualityToggle />
          <button className="menu-item" onClick={onRules}>
            <HelpCircle size={20} />
            Rules
          </button>
          <button className="menu-item danger" onClick={onReset} disabled={!isHost}>
            <RotateCcw size={20} />
            Reset Room
          </button>
        </div>
      </div>
    </div>
  );
}

// Lucide icon for an equipment slot / loot item, used across the compact dock.
function slotIcon(slot: string, size = 14) {
  if (slot === 'weapon') return <Swords size={size} />;
  if (slot === 'shield') return <Shield size={size} />;
  if (slot === 'helm') return <HardHat size={size} />;
  if (slot === 'armor') return <Shirt size={size} />;
  if (slot === 'gloves') return <Hand size={size} />;
  if (slot === 'boots') return <Footprints size={size} />;
  if (slot === 'ring') return <Gem size={size} />;
  return <Sparkles size={size} />;
}

function ItemSprite({ item, fallbackSize = 17 }: { item: Loot; fallbackSize?: number }) {
  const src = itemSpriteUrl(item.name);
  if (!src) return slotIcon(item.slot, fallbackSize);
  return <img className="item-sprite" src={src} alt="" />;
}

function itemStatLine(item: Loot) {
  return itemStatParts(item).join(' ');
}

function itemStatParts(item: Loot) {
  const parts = [
    item.power ? `+${item.power}P` : '',
    item.guard ? `+${item.guard}G` : '',
    item.speed ? `+${item.speed}S` : '',
    item.maxHp ? `+${item.maxHp}HP` : '',
    item.sabotage ? `+${item.sabotage}Rival` : '',
    item.lapHeal ? `+${item.lapHeal}Heal` : '',
    item.terrainScore ? `+${item.terrainScore}Tile` : '',
    item.revivePower ? `+${item.revivePower}Revive` : '',
    item.lootLuck ? `+${Math.round(item.lootLuck * 100)}%Loot` : '',
    item.drawRate ? `${Math.round(Math.abs(item.drawRate) * 100)}%Draw` : ''
  ].filter(Boolean);
  return parts.length > 0 ? parts : ['No stats'];
}

function itemPopoverLines(item: Loot, equipped: Loot | null | undefined) {
  return [
    `Stats: ${itemStatLine(item)}`,
    `Equip change: ${itemDeltaLine(item, equipped)}`,
    `Slot: ${equipmentLabels[item.slot]} · Role: ${item.role ?? 'Mixed'}`
  ];
}

function statValue(item: Loot | null | undefined, stat: keyof Pick<Loot, 'power' | 'guard' | 'speed' | 'maxHp' | 'sabotage' | 'lapHeal' | 'terrainScore' | 'revivePower'>) {
  return item?.[stat] ?? 0;
}

function itemDeltaLine(item: Loot, equipped: Loot | null | undefined) {
  const parts = [
    ['P', statValue(item, 'power') - statValue(equipped, 'power')],
    ['G', statValue(item, 'guard') - statValue(equipped, 'guard')],
    ['S', statValue(item, 'speed') - statValue(equipped, 'speed')],
    ['HP', statValue(item, 'maxHp') - statValue(equipped, 'maxHp')]
  ]
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${Number(value) > 0 ? '+' : ''}${value}${label}`);
  return parts.length > 0 ? parts.join(' ') : 'sidegrade';
}

function HandBar({
  hand,
  selectedId,
  draggingId,
  onSelect,
  onDragStart,
  onDragMove,
  onDropAt,
  onDragEnd
}: {
  hand: Card[];
  selectedId: string | null;
  draggingId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string, point: { x: number; y: number }) => void;
  onDragMove: (point: { x: number; y: number }) => void;
  onDropAt: (id: string, point: { x: number; y: number }) => void;
  onDragEnd: () => void;
}) {
  const pointerDragRef = useRef<{ id: string; pointerId: number; start: { x: number; y: number }; dragging: boolean } | null>(null);
  const suppressClickRef = useRef<string | null>(null);

  return (
    <div className="hand-bar" style={{ '--hand-count': Math.max(hand.length, 1) } as CSSProperties}>
      <div className="hand-card-stack">
        {hand.map((card, index) => (
          <button
            key={card.instanceId}
            draggable={false}
            data-card-id={card.instanceId}
            aria-label={`${card.name}: ${card.text}`}
            className={`hand-card ${cardFaceClass(card)} ${selectedId === card.instanceId ? 'selected' : ''} ${draggingId === card.instanceId ? 'dragging' : ''}`}
            style={{
              '--card-index': index,
              '--card-tilt': `${(index - (hand.length - 1) / 2) * 4.5}deg`,
              '--card-lift': `${Math.abs(index - (hand.length - 1) / 2) * 2}px`
            } as CSSProperties}
            onClick={(event) => {
              if (suppressClickRef.current === card.instanceId) {
                suppressClickRef.current = null;
                event.preventDefault();
                return;
              }
              onSelect(card.instanceId);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              pointerDragRef.current = {
                id: card.instanceId,
                pointerId: event.pointerId,
                start: { x: event.clientX, y: event.clientY },
                dragging: false
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = pointerDragRef.current;
              if (!drag || drag.id !== card.instanceId || drag.pointerId !== event.pointerId) return;
              const point = { x: event.clientX, y: event.clientY };
              const distance = Math.hypot(point.x - drag.start.x, point.y - drag.start.y);
              if (!drag.dragging && distance < 5) return;
              event.preventDefault();
              if (!drag.dragging) {
                drag.dragging = true;
                onDragStart(card.instanceId, point);
              } else {
                onDragMove(point);
              }
            }}
            onPointerUp={(event) => {
              const drag = pointerDragRef.current;
              if (!drag || drag.id !== card.instanceId || drag.pointerId !== event.pointerId) return;
              pointerDragRef.current = null;
              if (!drag.dragging) return;
              event.preventDefault();
              suppressClickRef.current = card.instanceId;
              onDropAt(card.instanceId, { x: event.clientX, y: event.clientY });
              onDragEnd();
            }}
            onPointerCancel={(event) => {
              const drag = pointerDragRef.current;
              if (!drag || drag.id !== card.instanceId || drag.pointerId !== event.pointerId) return;
              pointerDragRef.current = null;
              if (drag.dragging) onDragEnd();
            }}
          >
            <CardFace card={card} />
          </button>
        ))}
      </div>
      {hand.length === 0 && <span className="hand-empty">drawing…</span>}
    </div>
  );
}

function CardFace({ card, popover = true }: { card: Card; popover?: boolean }) {
  return (
    <>
      <span className="card-corner top">{card.icon}</span>
      <span className={`card-art ${card.kind === 'terrain' ? 'terrain-art' : `${card.kind}-art`}`}>
        {card.kind === 'terrain' ? (
          <span className={`card-tile-preview tile ${card.tile ?? 'road'}`}>
            <span className="tile-glyph">{card.icon}</span>
          </span>
        ) : (
          <span>{card.icon}</span>
        )}
      </span>
      <span className="card-pips" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="card-corner bottom">{card.icon}</span>
      <span className="card-grab"><Hand size={14} /></span>
      <span className="card-title">{card.name}</span>
      <span className="card-kind">{card.kind === 'terrain' ? tileNames[card.tile ?? 'road'] ?? 'Terrain' : cardSuit(card)}</span>
      {popover && (
        <InfoPopover
          title={card.name}
          eyebrow={`${cardSuit(card)} ${card.kind}`}
          lines={[card.text, comboHint(card), card.kind === 'terrain' ? `Places as the ${tileNames[card.tile ?? 'road'] ?? card.name} board tile.` : card.kind === 'bonk' ? (card.targetMode === 'chosen' ? 'Targets any rival runner.' : 'Automatically targets the highest-score rival.') : 'Targets a rival runner or one open rival road tile.']}
          hint={card.kind === 'terrain' ? 'Drag onto your loop or click, then choose a tile' : card.kind === 'bonk' ? 'Drag onto a rival portrait or click the bonk target' : 'Drag onto a rival portrait or click, then choose a target'}
          className="card-pop"
        />
      )}
    </>
  );
}

function DragCardGhost({ card, x, y }: { card: Card; x: number; y: number }) {
  return (
    <div
      className={`drag-card-ghost hand-card ${cardFaceClass(card)}`}
      style={{ '--drag-x': `${x}px`, '--drag-y': `${y}px` } as CSSProperties}
      aria-hidden="true"
    >
      <CardFace card={card} popover={false} />
    </div>
  );
}

function DragLootGhost({ item, x, y }: { item: Loot; x: number; y: number }) {
  return (
    <div
      className={`drag-loot-ghost side-loot ${item.slot} ${item.rarity}`}
      style={{ '--drag-x': `${x}px`, '--drag-y': `${y}px` } as CSSProperties}
      aria-hidden="true"
    >
      <ItemSprite item={item} fallbackSize={22} />
      <span>{item.name}</span>
      <small>{item.role ?? item.slot}</small>
    </div>
  );
}

// Horizontal centers (% of dock width) of the 7 painted control slots in the bottom bar,
// measured from right-dock-loophero-gothic-v4.png via scripts/ui-slot-measure.mjs.
const DOCK_SLOT_CX = [12.57, 24.26, 36.02, 47.72, 59.54, 71.84, 84.88];

function PlayerSideDock({
  player,
  config,
  game,
  lines,
  onEquip,
  onChoose,
  onLootDragStart,
  onLootDragEnd,
  draggingLootId,
  onMenu,
  isHost
}: {
  player: Player;
  config: GameConfig;
  game: GameState;
  lines: string[];
  onEquip: (item: Loot) => void;
  onChoose: (traitId: string) => void;
  onLootDragStart: (itemId: string, point: { x: number; y: number }) => void;
  onLootDragEnd: () => void;
  draggingLootId: string | null;
  onMenu: () => void;
  isHost: boolean;
}) {
  const [dockMode, setDockMode] = useState<'default' | 'talents'>('default');
  const hero = config.heroes.find((item) => item.id === player.heroId);
  const tree = config.talentTrees[player.heroId] ?? [];
  const pending = tree.filter((trait) => player.pendingTraits.includes(trait.id));
  const learned = tree.filter((trait) => traitRank(player, trait.id) > 0);
  const equippedIds = new Set(Object.values(player.loadout).filter(Boolean).map((item) => item?.id));
  const looseLoot = player.loot.filter((item) => !equippedIds.has(item.id));
  const draggingLoot = draggingLootId ? player.loot.find((item) => item.id === draggingLootId) ?? null : null;
  const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const loopProgress = tierLoopProgress(config, player);
  const loopTarget = tierLoopTarget(config, player);
  const loopStart = player.loopTier >= 3 ? (player.tierStartLap ?? 0) : (config.matchTiers.find((tier) => tier.id === player.loopTier)?.minLoops ?? 0);
  const loopPipCount = Math.max(1, Math.min(5, loopTarget.target - loopStart));
  const loopsSinceActStart = Math.max(0, player.laps - loopStart);

  return (
    <aside
      className={`player-side-dock ${dockMode === 'talents' ? 'talent-mode-open' : ''}`}
      style={{ '--hero-color': player.color } as CSSProperties}
    >
      {dockMode === 'talents' ? (
        <TalentTreeDock
          player={player}
          tree={tree}
          pending={pending}
          learned={learned}
          onChoose={onChoose}
          onBack={() => setDockMode('default')}
        />
      ) : (
        <>
          <div className="side-dock-head">
            <img src={heroPortraitUrl(player.heroId)} alt="" />
            <div>
              <strong>{player.name}</strong>
              <span>{hero?.name ?? 'Runner'} · {game.tier.name}</span>
            </div>
            <Crown size={18} />
          </div>

          <section className="rail-vitals">
            <div className="rail-hp-orb" style={{ '--hp-ratio': `${hpRatio}%` } as CSSProperties}>
              <strong>{Math.ceil(player.hp)}</strong>
              <span>/{player.maxHp}</span>
              <InfoPopover title="Health" body={`${Math.ceil(player.hp)}/${player.maxHp} HP`} />
            </div>
            <div className="rail-lives" role="img" aria-label={`${livesLeft(game, player)} of ${game.maxLives ?? 3} lives left`}>
              {Array.from({ length: game.maxLives ?? 3 }, (_, index) => (
                <span key={index} className={`life-pip ${index < livesLeft(game, player) ? 'alive' : 'spent'}`}>♥</span>
              ))}
              <InfoPopover title="Lives" body={`Hitting 0 HP spends a life. Lose all ${game.maxLives ?? 3} and the run is over for good.`} />
            </div>
            <div className="rail-stat-grid">
              <span className="rail-stat-tile"><Swords size={14} /><b>{player.power}</b></span>
              <span className="rail-stat-tile"><Shield size={14} /><b>{player.guard}</b></span>
              <span className="rail-stat-tile"><Footprints size={14} /><b>{player.speed}</b></span>
              <span className="rail-stat-tile"><Sparkles size={14} /><b>{player.score}</b></span>
              <span className="rail-stat-tile"><Coins size={14} /><b>{player.gold ?? 0}</b></span>
              <span className="rail-stat-tile"><Crown size={14} /><b>{player.rank}</b></span>
            </div>
          </section>

          <section
            className={`loop-tier-card ${game.claim?.playerId === player.id ? 'claimant' : ''}`}
            style={{ '--tier-progress': `${loopProgress}%` } as CSSProperties}
          >
            <div className="loop-tier-pips" aria-hidden="true">
              {Array.from({ length: loopPipCount }, (_, index) => (
                <span key={index} className={index < Math.min(loopPipCount, loopsSinceActStart) ? 'done' : index === Math.min(loopPipCount - 1, loopsSinceActStart) ? 'active' : ''}>
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="loop-tier-meta">
              <strong>Act {player.loopTier}</strong>
              <span>Lap {player.laps}</span>
            </div>
            <span className="loop-tier-meter"><i /></span>
          </section>

          <div className={`paperdoll ${draggingLoot ? 'loot-dragging' : ''}`}>
            <div className="paperdoll-body">
              <img src={heroSpriteUrl(player.heroId)} alt="" />
            </div>
            {equipmentSlots.map((slot) => {
              const item = player.loadout[slot];
              const canDrop = Boolean(draggingLoot && draggingLoot.slot === slot);
              return (
                <div
                  key={slot}
                  className={`paper-slot ${slot} ${item ? 'filled' : ''} ${canDrop ? 'drop-ready' : ''} ${draggingLoot && !canDrop ? 'drop-muted' : ''}`}
                  tabIndex={0}
                  onDragOver={(event) => {
                    if (!canDrop) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    if (!canDrop || !draggingLoot) return;
                    event.preventDefault();
                    onEquip(draggingLoot);
                    onLootDragEnd();
                  }}
                >
                  {item ? <ItemSprite item={item} fallbackSize={18} /> : slotIcon(slot, 18)}
                  {item && <span className="paper-slot-rarity" />}
                  <InfoPopover
                    title={item?.name ?? `${equipmentLabels[slot]} slot`}
                    eyebrow={item ? `${item.rarity} ${item.role ?? equipmentLabels[slot]}` : 'Loadout'}
                    body={item ? itemStatLine(item) : canDrop ? `Drop ${draggingLoot?.name ?? 'item'} here.` : 'No item equipped.'}
                    hint={canDrop ? 'drop to equip' : undefined}
                  />
                </div>
              );
            })}
          </div>

          <section className="dock-section loot-section">
            <div className="side-section-title icon-title">
              <Gem size={15} />
              <span>{looseLoot.length}/10</span>
            </div>
            <div className="side-loot-grid">
              {looseLoot.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  className={`side-loot ${item.slot} ${item.rarity}`}
                  draggable
                  onClick={() => onEquip(item)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('application/x-loopduel-kind', 'loot');
                    event.dataTransfer.setData('application/x-loopduel-loot-id', item.id);
                    event.dataTransfer.setData('text/plain', item.id);
                    onLootDragStart(item.id, { x: event.clientX, y: event.clientY });
                  }}
                  onDragEnd={onLootDragEnd}
                >
                  <ItemSprite item={item} />
                  <span className="loot-role">{item.role?.slice(0, 1) ?? '?'}</span>
                  <InfoPopover
                    title={item.name}
                    eyebrow={`${item.rarity} ${item.role ?? item.slot}`}
                    lines={itemPopoverLines(item, player.loadout[item.slot])}
                    hint="click or drag to equip"
                  />
                </button>
              ))}
              {[...Array(Math.max(0, 10 - Math.min(10, looseLoot.length)))].map((_, index) => (
                <span key={`empty-loot-${index}`} className="side-loot empty" aria-hidden="true" />
              ))}
            </div>
          </section>

          <div className="side-feed" tabIndex={0}>
            <ScrollText size={16} />
            <span>{lines.length}</span>
            <InfoPopover
              title="Event log"
              lines={lines.slice(0, 8)}
              className="feed-pop"
            />
          </div>

          {/* Controls sit on the 7 painted slots. For now only two are used: a gear in the
              center slot opens the full room/settings menu, and slot 7 holds the talent
              medallion. The other slots stay empty until they earn a purpose. */}
          <div className="side-controls">
            <button
              className="side-control-button gear-slot"
              style={{ left: `${DOCK_SLOT_CX[3]}%` }}
              onClick={onMenu}
              aria-label="Settings and room menu"
            >
              <span className="dock-slot-gear" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="100%" height="100%">
                  <g fill="currentColor">
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(45 12 12)" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(90 12 12)" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(135 12 12)" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(180 12 12)" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(225 12 12)" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(270 12 12)" />
                    <rect x="10.6" y="1.4" width="2.8" height="4.8" rx="0.7" transform="rotate(315 12 12)" />
                  </g>
                  <circle cx="12" cy="12" r="6.4" fill="currentColor" />
                  <circle cx="12" cy="12" r="2.7" fill="#160f08" />
                </svg>
              </span>
              <InfoPopover
                title="Settings"
                eyebrow={isHost ? 'Host controls' : 'Room menu'}
                body={`Add bots, start the match, pace, music and more · Room ${game.id} · ${game.players.length}/${game.maxPlayers} runners`}
              />
            </button>
            <button
              className={`side-control-button talent-slot ${pending.length > 0 ? 'has-pending' : ''}`}
              style={{ left: `${DOCK_SLOT_CX[6]}%` }}
              onClick={() => setDockMode('talents')}
              aria-label={`${hero?.name ?? 'Hero'} talent tree`}
            >
              <span className="dock-slot-icon" style={{ backgroundImage: `url(${talentIconUrl(player.heroId)})` }} />
              {pending.length > 0 && <strong className="dock-slot-badge">{pending.length}</strong>}
              <InfoPopover
                title={`${hero?.name ?? 'Hero'} talent tree`}
                eyebrow={pending.length > 0 ? 'Unlock ready' : 'Hero growth'}
                body={pending.length > 0 ? 'Open the tree and choose one highlighted node or rank up a learned one.' : learned.length > 0 ? `${learned[learned.length - 1].name} learned most recently.` : 'Level up to awaken the first node.'}
              />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

function MobileDrawer({
  mode,
  player,
  config,
  game,
  lines,
  onClose,
  onEquip,
  onChoose,
  onLootDragStart,
  onLootDragEnd,
  draggingLootId,
  onMenu,
  onAddBot,
  onFillCpu,
  onStartRoom,
  isHost,
  onSettings,
  profile,
  bgmOn,
  onToggleBgm
}: {
  mode: 'loot' | 'talents' | 'log' | 'menu' | null;
  player: Player;
  config: GameConfig;
  game: GameState;
  lines: string[];
  onClose: () => void;
  onEquip: (item: Loot) => void;
  onChoose: (traitId: string) => void;
  onLootDragStart: (itemId: string, point: { x: number; y: number }) => void;
  onLootDragEnd: () => void;
  draggingLootId: string | null;
  onMenu: () => void;
  onAddBot: () => void;
  onFillCpu: () => void;
  onStartRoom: () => void;
  isHost: boolean;
  onSettings: (settings: Partial<RoomSettings>) => void;
  profile: LocalProfile;
  bgmOn: boolean;
  onToggleBgm: () => void;
}) {
  if (!mode) return null;

  const hero = config.heroes.find((item) => item.id === player.heroId);
  const tree = config.talentTrees[player.heroId] ?? [];
  const equippedIds = new Set(Object.values(player.loadout).filter(Boolean).map((item) => item?.id));
  const looseLoot = player.loot.filter((item) => !equippedIds.has(item.id));
  const draggingLoot = draggingLootId ? player.loot.find((item) => item.id === draggingLootId) ?? null : null;

  return (
    <aside className="mobile-drawer" style={{ '--hero-color': player.color } as CSSProperties}>
      <div className="mobile-drawer-head">
        <div>
          <strong>{mode}</strong>
          <span>{hero?.name ?? 'Runner'} · {game.tier.name}</span>
        </div>
        <button className="icon-action" onClick={onClose}>Close</button>
      </div>

      {mode === 'loot' && (
        <div className="mobile-drawer-body">
          <div className="mobile-loadout">
            {equipmentSlots.map((slot) => {
              const item = player.loadout[slot];
              const canDrop = Boolean(draggingLoot && draggingLoot.slot === slot);
              return (
                <div
                  key={slot}
                  className={`mobile-loadout-slot ${slot} ${item ? 'filled' : ''} ${canDrop ? 'drop-ready' : ''}`}
                  onDragOver={(event) => {
                    if (!canDrop) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    if (!canDrop || !draggingLoot) return;
                    event.preventDefault();
                    onEquip(draggingLoot);
                    onLootDragEnd();
                  }}
                >
                  {item ? <ItemSprite item={item} fallbackSize={16} /> : slotIcon(slot, 16)}
                  <span>
                    <strong>{item?.name ?? equipmentLabels[slot]}</strong>
                    <small>{item ? `${item.role ?? item.rarity} · ${itemStatLine(item)}` : canDrop ? 'drop to equip' : 'empty'}</small>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mobile-loot-grid">
            {looseLoot.slice(0, 10).map((item) => (
              <button
                key={item.id}
                className={`mobile-loot-item ${item.slot} ${item.rarity}`}
                draggable
                onClick={() => onEquip(item)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('application/x-loopduel-kind', 'loot');
                  event.dataTransfer.setData('application/x-loopduel-loot-id', item.id);
                  event.dataTransfer.setData('text/plain', item.id);
                  onLootDragStart(item.id, { x: event.clientX, y: event.clientY });
                }}
                onDragEnd={onLootDragEnd}
              >
                <ItemSprite item={item} />
                <i>{item.role?.slice(0, 1) ?? '?'}</i>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.role ?? item.rarity} · {itemStatLine(item)} · {itemDeltaLine(item, player.loadout[item.slot])}</small>
                </span>
              </button>
            ))}
            {looseLoot.length === 0 && <span className="mobile-empty">No loose loot.</span>}
          </div>
        </div>
      )}

      {mode === 'talents' && (
        <div className="mobile-drawer-body mobile-talent-list">
          {tree.map((trait) => {
            const ready = player.pendingTraits.includes(trait.id);
            const rank = traitRank(player, trait.id);
            const maxRanks = traitMaxRanks(trait);
            const isLearned = rank > 0;
            return (
              <button
                key={trait.id}
                className={`mobile-talent-item ${ready ? 'ready' : isLearned ? 'learned' : 'locked'} ${rank >= maxRanks ? 'maxed' : ''}`}
                disabled={!ready}
                onClick={() => onChoose(trait.id)}
              >
                <span className="mobile-talent-icon" style={{ '--talent-art': `url(${talentArtUrl(trait.id)})` } as CSSProperties} />
                <b>{trait.name} <em>{rank}/{maxRanks}</em></b>
                <small>{trait.text}</small>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'log' && (
        <div className="mobile-drawer-body mobile-log-list">
          {lines.slice(0, 12).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
          {lines.length === 0 && <span className="mobile-empty">The loop is quiet.</span>}
        </div>
      )}

      {mode === 'menu' && (
        <div className="mobile-drawer-body mobile-menu-grid">
          <button className="menu-item" onClick={onMenu}>
            <Bot size={19} />
            Room Menu
          </button>
          <button className="menu-item" onClick={onAddBot} disabled={!isHost}>
            <Bot size={19} />
            Add Bot
          </button>
          <button className="menu-item" onClick={onFillCpu} disabled={!isHost}>
            <Users size={19} />
            Fill CPU
          </button>
          <button className="menu-item" onClick={onStartRoom} disabled={!isHost || game.status !== 'lobby'}>
            <Play size={19} />
            Start
          </button>
          <button
            className="menu-item"
            onClick={() => onSettings({ pace: game.settings.pace === 'quick' ? 'steady' : 'quick' })}
            disabled={!isHost || game.status !== 'lobby'}
          >
            <Settings size={19} />
            {game.settings.pace}
          </button>
          <div className="mobile-profile-summary">
            <strong>{profile.bestScore}</strong>
            <span>best score · {profile.wins}/{profile.matches} wins</span>
          </div>
          <button className="menu-item" onClick={onToggleBgm}>
            {bgmOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
            BGM
          </button>
        </div>
      )}
    </aside>
  );
}

function TalentTreeDock({
  player,
  tree,
  pending,
  learned,
  onChoose,
  onBack
}: {
  player: Player;
  tree: Trait[];
  pending: Trait[];
  learned: Trait[];
  onChoose: (traitId: string) => void;
  onBack: () => void;
}) {
  const learnedIds = new Set(learned.map((trait) => trait.id));
  const pendingIds = new Set(pending.map((trait) => trait.id));
  const byId = new Map(tree.map((trait) => [trait.id, trait]));
  const learnedRankCount = player.traits.length;
  const totalRankCount = totalTalentRanks(tree);

  return (
    <section className="talent-tree-mode">
      <div className="talent-mode-head">
        <button className="talent-back-button shared-back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div>
          <strong>Talent Tree</strong>
          <span>{player.talentPoints > 0 ? `${player.talentPoints} point${player.talentPoints === 1 ? '' : 's'} ready` : `${learnedRankCount}/${totalRankCount} ranks learned`}</span>
        </div>
      </div>

      <div className="talent-tree-board" style={{ '--talent-icon': `url(${talentIconUrl(player.heroId)})` } as CSSProperties}>
        <svg className="talent-lines" viewBox="0 0 100 100" aria-hidden="true">
          {tree.flatMap((trait) => trait.prereqs.map((prereq) => {
            const parent = byId.get(prereq);
            if (!parent) return null;
            const learnedLine = learnedIds.has(trait.id) && learnedIds.has(parent.id);
            const availableLine = pendingIds.has(trait.id) && learnedIds.has(parent.id);
            return (
              <line
                key={`${parent.id}-${trait.id}`}
                x1={parent.x}
                y1={parent.y}
                x2={trait.x}
                y2={trait.y}
                className={learnedLine ? 'learned' : availableLine ? 'available' : ''}
              />
            );
          }))}
        </svg>
        {tree.map((trait) => {
          const rank = traitRank(player, trait.id);
          const maxRanks = traitMaxRanks(trait);
          const learnedNode = rank > 0;
          const availableNode = pendingIds.has(trait.id);
          const state = learnedNode ? 'learned' : availableNode ? 'available' : 'locked';
          return (
            <button
              key={trait.id}
              className={`talent-node ${state} ${availableNode ? 'available' : ''} ${rank > 0 && rank < maxRanks ? 'rankable' : ''} ${rank >= maxRanks ? 'maxed' : ''}`}
              style={{ left: `${trait.x}%`, top: `${trait.y}%`, '--talent-art': `url(${talentArtUrl(trait.id)})` } as CSSProperties}
              aria-disabled={!availableNode}
              onClick={() => {
                if (availableNode) onChoose(trait.id);
              }}
            >
              <span className="talent-art" aria-hidden="true" />
              <span className="talent-rank-pips" aria-hidden="true">
                {Array.from({ length: maxRanks }, (_, index) => <i key={index} className={index < rank ? 'filled' : ''} />)}
              </span>
              <strong className="talent-node-label">{trait.name}</strong>
              <InfoPopover
                title={trait.name}
                eyebrow={rank > 0 ? `Rank ${rank}/${maxRanks}` : state === 'available' ? 'Available talent' : `Tier ${trait.tier}`}
                body={trait.text}
                hint={availableNode ? (rank > 0 ? 'click to rank up' : 'click to learn') : trait.prereqs.length > 0 ? `requires ${trait.prereqs.map((id) => byId.get(id)?.name ?? id).join(', ')}` : undefined}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SellZone({
  active,
  player,
  onDrop,
  onBuy
}: {
  active: boolean;
  player: Player;
  onDrop: (kind: 'card' | 'loot', id: string) => void;
  onBuy: (offer: ShopOffer) => void;
}) {
  const offers = player.shop?.offers ?? [];
  const remainingSeconds = Math.max(0, Math.ceil((player.shop?.remainingMs ?? 0) / 1000));

  function offerTitle(offer: ShopOffer) {
    if (offer.kind === 'card') return offer.card.name;
    if (offer.kind === 'loot') return offer.loot.name;
    return offer.name;
  }

  function offerMeta(offer: ShopOffer) {
    if (offer.kind === 'card') return `${cardSuit(offer.card)} card`;
    if (offer.kind === 'loot') return `${offer.loot.rarity} ${offer.loot.role ?? equipmentLabels[offer.loot.slot]}`;
    return `heals ${offer.heal} HP`;
  }

  function canBuy(offer: ShopOffer) {
    if ((player.gold ?? 0) < offer.price) return false;
    if (offer.kind === 'card') return player.hand.length < 7;
    if (offer.kind === 'loot') return player.loot.length < 10;
    return player.hp < player.maxHp;
  }

  return (
    <div
      className={`sell-zone ${active ? 'active' : ''}`}
      data-loopduel-drop={active ? 'sell-zone' : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const kind = event.dataTransfer.getData('application/x-loopduel-kind');
        const cardId = event.dataTransfer.getData('application/x-loopduel-card-id');
        const lootId = event.dataTransfer.getData('application/x-loopduel-loot-id');
        if (kind === 'card' && cardId) onDrop('card', cardId);
        if (kind === 'loot' && lootId) onDrop('loot', lootId);
      }}
    >
      <div className="shop-head">
        <Coins size={18} />
        <span>Market</span>
        <small>{player.gold ?? 0}g · {remainingSeconds}s</small>
      </div>
      <div className="shop-offers">
        {offers.map((offer) => {
          const affordable = canBuy(offer);
          return (
            <button
              key={offer.id}
              type="button"
              draggable={affordable}
              className={`shop-offer ${offer.kind} ${affordable ? '' : 'locked'}`}
              onClick={() => {
                if (affordable) onBuy(offer);
              }}
              onDragStart={(event) => {
                if (!affordable) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-loopduel-shop-offer-id', offer.id);
              }}
              onDragEnd={(event) => {
                if (!affordable) return;
                const target = event.currentTarget.getBoundingClientRect();
                const droppedOutside = event.clientX < target.left || event.clientX > target.right || event.clientY < target.top || event.clientY > target.bottom;
                if (droppedOutside) onBuy(offer);
              }}
            >
              {offer.kind === 'card' ? (
                <span className={`shop-card-glyph ${cardFaceClass(offer.card)}`}>
                  <span className={`shop-card-art ${cardFaceClass(offer.card)}`} aria-hidden="true">{offer.card.icon}</span>
                </span>
              ) : offer.kind === 'loot' ? (
                <span className={`shop-loot-glyph ${offer.loot.slot} ${offer.loot.rarity}`}><ItemSprite item={offer.loot} /></span>
              ) : (
                <span className="shop-potion-glyph"><img className="potion-sprite" src={healthPotionSpriteUrl()} alt="" /></span>
              )}
              <span>
                <strong>{offerTitle(offer)}</strong>
                <small>{offer.price}g</small>
              </span>
              <InfoPopover
                title={offerTitle(offer)}
                eyebrow={offerMeta(offer)}
                lines={offer.kind === 'card' ? [offer.card.text] : offer.kind === 'loot' ? itemPopoverLines(offer.loot, player.loadout[offer.loot.slot]) : [offer.text, `${Math.ceil(player.hp)}/${player.maxHp} HP now`]}
                hint={affordable ? 'drag out or click to buy' : (player.gold ?? 0) < offer.price ? 'not enough gold' : offer.kind === 'card' ? 'hand is full' : offer.kind === 'loot' ? 'loot bag is full' : 'already full health'}
              />
            </button>
          );
        })}
      </div>
      <InfoPopover
        title="Market"
        eyebrow="Personal rotating shop"
        body="Drop hand cards or loose items here to sell. Drag an offer out or click it to buy."
      />
    </div>
  );
}

export function ShopDrawer({
  open,
  player,
  onClose,
  onDrop,
  onBuy
}: {
  open: boolean;
  player: Player;
  onClose: () => void;
  onDrop: (kind: 'card' | 'loot', id: string) => void;
  onBuy: (offer: ShopOffer) => void;
}) {
  const offers = player.shop?.offers ?? [];
  const remainingSeconds = Math.max(0, Math.ceil((player.shop?.remainingMs ?? 0) / 1000));

  function offerTitle(offer: ShopOffer) {
    if (offer.kind === 'card') return offer.card.name;
    if (offer.kind === 'loot') return offer.loot.name;
    return offer.name;
  }

  function offerMeta(offer: ShopOffer) {
    if (offer.kind === 'card') return `${cardSuit(offer.card)} card`;
    if (offer.kind === 'loot') return `${offer.loot.rarity} ${offer.loot.role ?? equipmentLabels[offer.loot.slot]}`;
    return `heals ${offer.heal} HP`;
  }

  function canBuy(offer: ShopOffer) {
    if ((player.gold ?? 0) < offer.price) return false;
    if (offer.kind === 'card') return player.hand.length < 7;
    if (offer.kind === 'loot') return player.loot.length < 10;
    return player.hp < player.maxHp;
  }

  return (
    <section
      className={`shop-drawer ${open ? 'open' : ''}`}
      style={{ '--hero-color': player.color } as CSSProperties}
      aria-hidden={!open}
      data-loopduel-drop={open ? 'sell-zone' : undefined}
      onDragOver={(event) => {
        if (!open) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        if (!open) return;
        event.preventDefault();
        const kind = event.dataTransfer.getData('application/x-loopduel-kind');
        const cardId = event.dataTransfer.getData('application/x-loopduel-card-id');
        const lootId = event.dataTransfer.getData('application/x-loopduel-loot-id');
        if (kind === 'card' && cardId) onDrop('card', cardId);
        if (kind === 'loot' && lootId) onDrop('loot', lootId);
      }}
    >
      <div className="shop-drawer-head">
        <span className="shop-drawer-mark"><ShoppingBag size={18} /></span>
        <div>
          <strong>Loop Market</strong>
          <small>{player.gold ?? 0} gold · refresh {remainingSeconds}s</small>
        </div>
        <button type="button" className="shared-back-button shop-back-button" onClick={onClose} aria-label="Close shop">
          <ArrowLeft size={17} />
          <span>Back</span>
        </button>
      </div>
      <div className="shop-drawer-offers">
        {offers.map((offer) => {
          const affordable = canBuy(offer);
          return (
            <button
              key={offer.id}
              type="button"
              className={`shop-drawer-offer ${offer.kind} ${affordable ? '' : 'locked'}`}
              onClick={() => {
                if (affordable) onBuy(offer);
              }}
            >
              {offer.kind === 'card' ? (
                <span className={`shop-drawer-glyph card ${cardFaceClass(offer.card)}`}>
                  <span className={`shop-card-art ${cardFaceClass(offer.card)}`} aria-hidden="true">{offer.card.icon}</span>
                </span>
              ) : offer.kind === 'loot' ? (
                <span className={`shop-drawer-glyph loot ${offer.loot.slot} ${offer.loot.rarity}`}><ItemSprite item={offer.loot} /></span>
              ) : (
                <span className="shop-drawer-glyph potion"><img className="potion-sprite" src={healthPotionSpriteUrl()} alt="" /></span>
              )}
              <span>
                <strong>{offerTitle(offer)}</strong>
                <small>{offerMeta(offer)}</small>
              </span>
              <b>{offer.price}g</b>
              <InfoPopover
                title={offerTitle(offer)}
                eyebrow={offerMeta(offer)}
                lines={offer.kind === 'card' ? [offer.card.text] : offer.kind === 'loot' ? itemPopoverLines(offer.loot, player.loadout[offer.loot.slot]) : [offer.text, `${Math.ceil(player.hp)}/${player.maxHp} HP now`]}
                hint={affordable ? 'click to buy' : (player.gold ?? 0) < offer.price ? 'not enough gold' : offer.kind === 'card' ? 'hand is full' : offer.kind === 'loot' ? 'loot bag is full' : 'already full health'}
              />
            </button>
          );
        })}
      </div>
      <div className="shop-drawer-sell">
        <Coins size={16} />
        <span>Drop cards or loose gear here to sell.</span>
      </div>
    </section>
  );
}

function heroPassiveLines(player: Player, config: GameConfig) {
  const hero = config.heroes.find((item) => item.id === player.heroId);
  if (!hero) return [];
  return [
    hero.sabotage ? `Sabotage +${hero.sabotage}` : null,
    hero.lootLuck ? `Loot luck +${hero.lootLuck}` : null,
    hero.lapHeal ? `Lap heal +${hero.lapHeal}` : null,
    hero.terrainScore ? `Terrain score +${hero.terrainScore}` : null,
    hero.revivePower ? `Revive power +${hero.revivePower}` : null
  ].filter(Boolean) as string[];
}

export function HeroStatsDrawer({
  open,
  player,
  config,
  onClose
}: {
  open: boolean;
  player: Player;
  config: GameConfig;
  onClose: () => void;
}) {
  const hero = config.heroes.find((item) => item.id === player.heroId);
  const hpRatio = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
  const passiveLines = heroPassiveLines(player, config);
  const statRows = [
    ['HP', `${Math.ceil(player.hp)}/${player.maxHp}`],
    ['Power', player.power],
    ['Guard', player.guard],
    ['Speed', player.speed],
    ['Draw', player.drawRate],
    ['Sabotage', player.sabotage],
    ['Loot luck', player.lootLuck],
    ['Lap heal', player.lapHeal],
    ['Terrain score', player.terrainScore],
    ['Revive', player.revivePower]
  ];
  const runRows = [
    ['Score', player.score],
    ['Gold', player.gold],
    ['Level', player.level],
    ['XP', player.xp],
    ['Lap', player.laps],
    ['KOs', player.kos],
    ['Lives', player.livesLeft ?? Math.max(0, 3 - (player.deaths ?? 0))],
    ['Deaths', player.deaths],
    ['Cards', player.cardsPlayed],
    ['Tiles', player.tilesPlaced],
    ['Rival hits', player.rivalHits]
  ];
  const statHints: Record<string, string> = {
    HP: 'Health. Hit 0 and you collapse, spending one of your lives. Lose all three and the run ends.',
    Power: 'Attack strength in fights.',
    Guard: 'Reduces the damage you take in fights.',
    Speed: 'How fast your runner moves between tiles.',
    Draw: 'How quickly you draw new cards.',
    Sabotage: 'Extra damage your rival and bonk cards deal to other runners.',
    'Loot luck': 'Improves how often and how well loot drops.',
    'Lap heal': 'HP restored each time you finish a lap.',
    'Terrain score': 'Bonus score when you place terrain tiles.',
    Revive: 'Extra power you gain after falling and reviving (once per tier).'
  };

  return (
    <aside
      className={`hero-stats-drawer ${open ? 'open' : ''}`}
      style={{ '--hero-color': player.color, '--hp-ratio': `${hpRatio}%` } as CSSProperties}
      aria-hidden={!open}
    >
      <div className="hero-stats-head">
        <span className="hero-stats-portrait">
          <img src={heroPortraitUrl(player.heroId)} alt="" />
        </span>
        <div>
          <small>{hero?.title ?? 'Runner'}</small>
          <strong>{hero?.name ?? player.name}</strong>
          <span>{player.name}</span>
        </div>
        <button type="button" className="shared-back-button hero-stats-close" onClick={onClose} aria-label="Close hero stats">
          <ArrowLeft size={16} />
        </button>
      </div>

      <div className="hero-stats-hp">
        <span>Health</span>
        <b>{Math.ceil(player.hp)}/{player.maxHp}</b>
        <i aria-hidden="true" />
      </div>

      <div className="hero-stats-grid">
        {statRows.map(([label, value]) => (
          <span key={label} title={statHints[label as string]}>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        ))}
      </div>

      {player.ability && (
        <section className="hero-stats-section">
          <small>Ability</small>
          <strong>{player.ability.icon} {player.ability.name}</strong>
          <span>{player.ability.text}</span>
          <b>{player.ability.ready ? 'Ready now' : `${player.ability.remainingLoops} loop${player.ability.remainingLoops === 1 ? '' : 's'} until ready`}</b>
        </section>
      )}

      {passiveLines.length > 0 && (
        <section className="hero-stats-section">
          <small>Hero traits</small>
          {passiveLines.map((line) => <span key={line}>{line}</span>)}
        </section>
      )}

      <div className="hero-run-grid">
        {runRows.map(([label, value]) => (
          <span key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        ))}
      </div>
    </aside>
  );
}

function RivalIntel({
  players,
  focusedId,
  onFocus
}: {
  players: Player[];
  focusedId: string;
  onFocus: (id: string) => void;
}) {
  if (players.length === 0) return null;
  const sorted = [...players].sort((a, b) => {
    const aRisk = tileRisk(upcomingTiles(a, 5).find(({ tile }) => dangerousTileTypes.has(tile.type))?.tile ?? a.board[a.position] ?? a.board[0]);
    const bRisk = tileRisk(upcomingTiles(b, 5).find(({ tile }) => dangerousTileTypes.has(tile.type))?.tile ?? b.board[b.position] ?? b.board[0]);
    const riskDiff = bRisk - aRisk;
    if (riskDiff !== 0) return riskDiff;
    return b.score - a.score;
  });

  return (
    <section className="rival-intel" aria-label="Rival intent">
      {sorted.slice(0, 4).map((player) => {
        const next = upcomingTiles(player, 5);
        const threat = next.find(({ tile }) => dangerousTileTypes.has(tile.type));
        const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
        return (
          <button
            key={player.id}
            className={`rival-intel-card ${focusedId === player.id ? 'selected' : ''} ${player.marked ? 'marked' : ''}`}
            style={{ '--hero-color': player.color, '--hp-ratio': `${hpRatio}%` } as CSSProperties}
            onClick={() => onFocus(player.id)}
          >
            <img src={heroPortraitUrl(player.heroId)} alt="" />
            <span>
              <strong>{player.rank === 1 ? 'Leader' : player.name}</strong>
              <small>{threat ? `${threat.step} tiles to ${tileNames[threat.tile.type] ?? threat.tile.type}` : tacticalLabel(player)}</small>
            </span>
            <b>{player.score}</b>
            <i aria-hidden="true" />
            <InfoPopover
              title={player.name}
              eyebrow={player.marked ? 'Marked rival' : 'Rival read'}
              lines={[
                `${Math.ceil(player.hp)}/${player.maxHp} HP · Lv ${player.level}`,
                `Next five: ${next.map(({ tile }) => tileNames[tile.type] ?? tile.type).join(', ')}`,
                `${player.hand.length} cards · ${player.loot.length} loot · ${player.rivalHits} hits`
              ]}
              hint="click to focus their board"
            />
          </button>
        );
      })}
    </section>
  );
}

type BoardTileButtonProps = {
  tile: Tile;
  playerId: string;
  board: Tile[];
  canPlaceTerrain: boolean;
  canPlaceRivalTile: boolean;
  placementHint?: string;
  placementBlocked: boolean;
  recommended: boolean;
  draggingCard: Card | null;
  rivalTargetCard: Card | null;
  onTile?: (tile: Tile, cardId?: string) => void;
  onRivalTile?: (tileIndex: number, cardId?: string) => void;
};

const BoardTileButton = memo(function BoardTileButton({
  tile,
  playerId,
  board,
  canPlaceTerrain,
  canPlaceRivalTile,
  placementHint,
  placementBlocked,
  recommended,
  draggingCard,
  rivalTargetCard,
  onTile,
  onRivalTile
}: BoardTileButtonProps) {
  return (
    <button
      className={`tile ${tile.type} ${canPlaceTerrain ? 'placement-available' : ''} ${canPlaceRivalTile ? 'rival-tile-target' : ''} ${placementBlocked ? 'placement-blocked' : ''} ${recommended ? 'coach-recommended' : ''}`}
      data-loopduel-drop={canPlaceTerrain ? 'terrain-tile' : canPlaceRivalTile ? 'rival-tile' : undefined}
      data-player-id={canPlaceTerrain || canPlaceRivalTile ? playerId : undefined}
      data-tile-index={tile.index}
      style={{
        gridColumn: tile.coord[0] + 1,
        gridRow: tile.coord[1] + 1
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (canPlaceTerrain) onTile?.(tile);
        else if (canPlaceRivalTile) onRivalTile?.(tile.index, rivalTargetCard?.instanceId);
      }}
      onDragOver={(event) => {
        if (draggingCard?.kind === 'terrain' && canPlaceTerrain) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
        if (rivalTargetCard && canPlaceRivalTile) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'link';
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const cardId = event.dataTransfer.getData('application/x-loopduel-card-id') || event.dataTransfer.getData('text/plain');
        if (draggingCard?.kind === 'terrain' && canPlaceTerrain) onTile?.(tile, cardId || draggingCard.instanceId);
        if (rivalTargetCard && canPlaceRivalTile) onRivalTile?.(tile.index, cardId || rivalTargetCard.instanceId);
      }}
      disabled={!canPlaceTerrain && !canPlaceRivalTile}
    >
      {tile.type === 'road' && <span className={`road-shape ${roadShapeClass(board, tile)}`} aria-hidden="true" />}
      <span className="tile-glyph">{tileGlyphs[tile.type] ?? '?'}</span>
      <InfoPopover
        title={tileNames[tile.type] ?? tile.type}
        eyebrow={`Tile ${tile.index}`}
        body={tileDescription(tile)}
        lines={[
          tile.movementStopKind === 'combat' ? 'Runner stops here for combat' : 'Runner passes through',
          tile.charges > 0 ? `${tile.charges} charge${tile.charges === 1 ? '' : 's'} left` : tile.expiresOnLap ? `Expires on lap ${tile.expiresOnLap}` : 'Permanent tile',
          'Loop path'
        ]}
        hint={placementHint ?? (canPlaceRivalTile ? (rivalTargetCard?.id === 'oblivion' ? `Purge ${tileNames[tile.type] ?? tile.type}` : `Arm ${rivalTargetCard?.name} here`) : undefined)}
        className="tile-pop"
      />
    </button>
  );
}, (previous, next) => {
  const sameTile =
    previous.tile.index === next.tile.index &&
    previous.tile.type === next.tile.type &&
    previous.tile.coord[0] === next.tile.coord[0] &&
    previous.tile.coord[1] === next.tile.coord[1] &&
    previous.tile.charges === next.tile.charges &&
    previous.tile.expiresOnLap === next.tile.expiresOnLap &&
    previous.tile.movementStopKind === next.tile.movementStopKind &&
    previous.tile.movementStopReason === next.tile.movementStopReason;

  return sameTile &&
    previous.canPlaceTerrain === next.canPlaceTerrain &&
    previous.canPlaceRivalTile === next.canPlaceRivalTile &&
    previous.placementHint === next.placementHint &&
    previous.placementBlocked === next.placementBlocked &&
    previous.recommended === next.recommended &&
    previous.draggingCard?.instanceId === next.draggingCard?.instanceId &&
    previous.rivalTargetCard?.instanceId === next.rivalTargetCard?.instanceId;
});

type PlayerPanelProps = {
  player: Player;
  gameStatus: GameState['status'];
  serverNow: number;
  receivedAt?: number;
  authorityPaused?: boolean;
  rank: number;
  active: boolean;
  isHost: boolean;
  focused: boolean;
  selectedCard: Card | null;
  draggingCard: Card | null;
  rivalTargetCard: Card | null;
  recommendedTileIndexes?: number[];
  onTile?: (tile: Tile, cardId?: string) => void;
  onRivalTarget?: (cardId?: string) => void;
  onRivalTile?: (tileIndex: number, cardId?: string) => void;
  onStartRoom?: () => void;
  onActivateAbility?: () => void;
  onFocus: () => void;
};

function cardRenderKey(card: Card | null) {
  return card ? `${card.instanceId}:${card.kind}:${card.tile ?? ''}:${card.targetMode ?? ''}` : '';
}

function sameNumberList(previous: readonly number[] | undefined, next: readonly number[] | undefined) {
  if (previous === next) return true;
  const previousList = previous ?? [];
  const nextList = next ?? [];
  return previousList.length === nextList.length && previousList.every((value, index) => value === nextList[index]);
}

function playerPanelPropsEqual(previous: PlayerPanelProps, next: PlayerPanelProps) {
  return previous.player === next.player &&
    previous.gameStatus === next.gameStatus &&
    previous.authorityPaused === next.authorityPaused &&
    previous.rank === next.rank &&
    previous.active === next.active &&
    previous.isHost === next.isHost &&
    previous.focused === next.focused &&
    cardRenderKey(previous.selectedCard) === cardRenderKey(next.selectedCard) &&
    cardRenderKey(previous.draggingCard) === cardRenderKey(next.draggingCard) &&
    cardRenderKey(previous.rivalTargetCard) === cardRenderKey(next.rivalTargetCard) &&
    sameNumberList(previous.recommendedTileIndexes, next.recommendedTileIndexes) &&
    Boolean(previous.onTile) === Boolean(next.onTile) &&
    Boolean(previous.onRivalTarget) === Boolean(next.onRivalTarget) &&
    Boolean(previous.onRivalTile) === Boolean(next.onRivalTile) &&
    Boolean(previous.onStartRoom) === Boolean(next.onStartRoom) &&
    Boolean(previous.onActivateAbility) === Boolean(next.onActivateAbility);
}

const PlayerPanel = memo(function PlayerPanel({
  player,
  gameStatus,
  serverNow,
  receivedAt,
  authorityPaused = false,
  rank,
  active,
  isHost,
  focused,
  selectedCard,
  draggingCard,
  rivalTargetCard,
  recommendedTileIndexes = [],
  onTile,
  onRivalTarget,
  onRivalTile,
  onStartRoom,
  onActivateAbility,
  onFocus
}: PlayerPanelProps) {
  const canRivalTarget = Boolean(rivalTargetCard && onRivalTarget);
  // Runner position is driven by the server movement clock, so ordinary tiles
  // chain together visually and only stop when combat/stun state appears.
  const boardRef = useRef<HTMLDivElement | null>(null);
  const runnerRef = useRef<HTMLSpanElement | null>(null);
  const runnerHighlightRef = useRef<HTMLSpanElement | null>(null);
  const runnerFloatersRef = useRef<HTMLSpanElement | null>(null);
  const liveFloatersRef = useRef(new Map<RunnerFloater['tone'], LiveFloater>());
  const panelRef = useRef<HTMLElement | null>(null);
  const panelHitRef = useRef<HTMLSpanElement | null>(null);
  const [reachedPendingCombatCursor, setReachedPendingCombatCursor] = useState<number | null>(null);
  const previousRunnerStatsRef = useRef<{ hp: number; score: number; gold: number; xp: number; level: number; laps: number } | null>(null);
  const onCombatStopReached = useCallback((cursor: number | null) => {
    setReachedPendingCombatCursor((previous) => (previous === cursor ? previous : cursor));
  }, []);
  const motionSeedKey = useMemo(
    () => `${player.id}:${player.board.map((tile) => `${tile.index}:${tile.coord[0]},${tile.coord[1]}`).join('|')}`,
    [player.board, player.id]
  );
  useLayoutEffect(() => {
    setRunnerMotionTransform(
      runnerRef.current,
      runnerHighlightRef.current,
      tileCenter(player.board[player.position] ?? player.board[0])
    );
    // React must not reseed this on ordinary tile changes; the RAF motion loop owns the transform.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionSeedKey]);
  useRunnerMotion(runnerRef, runnerHighlightRef, player, gameStatus, serverNow, receivedAt, authorityPaused, onCombatStopReached);
  useEffect(() => {
    const current = {
      hp: Math.ceil(player.hp),
      score: player.score,
      gold: player.gold ?? 0,
      xp: player.xp,
      level: player.level,
      laps: player.laps
    };
    const previous = previousRunnerStatsRef.current;
    previousRunnerStatsRef.current = current;
    if (!previous) return;

    const nextFloaters: RunnerFloater[] = [];
    const addFloater = (value: number, suffix: string, tone: RunnerFloater['tone']) => {
      nextFloaters.push({
        value,
        suffix,
        tone,
        lane: nextFloaters.length % 3
      });
    };
    const hpDelta = current.hp - previous.hp;
    const scoreDelta = current.score - previous.score;
    const goldDelta = current.gold - previous.gold;
    const xpDelta = current.xp - previous.xp;
    const levelDelta = current.level - previous.level;
    const lapDelta = current.laps - previous.laps;

    if (hpDelta !== 0) addFloater(hpDelta, ' HP', hpDelta > 0 ? 'health' : 'loss');
    if (scoreDelta !== 0) addFloater(scoreDelta, ' score', scoreDelta > 0 ? 'gain' : 'loss');
    if (goldDelta !== 0) addFloater(goldDelta, 'g', goldDelta > 0 ? 'gold' : 'loss');
    if (levelDelta > 0) addFloater(levelDelta, ' Lv', 'level');
    else if (xpDelta !== 0) addFloater(xpDelta, ' XP', xpDelta > 0 ? 'xp' : 'loss');
    if (lapDelta > 0) addFloater(lapDelta, lapDelta === 1 ? ' loop' : ' loops', 'loop');

    // Audio only for the local player's own panel; combat hits are voiced by the
    // overlay's per-beat sounds, so this layer covers reward moments only.
    if (active) {
      if (levelDelta > 0) sfx.levelUp();
      if (goldDelta > 0) sfx.loot();
    }

    // Taking damage on the open board: a red flash plus a small decaying shake.
    // WAAPI (not CSS) so React re-renders of the panel className can't clobber
    // it; reduced-motion drops the shake but keeps a gentle flash.
    if (hpDelta < 0) {
      panelHitRef.current?.animate(
        [{ opacity: 0 }, { opacity: 0.5, offset: 0.3 }, { opacity: 0 }],
        { duration: 300, easing: 'ease-out' }
      );
      if (!prefersReducedMotion()) {
        panelRef.current?.animate(
          [
            { transform: 'translate3d(0,0,0)' },
            { transform: 'translate3d(-3px,1px,0)' },
            { transform: 'translate3d(3px,-1px,0)' },
            { transform: 'translate3d(-2px,0,0)' },
            { transform: 'translate3d(0,0,0)' }
          ],
          { duration: 280, easing: 'ease-out' }
        );
      }
    }

    const container = runnerFloatersRef.current;
    if (!container || nextFloaters.length === 0) return;

    window.requestAnimationFrame(() => {
      const live = liveFloatersRef.current;
      nextFloaters.forEach((floater) => {
        const existing = live.get(floater.tone);
        if (existing && existing.node.isConnected && performance.now() - existing.at < floaterMergeWindowMs) {
          existing.value += floater.value;
          existing.at = performance.now();
          existing.node.textContent = formatFloaterText(existing.value, existing.suffix);
          // Restart the rise so the merged total stays readable.
          existing.node.style.animation = 'none';
          void existing.node.offsetWidth;
          existing.node.style.animation = '';
          return;
        }
        const node = document.createElement('b');
        node.className = `runner-floater ${floater.tone}`;
        node.textContent = formatFloaterText(floater.value, floater.suffix);
        node.style.setProperty('--float-lane', String(floater.lane));
        const entry: LiveFloater = { node, value: floater.value, suffix: floater.suffix, at: performance.now() };
        live.set(floater.tone, entry);
        node.addEventListener('animationend', () => {
          node.remove();
          if (live.get(floater.tone)?.node === node) live.delete(floater.tone);
        }, { once: true });
        container.append(node);
      });

      // Level-up ring: a one-shot expanding ring punch at the runner.
      if (levelDelta > 0) {
        const ring = document.createElement('span');
        ring.className = 'level-up-ring';
        ring.addEventListener('animationend', () => ring.remove(), { once: true });
        container.append(ring);
      }
      // Loot toss: a glyph that lobs up and settles when gold is gained.
      if (goldDelta > 0) {
        const toss = document.createElement('b');
        toss.className = 'loot-toss';
        toss.textContent = '◆';
        toss.addEventListener('animationend', () => toss.remove(), { once: true });
        container.append(toss);
      }

      while (container.childElementCount > maxFloaterNodes) {
        container.firstElementChild?.remove();
      }
    });
  }, [active, player.gold, player.hp, player.laps, player.level, player.score, player.xp]);
  const stunSeconds = Math.ceil((player.stunRemainingMs ?? 0) / 1000);
  const compactRival = !active && !focused;
  const impact = eventImpact(player.event);
  const lobbyStart = active && gameStatus === 'lobby';
  const abilityUnavailable = Boolean(
    player.ability &&
    (!player.ability.ready || gameStatus !== 'running' || player.combat || player.stunRemainingMs)
  );
  const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const statusLabel = runnerStatusLabel(player);
  const runnerPoint = tileCenter(player.board[player.position] ?? player.board[0]);
  const pendingCombatCursor = pendingCombatStopCursor(player, serverNow, receivedAt, authorityPaused);
  const pendingCombatSegment = pendingCombatCursor !== null && player.arrivalMovement?.toCursor === pendingCombatCursor
    ? player.arrivalMovement
    : pendingCombatCursor !== null && player.nextMovement?.toCursor === pendingCombatCursor
      ? player.nextMovement
      : null;
  const presentationClock = serverPresentationClock(serverNow, receivedAt);
  const pendingCombatCueDelayMs = Math.max(
    0,
    Math.ceil((pendingCombatSegment?.arriveAt ?? presentationClock) - presentationClock)
  );
  const combatCuePoint = player.combat
    ? tileCenter(player.board[player.position] ?? player.board[0])
    : pendingCombatCursor !== null
      ? pointAlongBoard(player.board, pendingCombatCursor)
      : runnerPoint;
  const pendingCombatCueIsReady = pendingCombatCursor !== null && reachedPendingCombatCursor !== null && Math.abs(reachedPendingCombatCursor - pendingCombatCursor) < 0.001;
  const combatCueKey = player.combat
    ? `combat-cue-${player.combat.startedAt}`
    : pendingCombatCueIsReady
      ? `combat-cue-pending-${pendingCombatCursor}-${pendingCombatSegment?.arriveAt ?? 'now'}`
      : null;

  return (
    <article
      ref={panelRef}
      className={`player-panel ${active ? 'active' : ''} ${focused ? 'focused' : 'dimmed'} ${compactRival ? 'compact-rival' : ''} ${canRivalTarget ? 'rival-drop-target' : ''} ${player.combat ? 'combat-locked' : ''} ${stunSeconds > 0 ? 'stunned' : ''} ${impact ? `event-${impact.tone}` : ''}`}
      data-loopduel-drop={canRivalTarget ? 'rival-target' : undefined}
      data-player-id={canRivalTarget ? player.id : undefined}
      style={{ '--hero-color': player.color } as CSSProperties}
      onClick={() => {
        if (canRivalTarget) {
          onRivalTarget?.(rivalTargetCard?.instanceId);
          return;
        }
        onFocus();
      }}
      onDragOver={(event) => {
        if (!canRivalTarget) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'link';
      }}
      onDrop={(event) => {
        if (!canRivalTarget) return;
        event.preventDefault();
        onRivalTarget?.(event.dataTransfer.getData('text/plain') || rivalTargetCard?.instanceId);
      }}
    >
      <div
        ref={boardRef}
        className="board"
      >
        <span ref={panelHitRef} className="panel-hit-flash" aria-hidden="true" />
        {player.board.map((tile) => {
          const placementBlocked = combatPlacementBlocked(player, tile, selectedCard, serverNow, receivedAt, authorityPaused);
          const placementHint = terrainPlacementHint(player, tile, selectedCard, serverNow, receivedAt, authorityPaused);
          const canPlaceTerrain = Boolean(onTile && selectedCard?.kind === 'terrain' && tile.type === 'road' && !placementBlocked);
          const canPlaceRivalTile = Boolean(onRivalTile && rivalTargetCard && (
            rivalTargetCard.id === 'oblivion'
              ? tile.type !== 'camp' && tile.type !== 'road' && !tile.bossPhaseId
              : tile.type === 'road' && player.position !== tile.index
          ));
          const recommended = recommendedTileIndexes.includes(tile.index);
          return (
            <BoardTileButton
              key={tile.index}
              tile={tile}
              playerId={player.id}
              board={player.board}
              canPlaceTerrain={canPlaceTerrain}
              canPlaceRivalTile={canPlaceRivalTile}
              placementHint={placementHint}
              placementBlocked={placementBlocked}
              recommended={recommended}
              draggingCard={draggingCard}
              rivalTargetCard={rivalTargetCard}
              onTile={onTile}
              onRivalTile={onRivalTile}
            />
          );
        })}
        <span ref={runnerHighlightRef} className="runner-tile-highlight" aria-hidden="true" />
        <span ref={runnerRef} className="runner">
          <span className="runner-sprite">
            <img src={heroSpriteUrl(player.heroId)} alt="" />
            <span className="runner-hp-plate" style={{ '--hp-ratio': `${hpRatio}%` } as CSSProperties}>
              <b>{Math.ceil(player.hp)}</b>
              <i aria-hidden="true" />
            </span>
            <span ref={runnerFloatersRef} className="runner-floaters" aria-hidden="true" />
          </span>
        </span>
        <div className="board-core">
          {lobbyStart ? (
            <button
              className="board-start-button"
              aria-label={isHost ? 'Start match' : 'Waiting for host'}
              onClick={(event) => {
                event.stopPropagation();
                if (isHost) onStartRoom?.();
              }}
              disabled={!isHost}
            >
              <span>{isHost ? 'Start Match' : 'Waiting for Host'}</span>
            </button>
          ) : compactRival ? (
            <div className="rival-score-badge">
              <span className="bc-portrait">
                <img src={heroPortraitUrl(player.heroId)} alt="" />
                {rank === 1 && <Crown size={12} />}
              </span>
              <strong>{player.score}</strong>
              <small>{rank === 1 ? 'leader' : player.name}</small>
            </div>
          ) : (
            <>
              {active && player.ability && onActivateAbility && (
                <button
                  type="button"
                  className={`board-ability-button ${player.ability.ready ? 'ready' : 'cooling'}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (abilityUnavailable) return;
                    onActivateAbility();
                  }}
                  aria-disabled={abilityUnavailable}
                  aria-label={player.ability.name}
                >
                  <span className="ability-glyph">{player.ability.icon}</span>
                  <span>
                    <strong>{player.ability.name}</strong>
                    <small>{player.ability.ready ? 'Ready' : `${player.ability.remainingLoops} loop${player.ability.remainingLoops === 1 ? '' : 's'}`}</small>
                  </span>
                  <Zap size={15} />
                  <InfoPopover
                    title={player.ability.name}
                    eyebrow={player.ability.ready ? 'Activated ability ready' : 'Loop cooldown'}
                    body={player.ability.text}
                    hint={player.ability.ready ? 'click to use' : `ready after ${player.ability.remainingLoops} more loop${player.ability.remainingLoops === 1 ? '' : 's'}`}
                  />
                </button>
              )}
              <div className="bc-score-readout">
                <strong>{player.score}</strong>
                <span>{rank === 1 ? 'leader score' : 'score'}</span>
              </div>
              <div className="bc-event-stage">
                <small>{rank === 1 ? 'Leader' : active ? 'You' : player.name}</small>
                <strong>{statusLabel}</strong>
                <span>{Math.ceil(player.hp)}/{player.maxHp} HP · Lap {player.laps} · Lv {player.level}</span>
              </div>
              {player.signature && (
                <div className="bc-signature" style={{ '--sig-ratio': `${Math.max(0, Math.min(100, (player.signature.value / Math.max(1, player.signature.max)) * 100))}%` } as CSSProperties}>
                  <span>{player.signature.label}</span>
                  <b>{player.signature.value}/{player.signature.max}</b>
                  <i />
                  <InfoPopover title={player.signature.label} body={player.signature.text} />
                </div>
              )}
              {stunSeconds > 0 && <div className="bc-stun">stunned {stunSeconds}s</div>}
              {player.marked && <div className="bc-claim">marked</div>}
            </>
          )}
        </div>
        {impact && (
          <div key={`${player.lastEventAt ?? 0}-${player.event}`} className={`event-burst ${impact.tone}`}>
            <strong>{impact.title}</strong>
            <span>{impact.detail}</span>
          </div>
        )}
        {(player.event.includes('entered tier') || player.event.includes('entered act')) && <div className="tier-surge"><strong>Act {player.loopTier}</strong><span>loop collapsed</span></div>}
        {combatCueKey && (
          <div
            key={combatCueKey}
            className={`combat-entry-cue active ${player.combat ? 'confirmed' : 'pending'}`}
            style={{
              '--cue-left': `${combatCuePoint.left}%`,
              '--cue-top': `${combatCuePoint.top}%`,
              '--cue-delay': player.combat ? '0ms' : pendingCombatCueIsReady ? '0ms' : `${pendingCombatCueDelayMs}ms`
            } as CSSProperties}
            aria-hidden="true"
          >
            <span>fight!</span>
          </div>
        )}
        {player.combat && <CombatOverlay key={player.combat.startedAt} player={player} audible={active} />}
      </div>
    </article>
  );
}, playerPanelPropsEqual);

function CombatOverlay({ player, audible }: { player: Player; audible: boolean }) {
  const combat = player.combat;
  if (!combat) return null;
  return <CombatOverlayBody player={player} combat={combat} audible={audible} />;
}

function CombatOverlayBody({ player, combat, audible }: { player: Player; combat: Combat; audible: boolean }) {
  const [presentation] = useState(() => ({
    beats: combat.beats?.length ? combat.beats : fallbackCombatBeats(combat),
    durationMs: combat.durationMs,
    heroHpAfter: combat.heroHpAfter,
    enemyHpAfter: combat.enemyHpAfter
  }));
  const beats = presentation.beats;
  const [activeBeatIndex, setActiveBeatIndex] = useState(-1);
  const [hitStop, setHitStop] = useState(false);
  const hitStopTimerRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const shakeAnimRef = useRef<Animation | null>(null);
  const [presentationPhase, setPresentationPhase] = useState<'entry' | 'beat' | 'result' | 'exit'>('entry');
  const [logOpen, setLogOpen] = useState(false);
  const [displayHp, setDisplayHp] = useState({
    hero: combat.heroHpBefore,
    enemy: combat.enemyHpBefore
  });
  const activeBeat = activeBeatIndex >= 0 ? beats[activeBeatIndex] : null;
  const visibleDurationMs = Math.max(1100, combat.durationMs ?? 1734);
  const lastBeatAtMs = Math.max(0, ...beats.map((beat) => beat.atMs));
  const resultAtMs = Math.min(Math.max(lastBeatAtMs + 220, visibleDurationMs - 560), Math.max(0, visibleDurationMs - 260));
  const exitAtMs = Math.max(resultAtMs + 180, visibleDurationMs - 220);
  const combatOutcome = combat.heroHpAfter <= 0 ? 'Hero Fell' : combat.enemyCount > 1 ? 'Loot Found' : 'Victory';
  const logFocusIndex = Math.max(0, activeBeatIndex);
  const logStart = Math.max(0, Math.min(logFocusIndex - 1, Math.max(0, beats.length - 2)));
  const combatLog = beats.slice(logStart, logStart + 2).map((beat, offset) => {
    const index = logStart + offset;
    return {
      ...beat,
      index,
      state: index === activeBeatIndex ? 'active' : index < activeBeatIndex ? 'done' : 'upcoming'
    };
  });
  const enemyLineup = Array.from({ length: Math.max(1, Math.min(combat.enemyCount, 5)) }, (_, index) => {
    const id = combat.enemyIds?.[index] ?? combat.enemyIds?.[0] ?? combat.enemyId;
    return {
      id,
      name: combat.enemyNames?.[index] ?? combat.enemyNames?.[0] ?? combat.enemyName,
      size: combatEnemySize(id)
    };
  });
  const largestEnemySize = enemyLineup.some((enemy) => enemy.size === 'large')
    ? 'large'
    : enemyLineup.some((enemy) => enemy.size === 'medium')
      ? 'medium'
      : 'small';
  const enemyHpRows = enemyHealthRows(displayHp.enemy, combat.enemyMaxHp, enemyLineup);
  const activeEnemyIndex = activeBeat?.enemyIndex !== undefined
    ? Math.max(0, Math.min(activeBeat.enemyIndex, enemyLineup.length - 1))
    : Math.max(0, Math.min(enemyHpRows.findIndex((enemy) => enemy.current > 0), enemyLineup.length - 1));
  const activeEnemyName = enemyLineup[activeEnemyIndex]?.name ?? combat.enemyName;
  const attackerName = activeBeat?.attacker === 'enemy' ? activeEnemyName : player.name;
  const defenderName = activeBeat?.attacker === 'enemy' ? player.name : activeEnemyName;
  const impactTitle = presentationPhase === 'result' || presentationPhase === 'exit' ? combatOutcome : activeBeat ? `${attackerName} strikes ${defenderName}` : 'Fight!';
  const impactValue = presentationPhase === 'result' || presentationPhase === 'exit' ? `+${combat.reward} XP` : activeBeat ? `-${activeBeat.damage} HP` : combat.label;
  const impactDetail = presentationPhase === 'result' || presentationPhase === 'exit'
    ? combat.heroHpAfter <= 0 ? 'Retreat and recover' : `${combat.enemyName} cleared`
    : activeBeat?.text ?? `${combat.label} vs ${combat.enemyName}`;
  const impactMeta = presentationPhase === 'result' || presentationPhase === 'exit'
    ? `${combat.rounds} clashes resolved`
    : combat.enemyCount > 1 ? `${combat.enemyCount} foes · ${combat.rounds} clashes` : combat.label;

  useEffect(() => {
    const timers = beats.map((beat, index) => window.setTimeout(() => {
      setPresentationPhase('beat');
      setActiveBeatIndex(index);
      setDisplayHp({ hero: beat.heroHp, enemy: beat.enemyHp });
      // Finisher = the beat that drops the defender to 0.
      const defenderHp = beat.attacker === 'enemy' ? beat.heroHp : beat.enemyHp;
      const isFinisher = defenderHp <= 0;
      // Hit-stop (§2.3): on the focused panel, briefly freeze the overlay's
      // animations on a finisher so the shake + damage number erupt out of a
      // held impact frame ("freeze, then erupt"). Skipped under reduced motion.
      if (isFinisher && audible && !prefersReducedMotion()) {
        setHitStop(true);
        if (hitStopTimerRef.current !== null) window.clearTimeout(hitStopTimerRef.current);
        // The server clears player.combat (unmounting this overlay) ~tailMs+
        // beatMs-windupMs after the last beat — as little as ~340ms on the
        // fastest pace. Keep freeze (90ms) + shake (220ms) = 310ms under that
        // floor so the finisher's zeroed-HP frame and erupt are never clipped.
        hitStopTimerRef.current = window.setTimeout(() => {
          setHitStop(false);
          // Erupt out of the held frame the instant the freeze releases (§2.4).
          // WAAPI ignores animation-play-state, so it must fire on release.
          shakeAnimRef.current = shake(overlayRef.current, { magnitude: 1.6, durationMs: 220 });
        }, 90);
      }
      if (audible) {
        if (isFinisher) sfx.crit();
        else sfx.hit();
      }
    }, beat.atMs));
    timers.push(window.setTimeout(() => setPresentationPhase('result'), resultAtMs));
    timers.push(window.setTimeout(() => setPresentationPhase('exit'), exitAtMs));
    timers.push(window.setTimeout(() => {
      setDisplayHp({ hero: presentation.heroHpAfter, enemy: presentation.enemyHpAfter });
    }, resultAtMs));

    return () => {
      timers.forEach(window.clearTimeout);
      if (hitStopTimerRef.current !== null) window.clearTimeout(hitStopTimerRef.current);
      // Don't leave the erupt animation running on a detached overlay node.
      shakeAnimRef.current?.cancel();
      shakeAnimRef.current = null;
    };
  }, [presentation, beats, resultAtMs, exitAtMs, audible]);

  return (
    <div ref={overlayRef} className={`combat-overlay phase-${presentationPhase} combat-bg-${combat.backgroundId} combat-effect-${combat.effect} enemy-stage-${largestEnemySize} ${activeBeat ? 'combat-beat-active' : ''} ${hitStop ? 'hit-stop' : ''} ${logOpen ? 'log-open' : ''}`} style={{
      '--combat-bg': `url(${combatBackgroundUrl(combat.backgroundId)})`,
      '--combat-duration': `${visibleDurationMs}ms`,
      '--combat-delay': '0ms'
    } as CSSProperties}>
      <div className="combat-vignette" />
      <div className="combat-frame" aria-hidden="true" />
      <button
        type="button"
        className="combat-log-toggle"
        aria-expanded={logOpen}
        aria-controls={`combat-log-${combat.startedAt}`}
        onClick={() => setLogOpen((open) => !open)}
        title={logOpen ? 'Hide combat log' : 'Show combat log'}
      >
        <ScrollText size={14} aria-hidden="true" />
        <span>Log</span>
      </button>
      <div className="combat-announcement" aria-hidden="true">
        <span>
          Fight!
          <small>{combat.label} vs {combat.enemyName}</small>
        </span>
      </div>
      <div className={`combatant hero-combat ${activeBeat?.attacker === 'hero' ? 'combat-attacking' : ''} ${activeBeat?.attacker === 'enemy' ? 'combat-taking-hit' : ''}`}>
        <div className="combatant-glow" aria-hidden="true" />
        <div className="combat-ground-shadow" aria-hidden="true" />
        <CombatSpriteImg src={heroSpriteUrl(player.heroId)} alt="" />
        {activeBeat?.attacker === 'enemy' && (
          <div key={`fx-hero-${activeBeatIndex}`} className={`${combatFxClass(combat.effect)} combat-fx-on-hero`} aria-hidden="true" />
        )}
        <div className="combat-nameplate">
          <div className="combat-name-row">
            <span className="combat-side-label">Hero</span>
            <strong>{player.name}</strong>
          </div>
          <CombatBar
            current={Math.ceil(Math.max(0, displayHp.hero))}
            max={combat.heroMaxHp}
            value={displayHp.hero}
          />
        </div>
      </div>
      <div className="combat-banner">
        <em>{impactMeta}</em>
        <strong>{impactTitle}</strong>
        <span>{impactValue}</span>
        <small>{impactDetail}</small>
        {activeBeat && (
          <b key={`${activeBeatIndex}-${activeBeat.attacker}`} className={`combat-damage-float ${activeBeat.attacker}`}>
            -{activeBeat.damage}
          </b>
        )}
      </div>
      {logOpen && (
        <ol id={`combat-log-${combat.startedAt}`} className="combat-log" aria-label="Combat play by play">
          {combatLog.map((beat) => (
            <li key={`${beat.attacker}-${beat.index}-${beat.atMs}`} className={`combat-log-${beat.state}`}>
              <i aria-hidden="true" />
              <span>{beat.text ?? (beat.attacker === 'hero' ? `You hit ${combat.enemyName}` : `${combat.enemyName} hits you`)}</span>
            </li>
          ))}
        </ol>
      )}
      <div className={`combatant enemy-combat enemy-combat-${largestEnemySize} ${activeBeat?.attacker === 'enemy' ? 'combat-attacking' : ''} ${activeBeat?.attacker === 'hero' ? 'combat-taking-hit' : ''}`}>
        <div className="combatant-glow" aria-hidden="true" />
        <div className="combat-ground-shadow" aria-hidden="true" />
        <div className={`enemy-party enemy-party-${enemyLineup.length} enemy-party-max-${largestEnemySize}`} aria-hidden="true">
          {enemyLineup.map((enemy, index) => (
            <CombatSpriteImg
              key={`enemy-${index}-${enemy.id}`}
              data-enemy-slot={index}
              className={`enemy-size-${enemy.size} enemy-kind-${enemy.id} ${index === activeEnemyIndex ? 'active-enemy' : ''}`}
              src={combatEnemyUrl(enemy.id)}
              alt=""
            />
          ))}
        </div>
        {activeBeat?.attacker === 'hero' && (
          <div key={`fx-enemy-${activeBeatIndex}`} className={`${combatFxClass(combat.effect)} combat-fx-on-enemy combat-fx-flip`} aria-hidden="true" />
        )}
        <div className="combat-nameplate">
          <div className="combat-name-row">
            <span className="combat-side-label">Enemy</span>
            <strong>{combat.enemyName}</strong>
          </div>
          <div className="enemy-pips" aria-hidden="true">
            {enemyLineup.map((enemy, index) => (
              <span key={`${enemy.id}-pip-${index}`} className={index === activeEnemyIndex ? 'active-enemy-pip' : ''} />
            ))}
          </div>
          <div className={`enemy-hp-stack enemy-hp-stack-${enemyHpRows.length}`}>
            {enemyHpRows.map((enemy, index) => (
              <CombatBar
                key={`${enemy.name}-${index}`}
                className={index === activeEnemyIndex ? 'active-enemy-hp' : ''}
                label={enemy.name}
                current={Math.ceil(enemy.current)}
                max={enemy.max}
                value={enemy.current}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function enemyHealthRows(totalHp: number, maxHp: number, lineup: { name: string }[]) {
  const count = Math.max(1, lineup.length);
  const perEnemyMax = Math.max(1, Math.ceil(maxHp / count));
  const remainingTotal = Math.max(0, totalHp);
  return lineup.map((enemy, index) => {
    const laterEnemyHp = perEnemyMax * (count - index - 1);
    const current = Math.max(0, Math.min(perEnemyMax, remainingTotal - laterEnemyHp));
    return {
      name: enemy.name,
      current,
      max: perEnemyMax
    };
  });
}

function fallbackCombatBeats(combat: Combat): CombatBeat[] {
  const beats: CombatBeat[] = [
    {
      attacker: 'hero',
      atMs: 120,
      damage: combat.enemyHpBefore - combat.enemyHpAfter,
      heroHp: combat.heroHpBefore,
      enemyHp: combat.enemyHpAfter
    },
    {
      attacker: 'enemy',
      atMs: 260,
      damage: combat.damage,
      heroHp: combat.heroHpAfter,
      enemyHp: combat.enemyHpAfter
    }
  ];
  return beats.filter((beat) => beat.damage > 0);
}

// Combat sprite with the constant brightness/saturate filter baked into the
// bitmap (sprite-bake.ts) so the scale-animated img carries no live filter —
// a live filter re-rasters every strike-animation frame (frame-consistency
// appraisal). Browsers without canvas filters get the same look via a CSS
// filter class on the img instead.
function CombatSpriteImg({ src, className, ...rest }: { src: string } & Omit<ComponentProps<'img'>, 'src'>) {
  const bakedSrc = useBakedSprite(src);
  const fallback = spriteBakeUnsupported() ? ' sprite-filter-fallback' : '';
  return <img src={bakedSrc} className={`${className ?? ''}${fallback}`} {...rest} />;
}

function CombatBar({
  current,
  max,
  value,
  label,
  className = ''
}: {
  current: number;
  max: number;
  value: number;
  label?: string;
  className?: string;
}) {
  const hpRatio = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`combat-hp ${className}`}>
      <span style={{ transform: `scaleX(${hpRatio / 100})` }} />
      <small>{label ? `${label} ${current}/${max}` : `${current}/${max}`}</small>
    </div>
  );
}

function HelpOverlay({ config, onClose }: { config: GameConfig; onClose: () => void }) {
  const terrain = config.cards.filter((card) => card.kind === 'terrain');
  const rivals = config.cards.filter((card) => card.kind === 'rival');

  return (
    <div className="help-overlay" role="dialog" aria-modal="true">
      <div className="help-panel">
        <div className="help-head">
          <div>
            <strong>Rules</strong>
            <span>Defeat each act boss, then break the Loop Tyrant.</span>
          </div>
          <button className="icon-action" onClick={onClose}>Close</button>
        </div>
        <div className="help-grid">
          <section>
            <h2>Loop</h2>
            <p>Runners move automatically. Speed shortens movement delay. Camp heals; road can fight, heal, or sprint.</p>
          </section>
          <section>
            <h2>Cards</h2>
            <p>Terrain cards alter your own loop for a few completed laps, then expire back into road. Rival cards target another runner.</p>
          </section>
          <section>
            <h2>Progress</h2>
            <p>XP levels you up and offers traits. Loot rolls from fights and forges, then equips into paperdoll slots by item type.</p>
          </section>
          <section>
            <h2>Scoring</h2>
            <p>Score shows run strength and leaderboard pressure. Each act ends with a boss fight that checks whether your build can survive the jump.</p>
          </section>
          <section>
            <h2>Finale</h2>
            <p>After four completed loops in act III, the Loop Tyrant appears. Corruption rises from laps, act clears, and deaths; dying spends one of your three lives, restarts the current act board, and costs gold, tempo, and sometimes loose loot. Spend the last life and the run is lost.</p>
          </section>
          <section className="help-glossary">
            <h2>Glossary</h2>
            <p><b>Blood Moon</b> — a danger aura; fights placed near it stack more enemies.</p>
            <p><b>Combo</b> — placing terrain beside certain tiles transforms them into stronger versions (e.g. Meadow + Grove → Bloomgrove).</p>
            <p><b>Corruption</b> — rises from laps, act clears, and deaths; it makes boss fights harder, especially solo.</p>
            <p><b>Heat</b> — Ember Knight builds Heat from fights to grow stronger across a run.</p>
            <p><b>Purge</b> — the Oblivion card clears one of your own tiles back to plain road.</p>
            <p><b>Seal</b> — boss tiles you clear in sequence to bring the boss down.</p>
            <p><b>Relic</b> — the rarest, strongest tier of loot.</p>
            <p><b>Boss ante</b> — challenging a boss costs HP, time, or gold; only attempt when you can survive it.</p>
          </section>
        </div>
        <div className="help-lists">
          <div>
            <strong>Terrain</strong>
            {terrain.map((card) => <span key={card.id}>{card.icon} {card.name}: {card.text}</span>)}
          </div>
          <div>
            <strong>Rivals</strong>
            {rivals.map((card) => <span key={card.id}>{card.icon} {card.name}: {card.text}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  GameMenu,
  DragCardGhost,
  DragLootGhost,
  HandBar,
  HelpOverlay,
  InfoPopover,
  MobileDrawer,
  MobileRivalStrip,
  OnboardingCoach,
  PhaseStrip,
  PlayerPanel,
  RivalIntel,
  PlayerSideDock,
  SellZone
};
