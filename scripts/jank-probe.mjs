/* global document, window */
// Frame-consistency probe: record EVERY rAF gap over a long in-match stretch
// with per-frame UI-state flags (combat overlay up, beat active, floaters,
// animation count), then report tail percentiles and what state the worst
// spikes occurred in / transitioned into. Combat is forced (dangerous terrain
// placed every 5s) so the sample always exercises the expensive path.
//
// Stdout is a single JSON report; jank-gate.mjs consumes it and asserts
// budgets. Env knobs: PROBE_QUALITY (high|low), PROBE_SAMPLE_MS, PROBE_CPU
// (CDP throttle rate), PROBE_GL (swiftshader|none), PROBE_INJECT_CSS.
// Methodology + measured history: docs/frame-consistency-appraisal.md.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { io } from 'socket.io-client';
import { findPlaceableTerrainTile } from '../server/rules.mjs';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4700 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;
const roomCode = `jankc-${Date.now().toString(36)}`;
const sampleMs = Number(process.env.PROBE_SAMPLE_MS ?? 60_000);
const probeQuality = process.env.PROBE_QUALITY ?? 'high';
const useGl = (process.env.PROBE_GL ?? 'swiftshader') === 'swiftshader';
const cpuRate = Number(process.env.PROBE_CPU ?? 1);
const injectCss = process.env.PROBE_INJECT_CSS ?? '';

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1))];
}

function startServer() {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  server.stdout.on('data', (c) => { output += c.toString(); });
  server.stderr.on('data', (c) => { output += c.toString(); });
  return { server, output: () => output };
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch { /* warming */ }
    await delay(250);
  }
  throw new Error('server never became healthy');
}

function createSocketClient({ name, playerToken, heroId }) {
  const client = {
    playerToken,
    latestState: null,
    socket: io(baseUrl, { transports: ['websocket'], reconnection: false, forceNew: true, timeout: 8000 })
  };
  client.socket.on('state', (state) => { client.latestState = state; });
  client.ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`connect timeout ${playerToken}`)), 10_000);
    client.socket.once('connect', () => {
      client.socket.emit('join', { roomId: roomCode, name, heroId, playerToken }, (ack) => {
        clearTimeout(timeout);
        if (!ack?.accepted) reject(new Error(`join rejected: ${JSON.stringify(ack)}`));
        else resolve(client);
      });
    });
    client.socket.once('connect_error', reject);
  });
  return client;
}

const serverInfo = startServer();
let browser;
const sockets = [];

try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: useGl ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'] : []
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(baseUrl);
  await page.evaluate((quality) => {
    localStorage.clear();
    localStorage.setItem('loopduel.tutorialSeen', 'yes');
    localStorage.setItem('loopduel.smoothnessDebug', '1');
    if (quality) localStorage.setItem('loopduel.quality', quality);
  }, probeQuality);
  await page.reload();
  await page.fill('#player-name', 'Jank Probe');
  await page.fill('#room-code', roomCode);
  await page.click('.primary-action');
  await page.waitForSelector('.game-shell');
  const pageToken = await page.evaluate(() => localStorage.getItem('loopduel.playerToken'));

  sockets.push(createSocketClient({ name: 'Bot Two', playerToken: 'jank-p2', heroId: 'night-vagrant' }));
  sockets.push(createSocketClient({ name: 'Bot Three', playerToken: 'jank-p3', heroId: 'rune-archer' }));
  await Promise.all(sockets.map((c) => c.ready));
  const hostControl = createSocketClient({ name: 'Jank Control', playerToken: pageToken, heroId: 'ember-knight' });
  await hostControl.ready;
  sockets.push(hostControl);
  await new Promise((resolve, reject) => {
    hostControl.socket.emit('startRoom', { commandId: `jank-start-${Date.now()}` }, (ack) => {
      if (!ack?.accepted) reject(new Error(`startRoom rejected: ${JSON.stringify(ack)}`));
      else resolve();
    });
  });
  await page.waitForSelector('.player-panel.active.focused .runner img', { timeout: 15_000 });
  await delay(1500);

  if (cpuRate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await delay(500);
  }

  // Force encounters: every 5s each client drops its most dangerous terrain
  // card anywhere placeable (immediate combat allowed).
  const SAFE = new Set(['meadow', 'village', 'forge', 'shrine', 'mire', 'orchard', 'chapel', 'watchtower', 'market', 'armory', 'waystone', 'scriptorium']);
  const placer = setInterval(() => {
    for (const client of sockets) {
      const state = client.latestState;
      const me = state?.players?.find((p) => p.id === client.playerToken);
      if (!me || me.combat) continue;
      const card = me.hand?.find((c) => c.kind === 'terrain' && !SAFE.has(c.tile)) ?? me.hand?.find((c) => c.kind === 'terrain');
      if (!card) continue;
      const tile = findPlaceableTerrainTile(me, card, { allowImmediateCombat: true });
      if (!tile) continue;
      client.socket.emit('placeCard', { cardId: card.instanceId, tileIndex: tile.index, commandId: `jank-${client.playerToken}-${Date.now()}` }, () => {});
    }
  }, 5000);

  if (injectCss) await page.addStyleTag({ content: injectCss });
  const trace = await page.evaluate((durationMs) => new Promise((resolve) => {
    const startedAt = performance.now();
    const frames = [];
    const longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push({ t: entry.startTime - startedAt, dur: entry.duration });
      }).observe({ entryTypes: ['longtask'] });
    } catch { /* unsupported */ }
    let prev = null;
    const step = () => {
      const now = performance.now();
      const overlay = document.querySelector('.combat-overlay');
      frames.push({
        t: now - startedAt,
        gap: prev === null ? 0 : now - prev,
        combat: overlay !== null,
        beat: overlay !== null && overlay.classList.contains('combat-beat-active'),
        hitStop: overlay !== null && overlay.classList.contains('hit-stop'),
        floaters: document.querySelectorAll('.runner-floater').length,
        anims: document.getAnimations().length
      });
      prev = now;
      if (now - startedAt >= durationMs) {
        resolve({ frames, longTasks });
        return;
      }
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }), sampleMs);

  clearInterval(placer);
  const gaps = trace.frames.slice(1).map((f) => f.gap);
  const sorted = [...gaps].sort((a, b) => a - b);
  const seconds = sampleMs / 1000;
  const spikes = trace.frames
    .map((f, i) => ({ ...f, i }))
    .filter((f) => f.gap > 50)
    .sort((a, b) => b.gap - a.gap);

  // For each spike, look at state transitions in the 3 frames around it.
  const annotated = spikes.slice(0, 25).map((spike) => {
    const before = trace.frames[Math.max(0, spike.i - 1)];
    const after = trace.frames[Math.min(trace.frames.length - 1, spike.i + 1)];
    const transitions = [];
    if (before.combat !== spike.combat || spike.combat !== after.combat) transitions.push('combat-mount/unmount');
    if (spike.beat && !before.beat) transitions.push('beat-start');
    if (spike.floaters > before.floaters) transitions.push('floater-spawn');
    if (Math.abs(spike.anims - before.anims) >= 2) transitions.push(`anims ${before.anims}->${spike.anims}`);
    return {
      atSec: Number((spike.t / 1000).toFixed(1)),
      gapMs: Number(spike.gap.toFixed(1)),
      combat: spike.combat,
      beat: spike.beat,
      hitStop: spike.hitStop,
      floaters: spike.floaters,
      anims: spike.anims,
      transitions: transitions.join(', ') || 'none'
    };
  });

  const inCombat = trace.frames.filter((f) => f.combat).slice(1).map((f) => f.gap).sort((a, b) => a - b);
  const outCombat = trace.frames.filter((f) => !f.combat).slice(1).map((f) => f.gap).sort((a, b) => a - b);
  const combatShare = trace.frames.filter((f) => f.combat).length / trace.frames.length;

  console.log(JSON.stringify({
    jank: {
      gl: useGl ? 'swiftshader' : 'none',
      cpuRate,
      quality: probeQuality,
      sampleMs,
      fpsAvg: Number((gaps.length / seconds).toFixed(1)),
      gapMs: {
        p50: Number(percentile(sorted, 0.5).toFixed(1)),
        p90: Number(percentile(sorted, 0.9).toFixed(1)),
        p95: Number(percentile(sorted, 0.95).toFixed(1)),
        p99: Number(percentile(sorted, 0.99).toFixed(1)),
        max: Number(sorted[sorted.length - 1].toFixed(1))
      },
      spikesOver50ms: spikes.length,
      spikesPerMinute: Number((spikes.length / (seconds / 60)).toFixed(1)),
      combatShareOfFrames: Number(combatShare.toFixed(2)),
      inCombatGapMs: { p50: Number(percentile(inCombat, 0.5).toFixed(1)), p95: Number(percentile(inCombat, 0.95).toFixed(1)), p99: Number(percentile(inCombat, 0.99).toFixed(1)) },
      outCombatGapMs: { p50: Number(percentile(outCombat, 0.5).toFixed(1)), p95: Number(percentile(outCombat, 0.95).toFixed(1)), p99: Number(percentile(outCombat, 0.99).toFixed(1)) },
      longTasks: trace.longTasks.length,
      longTaskWorstMs: Number(Math.max(0, ...trace.longTasks.map((t) => t.dur)).toFixed(1)),
      worstSpikes: annotated
    }
  }, null, 2));
} catch (error) {
  console.error('[jank] FAILED:', error?.stack ?? error);
  console.error('[jank] server tail:', serverInfo.output().slice(-3000));
  process.exitCode = 1;
} finally {
  for (const client of sockets) client.socket.disconnect();
  if (browser) await browser.close();
  serverInfo.server.kill('SIGTERM');
  await delay(500);
  if (serverInfo.server.exitCode === null) serverInfo.server.kill('SIGKILL');
}
