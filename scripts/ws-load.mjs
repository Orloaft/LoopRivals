#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { io } from 'socket.io-client';

const heroIds = ['ember-knight', 'moss-warden', 'night-vagrant', 'rune-archer'];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const body = arg.replace(/^--/, '');
    const equalsAt = body.indexOf('=');
    const key = equalsAt === -1 ? body : body.slice(0, equalsAt);
    const value = equalsAt === -1 ? 'true' : body.slice(equalsAt + 1);
    return [key, value];
  })
);

const rooms = Number(args.get('rooms') ?? 8);
const playersPerRoom = Number(args.get('players') ?? 4);
const durationMs = Number(args.get('duration-ms') ?? 20_000);
const actionIntervalMs = Number(args.get('action-interval-ms') ?? 450);
const maxLiveIntervalMs = Number(args.get('max-live-interval-ms') ?? 3_200);
const expectedTickMs = Number(args.get('expected-tick-ms') ?? process.env.LOOPDUEL_EXPECTED_TICK_MS ?? 260);
const serverNodeEnv = String(args.get('node-env') ?? 'production');
const port = Number(args.get('port') ?? 45_000 + Math.floor(Math.random() * 10_000));
const url = `http://127.0.0.1:${port}`;
const serverEnvOverrides = parseServerEnv(args.get('server-env'));

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
const statePayloadBytes = [];
const deltaPayloadBytes = [];
const deltaEventCounts = [];
const socketEventVolumes = new Map();
const deltaEventsByType = new Map();
let stateUpdates = 0;
let stateBytes = 0;
let deltaUpdates = 0;
let deltaBytes = 0;

function parseServerEnv(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((env, entry) => {
      const equalsAt = entry.indexOf('=');
      if (equalsAt <= 0) return env;
      env[entry.slice(0, equalsAt)] = entry.slice(equalsAt + 1);
      return env;
    }, {});
}

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function ratioPercent(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100, 1) : 0;
}

function payloadByteLength(payload) {
  return Buffer.byteLength(JSON.stringify(payload));
}

function byteSummary(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    samples: values.length,
    totalBytes: total,
    totalMegabytes: round(total / 1024 / 1024, 3),
    avgBytes: Math.round(average(values)),
    p50Bytes: percentile(values, 0.5),
    p95Bytes: percentile(values, 0.95),
    p99Bytes: percentile(values, 0.99),
    maxBytes: values.length > 0 ? Math.max(...values) : 0
  };
}

function countSummary(values) {
  return {
    samples: values.length,
    total: values.reduce((sum, value) => sum + value, 0),
    avg: round(average(values), 2),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: values.length > 0 ? Math.max(...values) : 0
  };
}

function recordSocketVolume(eventName, bytes) {
  const current = socketEventVolumes.get(eventName) ?? { eventName, count: 0, bytes: 0 };
  current.count += 1;
  current.bytes += bytes;
  socketEventVolumes.set(eventName, current);
}

function reportableEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key === 'NODE_ENV' || key === 'PORT' || key.startsWith('LOOPDUEL_'))
      .sort(([a], [b]) => a.localeCompare(b))
  );
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

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function numberValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value) {
  return typeof value === 'string' ? value : null;
}

function movementCursor(value) {
  const movement = objectValue(value);
  return numberValue(movement?.toCursor);
}

function recordRoomPosition(roomId, playerId, cursor, laps = null) {
  if (!playerId || cursor === null) return;
  const positionSet = roomPositions.get(roomId) ?? new Set();
  positionSet.add(`${playerId}:${Number(cursor).toFixed(3)}:${laps ?? ''}`);
  roomPositions.set(roomId, positionSet);
}

function recordLiveUpdate(client, now) {
  if (client.lastLiveAt) updateIntervals.push(now - client.lastLiveAt);
  client.lastLiveAt = now;

  if (client.pendingActionAt) {
    actionLatencies.push(now - client.pendingActionAt);
    client.pendingActionAt = 0;
  }
}

function recordState(client, state) {
  const now = Date.now();
  const bytes = payloadByteLength(state);
  recordLiveUpdate(client, now);
  client.lastStateAt = now;
  client.latestState = state;
  stateUpdates += 1;
  stateBytes += bytes;
  statePayloadBytes.push(bytes);
  recordSocketVolume('state', bytes);

  roomTicks.set(state.id, Math.max(roomTicks.get(state.id) ?? 0, state.tick));
  roomStatuses.set(state.id, state.status);
  if (state.players.length === playersPerRoom) roomsSeenFull.add(state.id);

  const positionSet = roomPositions.get(state.id) ?? new Set();
  for (const player of state.players) positionSet.add(roomPositionKey(player));
  roomPositions.set(state.id, positionSet);
}

function recordDeltaRoomFacts(delta) {
  const roomId = delta.roomId;
  for (const event of delta.events ?? []) {
    const eventRoomId = event.roomId ?? roomId;
    roomTicks.set(eventRoomId, Math.max(roomTicks.get(eventRoomId) ?? 0, event.tick ?? 0));

    const payload = objectValue(event.payload) ?? {};
    if (event.type === 'roomStatusChanged') {
      roomStatuses.set(eventRoomId, stringValue(payload.to) ?? roomStatuses.get(eventRoomId));
    } else if (event.type === 'matchFinished') {
      roomStatuses.set(eventRoomId, 'finished');
    }

    const playerId = stringValue(payload.playerId);
    const laps = numberValue(payload.laps);
    const cursors = [
      numberValue(payload.position),
      numberValue(payload.tileIndex),
      movementCursor(payload.nextMovement),
      movementCursor(payload.arrivalMovement)
    ].filter((cursor) => cursor !== null);
    for (const cursor of cursors) recordRoomPosition(eventRoomId, playerId, cursor, laps);
  }
}

function recordDelta(client, delta) {
  const now = Date.now();
  const bytes = payloadByteLength(delta);
  const eventCount = Array.isArray(delta.events) ? delta.events.length : 0;
  recordLiveUpdate(client, now);
  client.lastEventSeq = Math.max(client.lastEventSeq ?? 0, delta.lastSeq ?? 0);
  deltaUpdates += 1;
  deltaBytes += bytes;
  deltaPayloadBytes.push(bytes);
  deltaEventCounts.push(eventCount);
  recordSocketVolume('room:delta', bytes);
  for (const event of delta.events ?? []) {
    deltaEventsByType.set(event.type, (deltaEventsByType.get(event.type) ?? 0) + 1);
  }
  recordDeltaRoomFacts(delta);
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
  socket.lastLiveAt = 0;
  socket.lastEventSeq = 0;
  socket.pendingActionAt = 0;

  socket.on('state', (state) => recordState(socket, state));
  socket.on('room:delta', (delta) => recordDelta(socket, delta));
  socket.on('notice', (notice) => {
    recordSocketVolume('notice', payloadByteLength(notice));
    notices.push({ roomId, playerToken, notice });
  });

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

  const serverEnv = {
    ...process.env,
    NODE_ENV: serverNodeEnv,
    PORT: String(port),
    ...serverEnvOverrides
  };

  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: serverEnv,
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
      if (!finished && (roomTicks.get(roomId) ?? 0) < Math.floor((durationMs / expectedTickMs) * 0.55)) failures.push(`${roomId} ticked too slowly`);
      if ((roomPositions.get(roomId)?.size ?? 0) < playersPerRoom * 3) failures.push(`${roomId} did not show enough player movement`);
    }

    if (notices.length > 0) failures.push(`${notices.length} server notices were emitted`);
    if (percentile(actionLatencies, 0.95) > 700) failures.push(`p95 action-to-state latency exceeded 700ms`);
    if (percentile(updateIntervals, 0.99) > maxLiveIntervalMs) {
      failures.push(`p99 live update interval exceeded ${maxLiveIntervalMs}ms`);
    }

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    const liveUpdates = stateUpdates + deltaUpdates;
    const broadcastBytes = stateBytes + deltaBytes;
    const report = {
      rooms,
      clients: clients.length,
      durationMs,
      cadence: {
        expectedTickMs,
        actionIntervalMs,
        maxLiveIntervalMs
      },
      server: {
        url,
        port,
        env: reportableEnv(serverEnv)
      },
      maxLiveIntervalMs,
      stateUpdates,
      deltaUpdates,
      liveUpdates,
      stateUpdatesPerSecond: Number((stateUpdates / elapsedSeconds).toFixed(1)),
      deltaUpdatesPerSecond: Number((deltaUpdates / elapsedSeconds).toFixed(1)),
      liveUpdatesPerSecond: Number((liveUpdates / elapsedSeconds).toFixed(1)),
      broadcastMegabytes: Number((broadcastBytes / 1024 / 1024).toFixed(2)),
      stateMegabytes: Number((stateBytes / 1024 / 1024).toFixed(2)),
      deltaMegabytes: Number((deltaBytes / 1024 / 1024).toFixed(2)),
      stateVsDelta: {
        updates: {
          state: stateUpdates,
          delta: deltaUpdates,
          total: liveUpdates,
          statePercent: ratioPercent(stateUpdates, liveUpdates),
          deltaPercent: ratioPercent(deltaUpdates, liveUpdates)
        },
        bytes: {
          state: stateBytes,
          delta: deltaBytes,
          total: broadcastBytes,
          statePercent: ratioPercent(stateBytes, broadcastBytes),
          deltaPercent: ratioPercent(deltaBytes, broadcastBytes)
        },
        payloadBytes: {
          state: byteSummary(statePayloadBytes),
          delta: byteSummary(deltaPayloadBytes)
        }
      },
      deltaEvents: {
        perDelta: countSummary(deltaEventCounts),
        byType: Object.fromEntries([...deltaEventsByType.entries()].sort((a, b) => b[1] - a[1]))
      },
      socketEvents: [...socketEventVolumes.values()]
        .map((event) => ({
          ...event,
          megabytes: round(event.bytes / 1024 / 1024, 3)
        }))
        .sort((a, b) => b.bytes - a.bytes),
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
      liveIntervalMs: {
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
