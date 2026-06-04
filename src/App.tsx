import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Bot, Coins, Crown, GitBranch, Hand, HelpCircle, Play, RotateCcw, ScrollText, Shield, Sparkles, Swords, Users, Volume2, VolumeX, Zap } from 'lucide-react';
import type { Card, Combat, GameConfig, GameState, Hero, Loot, Player, Tile, Trait } from './types';

const tileNames: Record<string, string> = {
  road: 'Road',
  camp: 'Camp',
  grove: 'Grove',
  meadow: 'Meadow',
  crypt: 'Crypt',
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
  forge: '⚒',
  shrine: '✚',
  mire: '≈',
  village: '⌂',
  obelisk: '◆',
  watchtower: '◈',
  ambush: '⚔',
  scorch: '☄'
};

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

function statLine(hero: Hero) {
  return `${hero.maxHp} HP · ${hero.power} POW · ${hero.guard} GRD · ${hero.speed} SPD`;
}

function tileDescription(tile: Tile) {
  const descriptions: Record<string, string> = {
    road: 'Can trigger a skirmish, a breather, or a sprint.',
    camp: 'Safe reset point. Crossing camp heals the runner.',
    grove: 'A steady fight tile with XP and loot pressure.',
    meadow: 'Healing terrain. Moss Warden gains extra value here.',
    crypt: 'Dangerous fight tile with better loot odds.',
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

function cardSuit(card: Card) {
  if (card.kind === 'rival') return 'Doom';
  if (card.tile === 'meadow' || card.tile === 'village') return 'Haven';
  if (card.tile === 'crypt' || card.tile === 'obelisk') return 'Peril';
  if (card.tile === 'forge' || card.tile === 'watchtower') return 'Engine';
  return 'Path';
}

function cardFaceClass(card: Card) {
  return card.kind === 'rival' ? 'rival' : `terrain ${card.tile ?? 'road'}`;
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

function App() {
  const socket = useMemo<Socket>(() => io(), []);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const [playerToken, setPlayerToken] = useState(() => localStorage.getItem('loopduel.playerToken') ?? '');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [name, setName] = useState(() => `Player ${Math.floor(Math.random() * 900 + 100)}`);
  const [roomId, setRoomId] = useState(() => localStorage.getItem('loopduel.roomId') ?? 'main');
  const [heroId, setHeroId] = useState('ember-knight');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragLootId, setDragLootId] = useState<string | null>(null);
  const [bgmOn, setBgmOn] = useState(() => localStorage.getItem('loopduel.bgm') !== 'off');

  useEffect(() => {
    socket.on('connect', () => {
      const savedToken = localStorage.getItem('loopduel.playerToken');
      const savedRoom = localStorage.getItem('loopduel.roomId') ?? 'main';
      if (savedToken) socket.emit('join', { name, heroId, roomId: savedRoom, playerToken: savedToken });
    });
    socket.on('config', (payload: GameConfig) => {
      setConfig(payload);
      setHeroId(payload.heroes[0]?.id ?? 'ember-knight');
    });
    socket.on('state', (payload: GameState) => setGame(payload));
    socket.on('session', ({ playerToken: nextToken, roomId: nextRoomId }: { playerToken: string; roomId: string }) => {
      localStorage.setItem('loopduel.playerToken', nextToken);
      localStorage.setItem('loopduel.roomId', nextRoomId);
      setPlayerToken(nextToken);
      setRoomId(nextRoomId);
    });
    socket.on('notice', (message: string) => setNotice(message));
    return () => {
      socket.off('connect');
      socket.off('config');
      socket.off('state');
      socket.off('session');
      socket.off('notice');
    };
  }, [heroId, name, socket]);

  // Esc toggles the game menu (and closes the rules overlay first if it's open).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (showHelp) {
        setShowHelp(false);
        return;
      }
      setShowMenu((open) => !open);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp]);

  const me = game?.players.find((player) => player.id === playerToken) ?? null;
  const selectedCard = me?.hand.find((card) => card.instanceId === selectedCardId) ?? null;
  const draggedCard = me?.hand.find((card) => card.instanceId === dragCardId) ?? null;
  const activeCard = draggedCard ?? selectedCard;
  const isHost = Boolean(me && game?.hostId === me.id);

  useEffect(() => {
    localStorage.setItem('loopduel.bgm', bgmOn ? 'on' : 'off');
    const audio = bgmRef.current;
    if (!audio) return;
    audio.volume = 0.32;
    audio.loop = true;
    if (!bgmOn || !me) {
      audio.pause();
      return;
    }
    const play = () => audio.play().catch(() => undefined);
    play();
    window.addEventListener('pointerdown', play, { once: true });
    return () => window.removeEventListener('pointerdown', play);
  }, [bgmOn, me]);

  function join() {
    socket.emit('join', { name, heroId, roomId, playerToken: playerToken || undefined });
    setSelectedCardId(null);
  }

  function addBot() {
    socket.emit('addBot');
  }

  function fillCpu() {
    socket.emit('fillCpu');
  }

  function placeCard(tile: Tile, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'terrain') return;
    socket.emit('placeCard', { cardId: card.instanceId, tileIndex: tile.index });
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function playRival(targetId: string, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'rival') return;
    socket.emit('playRivalCard', { cardId: card.instanceId, targetId });
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function playRivalOnTile(targetId: string, tileIndex: number, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'rival') return;
    socket.emit('playRivalCard', { cardId: card.instanceId, targetId, tileIndex });
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function equip(item: Loot) {
    socket.emit('equip', { itemId: item.id });
  }

  function sellCard(cardId: string) {
    socket.emit('sellCard', { cardId });
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function sellLoot(itemId: string) {
    socket.emit('sellLoot', { itemId });
    setDragLootId(null);
  }

  function chooseTrait(traitId: string) {
    socket.emit('chooseTrait', { traitId });
  }

  function handleSellDrop(kind: 'card' | 'loot', id: string) {
    if (kind === 'card') sellCard(id);
    else sellLoot(id);
  }

  function resetRoom() {
    socket.emit('resetRoom');
    setSelectedCardId(null);
    setDragCardId(null);
    setDragLootId(null);
  }

  if (!config || !game) {
    return <div className="boot">Loopduel</div>;
  }

  if (!me) {
    return (
      <main className="lobby-shell">
        <section className="brand-panel">
          <div className="brand-mark">LD</div>
          <div>
            <h1>Loopduel</h1>
            <p>Fast loop combat for one to four rival adventurers.</p>
          </div>
        </section>

        <section className="join-panel">
          <div className="name-row">
            <label htmlFor="player-name">Handle</label>
            <input
              id="player-name"
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
            />
            <label htmlFor="room-code">Room</label>
            <input
              id="room-code"
              value={roomId}
              maxLength={20}
              onChange={(event) => setRoomId(event.target.value)}
            />
            <button className="primary-action" onClick={join}>
              <Play size={18} />
              Enter
            </button>
            <button className="icon-action" onClick={() => setShowHelp(true)}>
              <HelpCircle size={18} />
              Rules
            </button>
          </div>

          <div className="hero-grid">
            {config.heroes.map((hero) => (
              <button
                className={`hero-card ${heroId === hero.id ? 'selected' : ''}`}
                key={hero.id}
                style={{ '--hero-color': hero.color } as React.CSSProperties}
                onClick={() => setHeroId(hero.id)}
              >
                <span className="hero-portrait-wrap">
                  <img src={heroPortraitUrl(hero.id)} alt="" />
                  <span className="hero-sigil">{hero.icon}</span>
                </span>
                <span className="hero-copy">
                  <strong>{hero.name}</strong>
                  <small>{hero.title}</small>
                  <span>{statLine(hero)}</span>
                  <p>{hero.text}</p>
                </span>
              </button>
            ))}
          </div>
        </section>
        {showHelp && <HelpOverlay config={config} onClose={() => setShowHelp(false)} />}
      </main>
    );
  }

  // Exactly one board is focused (full size); the rest render at 50%. Default is your
  // own board; clicking a board focuses it (clicking it again returns focus to you).
  const meId = me.id;
  const focusedPlayerId = focusedId && game.players.some((player) => player.id === focusedId)
    ? focusedId
    : meId;
  function focusBoard(id: string) {
    setFocusedId(id === focusedPlayerId && id !== meId ? meId : id);
  }
  const focusedPlayer = game.players.find((player) => player.id === focusedPlayerId);
  const arrangedPlayers = focusedPlayer
    ? [focusedPlayer, ...game.players.filter((player) => player.id !== focusedPlayer.id)]
    : game.players;
  const rivalTargetCard = activeCard?.kind === 'rival' ? activeCard : null;

  return (
    <main className="game-shell">
      <audio ref={bgmRef} src="/assets/audio/crypt-of-neon-glass.mp3" preload="auto" loop />
      {notice && <div className="notice-toast">{notice}</div>}

      {game.status === 'finished' && game.winner && (
        <section className="winner-strip" style={{ '--hero-color': game.winner.color } as React.CSSProperties}>
          <div>
            <strong>{game.winner.name} claimed the loop</strong>
            <span>{game.winner.score} points · Lv {game.winner.level} · {game.winner.laps} laps</span>
          </div>
          <button className="primary-action" onClick={resetRoom} disabled={!isHost}>
            <RotateCcw size={18} />
            Rematch
          </button>
        </section>
      )}

      <section className="play-layout">
        <section className={`arena-grid ${focusedPlayerId !== me.id ? 'has-focus' : ''}`}>
          {arrangedPlayers.map((player) => (
            <PlayerPanel
              key={player.id}
              player={player}
              rank={player.rank}
              active={player.id === me.id}
              focused={player.id === focusedPlayerId}
              selectedCard={player.id === me.id ? activeCard : null}
              draggingCard={player.id === me.id ? activeCard : null}
              rivalTargetCard={player.id !== me.id ? rivalTargetCard : null}
              onTile={player.id === me.id ? placeCard : undefined}
              onRivalTarget={player.id !== me.id ? (cardId) => playRival(player.id, cardId) : undefined}
              onRivalTile={player.id !== me.id ? (tileIndex, cardId) => playRivalOnTile(player.id, tileIndex, cardId) : undefined}
              onFocus={() => focusBoard(player.id)}
            />
          ))}
        </section>
        <PlayerSideDock
          player={me}
          config={config}
          game={game}
          lines={game.log}
          onEquip={equip}
          onChoose={chooseTrait}
          onLootDragStart={(id) => setDragLootId(id)}
          onLootDragEnd={() => setDragLootId(null)}
          onMenu={() => setShowMenu(true)}
          onAddBot={addBot}
          onFillCpu={fillCpu}
          isHost={isHost}
          bgmOn={bgmOn}
          onToggleBgm={() => setBgmOn((on) => !on)}
        />
      </section>

      <section className="control-dock">
        <HandBar
          hand={me.hand}
          selectedId={selectedCardId}
          draggingId={dragCardId}
          onSelect={(id) => setSelectedCardId(id === selectedCardId ? null : id)}
          onDragStart={(id) => {
            setSelectedCardId(id);
            setDragCardId(id);
          }}
          onDragEnd={() => setDragCardId(null)}
        />
        {rivalTargetCard && (
          <div className="target-row">
            <span className="target-label">strike</span>
            {game.players.filter((player) => player.id !== me.id).map((target) => (
              <button
                key={target.id}
                className="target-chip"
                style={{ '--hero-color': target.color } as React.CSSProperties}
                onClick={() => playRival(target.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'link';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  playRival(target.id, event.dataTransfer.getData('text/plain') || rivalTargetCard.instanceId);
                }}
              >
                <img src={heroPortraitUrl(target.heroId)} alt={target.name} />
                <InfoPopover
                  title={target.name}
                  eyebrow="Rival target"
                  body={`Lv ${target.level} · ${target.score} pts · ${Math.ceil(target.hp)}/${target.maxHp} HP`}
                  lines={[`${target.hand.length} cards`, `${target.loot.length} loot`, `${target.deaths} knockdowns`]}
                  hint="Drop a rival card here"
                />
              </button>
            ))}
          </div>
        )}
      </section>
      <SellZone active={Boolean(dragCardId || dragLootId)} onDrop={handleSellDrop} />
      {showHelp && <HelpOverlay config={config} onClose={() => setShowHelp(false)} />}
      {showMenu && (
        <GameMenu
          game={game}
          isHost={isHost}
          onAddBot={addBot}
          onFillCpu={fillCpu}
          onReset={() => { resetRoom(); setShowMenu(false); }}
          onRules={() => { setShowMenu(false); setShowHelp(true); }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </main>
  );
}

function GameMenu({
  game,
  isHost,
  onAddBot,
  onFillCpu,
  onReset,
  onRules,
  onClose
}: {
  game: GameState;
  isHost: boolean;
  onAddBot: () => void;
  onFillCpu: () => void;
  onReset: () => void;
  onRules: () => void;
  onClose: () => void;
}) {
  return (
    <div className="help-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="help-panel menu-panel" onClick={(event) => event.stopPropagation()}>
        <div className="help-head">
          <div>
            <strong>Menu</strong>
            <span>Room {game.id} · {game.players.length}/{game.maxPlayers} runners · first to {game.goalScore} · {isHost ? 'host controls' : 'guest view'} · tick {game.tick}</span>
          </div>
          <button className="icon-action" onClick={onClose}>Close · Esc</button>
        </div>
        <div className="menu-actions">
          <button className="menu-item" onClick={onAddBot} disabled={!isHost}>
            <Bot size={20} />
            Add Bot
          </button>
          <button className="menu-item" onClick={onFillCpu} disabled={!isHost}>
            <Users size={20} />
            Fill CPU Match
          </button>
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
  if (slot === 'armor') return <Shield size={size} />;
  return <Sparkles size={size} />;
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
  return `+${item.power}P +${item.guard}G +${item.speed}S +${item.maxHp}HP`;
}

function HandBar({
  hand,
  selectedId,
  draggingId,
  onSelect,
  onDragStart,
  onDragEnd
}: {
  hand: Card[];
  selectedId: string | null;
  draggingId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="hand-bar">
      {hand.map((card, index) => (
        <button
          key={card.instanceId}
          draggable
          aria-label={`${card.name}: ${card.text}`}
          className={`hand-card ${cardFaceClass(card)} ${selectedId === card.instanceId ? 'selected' : ''} ${draggingId === card.instanceId ? 'dragging' : ''}`}
          style={{
            '--card-index': index,
            '--hand-count': Math.max(hand.length, 1),
            '--card-tilt': `${(index - (hand.length - 1) / 2) * 4.5}deg`,
            '--card-lift': `${Math.abs(index - (hand.length - 1) / 2) * 2}px`
          } as React.CSSProperties}
          onClick={() => onSelect(card.instanceId)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = card.kind === 'terrain' ? 'move' : 'link';
            event.dataTransfer.setData('application/x-loopduel-kind', 'card');
            event.dataTransfer.setData('application/x-loopduel-card-id', card.instanceId);
            event.dataTransfer.setData('text/plain', card.instanceId);
            onDragStart(card.instanceId);
          }}
          onDragEnd={onDragEnd}
        >
          <span className="card-corner top">{card.icon}</span>
          <span className="card-art">
            <span>{card.icon}</span>
          </span>
          <span className="card-pips" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="card-corner bottom">{card.icon}</span>
          <span className="card-grab"><Hand size={14} /></span>
          <InfoPopover
            title={card.name}
            eyebrow={`${cardSuit(card)} ${card.kind}`}
            body={card.text}
            hint={card.kind === 'terrain' ? 'Drag onto your loop or click, then choose a tile' : 'Drag onto a rival portrait or click, then choose a target'}
            className="card-pop"
          />
        </button>
      ))}
      {hand.length === 0 && <span className="hand-empty">drawing…</span>}
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
  onMenu,
  onAddBot,
  onFillCpu,
  isHost,
  bgmOn,
  onToggleBgm
}: {
  player: Player;
  config: GameConfig;
  game: GameState;
  lines: string[];
  onEquip: (item: Loot) => void;
  onChoose: (traitId: string) => void;
  onLootDragStart: (itemId: string) => void;
  onLootDragEnd: () => void;
  onMenu: () => void;
  onAddBot: () => void;
  onFillCpu: () => void;
  isHost: boolean;
  bgmOn: boolean;
  onToggleBgm: () => void;
}) {
  const [dockMode, setDockMode] = useState<'default' | 'talents'>('default');
  const hero = config.heroes.find((item) => item.id === player.heroId);
  const tree = config.talentTrees[player.heroId] ?? [];
  const pending = tree.filter((trait) => player.pendingTraits.includes(trait.id));
  const learned = tree.filter((trait) => player.traits.includes(trait.id));
  const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const equippedIds = new Set(Object.values(player.loadout).filter(Boolean).map((item) => item?.id));
  const looseLoot = player.loot.filter((item) => !equippedIds.has(item.id));

  return (
    <aside className="player-side-dock" style={{ '--hero-color': player.color } as React.CSSProperties}>
      <div className="side-dock-head">
        <img src={heroPortraitUrl(player.heroId)} alt="" />
        <div>
          <strong>{player.name}</strong>
          <span>{hero?.name ?? 'Runner'} · Rank {player.rank}</span>
        </div>
        {player.rank === 1 && <Crown size={18} />}
      </div>

      <div className="side-stat-row">
        <span className="side-hp"><i style={{ width: `${hpRatio}%` }} /></span>
        <b>{Math.ceil(player.hp)}/{player.maxHp}</b>
        <em>{player.score}</em>
        <small><Coins size={12} /> {player.gold ?? 0}</small>
      </div>

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
          <div className="paperdoll">
            <div className="paperdoll-body">
              <img src={heroSpriteUrl(player.heroId)} alt="" />
            </div>
            {(['weapon', 'armor', 'charm'] as const).map((slot) => {
              const item = player.loadout[slot];
              return (
                <div key={slot} className={`paper-slot ${slot} ${item ? 'filled' : ''}`} tabIndex={0}>
                  {slotIcon(slot, 18)}
                  <InfoPopover
                    title={item?.name ?? `${slot} slot`}
                    eyebrow={item ? `${item.rarity} ${slot}` : 'Loadout'}
                    body={item ? itemStatLine(item) : 'No item equipped.'}
                  />
                </div>
              );
            })}
          </div>

          <section className={`dock-section side-talents ${pending.length > 0 ? 'has-pending' : ''}`}>
            <div className="side-section-title">
              <strong>Talents</strong>
              <span>{learned.length}/{tree.length}</span>
            </div>
            <button className={`talent-tree-entry ${pending.length > 0 ? 'pending' : ''}`} onClick={() => setDockMode('talents')}>
              <span className="talent-tree-medallion" style={{ '--talent-icon': `url(${talentIconUrl(player.heroId)})` } as React.CSSProperties} />
              <span className="talent-tree-entry-copy">
                <strong>{pending.length > 0 ? `${pending.length} talent choice${pending.length === 1 ? '' : 's'}` : 'Open talent tree'}</strong>
                <small>{pending.length > 0 ? 'Choose an available glowing node.' : learned.length > 0 ? `${learned[learned.length - 1].name} learned` : 'Level up to awaken the first node.'}</small>
              </span>
              <GitBranch size={18} />
              <InfoPopover
                title={`${hero?.name ?? 'Hero'} talent tree`}
                eyebrow={pending.length > 0 ? 'Unlock ready' : 'Hero growth'}
                body={pending.length > 0 ? 'Open the tree and choose one highlighted node.' : 'Each hero has a bespoke seven-node progression tree.'}
              />
            </button>
          </section>

          <section className="dock-section loot-section">
            <div className="side-section-title">
              <strong>Loot</strong>
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
                    onLootDragStart(item.id);
                  }}
                  onDragEnd={onLootDragEnd}
                >
                  {slotIcon(item.slot, 17)}
                  <InfoPopover
                    title={item.name}
                    eyebrow={`${item.rarity} ${item.slot}`}
                    body={itemStatLine(item)}
                    hint="click to equip"
                  />
                </button>
              ))}
              {looseLoot.length === 0 && <span className="side-empty">No loose loot.</span>}
            </div>
          </section>

          <div className="side-feed" tabIndex={0}>
            <ScrollText size={16} />
            <span>{lines[0] ?? 'The loop is quiet.'}</span>
            <InfoPopover
              title="Event log"
              lines={lines.slice(0, 8)}
              className="feed-pop"
            />
          </div>

          <div className="side-controls">
            <button className="side-control-button" onClick={onMenu}>
              <Bot size={15} />
              <span>Menu</span>
              <InfoPopover title="Menu" eyebrow={isHost ? 'Host controls' : 'Room menu'} body={`Room ${game.id} · ${game.players.length}/${game.maxPlayers} runners`} />
            </button>
            <button className="side-control-button" onClick={onAddBot} disabled={!isHost}>
              <Bot size={15} />
              <span>Bot</span>
              <InfoPopover title="Add bot" body={isHost ? 'Adds one CPU opponent if a seat is open.' : 'Only the room host can add opponents.'} />
            </button>
            <button className="side-control-button" onClick={onFillCpu} disabled={!isHost}>
              <Users size={15} />
              <span>Fill</span>
              <InfoPopover title="Fill CPU match" body={isHost ? 'Fills every open seat with CPU opponents.' : 'Only the room host can fill the match.'} />
            </button>
            <button className="side-control-button" onClick={onToggleBgm}>
              {bgmOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>BGM</span>
              <InfoPopover title="Crypt of Neon Glass" eyebrow="BGM" body={bgmOn ? 'Music is playing.' : 'Music is muted.'} />
            </button>
          </div>
        </>
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

      <div className="talent-tree-board" style={{ '--talent-icon': `url(${talentIconUrl(player.heroId)})` } as React.CSSProperties}>
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
              <span>{traitGlyph(trait.name)}</span>
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
  onDrop
}: {
  active: boolean;
  onDrop: (kind: 'card' | 'loot', id: string) => void;
}) {
  return (
    <div
      className={`sell-zone ${active ? 'active' : ''}`}
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
      <Coins size={18} />
      <span>Sell</span>
      <InfoPopover
        title="Sell"
        eyebrow="Gold score"
        body="Drop a hand card or loose item here to delete it and bank gold into your score."
      />
    </div>
  );
}

function PlayerPanel({
  player,
  rank,
  active,
  focused,
  selectedCard,
  draggingCard,
  rivalTargetCard,
  onTile,
  onRivalTarget,
  onRivalTile,
  onFocus
}: {
  player: Player;
  rank: number;
  active: boolean;
  focused: boolean;
  selectedCard: Card | null;
  draggingCard: Card | null;
  rivalTargetCard: Card | null;
  onTile?: (tile: Tile, cardId?: string) => void;
  onRivalTarget?: (cardId?: string) => void;
  onRivalTile?: (tileIndex: number, cardId?: string) => void;
  onFocus: () => void;
}) {
  const hpRatio = Math.max(0, player.hp / player.maxHp);
  const canRivalTarget = Boolean(rivalTargetCard && onRivalTarget);
  // Runner position as a percentage of the board, centered on the occupied tile.
  // Rendered at board level (not inside a tile) so CSS can smoothly slide it tile-to-tile.
  const runnerTile = player.board[player.position] ?? player.board[0];
  const runnerLeft = ((runnerTile.coord[0] + 0.5) / 5) * 100;
  const runnerTop = ((runnerTile.coord[1] + 0.5) / 5) * 100;

  return (
    <article
      className={`player-panel ${active ? 'active' : ''} ${focused ? 'focused' : 'dimmed'} ${canRivalTarget ? 'rival-drop-target' : ''}`}
      style={{ '--hero-color': player.color } as React.CSSProperties}
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
      <div className="board">
        {player.board.map((tile) => {
          const canPlaceTerrain = Boolean(onTile && selectedCard?.kind === 'terrain' && tile.type !== 'camp');
          const canPlaceRivalTile = Boolean(onRivalTile && rivalTargetCard && tile.type === 'road' && player.position !== tile.index);
          return (
            <button
              key={tile.index}
              className={`tile ${tile.type} ${player.position === tile.index ? 'occupied' : ''} ${canPlaceRivalTile ? 'rival-tile-target' : ''}`}
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
              {tile.type === 'road' && <span className={`road-shape ${roadShapeClass(player.board, tile)}`} aria-hidden="true" />}
              <span className="tile-glyph">{tileGlyphs[tile.type] ?? '?'}</span>
              <InfoPopover
                title={tileNames[tile.type] ?? tile.type}
                eyebrow={`Tile ${tile.index}`}
                body={tileDescription(tile)}
                lines={[
                  tile.charges > 0 ? `${tile.charges} charge${tile.charges === 1 ? '' : 's'} left` : 'Permanent tile',
                  player.position === tile.index ? `${player.name} is here` : 'Loop path'
                ]}
                hint={canPlaceTerrain ? `Drop ${selectedCard?.name} here` : canPlaceRivalTile ? `Arm ${rivalTargetCard?.name} here` : undefined}
                className="tile-pop"
              />
            </button>
          );
        })}
        <span className="runner" style={{ left: `${runnerLeft}%`, top: `${runnerTop}%` }}>
          <img src={heroSpriteUrl(player.heroId)} alt="" />
        </span>
        <div className="board-core">
          <div className="bc-name">
            <span className="bc-portrait">
              <img src={heroPortraitUrl(player.heroId)} alt="" />
              {rank === 1 && <Crown size={12} />}
            </span>
            <strong>{player.name}</strong>
            {!player.connected && <em>offline</em>}
          </div>
          <div className="bc-hp">
            <span className="bc-hp-bar"><i style={{ width: `${hpRatio * 100}%` }} /></span>
            <small>{Math.ceil(player.hp)}/{player.maxHp}</small>
          </div>
          <div className="bc-meta">Lv {player.level} · Lap {player.laps} · {player.score} pts</div>
          <div className="bc-stats">
            <span><Zap size={12} /> {player.power}</span>
            <span><Shield size={12} /> {player.guard}</span>
            <span>SPD {player.speed}</span>
          </div>
          <div className="bc-event">{player.event}</div>
          <div className="bc-cards">{player.hand.length} cards · {player.loot.length} loot · {player.gold ?? 0} gold</div>
          <InfoPopover
            title={player.name}
            eyebrow={active ? 'Your runner' : 'Runner'}
            body={`Lv ${player.level} · ${player.score} points · ${player.laps} laps`}
            lines={[
              `${Math.ceil(player.hp)}/${player.maxHp} HP`,
              `${player.power} power · ${player.guard} guard · ${player.speed} speed`,
              `${player.cardsPlayed} cards played · ${player.rivalHits} rival hits`
            ]}
            className="player-pop"
          />
        </div>
        {player.combat && <CombatOverlay key={player.combat.startedAt} player={player} />}
      </div>
    </article>
  );
}

function CombatOverlay({ player }: { player: Player }) {
  const combat = player.combat;
  if (!combat) return null;

  const heroBefore = Math.max(0, Math.min(100, (combat.heroHpBefore / combat.heroMaxHp) * 100));
  const heroAfter = Math.max(0, Math.min(100, (combat.heroHpAfter / combat.heroMaxHp) * 100));
  const enemyBefore = Math.max(0, Math.min(100, (combat.enemyHpBefore / combat.enemyMaxHp) * 100));
  const enemyAfter = Math.max(0, Math.min(100, (combat.enemyHpAfter / combat.enemyMaxHp) * 100));

  return (
    <div className="combat-overlay" style={{ '--combat-bg': `url(${combatBackgroundUrl(combat.backgroundId)})` } as React.CSSProperties}>
      <div className="combat-vignette" />
      <div className="combatant hero-combat">
        <img src={heroSpriteUrl(player.heroId)} alt="" />
        <div className="combat-name">{player.name}</div>
        <CombatBar
          current={Math.ceil(Math.max(0, combat.heroHpAfter))}
          max={combat.heroMaxHp}
          before={heroBefore}
          after={heroAfter}
        />
        <InfoPopover
          title={player.name}
          eyebrow="Combatant"
          body={`${Math.ceil(Math.max(0, combat.heroHpAfter))}/${combat.heroMaxHp} HP after impact`}
          lines={[`${player.power} power`, `${player.guard} guard`, `${player.speed} speed`]}
        />
      </div>
      <div className="combat-impact">
        <div className={combatFxClass(combat.effect)} aria-hidden="true" />
        <strong>{combat.label}</strong>
        <span>-{combat.damage} HP</span>
        <small>+{combat.reward} XP</small>
      </div>
      <div className="combatant enemy-combat">
        <img src={combatEnemyUrl(combat.enemyId)} alt="" />
        <div className="combat-name">{combat.enemyName}</div>
        <CombatBar current={combat.enemyHpAfter} max={combat.enemyMaxHp} before={enemyBefore} after={enemyAfter} />
        <InfoPopover
          title={combat.enemyName}
          eyebrow="Enemy"
          body={combat.label}
          lines={[`${combat.damage} damage dealt`, `${combat.reward} XP reward`]}
        />
      </div>
    </div>
  );
}

function CombatBar({ current, max, before, after }: { current: number; max: number; before: number; after: number }) {
  return (
    <div className="combat-hp">
      <span style={{ '--hp-before': `${before}%`, '--hp-after': `${after}%` } as React.CSSProperties} />
      <small>{current}/{max}</small>
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
            <span>First player to {config.goalScore} points wins.</span>
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
            <p>Terrain cards alter your own loop. Rival cards target another runner. Hands fill over time up to 7 cards.</p>
          </section>
          <section>
            <h2>Progress</h2>
            <p>XP levels you up and offers traits. Loot rolls from fights and forges, then equips into weapon, armor, or charm slots.</p>
          </section>
          <section>
            <h2>Scoring</h2>
            <p>Level, laps, fights, loot, and banked XP all add points. Knockouts revive at camp with a trimmed hand.</p>
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

export { App };
