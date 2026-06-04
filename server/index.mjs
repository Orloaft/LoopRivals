import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  addBot,
  chooseTrait,
  createRoom,
  disconnectPlayer,
  equip,
  fillCpuOpponents,
  joinRoom,
  playRival,
  playTerrain,
  publicConfig,
  resetRoom,
  roomSnapshot,
  runRoomStep,
  sellCard,
  sellLoot
} from './rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 4173);
const roomIdleTtlMs = Number(process.env.LOOPDUEL_ROOM_IDLE_TTL_MS ?? 30 * 60 * 1000);
const cleanupIntervalMs = Number(process.env.LOOPDUEL_ROOM_CLEANUP_INTERVAL_MS ?? 60 * 1000);

const rooms = new Map();

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
  if (!rooms.has(id)) rooms.set(id, createRoom(id));
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

function cleanupRooms(io) {
  const cutoff = Date.now() - roomIdleTtlMs;
  for (const [roomId, room] of rooms.entries()) {
    if (roomId === 'main') continue;
    if (hasConnectedHuman(room)) continue;
    if ((room.lastActivityAt ?? room.startedAt) > cutoff) continue;
    io.to(room.id).emit('notice', 'Room expired after being idle.');
    rooms.delete(roomId);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: corsOrigin }
  });

  app.get('/healthz', (_req, res) => {
    res.json({
      ok: true,
      rooms: rooms.size,
      players: [...rooms.values()].reduce((total, room) => total + Object.keys(room.players).length, 0),
      uptime: process.uptime()
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

    socket.on('join', ({ name, heroId, roomId, playerToken } = {}) => {
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
      emitRoom(io, room);
    });

    socket.on('addBot', () => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      addBot(room);
      emitRoom(io, room);
    });

    socket.on('fillCpu', () => {
      const { room, authorized } = requireHost(socket);
      if (!authorized) return;
      fillCpuOpponents(room);
      emitRoom(io, room);
    });

    socket.on('placeCard', ({ cardId, tileIndex } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playTerrain(room, player, cardId, Number(tileIndex));
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('playRivalCard', ({ cardId, targetId, tileIndex } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playRival(room, player, cardId, targetId, Number.isFinite(Number(tileIndex)) ? Number(tileIndex) : null);
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('sellCard', ({ cardId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      sellCard(room, player, cardId);
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('sellLoot', ({ itemId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      sellLoot(room, player, itemId);
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('equip', ({ itemId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      equip(player, itemId);
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('chooseTrait', ({ traitId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      chooseTrait(player, traitId);
      touchRoom(room);
      emitRoom(io, room);
    });

    socket.on('resetRoom', () => {
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
      emitRoom(io, room);
    });
  });

  setInterval(() => {
    for (const room of rooms.values()) {
      runRoomStep(room);
      emitRoom(io, room);
    }
  }, 260);

  setInterval(() => cleanupRooms(io), cleanupIntervalMs);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Loopduel listening on http://localhost:${port}`);
  });
}

await startServer();
