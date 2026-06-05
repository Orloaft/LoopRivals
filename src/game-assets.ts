import type { Hero } from './types';

function heroPortraitUrl(heroId: string) {
  return `/assets/heroes/${heroId}-portrait-v1.png`;
}

function heroSpriteUrl(heroId: string) {
  return `/assets/sprites/${heroId}-sprite-v2.png`;
}

function talentIconUrl(heroId: string) {
  return `/assets/ui/talent-icon-${heroId}-v1.png`;
}

function combatEnemyUrl(enemyId: string) {
  return `/assets/combat/enemy-${enemyId}.png`;
}

function combatBackgroundUrl(backgroundId: string) {
  return `/assets/combat/bg-${backgroundId}.png`;
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
  return match ? `/assets/items/${match[1]}.svg` : null;
}

function statLine(hero: Hero) {
  return `${hero.maxHp} HP · ${hero.power} POW · ${hero.guard} GRD · ${hero.speed} SPD`;
}

export {
  combatBackgroundUrl,
  combatEnemyUrl,
  heroPortraitUrl,
  heroSpriteUrl,
  itemSpriteUrl,
  statLine,
  talentIconUrl
};
