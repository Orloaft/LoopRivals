import type { Combat, GameState, LeaderboardEntry, MovementSegment, Player, RoomDelta, RoomEvent, Tile } from './types';

export type RoomProjectionResult = {
  state: GameState;
  appliedEvents: number;
  acceptedSeq: number;
  needsRecovery: boolean;
};

const combatBlockingTileTypes = new Set([
  'grove',
  'bloomgrove',
  'crypt',
  'wolfden',
  'bonepit',
  'ruinedkeep',
  'ransackedvillage',
  'bloodmoon',
  'wyrmgate',
  'embergate',
  'spidernest',
  'tollgate',
  'thornmaze',
  'graveyard',
  'dragonroost',
  'rootwall',
  'bramblebloom',
  'wardensheart',
  'oldgrowth',
  'guardstance',
  'markedchallenge',
  'retaliation',
  'executionstance',
  'seal1',
  'seal2',
  'seal3',
  'innergate',
  'ambush'
]);
function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function movementValue(value: unknown): MovementSegment | null {
  const movement = objectValue(value);
  if (!movement) return null;
  const fromCursor = numberValue(movement.fromCursor);
  const toCursor = numberValue(movement.toCursor);
  const departAt = numberValue(movement.departAt);
  const arriveAt = numberValue(movement.arriveAt);
  if (fromCursor === null || toCursor === null || departAt === null || arriveAt === null) return null;
  return { fromCursor, toCursor, departAt, arriveAt };
}

function tileValue(value: unknown): Tile | null {
  const tile = objectValue(value);
  if (!tile) return null;
  const index = numberValue(tile.index);
  const charges = numberValue(tile.charges);
  if (index === null || charges === null || !Array.isArray(tile.coord) || typeof tile.type !== 'string') return null;
  const coord: [number, number] = [
    numberValue(tile.coord[0]) ?? 0,
    numberValue(tile.coord[1]) ?? 0
  ];
  return {
    index,
    coord,
    type: tile.type,
    charges,
    expiresOnLap: numberValue(tile.expiresOnLap) ?? null,
    ...(stringValue(tile.bossPhaseId) ? { bossPhaseId: stringValue(tile.bossPhaseId) as string } : {}),
    ...(numberValue(tile.bossChunkIndex) !== null ? { bossChunkIndex: numberValue(tile.bossChunkIndex) as number } : {}),
    movementStopKind: tile.movementStopKind === 'combat' || tile.movementStopKind === 'none'
      ? tile.movementStopKind
      : combatBlockingTileTypes.has(tile.type)
        ? 'combat'
        : 'none',
    movementStopReason: typeof tile.movementStopReason === 'string'
      ? tile.movementStopReason
      : combatBlockingTileTypes.has(tile.type)
        ? 'combat'
        : null
  };
}

function boardValue(value: unknown): Tile[] | null {
  if (!Array.isArray(value)) return null;
  const board = value.map(tileValue);
  return board.every((tile): tile is Tile => Boolean(tile)) ? board : null;
}

function bossPhaseValue(value: unknown): Player['bossPhase'] | null {
  const phase = objectValue(value);
  if (!phase) return null;
  const id = stringValue(phase.id);
  const label = stringValue(phase.label);
  const tier = numberValue(phase.tier);
  if (!id || !label || tier === null || (phase.kind !== 'act' && phase.kind !== 'loop')) return null;
  const tileTypes = Array.isArray(phase.tileTypes)
    ? phase.tileTypes.filter((tileType): tileType is string => typeof tileType === 'string')
    : [];
  const tileIndexes = Array.isArray(phase.tileIndexes)
    ? phase.tileIndexes.map(numberValue).filter((index): index is number => index !== null)
    : [];
  const defeatedChunks = Array.isArray(phase.defeatedChunks)
    ? phase.defeatedChunks.map(numberValue).filter((index): index is number => index !== null)
    : [];
  return {
    id,
    kind: phase.kind,
    tier,
    nextTier: numberValue(phase.nextTier),
    label,
    tileTypes,
    threat: numberValue(phase.threat) ?? 0,
    reward: numberValue(phase.reward) ?? 0,
    enemyCount: numberValue(phase.enemyCount) ?? 1,
    armor: numberValue(phase.armor) ?? 0,
    totalChunks: numberValue(phase.totalChunks) ?? tileIndexes.length,
    remainingChunks: numberValue(phase.remainingChunks) ?? tileIndexes.length,
    defeatedChunks,
    tileIndexes,
    spawnedLap: numberValue(phase.spawnedLap) ?? 0
  };
}

function resetTile(tile: Tile): Tile {
  const { bossPhaseId, bossChunkIndex, ...rest } = tile;
  void bossPhaseId;
  void bossChunkIndex;
  return {
    ...rest,
    type: tile.index === 0 ? 'camp' : 'road',
    charges: 0,
    expiresOnLap: null,
    movementStopKind: 'none',
    movementStopReason: null
  };
}

function replacePlayer(state: GameState, playerId: string, updater: (player: Player) => Player) {
  state.players = state.players.map((player) => player.id === playerId ? updater(player) : player);
}

function refreshLeaderboard(state: GameState) {
  const ranked = [...state.players].sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.seatIndex - b.seatIndex;
  });
  const rankById = new Map(ranked.map((player, index) => [player.id, index + 1]));
  let rankChanged = false;
  const nextPlayers = state.players.map((player) => {
    const rank = rankById.get(player.id) ?? player.rank;
    if (player.rank === rank) return player;
    rankChanged = true;
    return { ...player, rank };
  });
  if (rankChanged) state.players = nextPlayers;

  const playersById = new Map(state.players.map((player) => [player.id, player]));
  state.leaderboard = ranked.map((player, index): LeaderboardEntry => {
    const rankedPlayer = playersById.get(player.id) ?? player;
    return {
      id: rankedPlayer.id,
      name: rankedPlayer.name,
      heroId: rankedPlayer.heroId,
      color: rankedPlayer.color,
      score: rankedPlayer.score,
      rank: index + 1,
      hp: rankedPlayer.hp,
      maxHp: rankedPlayer.maxHp,
      level: rankedPlayer.level,
      laps: rankedPlayer.laps
    };
  });
  state.winner = state.winnerId ? state.players.find((player) => player.id === state.winnerId) ?? null : null;
}

function applyPlayerProjection(player: Player, payload: Record<string, unknown>) {
  const hp = numberValue(payload.hp);
  const score = numberValue(payload.score);
  const level = numberValue(payload.level);
  const deaths = numberValue(payload.deaths);
  const laps = numberValue(payload.laps);
  const xp = numberValue(payload.xp);
  const gold = numberValue(payload.gold);
  const armor = numberValue(payload.armor);
  const curse = numberValue(payload.curse);
  const livesLeft = numberValue(payload.livesLeft);
  return {
    ...player,
    hp: hp ?? player.hp,
    score: score ?? player.score,
    level: level ?? player.level,
    deaths: deaths ?? player.deaths,
    livesLeft: livesLeft ?? player.livesLeft,
    laps: laps ?? player.laps,
    xp: xp ?? player.xp,
    gold: gold ?? player.gold,
    armor: armor ?? player.armor,
    curse: curse ?? player.curse
  };
}

function cursorForPlayerProjection(player: Player, position: number) {
  const boardLength = Math.max(1, player.board.length);
  return (player.laps ?? 0) * boardLength + position;
}

function movementSegmentForProjectionEvent(player: Player, movement: MovementSegment | null) {
  if (!player.combat || player.arrivalMovement !== null || !movement) return movement;
  const combatCursor = cursorForPlayerProjection(player, player.position);
  if (movement.toCursor <= combatCursor) return null;
  return movement;
}

function combatStartPosition(player: Player, payload: Record<string, unknown>) {
  const payloadPosition = numberValue(payload.position) ?? numberValue(payload.tileIndex);
  if (payloadPosition !== null) return payloadPosition;
  if (player.board[player.position]?.movementStopKind === 'combat') return player.position;

  const segments = [player.arrivalMovement, player.nextMovement].filter((segment): segment is MovementSegment => Boolean(segment));
  const boardLength = Math.max(1, player.board.length);
  for (const segment of segments) {
    const segmentPosition = Math.floor(segment.toCursor) % boardLength;
    if (player.board[segmentPosition]?.movementStopKind === 'combat') return segmentPosition;
  }

  return player.position;
}

function applyRoomEvent(state: GameState, event: RoomEvent) {
  const payload = objectValue(event.payload) ?? {};
  const playerId = stringValue(payload.playerId);

  state.tick = Math.max(state.tick, event.tick);
  state.now = Math.max(state.now, event.serverTime);

  if (event.type === 'roomStatusChanged') {
    const status = stringValue(payload.to);
    if (status === 'lobby' || status === 'running' || status === 'finished') state.status = status;
    return;
  }

  if (event.type === 'roomAuthorityPaused') {
    state.authority = {
      paused: true,
      reason: payload.reason === 'waiting-for-host' ? 'waiting-for-host' : null,
      startedAt: numberValue(payload.startedAt)
    };
    return;
  }

  if (event.type === 'roomAuthorityResumed') {
    state.authority = { paused: false, reason: null, startedAt: null };
    return;
  }

  if (event.type === 'matchFinished') {
    const winnerId = stringValue(payload.winnerId);
    state.status = 'finished';
    state.winnerId = winnerId;
    return;
  }

  if (event.type === 'playerRemoved' && playerId) {
    state.players = state.players.filter((player) => player.id !== playerId);
    if (state.hostId === playerId) state.hostId = stringValue(payload.hostId);
    return;
  }

  if (event.type === 'playerDisconnected' && playerId) {
    replacePlayer(state, playerId, (player) => ({ ...player, connected: false }));
    state.hostId = stringValue(payload.hostId) ?? state.hostId;
    return;
  }

  if (event.type === 'playerReconnected' && playerId) {
    replacePlayer(state, playerId, (player) => ({ ...player, connected: true }));
    return;
  }

  if (!playerId) return;

  if (event.type === 'movementSegment') {
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    replacePlayer(state, playerId, (player) => {
      const nextArrivalMovement = hasArrivalMovement
        ? movementSegmentForProjectionEvent(player, movementValue(payload.arrivalMovement))
        : player.arrivalMovement;
      return {
        ...player,
        nextMovement: hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
        arrivalMovement: nextArrivalMovement
      };
    });
    return;
  }

  if (event.type === 'tileResolved') {
    const position = numberValue(payload.position) ?? numberValue(payload.tileIndex);
    const eventText = stringValue(payload.event);
    const message = stringValue(payload.message);
    replacePlayer(state, playerId, (player) => {
      const projectedPlayer = applyPlayerProjection(player, payload);
      const nextPosition = position ?? projectedPlayer.position;
      const resolvedCursor = cursorForPlayerProjection(projectedPlayer, nextPosition);
      const arrivedMovement = projectedPlayer.nextMovement && projectedPlayer.nextMovement.toCursor <= resolvedCursor
        ? projectedPlayer.nextMovement
        : projectedPlayer.arrivalMovement;
      const nextMovement = projectedPlayer.nextMovement && projectedPlayer.nextMovement.toCursor <= resolvedCursor
        ? null
        : projectedPlayer.nextMovement;

      return {
        ...projectedPlayer,
        position: nextPosition,
        arrivalMovement: arrivedMovement,
        nextMovement,
        event: eventText ?? projectedPlayer.event,
        message: message ?? projectedPlayer.message,
        lastEventAt: event.serverTime
      };
    });
    return;
  }

  if (event.type === 'combatStarted') {
    const combat = objectValue(payload.combat) as Combat | null;
    replacePlayer(state, playerId, (player) => {
      const position = combatStartPosition(player, payload);
      const laps = numberValue(payload.laps) ?? player.laps;
      const resolvedCursor = cursorForPlayerProjection({ ...player, laps }, position);
      const nextMovement = player.nextMovement && player.nextMovement.toCursor <= resolvedCursor
        ? null
        : player.nextMovement;

      return {
        ...player,
        position,
        laps,
        arrivalMovement: null,
        nextMovement,
        combat: combat ?? player.combat,
        hp: numberValue(combat?.heroHpAfter) ?? player.hp,
        event: stringValue(payload.label) ?? player.event,
        lastEventAt: event.serverTime
      };
    });
    return;
  }

  if (event.type === 'combatEnded') {
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    replacePlayer(state, playerId, (player) => ({
      ...player,
      position: numberValue(payload.position) ?? numberValue(payload.tileIndex) ?? player.position,
      laps: numberValue(payload.laps) ?? player.laps,
      nextMovement: hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
      arrivalMovement: hasArrivalMovement ? movementValue(payload.arrivalMovement) : player.arrivalMovement,
      combat: null
    }));
    return;
  }

  if (event.type === 'playerStunned') {
    const stunnedUntil = numberValue(payload.stunnedUntil);
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    replacePlayer(state, playerId, (player) => ({
      ...player,
      position: numberValue(payload.position) ?? numberValue(payload.tileIndex) ?? player.position,
      laps: numberValue(payload.laps) ?? player.laps,
      nextMovement: hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
      arrivalMovement: hasArrivalMovement ? movementValue(payload.arrivalMovement) : player.arrivalMovement,
      stunnedUntil: stunnedUntil ?? player.stunnedUntil,
      stunnedBy: stringValue(payload.actorId) ?? player.stunnedBy,
      stunRemainingMs: stunnedUntil === null ? player.stunRemainingMs : Math.max(0, stunnedUntil - event.serverTime)
    }));
    return;
  }

  if (event.type === 'stunEnded') {
    replacePlayer(state, playerId, (player) => ({
      ...player,
      stunnedUntil: null,
      stunnedBy: null,
      stunRemainingMs: 0
    }));
    return;
  }

  if (event.type === 'playerEliminated') {
    replacePlayer(state, playerId, (player) => ({
      ...applyPlayerProjection(player, payload),
      eliminated: true,
      hp: 0,
      position: numberValue(payload.position) ?? player.position,
      laps: numberValue(payload.laps) ?? player.laps,
      nextMovement: null,
      arrivalMovement: null,
      combat: null
    }));
    return;
  }

  if (event.type === 'playerDefeated') {
    const board = boardValue(payload.board);
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    replacePlayer(state, playerId, (player) => ({
      ...applyPlayerProjection(player, payload),
      position: numberValue(payload.position) ?? numberValue(payload.tileIndex) ?? player.position,
      laps: numberValue(payload.laps) ?? player.laps,
      loopTier: numberValue(payload.loopTier) ?? player.loopTier,
      board: board ?? player.board,
      nextMovement: hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
      arrivalMovement: hasArrivalMovement ? movementValue(payload.arrivalMovement) : player.arrivalMovement,
      combat: null
    }));
    return;
  }

  if (event.type === 'playerTierChanged') {
    const board = boardValue(payload.board);
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    const hasCombat = hasOwn(payload, 'combat');
    replacePlayer(state, playerId, (player) => {
      const combat = hasCombat ? (objectValue(payload.combat) as Combat | null) : player.combat;
      return {
        ...applyPlayerProjection(player, payload),
        position: numberValue(payload.position) ?? numberValue(payload.tileIndex) ?? player.position,
        laps: numberValue(payload.laps) ?? player.laps,
        loopTier: numberValue(payload.loopTier) ?? numberValue(payload.to) ?? player.loopTier,
        board: board ?? player.board,
        nextMovement: combat ? null : hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
        arrivalMovement: combat ? null : hasArrivalMovement ? movementValue(payload.arrivalMovement) : player.arrivalMovement,
        combat
      };
    });
    return;
  }

  if (event.type === 'bossBoardReset') {
    const board = boardValue(payload.board);
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    replacePlayer(state, playerId, (player) => ({
      ...player,
      position: numberValue(payload.position) ?? player.position,
      laps: numberValue(payload.laps) ?? player.laps,
      board: board ?? player.board,
      nextMovement: hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
      arrivalMovement: hasArrivalMovement ? movementValue(payload.arrivalMovement) : player.arrivalMovement,
      combat: null
    }));
    return;
  }

  if (event.type === 'playerProjectionChanged') {
    replacePlayer(state, playerId, (player) => applyPlayerProjection(player, payload));
    return;
  }

  if (event.type === 'bossPhaseStarted' || event.type === 'bossPhaseChanged') {
    const bossPhase = bossPhaseValue(payload.bossPhase);
    if (!bossPhase) return;
    const board = boardValue(payload.board);
    const hasNextMovement = hasOwn(payload, 'nextMovement');
    const hasArrivalMovement = hasOwn(payload, 'arrivalMovement');
    replacePlayer(state, playerId, (player) => ({
      ...player,
      position: numberValue(payload.position) ?? player.position,
      laps: numberValue(payload.laps) ?? player.laps,
      board: board ?? player.board,
      nextMovement: hasNextMovement ? movementValue(payload.nextMovement) : player.nextMovement,
      arrivalMovement: hasArrivalMovement ? movementValue(payload.arrivalMovement) : player.arrivalMovement,
      bossPhase: bossPhase.remainingChunks > 0 ? bossPhase : null
    }));
    return;
  }

  if (event.type === 'lapCompleted') {
    const laps = numberValue(payload.laps) ?? numberValue(payload.to);
    replacePlayer(state, playerId, (player) => ({ ...player, laps: laps ?? player.laps }));
    return;
  }

  if (event.type === 'tilesExpired') {
    const lap = numberValue(payload.lap);
    replacePlayer(state, playerId, (player) => {
      const nextLaps = lap ?? player.laps;
      return {
        ...player,
        laps: nextLaps,
        board: player.board.map((tile) => (
          tile.type !== 'camp' && tile.type !== 'road' && tile.expiresOnLap !== null && tile.expiresOnLap !== undefined && nextLaps >= tile.expiresOnLap
            ? resetTile(tile)
            : tile
        ))
      };
    });
    return;
  }

  if (event.type === 'tileChanged') {
    const tileIndex = numberValue(payload.tileIndex);
    const tile = tileValue(payload.tile);
    if (tileIndex === null || !tile) return;
    replacePlayer(state, playerId, (player) => ({
      ...player,
      board: player.board.map((item) => item.index === tileIndex ? tile : item)
    }));
    return;
  }

  if (event.type === 'boardChanged') {
    const board = boardValue(payload.board);
    if (!board) return;
    replacePlayer(state, playerId, (player) => ({ ...player, board }));
    return;
  }

  if (event.type === 'lootGranted') {
    const item = objectValue(payload.item) as Player['loot'][number] | null;
    if (!item?.id) return;
    replacePlayer(state, playerId, (player) => ({
      ...player,
      loot: player.loot.some((loot) => loot.id === item.id) ? player.loot : [item, ...player.loot].slice(0, 10)
    }));
  }
}

function applyRoomEventClock(state: GameState, event: RoomEvent) {
  const serverTime = numberValue(event.serverTime);
  if (serverTime !== null) state.now = Math.max(state.now, serverTime);
  const tick = numberValue(event.tick);
  if (tick !== null) state.tick = Math.max(state.tick, tick);
}

export function applyRoomDelta(state: GameState, delta: RoomDelta, receivedAt = Date.now()): RoomProjectionResult {
  const currentSeq = state.runtime?.eventSeq ?? 0;
  if (delta.roomId !== state.id || delta.lastSeq <= currentSeq) {
    return { state, appliedEvents: 0, acceptedSeq: currentSeq, needsRecovery: false };
  }

  const pendingEvents = delta.events.filter((event) => event.seq > currentSeq).sort((a, b) => a.seq - b.seq);
  if (pendingEvents.length === 0) {
    return { state, appliedEvents: 0, acceptedSeq: currentSeq, needsRecovery: delta.lastSeq > currentSeq };
  }
  if (pendingEvents[0].seq !== currentSeq + 1) {
    return { state, appliedEvents: 0, acceptedSeq: currentSeq, needsRecovery: true };
  }

  const nextState: GameState = {
    ...state,
    players: state.players,
    leaderboard: state.leaderboard,
    log: state.log,
    runtime: {
      protocol: state.runtime?.protocol ?? 1,
      reason: 'delta',
      snapshotSeq: state.runtime?.snapshotSeq ?? 0,
      eventSeq: currentSeq,
      journalBaseSeq: state.runtime?.journalBaseSeq ?? currentSeq + 1,
      generatedAt: receivedAt
    },
    receivedAt
  };
  const runtime = nextState.runtime;
  if (!runtime) throw new Error('Room projection requires runtime sequencing');

  let appliedEvents = 0;
  for (const event of pendingEvents) {
    if (event.seq !== runtime.eventSeq + 1) {
      refreshLeaderboard(nextState);
      return {
        state: nextState,
        appliedEvents,
        acceptedSeq: runtime.eventSeq,
        needsRecovery: true
      };
    }
    applyRoomEventClock(nextState, event);
    applyRoomEvent(nextState, event);
    runtime.eventSeq = event.seq;
    runtime.generatedAt = receivedAt;
    appliedEvents += 1;
  }

  refreshLeaderboard(nextState);
  return {
    state: nextState,
    appliedEvents,
    acceptedSeq: runtime.eventSeq,
    needsRecovery: delta.lastSeq > runtime.eventSeq
  };
}
