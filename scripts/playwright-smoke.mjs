/* global document, window */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4300 + Math.floor(Math.random() * 1000));
const hmrPort = Number(process.env.PLAYWRIGHT_HMR_PORT ?? port + 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomCode = `smoke-${Date.now().toString(36)}`;

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
    if (serverInfo.server.exitCode !== null) {
      throw new Error(`Server exited early:\n${serverInfo.output()}`);
    }
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

function rectFitsViewport(metrics, label) {
  assert.ok(metrics.left >= -1, `${label} overflows left`);
  assert.ok(metrics.right <= metrics.innerWidth + 1, `${label} overflows right`);
}

function assertCustomCursor(cursor, label) {
  assert.match(cursor, /cursor-hand(?:-large)?-v1\.png/, `${label} should keep the bespoke cursor`);
}

async function travelState(page) {
  return page.evaluate(() => {
    const runner = document.querySelector('.player-panel.active.focused .runner');
    const parallaxLayer = document.querySelector('.parallax-brambles');
    const styles = runner ? window.getComputedStyle(runner) : null;
    const parallaxStyles = parallaxLayer ? window.getComputedStyle(parallaxLayer) : null;
    return {
      runnerTransform: styles?.transform ?? null,
      parallaxTransform: parallaxStyles?.transform ?? null
    };
  });
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

  await page.goto(baseUrl + '/?skiptitle=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#player-name', 'Smoke');
  await page.fill('#room-code', roomCode);
  await page.click('.primary-action');

  await page.waitForSelector('.game-shell');
  assert.equal(await page.locator('.game-shell .mobile-status-bar').count(), 0, 'game top status bar should be removed');
  await page.waitForSelector('.player-panel.active.focused .board');
  await page.waitForSelector('.hand-card');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.locator('.mobile-drawer-tab').filter({ hasText: /^Menu$/ }).click();
  await page.getByRole('button', { name: /^start$/i }).click();

  assert.equal(await page.locator('.hand-card.rival').count(), 0, 'solo opening hand should not contain rival cards');
  assertCustomCursor(
    await page.locator('.player-panel.active.focused .tile').first().evaluate((element) => window.getComputedStyle(element).cursor),
    'disabled board tiles'
  );

  const beforeCardCount = await page.locator('.hand-card').count();
  const dragStability = await page.evaluate(() => {
    const board = document.querySelector('.player-panel.active.focused .board')?.getBoundingClientRect();
    const card = document.querySelector('.hand-card')?.getBoundingClientRect();
    return {
      boardTop: board?.top ?? null,
      card: card ? { x: card.left + card.width / 2, y: card.top + card.height / 2 } : null
    };
  });
  assert.ok(dragStability.boardTop !== null, 'focused board should render before drag');
  assert.ok(dragStability.card, 'hand card should render before drag');
  await page.mouse.move(dragStability.card.x, dragStability.card.y);
  await page.mouse.down();
  await page.mouse.move(dragStability.card.x, dragStability.card.y - 120, { steps: 8 });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.drag-card-ghost').count(), 1, 'hand card should render a custom drag ghost');
  const ghostBox = await page.locator('.drag-card-ghost').first().boundingBox();
  assert.ok(ghostBox, 'custom drag ghost should have a visible box');
  assert.ok(ghostBox.width >= 96 && ghostBox.height >= 96, `custom drag ghost should keep card dimensions, got ${JSON.stringify(ghostBox)}`);
  const boardTopDuringDrag = await page.locator('.player-panel.active.focused .board').evaluate((element) => element.getBoundingClientRect().top);
  await page.mouse.up();
  assert.ok(Math.abs(boardTopDuringDrag - dragStability.boardTop) <= 1.5, 'focused board should not shift vertically while dragging a hand card');

  if (await page.locator('.hand-card.selected').count() === 0) {
    await page.locator('.hand-card.terrain').first().click();
  }
  const armedTileStyles = await page.locator('.player-panel.active.focused .tile.placement-available').first().evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return { cursor: styles.cursor, outlineStyle: styles.outlineStyle };
  });
  assertCustomCursor(armedTileStyles.cursor, 'armed board tiles');
  assert.equal(armedTileStyles.outlineStyle, 'none', 'armed board tiles should not use bright outline styling');
  const dropTarget = await page.locator('.player-panel.active.focused .tile.placement-available').first().boundingBox();
  const selectedCardBox = await page.locator('.hand-card.selected').first().boundingBox();
  assert.ok(dropTarget, 'available tile should have a drop target box');
  assert.ok(selectedCardBox, 'selected hand card should have a drag source box');
  await page.mouse.move(selectedCardBox.x + selectedCardBox.width / 2, selectedCardBox.y + selectedCardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dropTarget.x + dropTarget.width / 2, dropTarget.y + dropTarget.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction((count) => document.querySelectorAll('.hand-card').length < count, beforeCardCount);

  const metrics = await page.evaluate(() => {
    const board = document.querySelector('.player-panel.active.focused .board')?.getBoundingClientRect();
    const tray = document.querySelector('.control-dock')?.getBoundingClientRect();
    const drawerTabs = document.querySelector('.mobile-tray-head')?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      board: board ? { left: board.left, right: board.right, bottom: board.bottom } : null,
      tray: tray ? { left: tray.left, right: tray.right, top: tray.top } : null,
      drawerTabs: drawerTabs ? { top: drawerTabs.top, bottom: drawerTabs.bottom } : null
    };
  });

  assert.ok(metrics.board, 'mobile board should render');
  assert.ok(metrics.tray, 'mobile hand tray should render');
  assert.ok(metrics.drawerTabs, 'mobile drawer tabs should render');
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, 'mobile viewport should not horizontally overflow');
  rectFitsViewport({ ...metrics.board, innerWidth: metrics.innerWidth }, 'focused board');
  rectFitsViewport({ ...metrics.tray, innerWidth: metrics.innerWidth }, 'hand tray');
  assert.ok(metrics.board.bottom <= metrics.tray.top + 1, 'focused board should stay above hand tray');
  assert.ok(metrics.drawerTabs.bottom <= metrics.tray.top + 96, 'drawer tabs should stay attached to tray');

  if (await page.locator('.mobile-menu-grid').count() === 0) {
    await page.locator('.mobile-drawer-tab').filter({ hasText: /^Menu$/ }).click();
  }
  await page.getByRole('button', { name: /fill cpu/i }).click();
  await page.waitForSelector('.mobile-rival-chip');
  assert.ok(await page.locator('.mobile-rival-chip').count() > 0, 'mobile rival strip should appear after filling CPU opponents');

  const movingSample = await travelState(page);
  await page.waitForFunction((sample) => {
    const runner = document.querySelector('.player-panel.active.focused .runner');
    const parallaxLayer = document.querySelector('.parallax-brambles');
    if (!runner || !parallaxLayer) return false;
    const styles = window.getComputedStyle(runner);
    const parallaxStyles = window.getComputedStyle(parallaxLayer);
    return styles.transform !== sample.runnerTransform ||
      parallaxStyles.transform !== sample.parallaxTransform;
  }, movingSample, { timeout: 6000 });
  await stopServer(serverInfo.server);
  await page.waitForSelector('.authority-pause', { timeout: 6000 });
  assert.match(await page.locator('.authority-pause').textContent(), /Reconnecting to server/);
  const pausedA = await travelState(page);
  await page.waitForTimeout(650);
  const pausedB = await travelState(page);
  assert.deepEqual(pausedB, pausedA, 'runner and parallax should freeze while waiting for authority');
} finally {
  if (browser) await browser.close();
  await stopServer(serverInfo.server);
}
