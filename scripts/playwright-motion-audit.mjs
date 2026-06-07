/* global MutationObserver, document, window */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4500 + Math.floor(Math.random() * 1000));
const hmrPort = Number(process.env.PLAYWRIGHT_HMR_PORT ?? port + 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomCode = `motion-${Date.now().toString(36)}`;
const boardPath = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  [4, 1], [4, 2], [4, 3], [4, 4],
  [3, 4], [2, 4], [1, 4], [0, 4],
  [0, 3], [0, 2], [0, 1]
].map(([x, y]) => ({
  left: ((x + 0.5) / 5) * 100,
  top: ((y + 0.5) / 5) * 100
}));

function percentile(values, pct) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1))];
}

function summarizeFrameGaps(values) {
  if (values.length === 0) {
    return { samples: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  const round = (value) => Number(value.toFixed(2));
  return {
    samples: values.length,
    avg: round(total / values.length),
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    p99: round(percentile(values, 0.99)),
    max: round(Math.max(...values))
  };
}

function startServer() {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      LOOPDUEL_VITE_HMR_PORT: String(hmrPort),
      NODE_ENV: 'development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  server.stdout.on('data', (chunk) => { output += chunk.toString(); });
  server.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { server, output: () => output };
}

async function waitForServer(serverInfo) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (serverInfo.server.exitCode !== null) throw new Error(`Server exited early:\n${serverInfo.output()}`);
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // Keep polling while Vite starts.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${baseUrl}:\n${serverInfo.output()}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(3000).then(() => server.kill('SIGKILL'))
  ]);
}

async function joinAndStart(page) {
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('loopduel.tutorialSeen', 'yes');
    localStorage.setItem('loopduel.smoothnessDebug', '1');
  });
  await page.reload();
  await page.fill('#player-name', 'Motion');
  await page.fill('#room-code', roomCode);
  await page.click('.primary-action');
  await page.waitForSelector('.game-shell');
  await page.waitForSelector('.player-panel.active.focused .board');
  await page.waitForSelector('.hand-card');
  await page.getByRole('button', { name: /^start match$/i }).click();
  await page.waitForSelector('.player-panel.active.focused .runner img');
}

async function placeTerrainDuringMotion(page) {
  const safeTerrainSelector = [
    '.hand-card.terrain.meadow',
    '.hand-card.terrain.forge',
    '.hand-card.terrain.shrine',
    '.hand-card.terrain.mire',
    '.hand-card.terrain.village',
    '.hand-card.terrain.watchtower'
  ].join(', ');
  const safeTerrain = page.locator(safeTerrainSelector).first();
  const terrain = (await safeTerrain.count()) > 0 ? safeTerrain : page.locator('.hand-card.terrain').first();
  if (await terrain.count() === 0) return false;
  await terrain.click();
  const beforeCardCount = await page.locator('.hand-card').count();
  await page.locator('.player-panel.active.focused .tile.road:not(.occupied)').nth(1).click();
  await page.waitForFunction((count) => document.querySelectorAll('.hand-card').length < count, beforeCardCount, { timeout: 5000 });
  return true;
}

async function installMotionProbe(page) {
  await page.evaluate(() => {
    const runner = document.querySelector('.player-panel.active.focused .runner');
    const sprite = runner?.querySelector('img');
    window.__loopduelMotionAudit = {
      initialRunner: runner,
      initialSprite: sprite,
      runnerRemounts: 0,
      spriteRemounts: 0,
      childMutations: 0
    };
    const panel = document.querySelector('.player-panel.active.focused');
    const observer = new MutationObserver((mutations) => {
      window.__loopduelMotionAudit.childMutations += mutations.filter((mutation) => mutation.type === 'childList').length;
      const nextRunner = document.querySelector('.player-panel.active.focused .runner');
      const nextSprite = nextRunner?.querySelector('img');
      if (nextRunner && nextRunner !== window.__loopduelMotionAudit.initialRunner) {
        window.__loopduelMotionAudit.runnerRemounts += 1;
        window.__loopduelMotionAudit.initialRunner = nextRunner;
      }
      if (nextSprite && nextSprite !== window.__loopduelMotionAudit.initialSprite) {
        window.__loopduelMotionAudit.spriteRemounts += 1;
        window.__loopduelMotionAudit.initialSprite = nextSprite;
      }
    });
    if (panel) observer.observe(panel, { childList: true, subtree: true });
    window.__loopduelMotionAudit.observer = observer;
  });
}

async function sampleMotion(page, durationMs = 12_000) {
  return page.evaluate(({ durationMs }) => new Promise((resolve) => {
    const startedAt = performance.now();
    const samples = [];
    const frameGaps = [];
    let previousFrameAt = null;
    const sample = () => {
      const now = performance.now();
      if (previousFrameAt !== null) frameGaps.push(now - previousFrameAt);
      previousFrameAt = now;
      const panel = document.querySelector('.player-panel.active.focused');
      const board = panel?.querySelector('.board');
      const runner = panel?.querySelector('.runner');
      const highlight = panel?.querySelector('.runner-tile-highlight');
      const spriteWrap = panel?.querySelector('.runner-sprite');
      const sprite = panel?.querySelector('.runner img');
      const pause = document.querySelector('.authority-pause');
      if (board && runner && highlight) {
        const runnerRect = runner.getBoundingClientRect();
        const runnerMatrix = window.__parseLoopduelMatrix(window.getComputedStyle(runner).transform);
        const highlightMatrix = window.__parseLoopduelMatrix(window.getComputedStyle(highlight).transform);
        const spriteWrapStyle = spriteWrap ? window.getComputedStyle(spriteWrap) : null;
        const spriteStyle = sprite ? window.getComputedStyle(sprite) : null;
        samples.push({
          t: now - startedAt,
          left: (runnerMatrix.x / runnerRect.width) * 100,
          top: (runnerMatrix.y / runnerRect.height) * 100,
          highlightLeft: (highlightMatrix.x / runnerRect.width) * 100,
          highlightTop: (highlightMatrix.y / runnerRect.height) * 100,
          boardTop: board.getBoundingClientRect().top,
          panelClass: panel?.className ?? '',
          pauseText: pause?.textContent ?? '',
          spriteClass: spriteWrap?.className ?? '',
          spriteAnimationName: spriteWrapStyle?.animationName ?? '',
          spriteOpacity: Number(spriteWrapStyle?.opacity ?? 1),
          spriteVisibility: spriteWrapStyle?.visibility ?? '',
          imageAnimationName: spriteStyle?.animationName ?? '',
          imageOpacity: Number(spriteStyle?.opacity ?? 1),
          imageVisibility: spriteStyle?.visibility ?? '',
          spriteSrc: sprite?.currentSrc ?? '',
          spriteComplete: sprite?.complete ?? false,
          spriteNaturalWidth: sprite?.naturalWidth ?? 0,
          spriteNaturalHeight: sprite?.naturalHeight ?? 0
        });
      }
      if (now - startedAt >= durationMs) {
        window.__loopduelMotionAudit?.observer?.disconnect();
        resolve({
          samples,
          frameGaps,
          smoothness: window.__loopduelSmoothness?.snapshot?.() ?? null,
          audit: window.__loopduelMotionAudit
        });
        return;
      }
      window.requestAnimationFrame(sample);
    };
    window.__parseLoopduelMatrix = (transform) => {
      if (!transform || transform === 'none') return { x: 0, y: 0 };
      const values = transform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1].split(',').map((value) => Number(value.trim()));
      if (!values) return { x: 0, y: 0 };
      return values.length === 16 ? { x: values[12], y: values[13] } : { x: values[4], y: values[5] };
    };
    window.requestAnimationFrame(sample);
  }), { durationMs });
}

function closestCursor(sample) {
  let best = { cursor: 0, distance: Number.POSITIVE_INFINITY };
  for (let index = 0; index < boardPath.length; index += 1) {
    const start = boardPath[index];
    const end = boardPath[(index + 1) % boardPath.length];
    if (!start || !end) continue;
    const dx = end.left - start.left;
    const dy = end.top - start.top;
    const lengthSq = Math.max(0.0001, dx * dx + dy * dy);
    const mix = Math.max(0, Math.min(1, ((sample.left - start.left) * dx + (sample.top - start.top) * dy) / lengthSq));
    const projectedLeft = start.left + dx * mix;
    const projectedTop = start.top + dy * mix;
    const distance = Math.hypot(sample.left - projectedLeft, sample.top - projectedTop);
    if (distance < best.distance) best = { cursor: index + mix, distance };
  }
  return best;
}

function unwrapCursors(samples) {
  const boardLength = boardPath.length;
  let offset = 0;
  let previous = null;
  return samples.map((sample) => {
    const cursor = closestCursor(sample).cursor;
    if (previous !== null && boardLength > 0 && cursor + offset < previous - boardLength / 2) offset += boardLength;
    const unwrapped = cursor + offset;
    previous = unwrapped;
    return unwrapped;
  });
}

function assertMotionContract(trace) {
  assert.ok(trace.samples.length > 120, 'motion audit should collect enough animation frames');
  assert.equal(trace.audit.runnerRemounts, 0, 'runner element should not remount during ordinary movement and tile placement');
  assert.equal(trace.audit.spriteRemounts, 0, 'runner sprite image should not remount during ordinary movement and tile placement');
  assert.equal(trace.samples.some((sample) => /waiting for server/i.test(sample.pauseText)), false, 'server-waiting overlay should not appear while movement timeline is valid');
  assert.equal(trace.samples.some((sample) => !sample.spriteSrc || !sample.spriteComplete || sample.spriteNaturalWidth <= 0 || sample.spriteNaturalHeight <= 0), false, 'runner sprite image should stay loaded throughout motion');

  const spriteSources = new Set(trace.samples.map((sample) => sample.spriteSrc));
  assert.equal(spriteSources.size, 1, `runner sprite source changed during ordinary motion: ${JSON.stringify([...spriteSources])}`);

  const invisibleSprites = trace.samples.filter((sample) => (
    sample.spriteOpacity < 0.98 ||
    sample.imageOpacity < 0.98 ||
    sample.spriteVisibility === 'hidden' ||
    sample.imageVisibility === 'hidden'
  ));
  assert.equal(invisibleSprites.length, 0, `runner sprite became visually hidden: ${JSON.stringify(invisibleSprites.slice(0, 5))}`);

  const steadyMotionSamples = trace.samples.filter((sample) => !/\bcombat-locked\b|\bevent-/.test(sample.panelClass));
  assert.ok(steadyMotionSamples.length > 30, 'motion audit should collect steady non-event motion frames');

  const spriteAnimationNames = new Set(steadyMotionSamples.map((sample) => sample.spriteAnimationName).filter(Boolean));
  assert.deepEqual([...spriteAnimationNames].sort(), ['none'], `runner sprite wrapper animation changed during ordinary motion: ${JSON.stringify([...spriteAnimationNames])}`);

  const imageAnimationNames = new Set(steadyMotionSamples.map((sample) => sample.imageAnimationName).filter(Boolean));
  assert.deepEqual([...imageAnimationNames].sort(), ['runner-step'], `runner image animation changed during ordinary motion: ${JSON.stringify([...imageAnimationNames])}`);

  const boardTop = trace.samples[0].boardTop;
  const maxBoardShift = Math.max(...trace.samples.map((sample) => Math.abs(sample.boardTop - boardTop)));
  assert.ok(maxBoardShift <= 1.5, `board shifted ${maxBoardShift.toFixed(2)}px during motion`);

  const maxHighlightDrift = Math.max(...trace.samples.map((sample) => (
    Math.hypot(sample.left - sample.highlightLeft, sample.top - sample.highlightTop)
  )));
  assert.ok(maxHighlightDrift <= 0.08, `runner/highlight drifted ${maxHighlightDrift.toFixed(3)}%`);

  const cursors = unwrapCursors(trace.samples);
  const backwardJumps = [];
  for (let index = 1; index < cursors.length; index += 1) {
    const dt = trace.samples[index].t - trace.samples[index - 1].t;
    if (dt > 120) continue;
    const delta = cursors[index] - cursors[index - 1];
    if (delta < -0.22) {
      backwardJumps.push({
        index,
        delta,
        before: {
          t: Math.round(trace.samples[index - 1].t),
          cursor: Number(cursors[index - 1].toFixed(3)),
          left: Number(trace.samples[index - 1].left.toFixed(2)),
          top: Number(trace.samples[index - 1].top.toFixed(2)),
          panelClass: trace.samples[index - 1].panelClass
        },
        after: {
          t: Math.round(trace.samples[index].t),
          cursor: Number(cursors[index].toFixed(3)),
          left: Number(trace.samples[index].left.toFixed(2)),
          top: Number(trace.samples[index].top.toFixed(2)),
          panelClass: trace.samples[index].panelClass
        }
      });
    }
  }
  assert.equal(backwardJumps.length, 0, `runner cursor jumped backward: ${JSON.stringify(backwardJumps.slice(0, 5))}`);
}

function printMotionReport(trace) {
  console.log(JSON.stringify({
    motionAudit: {
      samples: trace.samples.length,
      frameGapMs: summarizeFrameGaps(trace.frameGaps ?? []),
      schedulerFrameGapMs: trace.smoothness?.rafFrameGapMs ?? null,
      longTasks: trace.smoothness?.longTasks ?? null,
      runnerRemounts: trace.audit.runnerRemounts,
      spriteRemounts: trace.audit.spriteRemounts
    }
  }, null, 2));
}

const serverInfo = startServer();
let browser;

try {
  await waitForServer(serverInfo);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  page.on('pageerror', (error) => {
    throw error;
  });

  await joinAndStart(page);
  await installMotionProbe(page);
  await delay(1200);
  const placed = await placeTerrainDuringMotion(page);
  assert.equal(placed, true, 'motion audit needs to place a terrain card during movement');
  const trace = await sampleMotion(page);
  assertMotionContract(trace);
  printMotionReport(trace);
} finally {
  if (browser) await browser.close();
  await stopServer(serverInfo.server);
}
