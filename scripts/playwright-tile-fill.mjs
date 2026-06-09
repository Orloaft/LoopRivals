/* global document, window */
// Drive a real match, place as many terrain cards on the focused board as
// possible (drawing more over time), and screenshot the populated loop so the
// tile-frame alignment can be appraised across many tile types in context.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4800 + Math.floor(Math.random() * 1000));
const hmrPort = Number(process.env.PLAYWRIGHT_HMR_PORT ?? port + 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomCode = `fill-${Date.now().toString(36)}`;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const outDir = path.join('test-results', 'tile-fill', stamp);
const runMs = Number(process.env.LOOPDUEL_FILL_MS ?? 60_000);

function startServer() {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(hmrPort), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  server.stdout.on('data', (c) => { output += c.toString(); });
  server.stderr.on('data', (c) => { output += c.toString(); });
  return { server, output: () => output };
}

async function waitForServer(info) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (info.server.exitCode !== null) throw new Error(`Server exited early:\n${info.output()}`);
    try { const r = await fetch(`${baseUrl}/healthz`); if (r.ok) return; } catch { /* warming */ }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${baseUrl}:\n${info.output()}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((res) => server.once('exit', res)),
    delay(3000).then(() => server.kill('SIGKILL'))
  ]);
}

async function waitForCleanBoard(page, timeoutMs = 8000) {
  // Wait until no combat scene / event banner is covering the board centre, and
  // clear any tile-detail popover by tapping a neutral spot.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy = await page.locator('.combat-frame, .bc-event-stage, .combat-vignette, .combat-banner').count().catch(() => 1);
    if (busy === 0) {
      await page.mouse.click(8, 8).catch(() => {});
      await page.waitForTimeout(150);
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

let shotN = 0;
async function shot(page, label) {
  await fs.promises.mkdir(outDir, { recursive: true });
  shotN += 1;
  const name = `${String(shotN).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  // also a cropped focused-board shot
  const board = page.locator('.player-panel.active.focused .board').first();
  if (await board.count().catch(() => 0)) {
    await board.screenshot({ path: path.join(outDir, `${String(shotN).padStart(2, '0')}-${label}-board.png`) }).catch(() => {});
  }
  console.log('captured', name);
}

async function placeOne(page) {
  // Select a terrain card if none selected.
  if (await page.locator('.hand-card.selected').count() === 0) {
    const terrain = page.locator('.hand-card.terrain');
    if (await terrain.count() === 0) return false;
    await terrain.first().click().catch(() => {});
    await page.waitForTimeout(120);
  }
  const tile = page.locator('.player-panel.active.focused .tile.placement-available').first();
  if (await tile.count() === 0) return false;
  const dropTarget = await tile.boundingBox();
  const card = await page.locator('.hand-card.selected').first().boundingBox();
  if (!dropTarget || !card) return false;
  const before = await page.locator('.hand-card').count();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(dropTarget.x + dropTarget.width / 2, dropTarget.y + dropTarget.height / 2, { steps: 14 });
  await page.mouse.up();
  try {
    await page.waitForFunction((c) => document.querySelectorAll('.hand-card').length < c, before, { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

const info = startServer();
let browser;
try {
  await waitForServer(info);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('loopduel.tutorialSeen', 'yes');
  });
  await page.reload();
  await page.fill('#player-name', 'Builder');
  await page.fill('#room-code', roomCode);
  await page.click('.primary-action');
  await page.waitForSelector('.player-panel.active.focused .board');
  await page.waitForSelector('.hand-card');
  const cont = page.getByRole('button', { name: /^continue$/i });
  if (await cont.count().catch(() => 0)) await cont.first().click().catch(() => {});
  await page.waitForTimeout(300);

  // Start the match so the hand becomes active and cards keep drawing.
  const start = page.getByRole('button', { name: /start match/i });
  if (await start.count().catch(() => 0)) await start.first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, 'match-start');

  let placed = 0;
  const deadline = Date.now() + runMs;
  let idleRounds = 0;
  while (Date.now() < deadline) {
    const ok = await placeOne(page);
    if (ok) {
      placed += 1;
      idleRounds = 0;
      console.log(`placed #${placed}`);
      if (placed % 3 === 0) {
        await waitForCleanBoard(page, 5000);
        await shot(page, `clean-placed-${placed}`);
      }
    } else {
      idleRounds += 1;
      // Wait for new cards to be drawn, then retry.
      await page.waitForTimeout(1500);
      if (idleRounds > 18) break; // ~27s with nothing placeable -> stop
    }
  }

  // Capture a few clean board shots (between combats) for appraisal.
  for (let i = 0; i < 3; i += 1) {
    await waitForCleanBoard(page);
    await shot(page, `final-clean-${i + 1}-placed-${placed}`);
    await page.waitForTimeout(1800);
  }

  // Count how many distinct terrain tiles ended up on the board.
  const boardSummary = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('.player-panel.active.focused .tile'));
    const arts = tiles.map((t) => {
      const url = getComputedStyle(t, '::before').backgroundImage || t.style.getPropertyValue('--tile-art');
      const m = url && url.match(/tiles\/v2\/([a-z0-9]+)\.png/i);
      return m ? m[1] : (url.includes('road') ? 'road' : 'other');
    });
    const counts = {};
    for (const a of arts) counts[a] = (counts[a] || 0) + 1;
    return { tileCount: tiles.length, counts };
  });
  fs.writeFileSync(path.join(outDir, 'board-summary.json'), JSON.stringify(boardSummary, null, 2));

  console.log('\nTILE_FILL_DONE');
  console.log('placed=' + placed);
  console.log('board=' + JSON.stringify(boardSummary));
  console.log('OUT_DIR=' + outDir);
} finally {
  if (browser) await browser.close();
  await stopServer(info.server);
}
