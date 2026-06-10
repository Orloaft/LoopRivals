import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5800 + Math.floor(Math.random() * 400));
const baseUrl = `http://127.0.0.1:${port}`;
const out = new URL('../tmp/ui-audit/gear-menu.png', import.meta.url).pathname;
const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(port + 1000), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = ''; server.stdout.on('data', (c) => { log += c; }); server.stderr.on('data', (c) => { log += c; });
async function waitForServer() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) { try { if ((await fetch(`${baseUrl}/healthz`)).ok) return; } catch { /* not up yet */ } await delay(250); }
  throw new Error('timeout:\n' + log);
}
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 });
  await page.goto(baseUrl + '/?skiptitle=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#player-name', 'Menu');
  await page.fill('#room-code', `menu-${Date.now().toString(36)}`);
  await page.click('.primary-action');
  await page.waitForSelector('.player-side-dock');
  await page.waitForTimeout(700);
  const cont = page.getByRole('button', { name: /^continue$/i });
  if (await cont.count()) { await cont.first().click().catch(() => {}); await page.waitForTimeout(200); }
  await page.locator('.gear-slot').first().click();
  await page.waitForSelector('.menu-panel', { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.locator('.menu-panel').screenshot({ path: out });
  console.log('SHOT → gear-menu.png');
} catch (e) {
  console.error('ERR', e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM'); await delay(300); server.kill('SIGKILL');
}
