import { prebakeSprites } from './sprite-bake';
import type { GameConfig, Hero } from './types';

function heroPortraitUrl(heroId: string) {
  return `/assets/heroes/${heroId}-portrait-v1.png`;
}

function heroSpriteUrl(heroId: string) {
  return `/assets/sprites/${heroId}-sprite-v2.png`;
}

function talentIconUrl(heroId: string) {
  return `/assets/ui/talent-icon-${heroId}-v1.png`;
}

function talentArtUrl(traitId: string) {
  return `/assets/ui/talents/${traitId}.svg`;
}

type CombatEnemySize = 'small' | 'medium' | 'large';

type CombatEnemyPresentation = {
  size: CombatEnemySize;
};

function combatEnemyUrl(enemyId: string) {
  return `/assets/combat/enemy-${enemyId}.png`;
}

const combatEnemyPresentation: Record<string, CombatEnemyPresentation> = {
  'ash-imp': { size: 'medium' },
  'bone-host': { size: 'large' },
  'briar-warden': { size: 'large' },
  brigand: { size: 'medium' },
  'crown-gate': { size: 'large' },
  'crown-sentinel': { size: 'large' },
  'crypt-skeleton': { size: 'medium' },
  'crypt-wraith': { size: 'medium' },
  'dire-thorn': { size: 'large' },
  'dusk-wolf': { size: 'medium' },
  'gate-wyrm': { size: 'large' },
  'goblin-cutthroat': { size: 'medium' },
  'grave-knight': { size: 'large' },
  'keep-reaver': { size: 'large' },
  'loop-tyrant': { size: 'large' },
  'loop-warden': { size: 'large' },
  'mire-slime': { size: 'small' },
  'moon-fiend': { size: 'large' },
  'obelisk-shade': { size: 'medium' },
  'plague-rat': { size: 'small' },
  'road-bandit': { size: 'medium' },
  'thorn-wolf': { size: 'medium' }
};

function combatEnemySize(enemyId: string): CombatEnemySize {
  return combatEnemyPresentation[enemyId]?.size ?? 'medium';
}

function combatBackgroundUrl(backgroundId: string) {
  return `/assets/combat/bg-${backgroundId}.png`;
}

function healthPotionSpriteUrl() {
  return '/assets/items/health-potion-v1.png';
}

const terrainTileArtIds = [
  'road',
  'camp',
  'grove',
  'meadow',
  'crypt',
  'wolfden',
  'bonepit',
  'ruinedkeep',
  'bloodmoon',
  'wyrmgate',
  'forge',
  'shrine',
  'mire',
  'village',
  'obelisk',
  'watchtower',
  'orchard',
  'chapel',
  'market',
  'armory',
  'waystone',
  'scriptorium',
  'spidernest',
  'tollgate',
  'thornmaze',
  'graveyard',
  'reliquary',
  'dragonroost',
  'ambush',
  'scorch'
] as const;

const bossLoopTileArtIds = [
  'rootwall',
  'bramblebloom',
  'wardensheart',
  'oldgrowth',
  'wyrmhead',
  'wyrmclaw',
  'wyrmcoil',
  'wyrmtail',
  'guardstance',
  'markedchallenge',
  'retaliation',
  'executionstance',
  'seal1',
  'seal2',
  'seal3',
  'innergate'
] as const;

const comboTransformationTileArtIds = [
  'bloomgrove',
  'ransackedvillage',
  'embergate'
] as const;

const tileArtIds = [
  ...terrainTileArtIds,
  ...bossLoopTileArtIds,
  ...comboTransformationTileArtIds
] as const;

function tileArtUrl(tileId: typeof tileArtIds[number]) {
  return `/assets/tiles/v2/${tileId}.png`;
}

const combatEntryCueFrameUrls = Array.from({ length: 8 }, (_, index) => (
  `/assets/ui/loopduel-combat-entry-cue-smooth-frame-${index + 1}.png`
));

const combatBackgroundIds = ['grove', 'crypt', 'road', 'forge'] as const;
const combatEnemyIds = [
  'ash-imp',
  'bone-host',
  'briar-warden',
  'brigand',
  'crown-gate',
  'crown-sentinel',
  'crypt-skeleton',
  'crypt-wraith',
  'dire-thorn',
  'dusk-wolf',
  'gate-wyrm',
  'goblin-cutthroat',
  'grave-knight',
  'keep-reaver',
  'loop-tyrant',
  'loop-warden',
  'mire-slime',
  'moon-fiend',
  'obelisk-shade',
  'plague-rat',
  'road-bandit',
  'thorn-wolf'
] as const;

const staticCriticalImageUrls = [
  '/assets/background/loopduel-parallax-sky-v3.png',
  '/assets/background/loopduel-parallax-spires-v3.png',
  '/assets/background/loopduel-parallax-graves-v3.png',
  '/assets/background/loopduel-parallax-brambles-v3.png',
  ...tileArtIds.map(tileArtUrl),
  '/assets/tiles/loopduel-tiles-retro-gothic-v1.png',
  '/assets/roads/loopduel-road-tiles-retro-gothic-dirt-v2.png',
  '/assets/ui/right-dock-loophero-gothic-v4.png',
  '/assets/ui/talent-back-medallion-v1.png',
  '/assets/ui/loopduel-start-button-states-v1.png',
  '/assets/ui/loopduel-guide-codex-frame-v1.png',
  '/assets/ui/loopduel-ui-row-plaque-v1.png',
  '/assets/ui/loopduel-popover-frame-v1.png',
  healthPotionSpriteUrl(),
  '/assets/combat/combat-fx-spritesheet-v1.png',
  ...combatEntryCueFrameUrls,
  ...combatBackgroundIds.map(combatBackgroundUrl),
  ...combatEnemyIds.map(combatEnemyUrl)
] as const;

const warmedImageUrls = new Set<string>();
const warmingImages = new Set<HTMLImageElement>();
const pendingWarmImageUrls: string[] = [];
let warmQueueScheduled = false;
let warmImageInFlight = false;

function scheduleImageWarm(callback: () => void) {
  if (typeof window === 'undefined') return;
  const requestIdle = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  }).requestIdleCallback;
  if (typeof requestIdle === 'function') {
    requestIdle(callback, { timeout: 1200 });
    return;
  }
  window.setTimeout(callback, 16);
}

function warmNextImageBatch() {
  warmQueueScheduled = false;
  if (typeof Image === 'undefined' || warmImageInFlight) return;

  const url = pendingWarmImageUrls.shift();
  if (!url) return;

  warmImageInFlight = true;
  const image = new Image();
  warmingImages.add(image);
  image.decoding = 'async';
  image.src = url;
  const cleanup = () => {
    warmImageInFlight = false;
    warmingImages.delete(image);
    if (pendingWarmImageUrls.length > 0 && !warmQueueScheduled) {
      warmQueueScheduled = true;
      scheduleImageWarm(warmNextImageBatch);
    }
  };
  if (typeof image.decode === 'function') {
    image.decode().then(cleanup, cleanup);
  } else {
    image.onload = cleanup;
    image.onerror = cleanup;
  }
}

type WarmImagePhase = 'lobby' | 'game';

function warmCriticalGameImages(config: Pick<GameConfig, 'heroes'> | null | undefined, phase: WarmImagePhase = 'game') {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;

  const heroUrls = config?.heroes.flatMap((hero) => (
    phase === 'lobby'
      ? [heroPortraitUrl(hero.id)]
      : [heroPortraitUrl(hero.id), heroSpriteUrl(hero.id), talentIconUrl(hero.id)]
  )) ?? [];
  const lobbyUrls = [
    '/assets/background/loopduel-parallax-sky-v3.png',
    '/assets/background/loopduel-parallax-spires-v3.png',
    '/assets/background/loopduel-parallax-graves-v3.png',
    '/assets/background/loopduel-parallax-brambles-v3.png',
    '/assets/ui/loopduel-title-stage-painterly-v1.png',
    '/assets/ui/loopduel-guide-codex-frame-v1.png',
    '/assets/ui/loopduel-ui-row-plaque-v1.png'
  ];
  const urls = phase === 'lobby'
    ? [...heroUrls, ...lobbyUrls]
    : [...heroUrls, ...staticCriticalImageUrls];

  // Combat overlay imgs render filter-baked bitmaps (sprite-bake.ts); warm
  // those during idle time too so the first combat doesn't pay decode+bake+
  // src-swap mid-fight.
  if (phase === 'game') {
    prebakeSprites([
      ...(config?.heroes.map((hero) => heroSpriteUrl(hero.id)) ?? []),
      ...combatEnemyIds.map(combatEnemyUrl)
    ]);
  }

  for (const url of urls) {
    if (warmedImageUrls.has(url)) continue;
    warmedImageUrls.add(url);
    pendingWarmImageUrls.push(url);
  }

  if (!warmQueueScheduled && pendingWarmImageUrls.length > 0) {
    warmQueueScheduled = true;
    scheduleImageWarm(warmNextImageBatch);
  }
}

const lootSpriteSlugs = [
  ['Glass Pike', 'glass-pike'],
  ['Moonblade', 'moonblade'],
  ['Ash Bow', 'ash-bow'],
  ['Thorn Mace', 'thorn-mace'],
  ['Cinder Wand', 'cinder-wand'],
  ['Tin Aegis', 'tin-aegis'],
  ['Root Buckler', 'root-buckler'],
  ['Mirror Ward', 'mirror-ward'],
  ['Crypt Kite', 'crypt-kite'],
  ['Cinder Guard', 'cinder-guard'],
  ['Crowncap Helm', 'crowncap-helm'],
  ['Ashen Sallet', 'ashen-sallet'],
  ['Moon Hood', 'moon-hood'],
  ['Bone Visor', 'bone-visor'],
  ['Rune Circlet', 'rune-circlet'],
  ['Patchwork Mail', 'patchwork-mail'],
  ['Duel Cloak', 'duel-cloak'],
  ['Grave Harness', 'grave-harness'],
  ['Briar Plate', 'briar-plate'],
  ['Loop Hauberk', 'loop-hauberk'],
  ['Mire Grips', 'mire-grips'],
  ['Duelist Wraps', 'duelist-wraps'],
  ['Ember Gaunts', 'ember-gaunts'],
  ['Thorn Claws', 'thorn-claws'],
  ['Hex Mitts', 'hex-mitts'],
  ['Road Boots', 'road-boots'],
  ['Softstep Greaves', 'softstep-greaves'],
  ['Moss Treads', 'moss-treads'],
  ['Spur Sabatons', 'spur-sabatons'],
  ['Wyrm Soles', 'wyrm-soles'],
  ['Red Loop Ring', 'red-loop-ring'],
  ['Lucky Band', 'lucky-band'],
  ['Vow Signet', 'vow-signet'],
  ['Black Market Seal', 'black-market-seal'],
  ['Grove Coil', 'grove-coil'],
  ['Lucky Tooth', 'lucky-tooth'],
  ['War Drum', 'war-drum'],
  ['Soft Lantern', 'soft-lantern'],
  ['Hex Needle', 'hex-needle'],
  ['Green Sigil', 'green-sigil']
] as const;

function itemSpriteUrl(itemName: string) {
  const match = lootSpriteSlugs.find(([baseName]) => itemName.includes(baseName));
  return match ? `/assets/items/${match[1]}.png` : null;
}

function statLine(hero: Hero) {
  return `${hero.maxHp} HP · ${hero.power} POW · ${hero.guard} GRD · ${hero.speed} SPD`;
}

export {
  combatBackgroundUrl,
  combatEnemySize,
  combatEnemyUrl,
  healthPotionSpriteUrl,
  heroPortraitUrl,
  heroSpriteUrl,
  itemSpriteUrl,
  statLine,
  talentArtUrl,
  talentIconUrl,
  warmCriticalGameImages
};
