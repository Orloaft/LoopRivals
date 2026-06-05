#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { io } from 'socket.io-client';

const heroIds = ['ember-knight', 'moss-warden', 'night-vagrant', 'rune-archer'];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const rooms = Number(args.get('rooms') ?? 8);
const playersPerRoom = Number(args.get('players') ?? 4);
const durationMs = Number(args.get('duration-ms') ?? 20_000);
const actionIntervalMs = Number(args.get('action-interval-ms') ?? 450);
const port = Number(args.get('port') ?? 45_000 + Math.floor(Math.random() * 10_000));
const url = `http://127.0.0.1:${port}`;

const startedAt = Date.now();
const roomsSeenFull = new Set();
const roomTicks = new Map();
const roomStatuses = new Map();
const roomPositions = new Map();
const notices = [];
const failures = [];
const updateIntervals = [];
const actionLatencies = [];
const connectLatencies = [];
const sessionLatencies = [];
let stateUpdates = 0;
let stateBytes = 0;

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(server) {
  server.stdout.on('data', (data) => process.stdout.write(data.toString()));
  server.stderr.on('data', (data) => process.stderr.write(data.toString()));

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`server exited early with code ${server.exitCode}`);
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) return;
    } catch {
      // Keep polling while the production server starts.
    }
    await wait(200);
  }
  throw new Error('server did not start within 15s');
}

function roomPositionKey(player) {
  return `${player.id}:${player.position}:${player.laps}`;
}

function recordState(client, state) {
  const now = Date.now();
  if (client.lastStateAt) updateIntervals.push(now - client.lastStateAt);
  client.lastStateAt = now;
  client.latestState = state;
  stateUpdates += 1;
  stateBytes += Buffer.byteLength(JSON.stringify(state));

  if (client.pendingActionAt) {
    actionLatencies.push(now - client.pendingActionAt);
    client.pendingActionAt = 0;
  }

  roomTicks.set(state.id, Math.max(roomTicks.get(state.id) ?? 0, state.tick));
  roomStatuses.set(state.id, state.status);
  if (state.players.length === playersPerRoom) roomsSeenFull.add(state.id);

  const positionSet = roomPositions.get(state.id) ?? new Set();
  for (const player of state.players) positionSet.add(roomPositionKey(player));
  roomPositions.set(state.id, positionSet);
}

function chooseAction(client) {
  const state = client.latestState;
  if (!state || state.status !== 'running') return null;
  const me = state.players.find((player) => player.id === client.playerToken);
  if (!me) return null;

  if (me.pendingTraits.length > 0) {
    return ['chooseTrait', { traitId: me.pendingTraits[0] }];
  }

  if (me.loot.length > 0 && Math.random() < 0.18) {
    return ['equip', { itemId: me.loot[0].id }];
  }

  const rival = me.hand.find((card) => card.kind === 'rival');
  const targets = state.players.filter((player) => player.id !== me.id);
  if (rival && targets.length > 0 && Math.random() < 0.42) {
    return ['playRivalCard', { cardId: rival.instanceId, targetId: targets[Math.floor(Math.random() * targets.length)].id }];
  }

  const terrain = me.hand.find((card) => card.kind === 'terrain');
  if (terrain) {
    const candidates = me.board.filter((tile) => tile.type !== 'camp');
    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    return ['placeCard', { cardId: terrain.instanceId, tileIndex: tile.index }];
  }

  return null;
}

async function connectClient(roomIndex, playerIndex) {
  const roomId = `load-${roomIndex}`;
  const playerToken = `${roomId}-p${playerIndex}`;
  const connectStartedAt = Date.now();
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    timeout: 8_000
  });

  socket.playerToken = playerToken;
  socket.latestState = null;
  socket.lastStateAt = 0;
  socket.pendingActionAt = 0;

  socket.on('state', (state) => recordState(socket, state));
  socket.on('notice', (notice) => notices.push({ roomId, playerToken, notice }));

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`connect timeout for ${playerToken}`)), 10_000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      connectLatencies.push(Date.now() - connectStartedAt);
      resolve();
    });
    socket.once('connect_error', reject);
  });

  const sessionStartedAt = Date.now();
  socket.emit('join', {
    name: `Load ${roomIndex}-${playerIndex}`,
    heroId: heroIds[playerIndex % heroIds.length],
    roomId,
    playerToken
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`session timeout for ${playerToken}`)), 10_000);
    socket.once('session', () => {
      clearTimeout(timeout);
      sessionLatencies.push(Date.now() - sessionStartedAt);
      resolve();
    });
  });

  return socket;
}

async function main() {
  console.log(`Starting Loopduel WebSocket load test: ${rooms} rooms x ${playersPerRoom} players, ${durationMs}ms, action every ${actionIntervalMs}ms/client`);

  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const clients = [];
    for (let roomIndex = 0; roomIndex < rooms; roomIndex += 1) {
      for (let playerIndex = 0; playerIndex < playersPerRoom; playerIndex += 1) {
        clients.push(await connectClient(roomIndex, playerIndex));
      }
    }
    for (let roomIndex = 0; roomIndex < rooms; roomIndex += 1) {
      clients.find((client) => client.playerToken === `load-${roomIndex}-p0`)?.emit('startRoom');
    }

    const actionTimer = setInterval(() => {
      for (const client of clients) {
        if (client.pendingActionAt) continue;
        const action = chooseAction(client);
        if (!action) continue;
        client.pendingActionAt = Date.now();
        client.emit(action[0], action[1]);
      }
    }, actionIntervalMs);

    await wait(durationMs);
    clearInterval(actionTimer);

    for (const client of clients) client.disconnect();

    const expectedRooms = new Set(Array.from({ length: rooms }, (_, index) => `load-${index}`));
    for (const roomId of expectedRooms) {
      const finished = roomStatuses.get(roomId) === 'finished';
      if (!roomsSeenFull.has(roomId)) failures.push(`${roomId} never reported ${playersPerRoom} players`);
      if (!finished && (roomTicks.get(roomId) ?? 0) < Math.floor((durationMs / 260) * 0.55)) failures.push(`${roomId} ticked too slowly`);
      if ((roomPositions.get(roomId)?.size ?? 0) < playersPerRoom * 3) failures.push(`${roomId} did not show enough player movement`);
    }

    if (notices.length > 0) failures.push(`${notices.length} server notices were emitted`);
    if (percentile(actionLatencies, 0.95) > 700) failures.push(`p95 action-to-state latency exceeded 700ms`);
    if (percentile(updateIntervals, 0.99) > 1_200) failures.push(`p99 state update interval exceeded 1200ms`);

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    const report = {
      rooms,
      clients: clients.length,
      durationMs,
      stateUpdates,
      stateUpdatesPerSecond: Number((stateUpdates / elapsedSeconds).toFixed(1)),
      broadcastMegabytes: Number((stateBytes / 1024 / 1024).toFixed(2)),
      connectMs: {
        avg: Math.round(average(connectLatencies)),
        p95: percentile(connectLatencies, 0.95),
        max: Math.max(...connectLatencies)
      },
      sessionMs: {
        avg: Math.round(average(sessionLatencies)),
        p95: percentile(sessionLatencies, 0.95),
        max: Math.max(...sessionLatencies)
      },
      stateIntervalMs: {
        avg: Math.round(average(updateIntervals)),
        p95: percentile(updateIntervals, 0.95),
        p99: percentile(updateIntervals, 0.99),
        max: Math.max(...updateIntervals)
      },
      actionToStateMs: {
        samples: actionLatencies.length,
        avg: Math.round(average(actionLatencies)),
        p95: percentile(actionLatencies, 0.95),
        p99: percentile(actionLatencies, 0.99),
        max: Math.max(...actionLatencies)
      },
      roomsFull: roomsSeenFull.size,
      roomsFinished: Array.from(roomStatuses.values()).filter((status) => status === 'finished').length,
      failures
    };

    console.log(JSON.stringify(report, null, 2));
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
