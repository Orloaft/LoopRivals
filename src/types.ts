export type Hero = {
  id: string;
  name: string;
  title: string;
  icon: string;
  color: string;
  maxHp: number;
  power: number;
  guard: number;
  speed: number;
  text: string;
};

export type Card = {
  id: string;
  instanceId: string;
  name: string;
  kind: 'terrain' | 'rival';
  tile?: string;
  icon: string;
  text: string;
};

export type Trait = {
  id: string;
  name: string;
  text: string;
};

export type Loot = {
  id: string;
  slot: 'weapon' | 'charm' | 'armor';
  name: string;
  rarity: 'common' | 'rare' | 'relic';
  power: number;
  guard: number;
  speed: number;
  maxHp: number;
};

export type Tile = {
  index: number;
  coord: [number, number];
  type: string;
  charges: number;
};

export type Combat = {
  enemyId: string;
  enemyName: string;
  backgroundId: string;
  label: string;
  damage: number;
  reward: number;
  heroHpBefore: number;
  heroHpAfter: number;
  heroMaxHp: number;
  enemyHpBefore: number;
  enemyHpAfter: number;
  enemyMaxHp: number;
  startedAt: number;
  expiresAt: number;
};

export type Player = {
  id: string;
  name: string;
  heroId: string;
  isBot: boolean;
  connected: boolean;
  color: string;
  board: Tile[];
  hand: Card[];
  loot: Loot[];
  loadout: {
    weapon: Loot | null;
    charm: Loot | null;
    armor: Loot | null;
  };
  traits: string[];
  pendingTraits: string[];
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  speed: number;
  position: number;
  laps: number;
  level: number;
  xp: number;
  kos: number;
  deaths: number;
  curse: number;
  armor: number;
  event: string;
  message: string;
  combat: Combat | null;
  score: number;
};

export type GameConfig = {
  heroes: Hero[];
  cards: Omit<Card, 'instanceId'>[];
  boardPath: [number, number][];
  traits: Trait[];
  maxPlayers: number;
  goalScore: number;
};

export type GameState = {
  id: string;
  status: 'lobby' | 'running' | 'finished';
  tick: number;
  log: string[];
  maxPlayers: number;
  goalScore: number;
  winnerId: string | null;
  winner: Player | null;
  players: Player[];
};
