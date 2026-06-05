import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot, GitBranch, HelpCircle, Play, RotateCcw, ScrollText, Shield } from 'lucide-react';
import { heroPortraitUrl, statLine } from './game-assets';
import type { GameConfig, GameState, Loot, Tile } from './types';
import {
  DragCardGhost,
  GameMenu,
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
} from './game-ui';

function savedPlayerToken() {
  return localStorage.getItem('loopduel.playerToken') ?? '';
}

function App() {
  const socket = useMemo<Socket>(() => io(), []);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const shouldAutoReconnect = import.meta.env.PROD;
  const [playerToken, setPlayerToken] = useState(() => shouldAutoReconnect ? savedPlayerToken() : '');
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
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const [bgmOn, setBgmOn] = useState(() => localStorage.getItem('loopduel.bgm') !== 'off');
  const [mobileDrawer, setMobileDrawer] = useState<'loot' | 'talents' | 'log' | 'menu' | null>(null);

  useEffect(() => {
    socket.on('connect', () => {
      if (!shouldAutoReconnect) return;
      const savedToken = savedPlayerToken();
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
  }, [heroId, name, shouldAutoReconnect, socket]);

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

  useEffect(() => {
    document.body.classList.toggle('card-drag-active', Boolean(draggedCard));
    if (!draggedCard) return () => document.body.classList.remove('card-drag-active');

    function trackDrag(event: DragEvent) {
      if (event.clientX === 0 && event.clientY === 0) return;
      setDragPoint({ x: event.clientX, y: event.clientY });
    }

    window.addEventListener('drag', trackDrag, true);
    window.addEventListener('dragover', trackDrag, true);
    return () => {
      document.body.classList.remove('card-drag-active');
      window.removeEventListener('drag', trackDrag, true);
      window.removeEventListener('dragover', trackDrag, true);
    };
  }, [draggedCard]);

  function join() {
    socket.emit('join', { name, heroId, roomId, playerToken: shouldAutoReconnect ? playerToken || undefined : undefined });
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
                style={{ '--hero-color': hero.color } as CSSProperties}
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

      {game.status !== 'finished' && <PhaseStrip game={game} />}
      <MobileStatusBar player={me} game={game} />

      {game.status === 'finished' && game.winner && (
        <section className="winner-strip" style={{ '--hero-color': game.winner.color } as CSSProperties}>
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
        <MobileRivalStrip
          players={game.players.filter((player) => player.id !== me.id)}
          focusedId={focusedPlayerId}
          activeCard={rivalTargetCard}
          onFocus={focusBoard}
          onTarget={(targetId) => playRival(targetId)}
        />
        <section className="control-dock">
          <div className="mobile-tray-head">
            <button className="mobile-drawer-tab" onClick={() => setMobileDrawer((mode) => mode === 'loot' ? null : 'loot')}>
              <Shield size={15} />
              Loot
            </button>
            <button className="mobile-drawer-tab" onClick={() => setMobileDrawer((mode) => mode === 'talents' ? null : 'talents')}>
              <GitBranch size={15} />
              Talents
            </button>
            <button className="mobile-drawer-tab" onClick={() => setMobileDrawer((mode) => mode === 'log' ? null : 'log')}>
              <ScrollText size={15} />
              Log
            </button>
            <button className="mobile-drawer-tab" onClick={() => setMobileDrawer((mode) => mode === 'menu' ? null : 'menu')}>
              <Bot size={15} />
              Menu
            </button>
          </div>
          <HandBar
            hand={me.hand}
            selectedId={selectedCardId}
            draggingId={dragCardId}
            onSelect={(id) => setSelectedCardId(id === selectedCardId ? null : id)}
            onDragStart={(id, point) => {
              setSelectedCardId(id);
              setDragCardId(id);
              setDragPoint(point);
            }}
            onDragEnd={() => setDragCardId(null)}
          />
          {activeCard && (
            <div className={`action-hint ${activeCard.kind}`}>
              <strong>{activeCard.icon} {activeCard.name}</strong>
              <span>{activeCard.kind === 'terrain' ? 'choose a loop tile' : 'choose a rival or road trap'}</span>
            </div>
          )}
          {rivalTargetCard && (
            <div className="target-row">
              <span className="target-label">strike</span>
              {game.players.filter((player) => player.id !== me.id).map((target) => (
                <button
                  key={target.id}
                  className="target-chip"
                  style={{ '--hero-color': target.color } as CSSProperties}
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
        <MobileDrawer
          mode={mobileDrawer}
          player={me}
          config={config}
          game={game}
          lines={game.log}
          onClose={() => setMobileDrawer(null)}
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
      {draggedCard && <DragCardGhost card={draggedCard} x={dragPoint.x} y={dragPoint.y} />}
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

export { App };
