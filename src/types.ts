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
  sabotage?: number;
  lootLuck?: number;
  lapHeal?: number;
  terrainScore?: number;
  revivePower?: number;
  text: string;
};

export type Card = {
  id: string;
  instanceId: string;
  name: string;
  kind: 'terrain' | 'rival' | 'bonk';
  tile?: string;
  rarity?: 'common' | 'rare' | 'relic';
  targetMode?: 'leader' | 'chosen';
  stunSeconds?: number;
  icon: string;
  text: string;
};

export type Trait = {
  id: string;
  heroId: string;
  name: string;
  text: string;
  tier: number;
  x: number;
  y: number;
  prereqs: string[];
  bonus: Partial<{
    maxHp: number;
    power: number;
    guard: number;
    speed: number;
    drawRate: number;
    sabotage: number;
    lootLuck: number;
    lapHeal: number;
    terrainScore: number;
    revivePower: number;
  }>;
};

export type EquipmentSlot = 'weapon' | 'shield' | 'helm' | 'armor' | 'gloves' | 'boots' | 'ring' | 'charm';

export type Loot = {
  id: string;
  slot: EquipmentSlot;
  name: string;
  rarity: 'common' | 'rare' | 'relic';
  role?: string;
  power: number;
  guard: number;
  speed: number;
  maxHp: number;
  drawRate?: number;
  sabotage?: number;
  lootLuck?: number;
  lapHeal?: number;
  terrainScore?: number;
  revivePower?: number;
};

export type ShopOffer = {
  id: string;
  kind: 'card';
  card: Card;
  price: number;
} | {
  id: string;
  kind: 'loot';
  loot: Loot;
  price: number;
};

export type Shop = {
  offers: ShopOffer[];
  rotatesAt: number;
  remainingMs?: number;
};

export type Tile = {
  index: number;
  coord: [number, number];
  type: string;
  charges: number;
  expiresOnLap?: number | null;
  movementStopKind?: 'none' | 'combat';
  movementStopReason?: string | null;
};

export type MatchTier = {
  id: number;
  name: string;
  minScore: number;
  minLoops: number;
  text: string;
};

export type RoomSettings = {
  maxPlayers: number;
  goalScore: number;
  pace: 'steady' | 'quick' | 'marathon';
};

export type ClaimState = {
  playerId: string;
  claimantName: string;
  claimantColor: string;
  startedAt: number;
  expiresAt: number;
  remainingMs: number;
  startLap: number;
  deathsAtStart: number;
  mode: 'solo-crown-lap' | 'marked-claim-lap';
};

export type OnboardingState = {
  enabled: boolean;
  playerId: string | null;
  rivalId: string | null;
  step: string;
  title: string;
  prompt: string;
  detail: string;
  recommendedTileIndexes: number[];
  recaps: string[];
  completed: boolean;
  startedAt: number;
  completedAt: number | null;
};

export type Combat = {
  enemyId: string;
  enemyName: string;
  enemyIds?: string[];
  enemyNames?: string[];
  backgroundId: string;
  effect: 'sword' | 'claw' | 'spectral' | 'ember';
  label: string;
  damage: number;
  reward: number;
  enemyCount: number;
  rounds: number;
  heroHpBefore: number;
  heroHpAfter: number;
  heroMaxHp: number;
  enemyHpBefore: number;
  enemyHpAfter: number;
  enemyMaxHp: number;
  beats?: CombatBeat[];
  startedAt: number;
  expiresAt: number;
  durationMs: number;
};

export type CombatBeat = {
  attacker: 'hero' | 'enemy';
  atMs: number;
  damage: number;
  enemyIndex?: number;
  heroHp: number;
  enemyHp: number;
  text?: string;
};

export type PendingBonk = {
  by: string;
  byName?: string;
  cardName: string;
  durationMs: number;
};

export type MovementSegment = {
  fromCursor: number;
  toCursor: number;
  departAt: number;
  arriveAt: number;
};

export type Player = {
  id: string;
  name: string;
  heroId: string;
  isBot: boolean;
  connected: boolean;
  color: string;
  seatIndex: number;
  rank: number;
  board: Tile[];
  hand: Card[];
  loot: Loot[];
  loadout: Record<EquipmentSlot, Loot | null>;
  gold: number;
  traits: string[];
  pendingTraits: string[];
  talentPoints: number;
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  speed: number;
  drawRate: number;
  sabotage: number;
  lootLuck: number;
  lapHeal: number;
  terrainScore: number;
  revivePower: number;
  signature?: {
    label: string;
    value: number;
    max: number;
    text: string;
  };
  position: number;
  laps: number;
  level: number;
  xp: number;
  kos: number;
  rivalHits: number;
  cardsPlayed: number;
  tilesPlaced: number;
  deaths: number;
  loopTier: number;
  tierStartScore: number;
  tierStartLap: number;
  bossAttempts: number;
  soloGatesCleared: number[];
  soloCorruption: number;
  soloGateAttempts: number;
  deathsThisTier: number;
  scorePenalty: number;
  marked: boolean;
  curse: number;
  armor: number;
  event: string;
  message: string;
  combat: Combat | null;
  lastEventAt?: number;
  lastMoveAt?: number | null;
  moveStartedAt?: number | null;
  nextMoveAt?: number;
  arrivalMovement?: MovementSegment | null;
  nextMovement?: MovementSegment | null;
  stunnedUntil: number | null;
  stunnedBy: string | null;
  pendingBonks?: PendingBonk[];
  stunRemainingMs?: number;
  shop?: Shop;
  score: number;
};

export type LeaderboardEntry = Pick<Player, 'id' | 'name' | 'heroId' | 'color' | 'score' | 'rank' | 'hp' | 'maxHp' | 'level' | 'laps'>;

export type GameConfig = {
  heroes: Hero[];
  cards: Omit<Card, 'instanceId'>[];
  boardPath: [number, number][];
  traits: Trait[];
  talentTrees: Record<string, Trait[]>;
  maxPlayers: number;
  goalScore: number;
  matchTiers: MatchTier[];
  roomSettingOptions: {
    maxPlayers: number[];
    goalScore: number[];
    pace: RoomSettings['pace'][];
  };
};

export type GameState = {
  id: string;
  status: 'lobby' | 'running' | 'finished';
  tick: number;
  now: number;
  runtime?: {
    protocol: number;
    reason: string;
    snapshotSeq: number;
    eventSeq: number;
    journalBaseSeq: number;
    generatedAt: number;
  };
  authority?: {
    paused: boolean;
    reason: 'waiting-for-host' | null;
    startedAt: number | null;
  };
  receivedAt?: number;
  log: string[];
  maxPlayers: number;
  goalScore: number;
  settings: RoomSettings;
  tier: MatchTier;
  claim: ClaimState | null;
  onboarding: OnboardingState | null;
  hostId: string | null;
  winnerId: string | null;
  winner: Player | null;
  leaderboard: LeaderboardEntry[];
  players: Player[];
};

export type RoomEvent = {
  seq: number;
  type: string;
  roomId: string;
  tick: number;
  serverTime: number;
  payload: Record<string, unknown>;
};

export type RoomDelta = {
  roomId: string;
  events: RoomEvent[];
  firstSeq: number;
  lastSeq: number;
};
