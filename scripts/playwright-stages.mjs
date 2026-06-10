/* global document, window */
// Staged screenshot capture: drives a real production build through the
// lobby -> pre-match -> live -> late-game stages and snapshots each one.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4900 + Math.floor(Math.random() * 1000));
const hmrPort = Number(process.env.PLAYWRIGHT_HMR_PORT ?? port + 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const outDir = path.join('test-results', 'stages', stamp);

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

const shots = [];
async function shot(page, name) {
  await fs.promises.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(file);
  console.log('captured', file);
  return file;
}

async function freshPage(browser, viewport, mobile) {
  const page = await browser.newPage({
    viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile
  });
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('loopduel.tutorialSeen', 'yes');
    localStorage.setItem('loopduel.smoothnessDebug', '1');
    // Pin full quality: these shots judge appearance, and the headless
    // software rasterizer would otherwise trip the auto low-quality fallback.
    localStorage.setItem('loopduel.quality', 'high');
  });
  await page.reload();
  return page;
}

async function dismissTutorial(page) {
  const cont = page.getByRole('button', { name: /^continue$/i });
  if (await cont.count().catch(() => 0)) {
    await cont.first().click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function clickByName(page, name) {
  const btn = page.getByRole('button', { name });
  if (await btn.count().catch(() => 0)) { await btn.first().click().catch(() => {}); return true; }
  return false;
}

const info = startServer();
let browser;
try {
  await waitForServer(info);
  browser = await chromium.launch({ headless: true });

  // ---------- DESKTOP storyline ----------
  const desktop = await freshPage(browser, { width: 1440, height: 960 }, false);
  await desktop.waitForSelector('#player-name', { timeout: 10_000 });
  await shot(desktop, '01-desktop-lobby.png');

  const room = `stage-${Date.now().toString(36)}`;
  await desktop.fill('#player-name', 'Captain');
  await desktop.fill('#room-code', room);
  await desktop.click('.primary-action');
  await desktop.waitForSelector('.game-shell');
  await desktop.waitForSelector('.player-panel.active.focused .board');
  await desktop.waitForSelector('.hand-card');
  await dismissTutorial(desktop);
  await desktop.waitForTimeout(400);
  await shot(desktop, '02-desktop-solo-board.png');

  // Host controls (Fill CPU / Start) live behind the gear menu now.
  await clickByName(desktop, /settings and room menu/i);
  await desktop.waitForTimeout(300);
  await clickByName(desktop, /fill cpu match/i);
  await desktop.waitForTimeout(700);
  await desktop.keyboard.press('Escape');
  await desktop.waitForTimeout(300);
  await shot(desktop, '03-desktop-lobby-filled.png');

  await clickByName(desktop, /start match/i);
  // wait for movement to actually begin
  await desktop.waitForFunction(() => {
    const r = document.querySelector('.player-panel.active.focused .runner');
    return r && window.getComputedStyle(r).transform !== 'none';
  }, { timeout: 8000 }).catch(() => {});
  await desktop.waitForTimeout(1500);
  await shot(desktop, '04-desktop-match-early.png');

  // let the loop run to develop combat / loot / leveling
  await desktop.waitForTimeout(14_000);
  await shot(desktop, '05-desktop-match-mid.png');

  await desktop.waitForTimeout(14_000);
  await shot(desktop, '06-desktop-match-late.png');

  // ---------- MOBILE storyline (its own room) ----------
  const mobile = await freshPage(browser, { width: 390, height: 844 }, true);
  await mobile.waitForSelector('#player-name', { timeout: 10_000 });
  await shot(mobile, '07-mobile-lobby.png');

  const mroom = `stage-m-${Date.now().toString(36)}`;
  await mobile.fill('#player-name', 'Pocket');
  await mobile.fill('#room-code', mroom);
  await mobile.click('.primary-action');
  await mobile.waitForSelector('.game-shell');
  await mobile.waitForSelector('.player-panel.active.focused .board');
  await dismissTutorial(mobile);
  await mobile.waitForTimeout(400);
  await shot(mobile, '08-mobile-solo-board.png');

  // open menu drawer to host-fill + start (mobile uses a drawer)
  const menuTab = mobile.locator('.mobile-drawer-tab').filter({ hasText: /^Menu$/ });
  if (await menuTab.count().catch(() => 0)) await menuTab.first().click().catch(() => {});
  await mobile.waitForTimeout(300);
  await clickByName(mobile, /fill cpu( match)?/i);
  await mobile.waitForTimeout(600);
  await clickByName(mobile, /^start( match)?$/i);
  await mobile.waitForTimeout(600);
  // close the drawer so the live board is visible
  await clickByName(mobile, /^close$/i);
  await mobile.waitForTimeout(300);
  // confirm movement actually started
  await mobile.waitForFunction(() => {
    const r = document.querySelector('.player-panel.active.focused .runner');
    return r && window.getComputedStyle(r).transform !== 'none';
  }, { timeout: 8000 }).catch(() => {});
  await mobile.waitForTimeout(1500);
  await shot(mobile, '09-mobile-match-early.png');
  await mobile.waitForTimeout(13_000);
  await shot(mobile, '10-mobile-match-mid.png');

  console.log('\nSTAGE_DIR=' + outDir);
  console.log('SHOT_COUNT=' + shots.length);
} finally {
  if (browser) await browser.close();
  await stopServer(info.server);
}
