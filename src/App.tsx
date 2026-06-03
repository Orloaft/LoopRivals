import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot, Crown, Play, Plus, Shield, Sparkles, Swords, Zap } from 'lucide-react';
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

function statLine(hero: Hero) {
  return `${hero.maxHp} HP · ${hero.power} POW · ${hero.guard} GRD · ${hero.speed} SPD`;
}

function App() {
  const socket = useMemo<Socket>(() => io(), []);
  const [socketId, setSocketId] = useState('');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [name, setName] = useState(() => `Player ${Math.floor(Math.random() * 900 + 100)}`);
  const [heroId, setHeroId] = useState('ember-knight');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    socket.on('connect', () => setSocketId(socket.id ?? ''));
    socket.on('config', (payload: GameConfig) => {
      setConfig(payload);
      setHeroId(payload.heroes[0]?.id ?? 'ember-knight');
    });
    socket.on('state', (payload: GameState) => setGame(payload));
    socket.on('notice', (message: string) => setNotice(message));
    return () => {
      socket.off('connect');
      socket.off('config');
      socket.off('state');
      socket.off('notice');
    };
  }, [socket]);

  const me = game?.players.find((player) => player.id === socketId) ?? null;
  const selectedCard = me?.hand.find((card) => card.instanceId === selectedCardId) ?? null;

  function join() {
    socket.emit('join', { name, heroId });
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
            <button className="primary-action" onClick={join}>
              <Play size={18} />
              Enter
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
                <span className="hero-icon">{hero.icon}</span>
                <strong>{hero.name}</strong>
                <small>{hero.title}</small>
                <span>{statLine(hero)}</span>
                <p>{hero.text}</p>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <h1>Loopduel</h1>
          <p>{game.players.length}/4 runners · tick {game.tick}</p>
        </div>
        <div className="top-actions">
          {notice && <span className="notice">{notice}</span>}
          <button className="icon-action" onClick={addBot} title="Add bot">
            <Bot size={18} />
            Bot
          </button>
        </div>
      </header>

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
        <div className="avatar-ring">
          <span>{rank === 1 ? <Crown size={18} /> : rank}</span>
        </div>
        <div>
          <h2>{player.name}</h2>
          <p>Lv {player.level} · Lap {player.laps} · {player.score} pts</p>
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
            {player.position === tile.index && <span className="runner">●</span>}
          </button>
        ))}
        <div className="board-core">
          <strong>{player.event}</strong>
          <span>{player.hand.length} cards · {player.loot.length} loot</span>
        </div>
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

export { App };
