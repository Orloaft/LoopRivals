import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4700 + Math.floor(Math.random() * 800));
const hmrPort = port + 1000;
const baseUrl = `http://127.0.0.1:${port}`;
const roomCode = `uiaudit-${Date.now().toString(36)}`;
const outDir = new URL('../tmp/ui-audit/', import.meta.url);

function startServer() {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(hmrPort), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  server.stdout.on('data', (c) => { output += c.toString(); });
  server.stderr.on('data', (c) => { output += c.toString(); });
  return { server, output: () => output };
}

async function waitForServer(info) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (info.server.exitCode !== null) throw new Error(`Server exited early:\n${info.output()}`);
    try { if ((await fetch(`${baseUrl}/healthz`)).ok) return; } catch { /* not up yet */ }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function shoot(page, name) {
  const path = new URL(name, outDir).pathname;
  await page.screenshot({ path });
  console.log(`SHOT full  → ${name}`);
}

async function shootEl(page, selector, name) {
  try {
    const el = page.locator(selector).first();
    if (await el.count() === 0) { console.log(`SKIP el (absent) ${selector}`); return false; }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const path = new URL(name, outDir).pathname;
    await el.screenshot({ path });
    console.log(`SHOT el    → ${name} (${selector})`);
    return true;
  } catch (e) { console.log(`FAIL el ${selector}: ${e.message}`); return false; }
}

const info = startServer();
let browser;
try {
  await mkdir(outDir, { recursive: true });
  await waitForServer(info);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 });

  await page.goto(baseUrl + '/?skiptitle=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#player-name', 'Audit');
  await page.fill('#room-code', roomCode);
  await page.click('.primary-action');
  await page.waitForSelector('.game-shell');
  await page.waitForTimeout(800);

  // Onboarding / guide coach (first run) — capture before dismissing
  await shootEl(page, '.onboarding-coach', '05-guide-onboarding-coach.png');
  await shoot(page, '01-initial-lobby.png');

  // Dismiss onboarding if present
  const cont = page.getByRole('button', { name: /^continue$/i });
  if (await cont.count()) { await cont.first().click().catch(() => {}); await page.waitForTimeout(300); }

  // Fill CPU + start a match so board is populated (best effort)
  for (const label of [/fill cpu/i, /add bot/i]) {
    const b = page.getByRole('button', { name: label });
    if (await b.count() && await b.first().isEnabled().catch(() => false)) { await b.first().click().catch(() => {}); await page.waitForTimeout(300); break; }
  }
  const start = page.getByRole('button', { name: /^start( match)?$/i });
  if (await start.count() && await start.first().isEnabled().catch(() => false)) { await start.first().click().catch(() => {}); await page.waitForTimeout(1200); }

  await shoot(page, '02-board-after-start.png');

  // Right dock controls
  await shootEl(page, '.side-controls', '06-right-dock-controls.png');
  await shootEl(page, 'aside', '06b-right-dock-aside.png');

  // Popover: hover a dock control button to surface InfoPopover
  const dockBtn = page.locator('.side-control-button').first();
  if (await dockBtn.count()) {
    await dockBtn.hover().catch(() => {});
    await page.waitForTimeout(500);
    await shoot(page, '04-popover-hover-fullframe.png');
    await shootEl(page, '.hover-pop', '04b-popover-element.png');
  }

  // Shop drawer
  const shopToggle = page.locator('.shop-dock-toggle');
  if (await shopToggle.count()) {
    await shopToggle.first().click().catch(() => {});
    await page.waitForTimeout(700);
    await shoot(page, '03-shop-fullframe.png');
    await shootEl(page, '.shop-drawer', '03b-shop-drawer.png');
    await shootEl(page, '.shop-drawer-offer', '03c-shop-offer-row.png');
    await shootEl(page, '.sell-zone', '03d-sell-zone.png');
    await shopToggle.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // Hero stats drawer
  const statsToggle = page.locator('.hero-stats-toggle');
  if (await statsToggle.count()) {
    await statsToggle.first().click().catch(() => {});
    await page.waitForTimeout(700);
    await shoot(page, '07-herostats-fullframe.png');
    await shootEl(page, '.hero-stats-drawer', '07b-hero-stats-drawer.png');
  }

  console.log('DONE. Output in tmp/ui-audit/');
} catch (e) {
  console.error('AUDIT ERROR:', e.message);
  console.error(info.output().slice(-1500));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (info.server.exitCode === null) { info.server.kill('SIGTERM'); await delay(500); info.server.kill('SIGKILL'); }
}
