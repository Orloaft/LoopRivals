import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, Bot, Coins, Crown, GitBranch, Hand, HelpCircle, RotateCcw, ScrollText, Shield, Sparkles, Swords, Users, Volume2, VolumeX, Zap } from 'lucide-react';
import {
  combatBackgroundUrl,
  combatEnemyUrl,
  heroPortraitUrl,
  heroSpriteUrl,
  talentIconUrl
} from './game-assets';
import type { Card, Combat, CombatBeat, GameConfig, GameState, Loot, Player, Tile, Trait } from './types';

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

function cardSuit(card: Card) {
  if (card.kind === 'rival') return 'Doom';
  if (card.tile === 'meadow' || card.tile === 'village') return 'Haven';
  if (card.tile === 'crypt' || card.tile === 'obelisk' || card.tile === 'wolfden' || card.tile === 'bonepit' || card.tile === 'ruinedkeep' || card.tile === 'bloodmoon' || card.tile === 'wyrmgate') return 'Peril';
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

function PhaseStrip({ game }: { game: GameState }) {
  const claim = game.claim;
  const progress = Math.max(0, Math.min(100, ((game.tier?.minScore ?? 0) / game.goalScore) * 100));
  const claimRemaining = claim ? Math.ceil(claim.remainingMs / 1000) : null;

  return (
    <section
      className={`phase-strip ${claim ? 'claiming' : ''}`}
      style={{ '--hero-color': claim?.claimantColor ?? '#d2b15c', '--phase-progress': `${progress}%` } as CSSProperties}
    >
      <div className="phase-copy">
        <strong>{claim ? 'Claim the Loop' : game.tier.name}</strong>
        <span>{claim ? `${claim.claimantName} must complete one marked lap` : game.tier.text}</span>
      </div>
      <div className="phase-meter" aria-hidden="true"><i /></div>
      <div className="phase-meta">
        {claim ? (
          <>
            <Crown size={16} />
            <span>{claimRemaining}s</span>
          </>
        ) : (
          <>
            <Sparkles size={16} />
            <span>{game.leaderboard[0]?.score ?? 0}/{game.goalScore}</span>
          </>
        )}
      </div>
    </section>
  );
}

function MobileStatusBar({ player, game }: { player: Player; game: GameState }) {
  const hpRatio = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const claimRemaining = game.claim ? Math.ceil(game.claim.remainingMs / 1000) : null;

  return (
    <section className="mobile-status-bar" style={{ '--hero-color': player.color, '--hp-ratio': `${hpRatio}%` } as CSSProperties}>
      <div className="mobile-status-hero">
        <img src={heroPortraitUrl(player.heroId)} alt="" />
        <span>
          <strong>{player.name}</strong>
          <small>{game.claim?.playerId === player.id ? `claim ${claimRemaining}s` : game.tier.name}</small>
        </span>
      </div>
      <div className="mobile-status-chips">
        <b>HP {Math.ceil(player.hp)}/{player.maxHp}</b>
        <b>{player.score} pts</b>
        <b>Lap {player.laps}</b>
        <b>{player.soloGatesCleared.length}/3 gates</b>
        <b><Coins size={12} /> {player.gold ?? 0}</b>
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
              <small>{activeCard ? 'target' : `${player.score} pts · Lv ${player.level}`}</small>
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
            <span>Room {game.id} · {game.players.length}/{game.maxPlayers} runners · {game.tier.name} · {isHost ? 'host controls' : 'guest view'} · tick {game.tick}</span>
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
  onDragStart: (id: string, point: { x: number; y: number }) => void;
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
          } as CSSProperties}
          onClick={() => onSelect(card.instanceId)}
          onDragStart={(event) => {
            const transparentDragImage = document.createElement('canvas');
            transparentDragImage.width = 1;
            transparentDragImage.height = 1;
            event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
            event.dataTransfer.effectAllowed = card.kind === 'terrain' ? 'move' : 'link';
            event.dataTransfer.setData('application/x-loopduel-kind', 'card');
            event.dataTransfer.setData('application/x-loopduel-card-id', card.instanceId);
            event.dataTransfer.setData('text/plain', card.instanceId);
            onDragStart(card.instanceId, { x: event.clientX, y: event.clientY });
          }}
          onDragEnd={onDragEnd}
        >
          <CardFace card={card} />
        </button>
      ))}
      {hand.length === 0 && <span className="hand-empty">drawing…</span>}
    </div>
  );
}

function CardFace({ card, popover = true }: { card: Card; popover?: boolean }) {
  return (
    <>
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
      {popover && (
        <InfoPopover
          title={card.name}
          eyebrow={`${cardSuit(card)} ${card.kind}`}
          body={card.text}
          hint={card.kind === 'terrain' ? 'Drag onto your loop or click, then choose a tile' : 'Drag onto a rival portrait or click, then choose a target'}
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
    <aside className="player-side-dock" style={{ '--hero-color': player.color } as CSSProperties}>
      <div className="side-dock-head">
        <img src={heroPortraitUrl(player.heroId)} alt="" />
        <div>
          <strong>{player.name}</strong>
          <span>{hero?.name ?? 'Runner'} · Rank {player.rank} · {game.tier.name}</span>
        </div>
        {player.rank === 1 && <Crown size={18} />}
      </div>

      <div className="side-stat-row">
        <span className="side-hp"><i style={{ width: `${hpRatio}%` }} /></span>
        <b>{Math.ceil(player.hp)}/{player.maxHp}</b>
        <em>{player.score}</em>
        <small><Coins size={12} /> {player.gold ?? 0}</small>
      </div>

      <div className={`phase-card ${game.claim?.playerId === player.id ? 'claimant' : ''}`}>
        <div>
          <strong>{game.claim?.playerId === player.id ? 'Claim lap active' : game.tier.name}</strong>
          <span>{game.claim ? `${game.claim.claimantName} has ${Math.ceil(game.claim.remainingMs / 1000)}s to close the loop.` : game.tier.text}</span>
        </div>
        <small>{player.soloGatesCleared.length}/3 gates</small>
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
              <span className="talent-tree-medallion" style={{ '--talent-icon': `url(${talentIconUrl(player.heroId)})` } as CSSProperties} />
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
  onMenu,
  onAddBot,
  onFillCpu,
  isHost,
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
  onLootDragStart: (itemId: string) => void;
  onLootDragEnd: () => void;
  onMenu: () => void;
  onAddBot: () => void;
  onFillCpu: () => void;
  isHost: boolean;
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
            {(['weapon', 'armor', 'charm'] as const).map((slot) => {
              const item = player.loadout[slot];
              return (
                <div key={slot} className={`mobile-loadout-slot ${slot} ${item ? 'filled' : ''}`}>
                  {slotIcon(slot, 16)}
                  <span>
                    <strong>{item?.name ?? slot}</strong>
                    <small>{item ? itemStatLine(item) : 'empty'}</small>
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
                  onLootDragStart(item.id);
                }}
                onDragEnd={onLootDragEnd}
              >
                {slotIcon(item.slot, 17)}
                <span>
                  <strong>{item.name}</strong>
                  <small>{itemStatLine(item)}</small>
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
      className={`player-panel ${active ? 'active' : ''} ${focused ? 'focused' : 'dimmed'} ${canRivalTarget ? 'rival-drop-target' : ''} ${player.combat ? 'combat-locked' : ''}`}
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
        <span
          className="runner"
          style={{
            '--runner-left': `${runnerLeft}%`,
            '--runner-top': `${runnerTop}%`
          } as CSSProperties}
        >
          <span className="runner-sprite">
            <img src={heroSpriteUrl(player.heroId)} alt="" />
          </span>
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
          {player.marked && <div className="bc-claim">marked</div>}
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

  useEffect(() => {
    const timers = beats.map((beat, index) => window.setTimeout(() => {
      setActiveBeatIndex(index);
      setDisplayHp({ hero: beat.heroHp, enemy: beat.enemyHp });
    }, beat.atMs));
    timers.push(window.setTimeout(() => {
      setDisplayHp({ hero: presentation.heroHpAfter, enemy: presentation.enemyHpAfter });
    }, Math.max(0, presentation.durationMs - 140)));

    return () => timers.forEach(window.clearTimeout);
  }, [presentation, beats]);

  return (
    <div className="combat-overlay" style={{
      '--combat-bg': `url(${combatBackgroundUrl(combat.backgroundId)})`,
      '--combat-duration': `${combat.durationMs ?? 5200}ms`
    } as CSSProperties}>
      <div className="combat-vignette" />
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
        <small>+{combat.reward} XP</small>
        {activeBeat && (
          <b key={`${activeBeatIndex}-${activeBeat.attacker}`} className={`combat-damage-float ${activeBeat.attacker}`}>
            -{activeBeat.damage}
          </b>
        )}
      </div>
      <div className={`combatant enemy-combat ${activeBeat?.attacker === 'enemy' ? 'combat-attacking' : ''} ${activeBeat?.attacker === 'hero' ? 'combat-taking-hit' : ''}`}>
        <img key={`enemy-${activeBeatIndex}-${activeBeat?.attacker ?? 'idle'}`} src={combatEnemyUrl(combat.enemyId)} alt="" />
        <div className="combat-name">{combat.enemyName}</div>
        <CombatBar current={Math.ceil(Math.max(0, displayHp.enemy))} max={combat.enemyMaxHp} value={displayHp.enemy} />
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

function CombatBar({ current, max, value }: { current: number; max: number; value: number }) {
  const hpRatio = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="combat-hp">
      <span style={{ width: `${hpRatio}%` }} />
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
            <span>Reach {config.goalScore}, then close a claim lap.</span>
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
            <p>Level, laps, fights, loot, and banked XP unlock tiers. At {config.goalScore} points the leader must complete one marked claim lap.</p>
          </section>
          <section>
            <h2>Solo</h2>
            <p>Solo runs add gate fights at each tier. Break the crown gate, then finish the crown lap to win.</p>
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
  HandBar,
  HelpOverlay,
  InfoPopover,
  MobileDrawer,
  MobileRivalStrip,
  MobileStatusBar,
  PhaseStrip,
  PlayerPanel,
  PlayerSideDock,
  SellZone
};
