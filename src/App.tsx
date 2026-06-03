import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot, Crown, HelpCircle, Play, Plus, RotateCcw, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import type { Card, GameConfig, GameState, Hero, Loot, Player, Tile } from './types';

const tileNames: Record<string, string> = {
  road: 'Road',
  camp: 'Camp',
  grove: 'Grove',
  meadow: 'Meadow',
  crypt: 'Crypt',
  forge: 'Forge',
  shrine: 'Shrine',
  mire: 'Mire',
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
  ambush: '⚔',
  scorch: '☄'
};

function heroPortraitUrl(heroId: string) {
  return `/assets/heroes/${heroId}-portrait-v1.png`;
}

function heroSpriteUrl(heroId: string) {
  return `/assets/sprites/${heroId}-sprite-v2.png`;
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

function App() {
  const socket = useMemo<Socket>(() => io(), []);
  const [playerToken, setPlayerToken] = useState(() => localStorage.getItem('loopduel.playerToken') ?? '');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [name, setName] = useState(() => `Player ${Math.floor(Math.random() * 900 + 100)}`);
  const [roomId, setRoomId] = useState(() => localStorage.getItem('loopduel.roomId') ?? 'main');
  const [heroId, setHeroId] = useState('ember-knight');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showHelp, setShowHelp] = useState(false);

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

  const me = game?.players.find((player) => player.id === playerToken) ?? null;
  const selectedCard = me?.hand.find((card) => card.instanceId === selectedCardId) ?? null;

  function join() {
    socket.emit('join', { name, heroId, roomId, playerToken: playerToken || undefined });
    setSelectedCardId(null);
  }

  function addBot() {
    socket.emit('addBot');
  }

  function placeCard(tile: Tile) {
    if (!selectedCard || selectedCard.kind !== 'terrain') return;
    socket.emit('placeCard', { cardId: selectedCard.instanceId, tileIndex: tile.index });
    setSelectedCardId(null);
  }

  function playRival(targetId: string) {
    if (!selectedCard || selectedCard.kind !== 'rival') return;
    socket.emit('playRivalCard', { cardId: selectedCard.instanceId, targetId });
    setSelectedCardId(null);
  }

  function equip(item: Loot) {
    socket.emit('equip', { itemId: item.id });
  }

  function chooseTrait(traitId: string) {
    socket.emit('chooseTrait', { traitId });
  }

  function resetRoom() {
    socket.emit('resetRoom');
    setSelectedCardId(null);
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
            <button className="icon-action" onClick={() => setShowHelp(true)} title="Rules">
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

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <h1>Loopduel</h1>
          <p>Room {game.id} · {game.players.length}/{game.maxPlayers} runners · first to {game.goalScore} · tick {game.tick}</p>
        </div>
        <div className="top-actions">
          {notice && <span className="notice">{notice}</span>}
          <button className="icon-action" onClick={() => setShowHelp(true)} title="Rules">
            <HelpCircle size={18} />
            Rules
          </button>
          <button className="icon-action" onClick={addBot} title="Add bot">
            <Bot size={18} />
            Bot
          </button>
          <button className="icon-action" onClick={resetRoom} title="Reset room">
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </header>

      {game.status === 'finished' && game.winner && (
        <section className="winner-strip" style={{ '--hero-color': game.winner.color } as React.CSSProperties}>
          <div>
            <strong>{game.winner.name} claimed the loop</strong>
            <span>{game.winner.score} points · Lv {game.winner.level} · {game.winner.laps} laps</span>
          </div>
          <button className="primary-action" onClick={resetRoom}>
            <RotateCcw size={18} />
            Rematch
          </button>
        </section>
      )}

      <section className="arena-grid">
        {game.players.map((player, index) => (
          <PlayerPanel
            key={player.id}
            player={player}
            rank={index + 1}
            active={player.id === me.id}
            selectedCard={player.id === me.id ? selectedCard : null}
            onTile={player.id === me.id ? placeCard : undefined}
          />
        ))}
      </section>

      <section className="control-dock">
        <div className="hand-panel">
          <PanelHeader icon={<Sparkles size={17} />} title="Hand" detail={`${me.hand.length}/7`} />
          <div className="card-row">
            {me.hand.map((card) => (
              <button
                key={card.instanceId}
                className={`play-card ${selectedCardId === card.instanceId ? 'selected' : ''} ${card.kind}`}
                onClick={() => setSelectedCardId(card.instanceId === selectedCardId ? null : card.instanceId)}
              >
                <span>{card.icon}</span>
                <strong>{card.name}</strong>
                <small>{card.kind}</small>
                <p>{card.text}</p>
              </button>
            ))}
          </div>
          {selectedCard?.kind === 'rival' && (
            <div className="target-row">
              {game.players.filter((player) => player.id !== me.id).map((target) => (
                <button key={target.id} onClick={() => playRival(target.id)}>
                  <Swords size={16} />
                  {target.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="side-panels">
          <LoadoutPanel player={me} onEquip={equip} />
          <TraitPanel player={me} config={config} onChoose={chooseTrait} />
          <LogPanel lines={game.log} />
        </div>
      </section>
      {showHelp && <HelpOverlay config={config} onClose={() => setShowHelp(false)} />}
    </main>
  );
}

function PanelHeader({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div className="panel-header">
      <span>{icon}</span>
      <strong>{title}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function PlayerPanel({
  player,
  rank,
  active,
  selectedCard,
  onTile
}: {
  player: Player;
  rank: number;
  active: boolean;
  selectedCard: Card | null;
  onTile?: (tile: Tile) => void;
}) {
  const hpRatio = Math.max(0, player.hp / player.maxHp);

  return (
    <article className={`player-panel ${active ? 'active' : ''}`} style={{ '--hero-color': player.color } as React.CSSProperties}>
      <div className="player-head">
        <div className="player-portrait">
          <img src={heroPortraitUrl(player.heroId)} alt="" />
          <span>{rank === 1 ? <Crown size={16} /> : rank}</span>
        </div>
        <div>
          <h2>{player.name}</h2>
          <p>Lv {player.level} · Lap {player.laps} · {player.score} pts{!player.connected ? ' · offline' : ''}</p>
        </div>
      </div>

      <div className="hp-track">
        <span style={{ width: `${hpRatio * 100}%` }} />
      </div>

      <div className="board">
        {player.board.map((tile) => (
          <button
            key={tile.index}
            className={`tile ${tile.type} ${player.position === tile.index ? 'occupied' : ''}`}
            style={{
              gridColumn: tile.coord[0] + 1,
              gridRow: tile.coord[1] + 1
            }}
            onClick={() => onTile?.(tile)}
            disabled={!onTile || !selectedCard || selectedCard.kind !== 'terrain' || tile.type === 'camp'}
            title={tileNames[tile.type] ?? tile.type}
          >
            <span className="tile-glyph">{tileGlyphs[tile.type] ?? '?'}</span>
            {player.position === tile.index && (
              <span className="runner">
                <img src={heroSpriteUrl(player.heroId)} alt="" />
              </span>
            )}
          </button>
        ))}
        <div className="board-core">
          <strong>{player.event}</strong>
          <span>{player.hand.length} cards · {player.loot.length} loot</span>
        </div>
        {player.combat && <CombatOverlay player={player} />}
      </div>

      <div className="stat-strip">
        <span><Zap size={14} /> {player.power}</span>
        <span><Shield size={14} /> {player.guard}</span>
        <span>SPD {player.speed}</span>
        <span>{Math.ceil(player.hp)}/{player.maxHp}</span>
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
      </div>
      <div className="combat-impact">
        <strong>{combat.label}</strong>
        <span>-{combat.damage} HP</span>
        <small>+{combat.reward} XP</small>
      </div>
      <div className="combatant enemy-combat">
        <img src={combatEnemyUrl(combat.enemyId)} alt="" />
        <div className="combat-name">{combat.enemyName}</div>
        <CombatBar current={combat.enemyHpAfter} max={combat.enemyMaxHp} before={enemyBefore} after={enemyAfter} />
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

function LoadoutPanel({ player, onEquip }: { player: Player; onEquip: (item: Loot) => void }) {
  return (
    <div className="dock-panel">
      <PanelHeader icon={<Shield size={17} />} title="Loadout" />
      <div className="loadout-slots">
        {(['weapon', 'armor', 'charm'] as const).map((slot) => (
          <div className="slot" key={slot}>
            <small>{slot}</small>
            <strong>{player.loadout[slot]?.name ?? 'empty'}</strong>
          </div>
        ))}
      </div>
      <div className="loot-list">
        {player.loot.slice(0, 5).map((item) => (
          <button key={item.id} className={`loot ${item.rarity}`} onClick={() => onEquip(item)}>
            <span>{item.slot}</span>
            <strong>{item.name}</strong>
            <small>+{item.power}P +{item.guard}G +{item.speed}S +{item.maxHp}HP</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function TraitPanel({
  player,
  config,
  onChoose
}: {
  player: Player;
  config: GameConfig;
  onChoose: (traitId: string) => void;
}) {
  const pending = config.traits.filter((trait) => player.pendingTraits.includes(trait.id));
  const learned = config.traits.filter((trait) => player.traits.includes(trait.id));

  return (
    <div className="dock-panel">
      <PanelHeader icon={<Plus size={17} />} title="Traits" detail={`${player.traits.length}`} />
      {pending.length > 0 && (
        <div className="trait-choice">
          {pending.map((trait) => (
            <button key={trait.id} onClick={() => onChoose(trait.id)}>
              <strong>{trait.name}</strong>
              <span>{trait.text}</span>
            </button>
          ))}
        </div>
      )}
      <div className="learned-list">
        {learned.map((trait) => <span key={trait.id}>{trait.name}</span>)}
      </div>
    </div>
  );
}

function LogPanel({ lines }: { lines: string[] }) {
  return (
    <div className="dock-panel log-panel">
      <PanelHeader icon={<Swords size={17} />} title="Feed" />
      {lines.slice(0, 7).map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
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
