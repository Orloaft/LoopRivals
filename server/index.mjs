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
  runRoomStep
} from './rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 4173);

const rooms = new Map();

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
  const room = getRoom(socket.data.roomId);
  const player = room.players[socket.data.playerId];
  return { room, player };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true }
  });

  if (isProduction) {
    app.use(express.static(path.join(root, 'dist')));
    app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root,
      server: { middlewareMode: true },
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
      const { room } = getSocketPlayer(socket);
      addBot(room);
      emitRoom(io, room);
    });

    socket.on('fillCpu', () => {
      const { room } = getSocketPlayer(socket);
      fillCpuOpponents(room);
      emitRoom(io, room);
    });

    socket.on('placeCard', ({ cardId, tileIndex } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playTerrain(room, player, cardId, Number(tileIndex));
      emitRoom(io, room);
    });

    socket.on('playRivalCard', ({ cardId, targetId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      playRival(room, player, cardId, targetId);
      emitRoom(io, room);
    });

    socket.on('equip', ({ itemId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      equip(player, itemId);
      emitRoom(io, room);
    });

    socket.on('chooseTrait', ({ traitId } = {}) => {
      const { room, player } = getSocketPlayer(socket);
      if (!player) return;
      chooseTrait(player, traitId);
      emitRoom(io, room);
    });

    socket.on('resetRoom', () => {
      const { room } = getSocketPlayer(socket);
      resetRoom(room);
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

  server.listen(port, '0.0.0.0', () => {
    console.log(`Loopduel listening on http://localhost:${port}`);
  });
}

await startServer();
