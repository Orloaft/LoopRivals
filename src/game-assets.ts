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

function statLine(hero: Hero) {
  return `${hero.maxHp} HP · ${hero.power} POW · ${hero.guard} GRD · ${hero.speed} SPD`;
}

export {
  combatBackgroundUrl,
  combatEnemyUrl,
  heroPortraitUrl,
  heroSpriteUrl,
  statLine,
  talentIconUrl
};
