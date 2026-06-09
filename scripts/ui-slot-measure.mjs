/* global document, Image */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5600 + Math.floor(Math.random() * 500));
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(port + 1000), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = ''; server.stdout.on('data', (c) => { log += c; }); server.stderr.on('data', (c) => { log += c; });
async function waitForServer() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) { try { if ((await fetch(`${baseUrl}/healthz`)).ok) return; } catch {} await delay(250); }
  throw new Error('timeout');
}
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const res = await page.evaluate(async (url) => {
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const lum = (x, y) => { const i = (y * W + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
    // Slot row sits in the bottom ~13%; from the hi-res crop the slots occupy the upper part of that band.
    const yTop = Math.floor(H * 0.872), yBot = Math.floor(H * 0.915);
    // Column brightness profile across the slot row.
    const prof = [];
    for (let x = 0; x < W; x += 1) {
      let s = 0, n = 0;
      for (let y = yTop; y <= yBot; y += 1) { s += lum(x, y); n += 1; }
      prof.push(s / n);
    }
    const max = Math.max(...prof), min = Math.min(...prof);
    const mid = (max + min) / 2;
    // Dark cells = slot interiors; bright = gold frame rims. Find contiguous dark runs.
    const runs = []; let cur = null;
    for (let x = Math.floor(W * 0.05); x < W * 0.95; x += 1) {
      if (prof[x] < mid) { if (!cur) cur = { x0: x, x1: x }; else cur.x1 = x; }
      else if (cur) { if (cur.x1 - cur.x0 > W * 0.02) runs.push(cur); cur = null; }
    }
    if (cur && cur.x1 - cur.x0 > W * 0.02) runs.push(cur);
    const slots = runs.map((r) => ({
      cxPct: +(((r.x0 + r.x1) / 2) / W).toFixed(4),
      wPct: +((r.x1 - r.x0) / W).toFixed(4)
    }));
    return { W, H, yTopPct: +(yTop / H).toFixed(4), yBotPct: +(yBot / H).toFixed(4), slotCount: slots.length, slots, profMax: Math.round(max), profMin: Math.round(min) };
  }, `${baseUrl}/assets/ui/right-dock-loophero-gothic-v4.png`);
  console.log(JSON.stringify(res, null, 2));
} catch (e) {
  console.error('ERR', e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM'); await delay(300); server.kill('SIGKILL');
}
