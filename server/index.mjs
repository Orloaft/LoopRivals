import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  addBot,
  buyShopOffer,
  chooseTrait,
  createRoom,
  disconnectPlayer,
  equip,
  fillCpuOpponents,
  joinRoom,
  kickPlayer,
  playBonk,
  playRival,
  playTerrain,
  publicConfig,
  resetRoom,
  restoreRoom,
  roomSnapshot,
  runRoomStep,
  sellCard,
  sellLoot,
  serializeRoom,
  startRoom,
  updateRoomSettings
} from './rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 4173);
const roomIdleTtlMs = Number(process.env.LOOPDUEL_ROOM_IDLE_TTL_MS ?? 30 * 60 * 1000);
const cleanupIntervalMs = Number(process.env.LOOPDUEL_ROOM_CLEANUP_INTERVAL_MS ?? 60 * 1000);
const socketActionLimit = Number(process.env.LOOPDUEL_SOCKET_ACTION_LIMIT ?? 36);
const socketActionWindowMs = Number(process.env.LOOPDUEL_SOCKET_ACTION_WINDOW_MS ?? 4000);
const persistencePath = process.env.LOOPDUEL_PERSISTENCE_PATH
  ? path.resolve(root, process.env.LOOPDUEL_PERSISTENCE_PATH)
  : null;
const persistenceFlushIntervalMs = Number(process.env.LOOPDUEL_PERSISTENCE_FLUSH_INTERVAL_MS ?? 2000);
const buildVersion = readPackageVersion();
const buildSha = process.env.LOOPDUEL_BUILD_SHA ?? process.env.GITHUB_SHA ?? null;

const rooms = new Map();
let persistenceDirty = false;
let lastPersistenceError = null;
let lastPersistenceSaveAt = null;

function readPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function logEvent(level, event, fields = {}) {
  console.log(JSON.stringify({
    level,
    event,
    service: 'loopduel',
    timestamp: new Date().toISOString(),
    ...fields
  }));
}

function loadPersistedRooms() {
  if (!persistencePath) return;

  try {
    if (!fs.existsSync(persistencePath)) return;
    const payload = JSON.parse(fs.readFileSync(persistencePath, 'utf8'));
    const savedRooms = Array.isArray(payload?.rooms) ? payload.rooms : [];
    let restored = 0;
    for (const snapshot of savedRooms) {
      const room = restoreRoom(snapshot, { markDisconnected: true });
      if (!room) continue;
      rooms.set(room.id, room);
      restored += 1;
    }
    logEvent('info', 'rooms_restored', { persistencePath, restored });
  } catch (error) {
    lastPersistenceError = error instanceof Error ? error.message : String(error);
    logEvent('error', 'rooms_restore_failed', { persistencePath, error: lastPersistenceError });
  }
}

function markPersistenceDirty() {
  if (persistencePath) persistenceDirty = true;
}

function savePersistedRooms({ force = false } = {}) {
  if (!persistencePath || (!force && !persistenceDirty)) return;

  try {
    fs.mkdirSync(path.dirname(persistencePath), { recursive: true });
    const payload = {
      version: 1,
      savedAt: Date.now(),
      rooms: [...rooms.values()].map((room) => serializeRoom(room))
    };
    const tempPath = `${persistencePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(payload)}\n`);
    fs.renameSync(tempPath, persistencePath);
    persistenceDirty = false;
    lastPersistenceError = null;
    lastPersistenceSaveAt = payload.savedAt;
  } catch (error) {
    lastPersistenceError = error instanceof Error ? error.message : String(error);
    logEvent('error', 'rooms_persist_failed', { persistencePath, error: lastPersistenceError });
  }
}

function parseAllowedOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(
  process.env.LOOPDUEL_ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? process.env.ORIGIN
);

function corsOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.length === 0) {
    callback(null, !isProduction);
    return;
  }

  callback(null, allowedOrigins.includes(origin));
}

function cleanRoomId(value) {
  const raw = String(value ?? 'main').trim().toLowerCase();
  return raw.replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'main';
}

function getRoom(roomId = 'main') {
  const id = cleanRoomId(roomId);
  if (!rooms.has(id)) {
    rooms.set(id, createRoom(id));
    markPersistenceDirty();
  }
  return rooms.get(id);
}

function emitRoom(io, room) {
  io.to(room.id).emit('state', roomSnapshot(room));
}

function getSocketPlayer(socket) {
  if (!socket.data.roomId || !socket.data.playerId) return { room: null, player: null };
  const room = getRoom(socket.data.roomId);
  const player = room.players[socket.data.playerId];
  return { room, player };
}

function touchRoom(room) {
  room.lastActivityAt = Date.now();
  markPersistenceDirty();
}

function hasConnectedHuman(room) {
  return Object.values(room.players).some((player) => !player.isBot && player.connected);
}

function requireHost(socket) {
  const { room, player } = getSocketPlayer(socket);
  if (!room || !player) {
    socket.emit('notice', 'Join a room before using room controls.');
    return { room: null, player: null, authorized: false };
  }

  if (room.hostId !== player.id) {
    socket.emit('notice', 'Only the room host can use that control.');
    return { room, player, authorized: false };
  }

  return { room, player, authorized: true };
}

function allowSocketAction(socket, eventName) {
  const nowMs = Date.now();
  const windowStartedAt = socket.data.actionWindowStartedAt ?? nowMs;
  if (nowMs - windowStartedAt > socketActionWindowMs) {
    socket.data.actionWindowStartedAt = nowMs;
    socket.data.actionCount = 1;
    return true;
  }

  socket.data.actionWindowStartedAt = windowStartedAt;
  socket.data.actionCount = (socket.data.actionCount ?? 0) + 1;
  if (socket.data.actionCount <= socketActionLimit) return true;

  if (!socket.data.rateLimitNoticeAt || nowMs - socket.data.rateLimitNoticeAt > socketActionWindowMs) {
    socket.data.rateLimitNoticeAt = nowMs;
    socket.emit('notice', 'Slow down a moment; the room is catching up.');
    logEvent('warn', 'socket_rate_limited', {
      eventName,
      socketId: socket.id,
      roomId: socket.data.roomId ?? null,
      playerId: socket.data.playerId ?? null
    });
  }
  return false;
}

function onPlayerAction(socket, eventName, handler) {
  socket.on(eventName, (payload = {}) => {
    if (!allowSocketAction(socket, eventName)) return;
    handler(payload);
  });
}

function cleanupRooms(io) {
  const cutoff = Date.now() - roomIdleTtlMs;
  for (const [roomId, room] of rooms.entries()) {
    if (roomId === 'main') continue;
    if (hasConnectedHuman(room)) continue;
    if ((room.lastActivityAt ?? room.startedAt) > cutoff) continue;
    io.to(room.id).emit('notice', 'Room expired after being idle.');
    rooms.delete(roomId);
    markPersistenceDirty();
  }
}

async function startServer() {
  loadPersistedRooms();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: corsOrigin }
  });

  app.get('/healthz', (_req, res) => {
    const playerCount = [...rooms.values()].reduce((total, room) => total + Object.keys(room.players).length, 0);
    res.json({
      ok: true,
      version: buildVersion,
      buildSha,
      env: process.env.NODE_ENV ?? 'development',
      rooms: rooms.size,
      players: playerCount,
      uptime: process.uptime(),
      limits: {
        socketActionLimit,
        socketActionWindowMs,
        roomIdleTtlMs
      },
      persistence: {
        enabled: Boolean(persistencePath),
        lastSaveAt: lastPersistenceSaveAt,
        lastError: lastPersistenceError
      }
    });
  });

  if (isProduction) {
    app.use(express.static(path.join(root, 'dist')));
    app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const hmrPort = Number(process.env.LOOPDUEL_VITE_HMR_PORT);
    const vite = await createServer({
      root,
      server: {
        middlewareMode: true,
        hmr: Number.isFinite(hmrPort) && hmrPort > 0 ? { port: hmrPort } : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  io.on('connection', (socket) => {
    socket.emit('config', publicConfig());
    socket.emit('state', roomSnapshot(getRoom('main')));

    onPlayerAction(socket, 'spectate', ({ roomId } = {}) => {
      const room = getRoom(roomId);
      if (socket.data.roomId && socket.data.roomId !== room.id) socket.leave(socket.data.roomId);
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.playerId = null;
      socket.emit('state', roomSnapshot(room));
      socket.emit('notice', `Watching room ${room.id}.`);
    });

    onPlayerAction(socket, 'join', ({ name, heroId, roomId, playerToken } = {}) => {
      const room = getRoom(roomId);
      const playerId = String(playerToken || crypto.randomUUID());
      const result = joinRoom(room, { playerId, name, heroId });

      if (result.full) {
        socket.emit('notice', 'Room is full. Try another room code.');
        return;
      }

      if (socket.data.roomId && socket.data.roomId !== room.id) {
        socket.leave(socket.data.roomId);
      }
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.playerId = playerId;
      socket.emit('session', { playerToken: playerId, roomId: room.id });
      markPersistenceDirty();
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'addBot', () => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      addBot(room);
      markPersistenceDirty();
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'fillCpu', () => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      fillCpuOpponents(room);
      markPersistenceDirty();
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'startRoom', () => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      if (startRoom(room)) {
        markPersistenceDirty();
        emitRoom(io, room);
      }
    });

    onPlayerAction(socket, 'updateRoomSettings', (settings = {}) => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      if (updateRoomSettings(room, settings)) {
        markPersistenceDirty();
        emitRoom(io, room);
      }
    });

    onPlayerAction(socket, 'kickPlayer', ({ targetId } = {}) => {
      const { room, player, authorized } = requireHost(socket);
      if (!authorized) return;
      if (String(targetId) === player.id) {
        socket.emit('notice', 'The host cannot kick themselves.');
        return;
      }
      if (kickPlayer(room, String(targetId))) {
        markPersistenceDirty();
        emitRoom(io, room);
      }
    });

    onPlayerAction(socket, 'placeCard', ({ cardId, tileIndex } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playTerrain(room, player, cardId, Number(tileIndex));
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'playRivalCard', ({ cardId, targetId, tileIndex } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playRival(room, player, cardId, targetId, Number.isFinite(Number(tileIndex)) ? Number(tileIndex) : null);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'playBonkCard', ({ cardId, targetId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playBonk(room, player, cardId, targetId);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'sellCard', ({ cardId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      sellCard(room, player, cardId);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'sellLoot', ({ itemId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      sellLoot(room, player, itemId);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'buyShopOffer', ({ offerId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      buyShopOffer(room, player, offerId);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'equip', ({ itemId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      equip(player, itemId);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'chooseTrait', ({ traitId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      chooseTrait(player, traitId);
      touchRoom(room);
      emitRoom(io, room);
    });

    onPlayerAction(socket, 'resetRoom', () => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      resetRoom(room);
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('disconnect', () => {
      if (!socket.data.playerId) return;
      const room = getRoom(socket.data.roomId);
      disconnectPlayer(room, socket.data.playerId);
      markPersistenceDirty();
      emitRoom(io, room);
    });
  });

  setInterval(() => {
    for (const room of rooms.values()) {
      runRoomStep(room);
      emitRoom(io, room);
    }
    if (rooms.size > 0) markPersistenceDirty();
  }, 260);

  setInterval(() => cleanupRooms(io), cleanupIntervalMs);
  setInterval(() => savePersistedRooms(), persistenceFlushIntervalMs);

  process.once('SIGTERM', () => {
    savePersistedRooms({ force: true });
    process.exit(0);
  });

  process.once('SIGINT', () => {
    savePersistedRooms({ force: true });
    process.exit(0);
  });

  server.listen(port, '0.0.0.0', () => {
    logEvent('info', 'server_listening', {
      url: `http://localhost:${port}`,
      env: process.env.NODE_ENV ?? 'development',
      version: buildVersion,
      buildSha
    });
  });
}

await startServer();
