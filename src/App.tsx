import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { Activity, Bot, Crown, Eye, GitBranch, HelpCircle, Play, RotateCcw, ScrollText, Share2, Shield, ShoppingBag, Sparkles } from 'lucide-react';
import { isAuthorityStateStale } from './authority-timeline';
import { createRoomAuthorityBatcher } from './client-authority-batcher';
import { createClientCommandTransport } from './client-command-transport';
import { heroPortraitUrl, statLine, warmCriticalGameImages } from './game-assets';
import { gameplayRaf, type GameplayRafFrame } from './gameplay-raf';
import { authoritativeCursor, clampCursorAtMovementStop, combatEngageIsPending, maxVisualFrameStepMs, playerMotionIsLocked, visualCursorForPlayer, visualFrameCursorForPlayer, visualSegmentDurationMs } from './movement';
import { applyRoomDelta } from './room-projection';
import { measureDeltaApply, recordSocketEvent } from './smoothness-metrics';
import type { GameConfig, GameState, Loot, RoomDelta, RoomSettings, ShopOffer, Tile } from './types';
import {
  DragCardGhost,
  DragLootGhost,
  GameMenu,
  HandBar,
  HelpOverlay,
  InfoPopover,
  MobileDrawer,
  MobileRivalStrip,
  OnboardingCoach,
  PhaseStrip,
  PlayerPanel,
  RivalIntel,
  PlayerSideDock,
  SellZone,
  HeroStatsDrawer,
  ShopDrawer
} from './game-ui';

function savedPlayerToken() {
  return localStorage.getItem('loopduel.playerToken') ?? '';
}

function initialRoomId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? localStorage.getItem('loopduel.roomId') ?? 'main';
}

export type LocalProfile = {
  matches: number;
  wins: number;
  bestScore: number;
  bestLevel: number;
};

const emptyProfile: LocalProfile = { matches: 0, wins: 0, bestScore: 0, bestLevel: 1 };
const authorityStaleMs = 1800;
const commandAckEvents = new Set([
  'updateRoomSettings',
  'kickPlayer',
  'placeCard',
  'playRivalCard',
  'playBonkCard',
  'sellCard',
  'sellLoot',
  'buyShopOffer',
  'activateHeroAbility',
  'equip',
  'chooseTrait'
]);

function setParallaxLayerProgress(
  layers: {
    spires: HTMLSpanElement | null;
    graves: HTMLSpanElement | null;
    brambles: HTMLSpanElement | null;
  },
  cursor: number,
  boardLength: number
) {
  const progress = cursor / Math.max(1, boardLength);
  const translate = (px: number) => `translate3d(${(progress * px).toFixed(2)}px, 0, 0)`;
  if (layers.spires) layers.spires.style.transform = translate(-120);
  if (layers.graves) layers.graves.style.transform = translate(-200);
  if (layers.brambles) layers.brambles.style.transform = translate(-380);
}

function GothicParallaxBackdrop({
  player,
  gameStatus,
  serverNow,
  receivedAt,
  authorityPaused
}: {
  player?: GameState['players'][number] | null;
  gameStatus?: GameState['status'];
  serverNow?: number;
  receivedAt?: number;
  authorityPaused?: boolean;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const spiresRef = useRef<HTMLSpanElement | null>(null);
  const gravesRef = useRef<HTMLSpanElement | null>(null);
  const bramblesRef = useRef<HTMLSpanElement | null>(null);
  const cursorRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const motionRef = useRef({ player, serverNow, receivedAt, authorityPaused });

  useLayoutEffect(() => {
    motionRef.current = { player, serverNow, receivedAt, authorityPaused };
  }, [authorityPaused, player, receivedAt, serverNow]);
  const hasMotionPlayer = Boolean(player);
  const motionLocked = Boolean(
    player?.combat ||
    player?.stunRemainingMs ||
    (player as NonNullable<typeof player> & { guidedDormant?: boolean } | null | undefined)?.guidedDormant
  );

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return undefined;
    const current = motionRef.current;

    if (!current.player) {
      cursorRef.current = null;
      lastFrameAtRef.current = null;
      setParallaxLayerProgress({ spires: spiresRef.current, graves: gravesRef.current, brambles: bramblesRef.current }, 0, 1);
      return undefined;
    }

    const boardLength = Math.max(1, current.player.board.length);
    if (gameStatus !== 'running' || authorityPaused || current.player.combat || current.player.stunRemainingMs || (current.player as typeof current.player & { guidedDormant?: boolean }).guidedDormant) {
      const cursor = visualCursorForPlayer(current.player, current.serverNow ?? Date.now(), current.receivedAt, authorityPaused);
      cursorRef.current = cursor;
      lastFrameAtRef.current = null;
      setParallaxLayerProgress({ spires: spiresRef.current, graves: gravesRef.current, brambles: bramblesRef.current }, cursor, boardLength);
      if (!current.player.combat || authorityPaused || gameStatus !== 'running') return undefined;
    }

    let unsubscribe: (() => void) | null = null;
    const tick = (frame: GameplayRafFrame) => {
      const frameAt = frame.now;
      const current = motionRef.current;
      if (!current.player) return;
      if (playerMotionIsLocked(current.player, current.authorityPaused)) {
        const cursor = visualCursorForPlayer(current.player, current.serverNow ?? frameAt, current.receivedAt, current.authorityPaused);
        cursorRef.current = cursor;
        lastFrameAtRef.current = null;
        setParallaxLayerProgress({ spires: spiresRef.current, graves: gravesRef.current, brambles: bramblesRef.current }, cursor, current.player.board.length);
        if (!combatEngageIsPending(current.player, current.serverNow ?? frameAt, current.receivedAt, current.authorityPaused)) {
          unsubscribe?.();
          unsubscribe = null;
        }
        return;
      }
      const previousCursor = cursorRef.current;
      const elapsedMs = lastFrameAtRef.current === null ? 0 : Math.min(maxVisualFrameStepMs, frameAt - lastFrameAtRef.current);
      const segment = current.player.nextMovement ?? current.player.arrivalMovement;
      const segmentDurationMs = visualSegmentDurationMs(segment);
      const localStepCursor = previousCursor === null
        ? visualFrameCursorForPlayer(current.player, previousCursor, authoritativeCursor(current.player), current.serverNow ?? frameAt, current.receivedAt, current.authorityPaused)
        : clampCursorAtMovementStop(current.player.board, previousCursor, previousCursor + elapsedMs / segmentDurationMs);
      const nextCursor = visualFrameCursorForPlayer(current.player, previousCursor, localStepCursor, current.serverNow ?? frameAt, current.receivedAt, current.authorityPaused);
      lastFrameAtRef.current = frameAt;
      cursorRef.current = nextCursor;
      setParallaxLayerProgress({ spires: spiresRef.current, graves: gravesRef.current, brambles: bramblesRef.current }, nextCursor, current.player.board.length);
    };
    unsubscribe = gameplayRaf.subscribe(tick);
    return () => {
      unsubscribe?.();
      unsubscribe = null;
    };
  }, [authorityPaused, gameStatus, hasMotionPlayer, motionLocked]);

  return (
    <div ref={backdropRef} className="gothic-parallax" aria-hidden="true">
      <span className="parallax-sky" />
      <span ref={spiresRef} className="parallax-spires" />
      <span ref={gravesRef} className="parallax-graves" />
      <span ref={bramblesRef} className="parallax-brambles" />
      <span className="parallax-vignette" />
    </div>
  );
}

function guidedRoomId() {
  return `guide-${Math.floor(Math.random() * 1e7).toString(36)}`;
}

function loadProfile(): LocalProfile {
  try {
    return { ...emptyProfile, ...JSON.parse(localStorage.getItem('loopduel.profile') ?? '{}') };
  } catch {
    return emptyProfile;
  }
}

function App() {
  const socket = useMemo<Socket>(() => io(), []);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const shouldAutoReconnect = import.meta.env.PROD;
  const [playerToken, setPlayerToken] = useState(() => shouldAutoReconnect ? savedPlayerToken() : '');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const playerTokenRef = useRef(playerToken);
  const authorityPausedRef = useRef(false);
  const lastRoomEventSeqRef = useRef(0);
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const authorityStateStaleRef = useRef(false);
  const [authorityStateStale, setAuthorityStateStale] = useState(false);
  const [name, setName] = useState(() => `Player ${Math.floor(Math.random() * 900 + 100)}`);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [heroId, setHeroId] = useState('ember-knight');
  const [spectatorRoomId, setSpectatorRoomId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem('loopduel.tutorialSeen') !== 'yes');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragLootId, setDragLootId] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const dragFrameRef = useRef<number | null>(null);
  const [bgmOn, setBgmOn] = useState(() => localStorage.getItem('loopduel.bgm') !== 'off');
  const [shopOpen, setShopOpen] = useState(false);
  const [heroStatsOpen, setHeroStatsOpen] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  const [recordedFinishId, setRecordedFinishId] = useState<string | null>(null);
  const [mobileDrawer, setMobileDrawer] = useState<'loot' | 'talents' | 'log' | 'menu' | null>(null);
  const commandTransportRef = useRef<ReturnType<typeof createClientCommandTransport> | null>(null);
  const roomAuthorityBatcherRef = useRef<ReturnType<typeof createRoomAuthorityBatcher> | null>(null);
  const me = game?.players.find((player) => player.id === playerToken) ?? null;
  const assetWarmPhase = me ? 'game' : 'lobby';

  useEffect(() => {
    playerTokenRef.current = playerToken;
  }, [playerToken]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    warmCriticalGameImages(config, assetWarmPhase);
  }, [assetWarmPhase, config]);

  useEffect(() => {
    const commandTransport = createClientCommandTransport({
      emit: (eventName, payload, ack) => {
        recordSocketEvent(eventName, payload, 'outbound');
        if (ack) socket.emit(eventName, payload, ack);
        else socket.emit(eventName, payload);
      },
      getPlayerId: () => playerTokenRef.current || null,
      onNotice: setNotice,
      shouldRetry: () => !authorityPausedRef.current
    });
    const roomAuthorityBatcher = createRoomAuthorityBatcher({
      getState: () => gameRef.current,
      commitState: (nextGame) => {
        gameRef.current = nextGame;
        setGame(nextGame);
      },
      applyDelta: (currentState, delta, receivedAt) => measureDeltaApply(() => applyRoomDelta(currentState, delta, receivedAt)),
      onAcceptedSeq: (seq) => {
        lastRoomEventSeqRef.current = Math.max(lastRoomEventSeqRef.current, seq);
      },
      onRecovery: ({ roomId: recoveryRoomId, fromSeq }) => {
        const payload = { roomId: recoveryRoomId, fromSeq };
        recordSocketEvent('room:resume', payload, 'outbound');
        socket.emit('room:resume', payload);
      }
    });

    commandTransportRef.current = commandTransport;
    roomAuthorityBatcherRef.current = roomAuthorityBatcher;

    return () => {
      commandTransport.dispose();
      roomAuthorityBatcher.dispose();
      if (commandTransportRef.current === commandTransport) commandTransportRef.current = null;
      if (roomAuthorityBatcherRef.current === roomAuthorityBatcher) roomAuthorityBatcherRef.current = null;
    };
  }, [socket]);

  useEffect(() => {
    socket.on('connect', () => {
      setSocketConnected(true);
      const savedRoom = localStorage.getItem('loopduel.roomId') ?? 'main';
      if (lastRoomEventSeqRef.current > 0) {
        const payload = { roomId: savedRoom, fromSeq: lastRoomEventSeqRef.current };
        recordSocketEvent('room:resume', payload, 'outbound');
        socket.emit('room:resume', payload);
      }
      if (!shouldAutoReconnect) return;
      const savedToken = savedPlayerToken();
      if (savedToken) {
        const payload = { name, heroId, roomId: savedRoom, playerToken: savedToken };
        const sent = commandTransportRef.current?.send('join', payload, { retry: false, trackAck: false });
        if (!sent) {
          recordSocketEvent('join', payload, 'outbound');
          socket.emit('join', payload);
        }
      }
    });
    socket.on('config', (payload: GameConfig) => {
      setConfig(payload);
      setHeroId(payload.heroes[0]?.id ?? 'ember-knight');
    });
    socket.on('state', (payload: GameState) => {
      recordSocketEvent('state', payload, 'inbound');
      const batcher = roomAuthorityBatcherRef.current;
      if (batcher) batcher.enqueueState(payload);
      else setGame({ ...payload, receivedAt: Date.now() });
    });
    socket.on('room:delta', (payload: RoomDelta) => {
      recordSocketEvent('room:delta', payload, 'inbound');
      commandTransportRef.current?.observeRoomDelta(payload);
      const batcher = roomAuthorityBatcherRef.current;
      if (batcher) {
        batcher.enqueueDelta(payload);
        return;
      }
      setGame((current) => {
        if (!current) return current;
        const projection = measureDeltaApply(() => applyRoomDelta(current, payload));
        lastRoomEventSeqRef.current = Math.max(lastRoomEventSeqRef.current, projection.acceptedSeq);
        return projection.state;
      });
    });
    socket.on('session', ({ playerToken: nextToken, roomId: nextRoomId }: { playerToken: string; roomId: string }) => {
      localStorage.setItem('loopduel.playerToken', nextToken);
      localStorage.setItem('loopduel.roomId', nextRoomId);
      playerTokenRef.current = nextToken;
      setPlayerToken(nextToken);
      setRoomId(nextRoomId);
      setSpectatorRoomId(null);
    });
    socket.on('notice', (message: string) => {
      recordSocketEvent('notice', message, 'inbound');
      setNotice(message);
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    return () => {
      socket.off('connect');
      socket.off('config');
      socket.off('state');
      socket.off('room:delta');
      socket.off('session');
      socket.off('notice');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [heroId, name, shouldAutoReconnect, socket]);

  useEffect(() => {
    const updateAuthorityStateStale = () => {
      const nextStale = isAuthorityStateStale(game, Date.now(), authorityStaleMs);
      if (authorityStateStaleRef.current === nextStale) return;
      authorityStateStaleRef.current = nextStale;
      setAuthorityStateStale(nextStale);
    };
    updateAuthorityStateStale();
    const timer = window.setInterval(updateAuthorityStateStale, 250);
    return () => window.clearInterval(timer);
  }, [game]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

  const selectedCard = me?.hand.find((card) => card.instanceId === selectedCardId) ?? null;
  const draggedCard = me?.hand.find((card) => card.instanceId === dragCardId) ?? null;
  const draggedLoot = me?.loot.find((item) => item.id === dragLootId) ?? null;
  const activeCard = draggedCard ?? selectedCard;
  const isHost = Boolean(me && game?.hostId === me.id);
  const hostPlayer = game?.players.find((player) => player.id === game.hostId) ?? null;
  const hostMissing = Boolean(hostPlayer && !hostPlayer.connected);
  const serverAuthorityPaused = Boolean(game?.authority?.paused);
  const authorityPaused = Boolean(game && game.status === 'running' && (!socketConnected || serverAuthorityPaused || hostMissing || authorityStateStale));
  const authorityPauseTitle = !socketConnected
    ? 'Reconnecting to server'
    : serverAuthorityPaused || hostMissing
      ? 'Waiting for host'
      : 'Waiting for server';
  const authorityPauseDetail = !socketConnected
    ? 'Movement is paused until the authoritative room connection returns.'
    : 'Movement is paused until a fresh authoritative snapshot arrives.';

  useEffect(() => {
    authorityPausedRef.current = authorityPaused;
  }, [authorityPaused]);

  function emitAuthoritative(eventName: string, payload?: unknown) {
    if (authorityPaused) {
      setNotice(`${authorityPauseTitle}. Actions are paused for sync.`);
      return false;
    }
    const sent = commandTransportRef.current?.send(eventName, payload, {
      retry: commandAckEvents.has(eventName),
      trackAck: commandAckEvents.has(eventName)
    });
    if (!sent) {
      recordSocketEvent(eventName, payload, 'outbound');
      socket.emit(eventName, payload);
    }
    return true;
  }

  function closeTutorial() {
    localStorage.setItem('loopduel.tutorialSeen', 'yes');
    setShowTutorial(false);
  }

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
    if (!game || !me || game.status !== 'finished') return;
    const finishId = `${game.id}:${game.winnerId ?? 'none'}`;
    if (recordedFinishId === finishId) return;
    const nextProfile = {
      matches: profile.matches + 1,
      wins: profile.wins + (game.winnerId === me.id ? 1 : 0),
      bestScore: Math.max(profile.bestScore, me.score),
      bestLevel: Math.max(profile.bestLevel, me.level)
    };
    localStorage.setItem('loopduel.profile', JSON.stringify(nextProfile));
    const updateId = window.setTimeout(() => {
      setProfile(nextProfile);
      setRecordedFinishId(finishId);
    }, 0);
    return () => window.clearTimeout(updateId);
  }, [game, me, profile, recordedFinishId]);

  useEffect(() => {
    document.body.classList.toggle('card-drag-active', Boolean(draggedCard));
    document.body.classList.toggle('loot-drag-active', Boolean(draggedLoot));
    if (!draggedCard && !draggedLoot) {
      return () => {
        document.body.classList.remove('card-drag-active');
        document.body.classList.remove('loot-drag-active');
      };
    }

    function trackDrag(event: DragEvent) {
      if (event.clientX === 0 && event.clientY === 0) return;
      const point = { x: event.clientX, y: event.clientY };
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        setDragPoint(point);
      });
    }

    window.addEventListener('drag', trackDrag, true);
    window.addEventListener('dragover', trackDrag, true);
    return () => {
      document.body.classList.remove('card-drag-active');
      document.body.classList.remove('loot-drag-active');
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
      window.removeEventListener('drag', trackDrag, true);
      window.removeEventListener('dragover', trackDrag, true);
    };
  }, [draggedCard, draggedLoot]);

  function join() {
    const payload = { name, heroId, roomId, playerToken: shouldAutoReconnect ? playerToken || undefined : undefined };
    const sent = commandTransportRef.current?.send('join', payload, {
      retry: false,
      trackAck: false
    });
    if (!sent) {
      recordSocketEvent('join', payload, 'outbound');
      socket.emit('join', payload);
    }
    setSpectatorRoomId(null);
    setSelectedCardId(null);
  }

  function startGuidedDuel() {
    const nextRoomId = guidedRoomId();
    setRoomId(nextRoomId);
    setHeroId('ember-knight');
    const payload = {
      name,
      heroId: 'ember-knight',
      roomId: nextRoomId,
      guidedRun: true
    };
    const sent = commandTransportRef.current?.send('join', payload, {
      retry: false,
      trackAck: false
    });
    if (!sent) {
      recordSocketEvent('join', payload, 'outbound');
      socket.emit('join', payload);
    }
    setSpectatorRoomId(null);
    setSelectedCardId(null);
    setShowTutorial(false);
  }

  function spectate() {
    const payload = { roomId };
    recordSocketEvent('spectate', payload, 'outbound');
    socket.emit('spectate', payload);
    setSpectatorRoomId(roomId);
    localStorage.setItem('loopduel.roomId', roomId);
  }

  function inviteUrl(nextRoomId = game?.id ?? roomId) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', nextRoomId);
    return url.toString();
  }

  async function copyInvite(nextRoomId = game?.id ?? roomId) {
    const url = inviteUrl(nextRoomId);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setNotice(`Invite copied for room ${nextRoomId}.`);
  }

  function addBot() {
    emitAuthoritative('addBot');
  }

  function fillCpu() {
    emitAuthoritative('fillCpu');
  }

  function startRoom() {
    emitAuthoritative('startRoom');
  }

  function updateRoomSettings(settings: Partial<RoomSettings>) {
    emitAuthoritative('updateRoomSettings', settings);
  }

  function kickPlayer(targetId: string) {
    emitAuthoritative('kickPlayer', { targetId });
  }

  function placeCard(tile: Tile, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'terrain') return;
    if (!emitAuthoritative('placeCard', { cardId: card.instanceId, tileIndex: tile.index })) return;
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function playRival(targetId: string, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'rival') return;
    if (!emitAuthoritative('playRivalCard', { cardId: card.instanceId, targetId })) return;
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function playBonk(targetId?: string, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'bonk') return;
    if (!emitAuthoritative('playBonkCard', { cardId: card.instanceId, targetId })) return;
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function playRivalOnTile(targetId: string, tileIndex: number, cardId = activeCard?.instanceId) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card || card.kind !== 'rival') return;
    if (!emitAuthoritative('playRivalCard', { cardId: card.instanceId, targetId, tileIndex })) return;
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function equip(item: Loot) {
    emitAuthoritative('equip', { itemId: item.id });
  }

  function sellCard(cardId: string) {
    if (!emitAuthoritative('sellCard', { cardId })) return;
    setSelectedCardId(null);
    setDragCardId(null);
  }

  function sellLoot(itemId: string) {
    if (!emitAuthoritative('sellLoot', { itemId })) return;
    setDragLootId(null);
  }

  function buyShopOffer(offer: ShopOffer) {
    emitAuthoritative('buyShopOffer', { offerId: offer.id });
  }

  function activateHeroAbility() {
    emitAuthoritative('activateHeroAbility', {});
  }

  function chooseTrait(traitId: string) {
    emitAuthoritative('chooseTrait', { traitId });
  }

  function handleSellDrop(kind: 'card' | 'loot', id: string) {
    if (kind === 'card') sellCard(id);
    else sellLoot(id);
  }

  function handleCardPointerDrop(cardId: string, point: { x: number; y: number }) {
    const card = me?.hand.find((item) => item.instanceId === cardId) ?? null;
    if (!card) return;
    const target = document.elementFromPoint(point.x, point.y) as HTMLElement | null;
    const dropTarget = target?.closest<HTMLElement>('[data-loopduel-drop]');
    const dropKind = dropTarget?.dataset.loopduelDrop;
    if (!dropKind) return;
    if (dropKind === 'sell-zone') {
      sellCard(card.instanceId);
      return;
    }
    if (dropKind === 'terrain-tile' && card.kind === 'terrain') {
      const tileIndex = Number(dropTarget.dataset.tileIndex);
      const tile = me?.board.find((item) => item.index === tileIndex);
      if (tile) placeCard(tile, card.instanceId);
      return;
    }
    if (dropKind === 'rival-target') {
      const targetId = dropTarget.dataset.playerId;
      if (!targetId) return;
      if (card.kind === 'bonk') playBonk(targetId, card.instanceId);
      if (card.kind === 'rival') playRival(targetId, card.instanceId);
      return;
    }
    if (dropKind === 'rival-tile' && card.kind === 'rival') {
      const targetId = dropTarget.dataset.playerId;
      const tileIndex = Number(dropTarget.dataset.tileIndex);
      if (targetId && Number.isFinite(tileIndex)) playRivalOnTile(targetId, tileIndex, card.instanceId);
    }
  }

  function resetRoom() {
    if (!emitAuthoritative('resetRoom')) return;
    setSelectedCardId(null);
    setDragCardId(null);
    setDragLootId(null);
  }

  if (!config || !game) {
    return <div className="boot">Loopduel</div>;
  }

  if (!me && spectatorRoomId && game.id === spectatorRoomId) {
    return (
      <main className="game-shell spectator-shell">
        <GothicParallaxBackdrop player={game.players[0]} />
        {notice && <div className="notice-toast">{notice}</div>}
        {game.status !== 'finished' && <PhaseStrip game={game} />}
        <section className="spectator-bar">
          <div>
            <strong>Watching room {game.id}</strong>
            <span>{game.players.length}/{game.maxPlayers} runners · {game.tier.name} · tick {game.tick}</span>
          </div>
          <div className="spectator-actions">
            <button className="icon-action" onClick={() => copyInvite(game.id)}>
              <Share2 size={18} />
              Invite
            </button>
            <button className="primary-action" onClick={join}>
              <Play size={18} />
              Join
            </button>
          </div>
        </section>
        <section className="play-layout spectator-layout">
          <section className="arena-grid has-focus">
            {game.players.map((player, index) => (
              <PlayerPanel
                key={player.id}
                player={player}
                gameStatus={game.status}
                serverNow={game.now}
                receivedAt={game.receivedAt}
                rank={player.rank}
                active={false}
                isHost={false}
                focused={index === 0}
                selectedCard={null}
                draggingCard={null}
                rivalTargetCard={null}
                onFocus={() => undefined}
              />
            ))}
          </section>
          <aside className="spectator-feed">
            <strong>Leaderboard</strong>
            {game.leaderboard.map((entry) => (
              <span key={entry.id}>#{entry.rank} {entry.name} · {entry.score} pts · Lv {entry.level}</span>
            ))}
            <strong>Log</strong>
            {game.log.slice(0, 8).map((line) => <span key={line}>{line}</span>)}
          </aside>
        </section>
      </main>
    );
  }

  if (!me) {
    const selectedHero = config.heroes.find((hero) => hero.id === heroId) ?? config.heroes[0];
    return (
      <main className="lobby-shell title-screen">
        <GothicParallaxBackdrop />
        <section className="title-stage">
          <div className="title-copy">
            <span className="title-kicker">Retro gothic loop combat</span>
            <h1>Loopduel</h1>
            <p>Shape the road, outlast the boss loop, and break rival runners before the Tyrant answers.</p>
          </div>
          <aside className="title-hero-showcase" style={{ '--hero-color': selectedHero.color } as CSSProperties}>
            <span className="title-hero-frame">
              <img src={heroPortraitUrl(selectedHero.id)} alt="" />
              <span>{selectedHero.icon}</span>
            </span>
            <div>
              <small>Chosen runner</small>
              <strong>{selectedHero.name}</strong>
              <span>{selectedHero.title} · {statLine(selectedHero)}</span>
              <p>{selectedHero.text}</p>
            </div>
          </aside>
        </section>

        <section className="join-panel title-control-panel">
          <div className="name-row title-action-rail">
            <label className="title-field" htmlFor="player-name">
              <span>Handle</span>
              <input
                id="player-name"
                value={name}
                maxLength={20}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="title-field room-field" htmlFor="room-code">
              <span>Room</span>
              <input
                id="room-code"
                value={roomId}
                maxLength={20}
                onChange={(event) => setRoomId(event.target.value)}
              />
            </label>
            <button className="primary-action" onClick={join}>
              <Play size={18} />
              Enter
            </button>
            <button className="primary-action guide-action" onClick={startGuidedDuel}>
              <HelpCircle size={18} />
              Guided Duel
            </button>
            <div className="title-secondary-actions">
              <button className="icon-action" onClick={spectate}>
                <Eye size={18} />
                Watch
              </button>
              <button className="icon-action" onClick={() => copyInvite(roomId)}>
                <Share2 size={18} />
                Invite
              </button>
              <span className="join-qr" aria-label={`QR invite for room ${roomId}`}>
                <QRCodeSVG value={inviteUrl(roomId)} size={80} marginSize={1} />
              </span>
              <button className="icon-action" onClick={() => setShowHelp(true)}>
                <HelpCircle size={18} />
                Rules
              </button>
            </div>
          </div>
          <div className="profile-strip" aria-label="Local profile">
            <span><strong>{profile.matches}</strong> matches</span>
            <span><strong>{profile.wins}</strong> wins</span>
            <span><strong>{profile.bestScore}</strong> best</span>
            <span><strong>{profile.bestLevel}</strong> best level</span>
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
  const purgeTargetCard = activeCard?.kind === 'rival' && activeCard.id === 'oblivion' ? activeCard : null;
  const rivalTargetCard = activeCard?.kind === 'rival' && activeCard.id !== 'oblivion' ? activeCard : null;
  const bonkTargetCard = activeCard?.kind === 'bonk' ? activeCard : null;
  const highestScoreRival = game.players
    .filter((player) => player.id !== me.id)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    })[0] ?? null;
  const bonkTargets = bonkTargetCard?.targetMode === 'chosen'
    ? game.players.filter((player) => player.id !== me.id)
    : highestScoreRival ? [highestScoreRival] : [];
  const activeCardGuidance = activeCard ? activeCard.combo?.text ?? (
    activeCard.kind === 'terrain'
      ? 'Place it so the next lap reads clearly: a haven before a peril, an engine before a boss push, danger only with recovery nearby.'
      : activeCard.kind === 'bonk'
        ? 'Use it when a rival is one beat from payoff, a gate push, or a clean lead.'
        : activeCard.id === 'oblivion'
          ? 'Choose one of your own changed tiles. Clear the route before a bad combo or hazard keeps taxing every lap.'
        : 'Aim at a rival plan you can see: a payoff tile, a greedy road, or the leader about to cash out.'
  ) : '';
  const showOnboardingCoach = Boolean(
    game.onboarding?.enabled &&
    (!game.onboarding.playerId || game.onboarding.playerId === me.id)
  );

  return (
    <main className={`game-shell ${authorityPaused ? 'authority-paused' : ''}`}>
      <GothicParallaxBackdrop
        player={me}
        gameStatus={game.status}
        serverNow={game.now}
        receivedAt={game.receivedAt}
        authorityPaused={authorityPaused}
      />
      <audio ref={bgmRef} src="/assets/audio/crypt-of-neon-glass.m4a" preload="none" loop />
      {notice && <div className="notice-toast">{notice}</div>}
      {authorityPaused && (
        <section className="authority-pause" role="status" aria-live="polite">
          <strong>{authorityPauseTitle}</strong>
          <span>{authorityPauseDetail}</span>
        </section>
      )}

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
      {game.status === 'finished' && (
        <section className="match-summary">
          <div className="summary-board">
            {game.leaderboard.slice(0, 4).map((entry) => {
              const player = game.players.find((item) => item.id === entry.id);
              return (
                <article
                  className={`summary-card ${entry.id === game.winnerId ? 'winner' : ''}`}
                  key={entry.id}
                  style={{ '--hero-color': player?.color ?? '#d2b15c' } as CSSProperties}
                >
                  <span className="summary-rank">#{entry.rank}</span>
                  <strong>{entry.name}</strong>
                  <small>{entry.score} pts</small>
                  <div>
                    <span>Lv {entry.level}</span>
                    <span>{entry.laps} laps</span>
                    <span>{player?.kos ?? 0} KOs</span>
                    <span>{player?.rivalHits ?? 0} hits</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="summary-log">
            <strong>Final turns</strong>
            {game.log.slice(0, 4).map((line) => <span key={line}>{line}</span>)}
          </div>
        </section>
      )}
      {showOnboardingCoach && game.onboarding && (
        <OnboardingCoach
          onboarding={game.onboarding}
          player={me}
          config={config}
          activeCard={activeCard}
          onOpenRules={() => setShowHelp(true)}
        />
      )}

      <section className="play-layout">
        <section className={`arena-grid ${focusedPlayerId !== me.id ? 'has-focus' : ''}`}>
          {arrangedPlayers.map((player) => (
            <PlayerPanel
              key={player.id}
              player={player}
              gameStatus={game.status}
              serverNow={game.now}
              receivedAt={game.receivedAt}
              authorityPaused={authorityPaused}
              rank={player.rank}
              active={player.id === me.id}
              isHost={isHost}
              focused={player.id === focusedPlayerId}
              selectedCard={player.id === me.id ? activeCard : null}
              draggingCard={player.id === me.id ? activeCard : null}
              rivalTargetCard={player.id === me.id && purgeTargetCard
                ? purgeTargetCard
                : player.id !== me.id && (!bonkTargetCard || bonkTargetCard.targetMode === 'chosen' || player.id === highestScoreRival?.id)
                  ? rivalTargetCard ?? bonkTargetCard
                  : null}
              recommendedTileIndexes={player.id === me.id ? game.onboarding?.recommendedTileIndexes ?? [] : []}
              onTile={player.id === me.id ? placeCard : undefined}
              onRivalTarget={player.id !== me.id ? (cardId) => {
                const card = me.hand.find((item) => item.instanceId === cardId) ?? activeCard;
                if (card?.kind === 'bonk') playBonk(player.id, cardId);
                else playRival(player.id, cardId);
              } : undefined}
              onRivalTile={(player.id === me.id && purgeTargetCard) || (player.id !== me.id && rivalTargetCard)
                ? (tileIndex, cardId) => playRivalOnTile(player.id, tileIndex, cardId)
                : undefined}
              onStartRoom={startRoom}
              onActivateAbility={player.id === me.id ? activateHeroAbility : undefined}
              onFocus={() => focusBoard(player.id)}
            />
          ))}
        </section>
        <MobileRivalStrip
          players={bonkTargetCard ? bonkTargets : game.players.filter((player) => player.id !== me.id)}
          focusedId={focusedPlayerId}
          activeCard={rivalTargetCard ?? bonkTargetCard}
          onFocus={focusBoard}
          onTarget={(targetId) => bonkTargetCard ? playBonk(targetId) : playRival(targetId)}
        />
        <section className="control-dock">
          <RivalIntel
            players={game.players.filter((player) => player.id !== me.id)}
            focusedId={focusedPlayerId}
            onFocus={focusBoard}
          />
          <div className="mobile-tray-head">
            <button className="mobile-drawer-tab board-tab" onClick={() => setMobileDrawer(null)}>
              <Eye size={15} />
              Board
            </button>
            <button className="mobile-drawer-tab" onClick={() => setMobileDrawer((mode) => mode === 'loot' ? null : 'loot')}>
              <Shield size={15} />
              Gear
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
            onDragMove={setDragPoint}
            onDropAt={handleCardPointerDrop}
            onDragEnd={() => setDragCardId(null)}
          />
          <div className={`action-hint ${activeCard ? activeCard.kind : 'empty'}`} aria-hidden={!activeCard}>
            <strong>{activeCard ? `${activeCard.icon} ${activeCard.name}` : 'No card'}</strong>
            <span>{activeCard ? (activeCard.kind === 'terrain' ? 'choose a loop tile' : activeCard.kind === 'bonk' ? (activeCard.targetMode === 'chosen' ? 'choose who gets stunned' : 'bonks the leading rival') : activeCard.id === 'oblivion' ? 'choose your tile to purge' : 'choose a rival or road trap') : 'standing by'}</span>
          </div>
          {activeCard && (
            <div className="mobile-card-counsel" role="status" aria-live="polite">
              <strong>{activeCard.kind === 'terrain' ? 'Road counsel' : activeCard.kind === 'bonk' ? 'Timing counsel' : 'Rival counsel'}</strong>
              <span>{activeCard.text}</span>
              <small>{activeCardGuidance}</small>
            </div>
          )}
          {(rivalTargetCard || bonkTargetCard) && (
            <div className="target-row">
              <span className="target-label">{bonkTargetCard ? 'bonk' : 'strike'}</span>
              {(bonkTargetCard ? bonkTargets : game.players.filter((player) => player.id !== me.id)).map((target) => (
                <button
                  key={target.id}
                  className="target-chip"
                  data-loopduel-drop="rival-target"
                  data-player-id={target.id}
                  style={{ '--hero-color': target.color } as CSSProperties}
                  onClick={() => bonkTargetCard ? playBonk(target.id) : playRival(target.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'link';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const cardId = event.dataTransfer.getData('text/plain') || (rivalTargetCard ?? bonkTargetCard)?.instanceId;
                    if (bonkTargetCard) playBonk(target.id, cardId);
                    else playRival(target.id, cardId);
                  }}
                >
                  <img src={heroPortraitUrl(target.heroId)} alt={target.name} />
                  <InfoPopover
                    title={target.name}
                    eyebrow="Rival target"
                    body={`Lv ${target.level} · ${target.score} pts · ${Math.ceil(target.hp)}/${target.maxHp} HP`}
                    lines={[`${target.hand.length} cards`, `${target.loot.length} loot`, `${target.deaths} knockdowns`]}
                    hint={bonkTargetCard ? 'Drop a bonk card here' : 'Drop a rival card here'}
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
          onLootDragStart={(id, point) => {
            setDragLootId(id);
            setDragPoint(point);
          }}
          onLootDragEnd={() => setDragLootId(null)}
          draggingLootId={dragLootId}
          onMenu={() => setShowMenu(true)}
          isHost={isHost}
        />
        <button
          type="button"
          className={`shop-dock-toggle ${shopOpen ? 'open' : ''}`}
          onClick={() => {
            setHeroStatsOpen(false);
            setShopOpen((open) => !open);
          }}
          aria-label={shopOpen ? 'Close shop' : 'Open shop'}
          style={{ '--hero-color': me.color } as CSSProperties}
        >
          <ShoppingBag size={20} />
          <span>{me.gold ?? 0}g</span>
          <InfoPopover
            title="Loop Market"
            eyebrow={shopOpen ? 'Shop open' : 'Personal shop'}
            body="Opens the rotating shop beside your right dock."
          />
        </button>
        <button
          type="button"
          className={`hero-stats-toggle ${heroStatsOpen ? 'open' : ''}`}
          onClick={() => {
            setShopOpen(false);
            setHeroStatsOpen((open) => !open);
          }}
          aria-label={heroStatsOpen ? 'Close hero stats' : 'Open hero stats'}
          aria-expanded={heroStatsOpen}
          style={{ '--hero-color': me.color } as CSSProperties}
        >
          <Activity size={20} />
          <span>Stats</span>
          <InfoPopover
            title="Hero Stats"
            eyebrow={heroStatsOpen ? 'Stats open' : 'Build details'}
            body="Opens your hero stats and run details."
          />
        </button>
        <ShopDrawer
          open={shopOpen}
          player={me}
          onClose={() => setShopOpen(false)}
          onDrop={handleSellDrop}
          onBuy={buyShopOffer}
        />
        <HeroStatsDrawer
          open={heroStatsOpen}
          player={me}
          config={config}
          onClose={() => setHeroStatsOpen(false)}
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
          onLootDragStart={(id, point) => {
            setDragLootId(id);
            setDragPoint(point);
          }}
          onLootDragEnd={() => setDragLootId(null)}
          draggingLootId={dragLootId}
          onMenu={() => setShowMenu(true)}
          onAddBot={addBot}
          onFillCpu={fillCpu}
          onStartRoom={startRoom}
          isHost={isHost}
          onSettings={updateRoomSettings}
          profile={profile}
          bgmOn={bgmOn}
          onToggleBgm={() => setBgmOn((on) => !on)}
        />
      </section>
      <div className="drag-overlay-layer" aria-hidden="true">
        {draggedCard && <DragCardGhost card={draggedCard} x={dragPoint.x} y={dragPoint.y} />}
        {draggedLoot && <DragLootGhost item={draggedLoot} x={dragPoint.x} y={dragPoint.y} />}
      </div>
      <SellZone
        active={Boolean(dragCardId || dragLootId)}
        player={me}
        onDrop={handleSellDrop}
        onBuy={buyShopOffer}
      />
      {showHelp && <HelpOverlay config={config} onClose={() => setShowHelp(false)} />}
      {showTutorial && game.status !== 'finished' && (
        <section className="tutorial-overlay" role="dialog" aria-modal="true">
          <div className="tutorial-panel">
            <div className="tutorial-head">
              <div>
                <span>The Warden speaks</span>
                <strong>First Run</strong>
                <p>Learn the road by changing it. Loopduel is a race, a duel, and a bargain with the board.</p>
              </div>
              <button className="icon-action" onClick={closeTutorial}>Close</button>
            </div>
            <div className="tutorial-steps">
              <article>
                <span><Shield size={16} /></span>
                <strong>Shape the loop</strong>
                <p>Drop terrain onto your own road. Havens keep you alive; peril pays XP and loot when recovery is close.</p>
              </article>
              <article>
                <span><GitBranch size={16} /></span>
                <strong>Read combos</strong>
                <p>Some pairings can transform the road. Put engines, havens, and danger where the next lap stays readable.</p>
              </article>
              <article>
                <span><ScrollText size={16} /></span>
                <strong>Beware the Blood Moon</strong>
                <p>A Blood Moon tile makes nearby fights stack more enemies. Lean in for bigger rewards only when you have healing close.</p>
              </article>
              <article>
                <span><RotateCcw size={16} /></span>
                <strong>Purge with intent</strong>
                <p>Purge is a reset, not a panic button. Spend it to cut away a poisoned route before it snowballs.</p>
              </article>
              <article>
                <span><Crown size={16} /></span>
                <strong>Pay the boss ante</strong>
                <p>Act bosses and the Tyrant test the whole build. Wager only when your stats, gear, and road can answer.</p>
              </article>
              <article>
                <span><Sparkles size={16} /></span>
                <strong>Chase relic loot</strong>
                <p>Relics are the rarest loot tier — powerful passive gear. Equip them in the matching slot for a major stat boost.</p>
              </article>
            </div>
            <div className="tutorial-actions">
              <button className="icon-action" onClick={() => setShowHelp(true)}>
                <HelpCircle size={18} />
                Rules
              </button>
              <button className="primary-action" onClick={closeTutorial}>
                <Play size={18} />
                Continue
              </button>
            </div>
          </div>
        </section>
      )}
      {showMenu && (
        <GameMenu
          game={game}
          isHost={isHost}
          onAddBot={addBot}
          onFillCpu={fillCpu}
          onStartRoom={startRoom}
          onKickPlayer={kickPlayer}
          onSettings={updateRoomSettings}
          inviteUrl={inviteUrl(game.id)}
          profile={profile}
          bgmOn={bgmOn}
          onToggleBgm={() => setBgmOn((on) => !on)}
          onReset={() => { resetRoom(); setShowMenu(false); }}
          onRules={() => { setShowMenu(false); setShowHelp(true); }}
          onClose={() => setShowMenu(false)}
        />
      )}
    </main>
  );
}

export { App };
