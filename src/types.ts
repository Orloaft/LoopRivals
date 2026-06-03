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
  score: number;
};

export type GameConfig = {
  heroes: Hero[];
  cards: Omit<Card, 'instanceId'>[];
  boardPath: [number, number][];
  traits: Trait[];
};

export type GameState = {
  status: 'lobby' | 'running';
  tick: number;
  log: string[];
  players: Player[];
};
