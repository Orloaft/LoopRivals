import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Bot, Coins, Crown, Footprints, Gem, GitBranch, Hand, HardHat, HelpCircle, Play, RotateCcw, ScrollText, Settings, Shield, Shirt, ShoppingBag, Sparkles, Swords, UserX, Users, Volume2, VolumeX, Zap } from 'lucide-react';
import {
  combatBackgroundUrl,
  combatEnemyUrl,
  heroPortraitUrl,
  heroSpriteUrl,
  itemSpriteUrl,
  talentIconUrl
} from './game-assets';
import { authoritativeCursor, clampCursorAtMovementStop, combatEngageIsPending, playerMotionIsLocked, pointAlongBoard, tileCenter, visualCursorForPlayer, visualFrameCursorForPlayer, type RunnerPoint } from './movement';
import type { Card, Combat, CombatBeat, EquipmentSlot, GameConfig, GameState, Loot, Player, RoomSettings, ShopOffer, Tile, Trait } from './types';

type LocalProfile = {
  matches: number;
  wins: number;
  bestScore: number;
  bestLevel: number;
};

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
  meadow: 'Meadow',
  crypt: 'Crypt',
  wolfden: 'Wolf Den',
  bonepit: 'Bone Pit',
  ruinedkeep: 'Ruined Keep',
  bloodmoon: 'Blood Moon',
  wyrmgate: 'Wyrm Gate',
  forge: 'Forge',
  shrine: 'Shrine',
  mire: 'Mire',
  village: 'Village',
  obelisk: 'Obelisk',
  watchtower: 'Watchtower',
  ambush: 'Ambush',
  scorch: 'Scorch'
};

const tileGlyphs: Record<string, string> = {
  road: '',
  camp: '⌂',
  grove: '♣',
  meadow: '✦',
  crypt: '☗',
  wolfden: '♣',
  bonepit: '☗',
  ruinedkeep: '⚔',
  bloodmoon: '☾',
  wyrmgate: '◆',
  forge: '⚒',
  shrine: '✚',
  mire: '≈',
  village: '⌂',
  obelisk: '◆',
  watchtower: '◈',
  ambush: '⚔',
  scorch: '☄'
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
    meadow: 'Healing terrain. Moss Warden gains extra value here.',
    crypt: 'Dangerous fight tile with better loot odds.',
    wolfden: 'A pack fight tile that stacks hard beside danger.',
    bonepit: 'A two-enemy undead fight with stronger loot pressure.',
    ruinedkeep: 'An elite raider encounter with high XP and loot odds.',
    bloodmoon: 'A danger aura that makes nearby fights stack larger.',
    wyrmgate: 'A boss-class fight tile for powered-up runners.',
    forge: 'Grants armor and has strong loot tempo.',
    shrine: 'XP burst that accelerates trait choices.',
    mire: 'Slows movement but draws cards.',
    village: 'Safe heal, small XP, and supply chance.',
    obelisk: 'XP spike that may wake a hard encounter.',
    watchtower: 'Draws rival cards and enables control play.',
    ambush: 'Temporary rival trap that creates a hard fight.',
    scorch: 'Temporary hazard left by a meteor strike.'
  };
  return descriptions[tile.type] ?? 'Unknown loop tile.';
}

const dangerousTileTypes = new Set(['grove', 'crypt', 'wolfden', 'bonepit', 'ruinedkeep', 'bloodmoon', 'wyrmgate', 'obelisk', 'ambush', 'scorch']);
const combatPlacementTileTypes = new Set(['grove', 'crypt', 'wolfden', 'bonepit', 'ruinedkeep', 'bloodmoon', 'wyrmgate', 'ambush']);
const stabilizerTileTypes = new Set(['camp', 'meadow', 'village', 'forge', 'shrine', 'mire']);
const payoffTileTypes = new Set(['crypt', 'bonepit', 'ruinedkeep', 'bloodmoon', 'wyrmgate', 'obelisk', 'forge', 'watchtower']);

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
  if (combatPlacementBlocked(player, tile, card, serverNow, receivedAt, authorityPaused)) return 'Combat tiles need two visual steps of lead time.';
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
  if (tile.type === 'wyrmgate') return 5;
  if (tile.type === 'bloodmoon' || tile.type === 'ruinedkeep' || tile.type === 'bonepit') return 4;
  if (tile.type === 'crypt' || tile.type === 'wolfden' || tile.type === 'ambush' || tile.type === 'scorch') return 3;
  if (tile.type === 'obelisk' || tile.type === 'grove') return 2;
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
  if (lower.includes('loop tyrant')) return { tone: 'danger', title: 'TYRANT', detail: event };
  if (/(failed|broken|defeated|died|knock)/.test(lower)) return { tone: 'danger', title: 'DOWN', detail: event };
  return null;
}

function comboHint(card: Card) {
  if (card.kind === 'rival') return 'Best when a rival is near a danger tile or marked as leader.';
  if (card.kind === 'bonk') return card.targetMode === 'chosen' ? 'Save for a gate push or a rival about to cash out.' : 'Tempo answer when the leader is about to spike.';
  if (card.tile === 'bloodmoon') return 'Place within two tiles of Crypt, Wolf Den, or Bone Pit to grow enemy stacks.';
  if (card.tile === 'meadow' || card.tile === 'village') return 'Place before danger so the next lap has a recovery window.';
  if (card.tile === 'forge' || card.tile === 'shrine') return 'Place just before a gate push for armor, XP, or trait tempo.';
  if (card.tile === 'mire') return 'Place before a hard fight when you need one more card first.';
  if (card.tile === 'watchtower') return 'Use when the leader is close to a payoff tile.';
  if (payoffTileTypes.has(card.tile ?? '')) return 'Pair with safe terrain nearby before stacking more danger.';
  return 'Road shaping card.';
}

function cardSuit(card: Card) {
  if (card.kind === 'bonk') return card.rarity === 'rare' ? 'Rare control' : 'Common control';
  if (card.kind === 'rival') return 'Doom';
  if (card.tile === 'meadow' || card.tile === 'village') return 'Haven';
  if (card.tile === 'crypt' || card.tile === 'obelisk' || card.tile === 'wolfden' || card.tile === 'bonepit' || card.tile === 'ruinedkeep' || card.tile === 'bloodmoon' || card.tile === 'wyrmgate') return 'Peril';
  if (card.tile === 'forge' || card.tile === 'watchtower') return 'Engine';
  return 'Path';
}

function cardFaceClass(card: Card) {
  if (card.kind === 'rival') return 'rival';
  if (card.kind === 'bonk') return `bonk ${card.rarity ?? 'common'}`;
  return `terrain ${card.tile ?? 'road'}`;
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
  return (
    <span className={`hover-pop ${className}`}>
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
  if (nextTier) return { label: `Tier ${nextTier.id}`, target: nextTier.minLoops, remaining: Math.max(0, nextTier.minLoops - player.laps) };
  return { label: 'Tyrant', target: (player.tierStartLap ?? 0) + bossLoopRequirement, remaining: Math.max(0, (player.tierStartLap ?? 0) + bossLoopRequirement - player.laps) };
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
  authorityPaused = false
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
    }
  }, [authorityPaused, highlightRef, moving, player, receivedAt, runnerRef, serverNow]);

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

    let frame = 0;
    const tick = () => {
      const frameAt = Date.now();
      const clock = clockRef.current;
      const currentPlayer = playerRef.current;
      if (playerMotionIsLocked(currentPlayer, authorityPaused)) {
        const cursor = visualCursorForPlayer(currentPlayer, clock.serverNow, clock.receivedAt, authorityPaused);
        cursorRef.current = cursor;
        lastFrameAtRef.current = null;
        setRunnerMotionTransform(runnerRef.current, highlightRef.current, pointAlongBoard(currentPlayer.board, cursor));
        if (combatEngageIsPending(currentPlayer, clock.serverNow, clock.receivedAt, authorityPaused)) {
          frame = window.requestAnimationFrame(tick);
        }
        return;
      }
      const previousCursor = cursorRef.current;
      const elapsedMs = lastFrameAtRef.current === null ? 0 : frameAt - lastFrameAtRef.current;
      const segment = currentPlayer.nextMovement ?? currentPlayer.arrivalMovement;
      const segmentDurationMs = Math.max(1, (segment?.arriveAt ?? 0) - (segment?.departAt ?? 0)) || 800;
      const localStepCursor = previousCursor === null
        ? visualFrameCursorForPlayer(currentPlayer, previousCursor, authoritativeCursor(currentPlayer), clock.serverNow, clock.receivedAt, authorityPaused)
        : clampCursorAtMovementStop(currentPlayer.board, previousCursor, previousCursor + elapsedMs / segmentDurationMs);
      const nextCursor = visualFrameCursorForPlayer(currentPlayer, previousCursor, localStepCursor, clock.serverNow, clock.receivedAt, authorityPaused);
      lastFrameAtRef.current = frameAt;
      cursorRef.current = nextCursor;
      setRunnerMotionTransform(runnerRef.current, highlightRef.current, pointAlongBoard(currentPlayer.board, nextCursor));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [authorityPaused, boardGeometryKey, combatMotionKey, gameStatus, highlightRef, moving, runnerRef]);
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

function traitGlyph(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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
  onAddBot,
  onFillCpu,
  onStartRoom,
  onActivateAbility,
  isHost,
  onSettings,
  profile,
  bgmOn,
  onToggleBgm
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
  onAddBot: () => void;
  onFillCpu: () => void;
  onStartRoom: () => void;
  onActivateAbility: () => void;
  isHost: boolean;
  onSettings: (settings: Partial<RoomSettings>) => void;
  profile: LocalProfile;
  bgmOn: boolean;
  onToggleBgm: () => void;
}) {
  const [dockMode, setDockMode] = useState<'default' | 'talents'>('default');
  const hero = config.heroes.find((item) => item.id === player.heroId);
  const tree = config.talentTrees[player.heroId] ?? [];
  const pending = tree.filter((trait) => player.pendingTraits.includes(trait.id));
  const learned = tree.filter((trait) => player.traits.includes(trait.id));
  const equippedIds = new Set(Object.values(player.loadout).filter(Boolean).map((item) => item?.id));
  const looseLoot = player.loot.filter((item) => !equippedIds.has(item.id));
  const draggingLoot = draggingLootId ? player.loot.find((item) => item.id === draggingLootId) ?? null : null;
  const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const loopProgress = tierLoopProgress(config, player);

  return (
    <aside className="player-side-dock" style={{ '--hero-color': player.color } as CSSProperties}>
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
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className={index < Math.min(4, player.laps - (player.tierStartLap ?? 0)) ? 'done' : index === 0 ? 'active' : ''}>
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="loop-tier-meta">
              <strong>Tier {player.loopTier}</strong>
              <span>Lap {player.laps}</span>
            </div>
            <span className="loop-tier-meter"><i /></span>
          </section>

          {player.ability && (
            <button
              type="button"
              className={`hero-ability-button ${player.ability.ready ? 'ready' : 'cooling'}`}
              onClick={onActivateAbility}
              disabled={!player.ability.ready || game.status !== 'running' || Boolean(player.combat) || Boolean(player.stunRemainingMs)}
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

          <section className={`dock-section side-talents ${pending.length > 0 ? 'has-pending' : ''}`} aria-label="Talents">
            <div className="side-section-title icon-title">
              <GitBranch size={15} />
              <span>{learned.length}/{tree.length}</span>
            </div>
            <button className={`talent-tree-entry ${pending.length > 0 ? 'pending' : ''}`} onClick={() => setDockMode('talents')}>
              <span className="talent-tree-medallion" style={{ '--talent-icon': `url(${talentIconUrl(player.heroId)})` } as CSSProperties} />
              <span className="talent-rune-strip">
                {[...pending, ...learned].slice(0, 6).map((trait) => (
                  <i key={trait.id} className={pending.some((item) => item.id === trait.id) ? 'pending' : 'learned'}>{traitGlyph(trait.name)}</i>
                ))}
                {[...Array(Math.max(0, Math.min(6, tree.length || 6) - Math.min(6, pending.length + learned.length)))].map((_, index) => <i key={`empty-${index}`} />)}
              </span>
              <strong>{pending.length > 0 ? pending.length : player.talentPoints}</strong>
              <InfoPopover
                title={`${hero?.name ?? 'Hero'} talent tree`}
                eyebrow={pending.length > 0 ? 'Unlock ready' : 'Hero growth'}
                body={pending.length > 0 ? 'Open the tree and choose one highlighted node.' : learned.length > 0 ? `${learned[learned.length - 1].name} learned most recently.` : 'Level up to awaken the first node.'}
              />
            </button>
          </section>

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

          <div className="side-controls">
            <button className="side-control-button" onClick={onMenu} aria-label="Menu">
              <Bot size={15} />
              <InfoPopover title="Menu" eyebrow={isHost ? 'Host controls' : 'Room menu'} body={`Room ${game.id} · ${game.players.length}/${game.maxPlayers} runners`} />
            </button>
            <button className="side-control-button" onClick={onAddBot} disabled={!isHost} aria-label="Add bot">
              <Bot size={15} />
              <InfoPopover title="Add bot" body={isHost ? 'Adds one CPU opponent if a seat is open.' : 'Only the room host can add opponents.'} />
            </button>
            <button className="side-control-button" onClick={onFillCpu} disabled={!isHost} aria-label="Fill CPU match">
              <Users size={15} />
              <InfoPopover title="Fill CPU match" body={isHost ? 'Fills every open seat with CPU opponents.' : 'Only the room host can fill the match.'} />
            </button>
            <button className="side-control-button" onClick={onStartRoom} disabled={!isHost || game.status !== 'lobby'} aria-label="Start match">
              <Play size={15} />
              <InfoPopover title="Start match" body={isHost ? 'Starts movement and scoring for this room.' : 'Only the room host can start the match.'} />
            </button>
            <button
              className="side-control-button"
              onClick={() => onSettings({ pace: game.settings.pace === 'quick' ? 'steady' : 'quick' })}
              disabled={!isHost || game.status !== 'lobby'}
              aria-label="Toggle pace"
            >
              <Settings size={15} />
              <InfoPopover title="Room pace" eyebrow={game.settings.pace} body={`${game.settings.maxPlayers} seats · ${game.settings.goalScore} score scale · profile best ${profile.bestScore}`} />
            </button>
            <button className="side-control-button" onClick={onToggleBgm} aria-label="Toggle music">
              {bgmOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <InfoPopover title="Crypt of Neon Glass" eyebrow="BGM" body={bgmOn ? 'Music is playing.' : 'Music is muted.'} />
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
  const pending = tree.filter((trait) => player.pendingTraits.includes(trait.id));
  const learned = tree.filter((trait) => player.traits.includes(trait.id));
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
          {[...pending, ...learned].slice(0, 8).map((trait) => {
            const ready = player.pendingTraits.includes(trait.id);
            return (
              <button
                key={trait.id}
                className={`mobile-talent-item ${ready ? 'ready' : 'learned'}`}
                disabled={!ready}
                onClick={() => onChoose(trait.id)}
              >
                <span>{traitGlyph(trait.name)}</span>
                <b>{trait.name}</b>
                <small>{trait.text}</small>
              </button>
            );
          })}
          {pending.length === 0 && learned.length === 0 && <span className="mobile-empty">Level up to awaken the first node.</span>}
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

  return (
    <section className="talent-tree-mode">
      <div className="talent-mode-head">
        <button className="talent-back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div>
          <strong>Talent Tree</strong>
          <span>{player.talentPoints > 0 ? `${player.talentPoints} point${player.talentPoints === 1 ? '' : 's'} ready` : `${learned.length}/${tree.length} learned`}</span>
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
          const learnedNode = learnedIds.has(trait.id);
          const availableNode = pendingIds.has(trait.id);
          const state = learnedNode ? 'learned' : availableNode ? 'available' : 'locked';
          return (
            <button
              key={trait.id}
              className={`talent-node ${state}`}
              style={{ left: `${trait.x}%`, top: `${trait.y}%` }}
              aria-disabled={!availableNode}
              onClick={() => {
                if (availableNode) onChoose(trait.id);
              }}
            >
              <span className="talent-glyph">{traitGlyph(trait.name)}</span>
              <strong className="talent-node-label">{trait.name}</strong>
              <InfoPopover
                title={trait.name}
                eyebrow={state === 'available' ? 'Available talent' : state === 'learned' ? 'Learned talent' : `Tier ${trait.tier}`}
                body={trait.text}
                hint={availableNode ? 'click to learn' : trait.prereqs.length > 0 ? `requires ${trait.prereqs.map((id) => byId.get(id)?.name ?? id).join(', ')}` : undefined}
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
    return offer.kind === 'card' ? offer.card.name : offer.loot.name;
  }

  function offerMeta(offer: ShopOffer) {
    return offer.kind === 'card'
      ? `${cardSuit(offer.card)} card`
      : `${offer.loot.rarity} ${offer.loot.role ?? equipmentLabels[offer.loot.slot]}`;
  }

  function canBuy(offer: ShopOffer) {
    if ((player.gold ?? 0) < offer.price) return false;
    if (offer.kind === 'card') return player.hand.length < 7;
    return player.loot.length < 10;
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
                <span className={`shop-card-glyph ${cardFaceClass(offer.card)}`}>{offer.card.icon}</span>
              ) : (
                <span className={`shop-loot-glyph ${offer.loot.slot} ${offer.loot.rarity}`}><ItemSprite item={offer.loot} /></span>
              )}
              <span>
                <strong>{offerTitle(offer)}</strong>
                <small>{offer.price}g</small>
              </span>
              <InfoPopover
                title={offerTitle(offer)}
                eyebrow={offerMeta(offer)}
                lines={offer.kind === 'card' ? [offer.card.text] : itemPopoverLines(offer.loot, player.loadout[offer.loot.slot])}
                hint={affordable ? 'drag out or click to buy' : (player.gold ?? 0) < offer.price ? 'not enough gold' : offer.kind === 'card' ? 'hand is full' : 'loot bag is full'}
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
    return offer.kind === 'card' ? offer.card.name : offer.loot.name;
  }

  function offerMeta(offer: ShopOffer) {
    return offer.kind === 'card'
      ? `${cardSuit(offer.card)} card`
      : `${offer.loot.rarity} ${offer.loot.role ?? equipmentLabels[offer.loot.slot]}`;
  }

  function canBuy(offer: ShopOffer) {
    if ((player.gold ?? 0) < offer.price) return false;
    if (offer.kind === 'card') return player.hand.length < 7;
    return player.loot.length < 10;
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
        <button type="button" onClick={onClose} aria-label="Close shop">
          <ArrowLeft size={17} />
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
                <span className={`shop-drawer-glyph card ${cardFaceClass(offer.card)}`}>{offer.card.icon}</span>
              ) : (
                <span className={`shop-drawer-glyph loot ${offer.loot.slot} ${offer.loot.rarity}`}><ItemSprite item={offer.loot} /></span>
              )}
              <span>
                <strong>{offerTitle(offer)}</strong>
                <small>{offerMeta(offer)}</small>
              </span>
              <b>{offer.price}g</b>
              <InfoPopover
                title={offerTitle(offer)}
                eyebrow={offerMeta(offer)}
                lines={offer.kind === 'card' ? [offer.card.text] : itemPopoverLines(offer.loot, player.loadout[offer.loot.slot])}
                hint={affordable ? 'click to buy' : (player.gold ?? 0) < offer.price ? 'not enough gold' : offer.kind === 'card' ? 'hand is full' : 'loot bag is full'}
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
      data-tile-index={canPlaceTerrain || canPlaceRivalTile ? tile.index : undefined}
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
        hint={placementHint ?? (canPlaceRivalTile ? `Arm ${rivalTargetCard?.name} here` : undefined)}
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

function PlayerPanel({
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
  onFocus
}: {
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
  onFocus: () => void;
}) {
  const canRivalTarget = Boolean(rivalTargetCard && onRivalTarget);
  // Runner position is driven by the server movement clock, so ordinary tiles
  // chain together visually and only stop when combat/stun state appears.
  const boardRef = useRef<HTMLDivElement | null>(null);
  const runnerRef = useRef<HTMLSpanElement | null>(null);
  const runnerHighlightRef = useRef<HTMLSpanElement | null>(null);
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
  useRunnerMotion(runnerRef, runnerHighlightRef, player, gameStatus, serverNow, receivedAt, authorityPaused);
  const stunSeconds = Math.ceil((player.stunRemainingMs ?? 0) / 1000);
  const compactRival = !active && !focused;
  const impact = eventImpact(player.event);
  const lobbyStart = active && gameStatus === 'lobby';
  const runnerPoint = tileCenter(player.board[player.position] ?? player.board[0]);
  const combatCuePoint = player.combat ? tileCenter(player.board[player.position] ?? player.board[0]) : runnerPoint;
  const combatCueKey = player.combat ? `combat-cue-${player.combat.startedAt}` : null;

  return (
    <article
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
        {player.board.map((tile) => {
          const placementBlocked = combatPlacementBlocked(player, tile, selectedCard, serverNow, receivedAt, authorityPaused);
          const placementHint = terrainPlacementHint(player, tile, selectedCard, serverNow, receivedAt, authorityPaused);
          const canPlaceTerrain = Boolean(onTile && selectedCard?.kind === 'terrain' && tile.type !== 'camp' && !placementBlocked);
          const canPlaceRivalTile = Boolean(onRivalTile && rivalTargetCard && tile.type === 'road' && player.position !== tile.index);
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
              <div className="bc-event-stage">
                <small>{rank === 1 ? 'Leader' : active ? 'You' : player.name}</small>
                <strong>{player.event}</strong>
                <span>Lap {player.laps} · Lv {player.level} · Corr {player.soloCorruption ?? 0}</span>
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
          <InfoPopover
            title={player.name}
            eyebrow={active ? 'Your runner' : 'Runner'}
            body={`Lv ${player.level} · ${player.score} points · ${player.laps} laps`}
            lines={[
              `${Math.ceil(player.hp)}/${player.maxHp} HP`,
              `${player.power} power · ${player.guard} guard · ${player.speed} speed`,
              `${player.soloCorruption ?? 0} corruption · ${player.soloGatesCleared.length}/3 gates`,
              `${player.cardsPlayed} cards played · ${player.rivalHits} rival hits`
            ]}
            className="player-pop"
          />
        </div>
        {impact && (
          <div key={`${player.lastEventAt ?? 0}-${player.event}`} className={`event-burst ${impact.tone}`}>
            <strong>{impact.title}</strong>
            <span>{impact.detail}</span>
          </div>
        )}
        {player.event.includes('entered tier') && <div className="tier-surge"><strong>Tier {player.loopTier}</strong><span>loop collapsed</span></div>}
        {combatCueKey && (
          <div
            key={combatCueKey}
            className="combat-entry-cue active"
            style={{
              '--cue-left': `${combatCuePoint.left}%`,
              '--cue-top': `${combatCuePoint.top}%`
            } as CSSProperties}
            aria-hidden="true"
          />
        )}
        {player.combat && <CombatOverlay key={player.combat.startedAt} player={player} />}
      </div>
    </article>
  );
}

function CombatOverlay({ player }: { player: Player }) {
  const combat = player.combat;
  if (!combat) return null;
  return <CombatOverlayBody player={player} combat={combat} />;
}

function CombatOverlayBody({ player, combat }: { player: Player; combat: Combat }) {
  const [presentation] = useState(() => ({
    beats: combat.beats?.length ? combat.beats : fallbackCombatBeats(combat),
    durationMs: combat.durationMs,
    heroHpAfter: combat.heroHpAfter,
    enemyHpAfter: combat.enemyHpAfter
  }));
  const beats = presentation.beats;
  const [activeBeatIndex, setActiveBeatIndex] = useState(-1);
  const [displayHp, setDisplayHp] = useState({
    hero: combat.heroHpBefore,
    enemy: combat.enemyHpBefore
  });
  const activeBeat = activeBeatIndex >= 0 ? beats[activeBeatIndex] : null;
  const visibleDurationMs = Math.max(600, (combat.durationMs ?? 1734) - 500);
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
  const enemyLineup = Array.from({ length: Math.max(1, Math.min(combat.enemyCount, 5)) }, (_, index) => ({
    id: combat.enemyIds?.[index] ?? combat.enemyIds?.[0] ?? combat.enemyId,
    name: combat.enemyNames?.[index] ?? combat.enemyNames?.[0] ?? combat.enemyName
  }));
  const enemyHpRows = enemyHealthRows(displayHp.enemy, combat.enemyMaxHp, enemyLineup);
  const activeEnemyIndex = activeBeat?.enemyIndex !== undefined
    ? Math.max(0, Math.min(activeBeat.enemyIndex, enemyLineup.length - 1))
    : Math.max(0, Math.min(enemyHpRows.findIndex((enemy) => enemy.current > 0), enemyLineup.length - 1));

  useEffect(() => {
    const timers = beats.map((beat, index) => window.setTimeout(() => {
      setActiveBeatIndex(index);
      setDisplayHp({ hero: beat.heroHp, enemy: beat.enemyHp });
    }, beat.atMs));
    timers.push(window.setTimeout(() => {
      setDisplayHp({ hero: presentation.heroHpAfter, enemy: presentation.enemyHpAfter });
    }, Math.max(0, visibleDurationMs - 140)));

    return () => timers.forEach(window.clearTimeout);
  }, [presentation, beats, visibleDurationMs]);

  return (
    <div className="combat-overlay" style={{
      '--combat-bg': `url(${combatBackgroundUrl(combat.backgroundId)})`,
      '--combat-duration': `${visibleDurationMs}ms`,
      '--combat-delay': '0ms'
    } as CSSProperties}>
      <div className="combat-vignette" />
      <div className="combat-announcement" aria-hidden="true">
        <span>
          Fight!
          <small>{combat.label} vs {combat.enemyName}</small>
        </span>
      </div>
      <div className={`combatant hero-combat ${activeBeat?.attacker === 'hero' ? 'combat-attacking' : ''} ${activeBeat?.attacker === 'enemy' ? 'combat-taking-hit' : ''}`}>
        <img key={`hero-${activeBeatIndex}-${activeBeat?.attacker ?? 'idle'}`} src={heroSpriteUrl(player.heroId)} alt="" />
        <div className="combat-name">{player.name}</div>
        <CombatBar
          current={Math.ceil(Math.max(0, displayHp.hero))}
          max={combat.heroMaxHp}
          value={displayHp.hero}
        />
        <InfoPopover
          title={player.name}
          eyebrow="Combatant"
          body={`${Math.ceil(Math.max(0, combat.heroHpAfter))}/${combat.heroMaxHp} HP after impact`}
          lines={[`${player.power} power`, `${player.guard} guard`, `${player.speed} speed`]}
        />
      </div>
      <div className="combat-impact">
        {activeBeat && <div key={`fx-${activeBeatIndex}`} className={combatFxClass(combat.effect)} aria-hidden="true" />}
        <strong>{combat.label}</strong>
        {combat.enemyCount > 1 && <em>{combat.enemyCount} foes · {combat.rounds} clashes</em>}
        <span>{activeBeat ? `-${activeBeat.damage} HP` : 'Fight'}</span>
        <small>{activeBeat?.text ?? `+${combat.reward} XP when cleared`}</small>
        {activeBeat && (
          <b key={`${activeBeatIndex}-${activeBeat.attacker}`} className={`combat-damage-float ${activeBeat.attacker}`}>
            -{activeBeat.damage}
          </b>
        )}
      </div>
      <ol className="combat-log" aria-label="Combat play by play">
        {combatLog.map((beat) => (
          <li key={`${beat.attacker}-${beat.index}-${beat.atMs}`} className={`combat-log-${beat.state}`}>
            <i aria-hidden="true" />
            <span>{beat.text ?? (beat.attacker === 'hero' ? `You hit ${combat.enemyName}` : `${combat.enemyName} hits you`)}</span>
          </li>
        ))}
      </ol>
      <div className={`combatant enemy-combat ${activeBeat?.attacker === 'enemy' ? 'combat-attacking' : ''} ${activeBeat?.attacker === 'hero' ? 'combat-taking-hit' : ''}`}>
        <div className={`enemy-party enemy-party-${enemyLineup.length}`} aria-hidden="true">
          {enemyLineup.map((enemy, index) => (
            <img
              key={`enemy-${index}-${enemy.id}`}
              data-enemy-slot={index}
              className={index === activeEnemyIndex ? 'active-enemy' : ''}
              src={combatEnemyUrl(enemy.id)}
              alt=""
            />
          ))}
        </div>
        <div className="combat-name">{combat.enemyName}</div>
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
        <InfoPopover
          title={combat.enemyName}
          eyebrow="Enemy"
          body={combat.label}
          lines={[`${combat.enemyCount} foe${combat.enemyCount === 1 ? '' : 's'}`, `${combat.rounds} clash${combat.rounds === 1 ? '' : 'es'}`, `${combat.damage} damage dealt`, `${combat.reward} XP reward`]}
        />
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
      <span style={{ width: `${hpRatio}%` }} />
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
            <span>Break the gates, then defeat the Loop Tyrant.</span>
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
            <p>Score shows run strength and leaderboard pressure. Tiers advance from completed loops, with solo gate fights checking whether your build can survive the jump.</p>
          </section>
          <section>
            <h2>Finale</h2>
            <p>After four completed loops in tier III, the Loop Tyrant appears. Corruption rises from laps, tier clears, and deaths; dying restarts the current tier board and costs gold, tempo, and sometimes loose loot.</p>
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
  PhaseStrip,
  PlayerPanel,
  RivalIntel,
  PlayerSideDock,
  SellZone
};
