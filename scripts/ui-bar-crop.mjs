import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5300 + Math.floor(Math.random() * 600));
const baseUrl = `http://127.0.0.1:${port}`;
const out = new URL('../tmp/ui-audit/painted-bar-hires.png', import.meta.url).pathname;

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(port + 1000), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = ''; server.stdout.on('data', (c) => { log += c; }); server.stderr.on('data', (c) => { log += c; });

async function waitForServer() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${baseUrl}/healthz`)).ok) return; } catch {}
    await delay(250);
  }
  throw new Error('server timeout:\n' + log);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1750 }, deviceScaleFactor: 2 });
  await page.goto(baseUrl);
  // Render only the dock PNG bottom strip, scaled up, on a neutral backdrop.
  await page.setContent(`<body style="margin:0;background:#222;">
    <img id="d" src="${baseUrl}/assets/ui/right-dock-loophero-gothic-v4.png" style="width:744px;display:block;">
  </body>`);
  await page.waitForSelector('#d');
  await page.waitForTimeout(300);
  const img = await page.locator('#d').boundingBox();
  // Bottom ~13% holds the control bar.
  await page.screenshot({
    path: out,
    clip: { x: img.x, y: img.y + img.height * 0.87, width: img.width, height: img.height * 0.13 }
  });
  console.log('SHOT → painted-bar-hires.png');
} catch (e) {
  console.error('ERR', e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM'); await delay(300); server.kill('SIGKILL');
}
