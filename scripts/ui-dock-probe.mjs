/* global document, Image */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4900 + Math.floor(Math.random() * 700));
const hmrPort = port + 1000;
const baseUrl = `http://127.0.0.1:${port}`;
const outDir = new URL('../tmp/ui-audit/', import.meta.url);

function startServer() {
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(hmrPort), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  server.stdout.on('data', (c) => { out += c.toString(); });
  server.stderr.on('data', (c) => { out += c.toString(); });
  return { server, output: () => out };
}
async function waitForServer(info) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (info.server.exitCode !== null) throw new Error(`Server exited:\n${info.output()}`);
    try { if ((await fetch(`${baseUrl}/healthz`)).ok) return; } catch { /* not up yet */ }
    await delay(250);
  }
  throw new Error('server timeout');
}

const info = startServer();
let browser;
try {
  await mkdir(outDir, { recursive: true });
  await waitForServer(info);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 3 });
  await page.goto(baseUrl); // same-origin so the canvas scan isn't tainted

  // 1) Scan the dock PNG for the painted socket bar.
  const scan = await page.evaluate(async (url) => {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const lum = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]; };
    // Look in bottom 18% for a horizontal band containing bright (gold) socket rims.
    const y0 = Math.floor(H * 0.82);
    const rows = [];
    for (let y = y0; y < H; y += 1) {
      let bright = 0;
      for (let x = Math.floor(W * 0.1); x < W * 0.9; x += 2) if (lum(x, y) > 90) bright += 1;
      rows.push({ y, bright });
    }
    // band = contiguous rows with elevated brightness
    const maxBright = Math.max(...rows.map((r) => r.bright));
    const band = rows.filter((r) => r.bright > maxBright * 0.35);
    const bandTop = band.length ? band[0].y : y0;
    const bandBot = band.length ? band[band.length - 1].y : H - 1;
    const midY = Math.floor((bandTop + bandBot) / 2);
    // Across the band mid row, find socket clusters via columnar brightness profile.
    const prof = [];
    for (let x = 0; x < W; x += 1) {
      let s = 0; for (let y = bandTop; y <= bandBot; y += 1) s += lum(x, y);
      prof.push(s / Math.max(1, bandBot - bandTop + 1));
    }
    // Sockets read as bright rims; find peaks: scan for x-ranges above threshold, group.
    const thr = Math.max(...prof) * 0.5;
    const groups = []; let cur = null;
    for (let x = Math.floor(W * 0.08); x < W * 0.92; x += 1) {
      if (prof[x] > thr) { if (!cur) cur = { x0: x, x1: x }; else cur.x1 = x; }
      else if (cur) { if (cur.x1 - cur.x0 > 4) groups.push(cur); cur = null; }
    }
    if (cur && cur.x1 - cur.x0 > 4) groups.push(cur);
    const centers = groups.map((g) => ((g.x0 + g.x1) / 2 / W));
    return {
      W, H,
      bandTopPct: bandTop / H, bandBotPct: bandBot / H, midYPct: midY / H,
      groupCount: groups.length,
      socketCentersPct: centers,
      socketWidthsPct: groups.map((g) => (g.x1 - g.x0) / W)
    };
  }, `${baseUrl}/assets/ui/right-dock-loophero-gothic-v4.png`);
  console.log('PAINTED SOCKET SCAN:', JSON.stringify(scan, null, 2));

  // 2) Enter a game and measure current button geometry relative to the dock.
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#player-name', 'Probe');
  await page.fill('#room-code', `probe-${Date.now().toString(36)}`);
  await page.click('.primary-action');
  await page.waitForSelector('.player-side-dock');
  await page.waitForTimeout(700);
  const cont = page.getByRole('button', { name: /^continue$/i });
  if (await cont.count()) { await cont.first().click().catch(() => {}); await page.waitForTimeout(200); }

  const geo = await page.evaluate(() => {
    const dock = document.querySelector('.player-side-dock')?.getBoundingClientRect();
    const btns = [...document.querySelectorAll('.side-control-button')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        label: b.getAttribute('aria-label'),
        cxPct: (r.left + r.width / 2 - dock.left) / dock.width,
        cyPct: (r.top + r.height / 2 - dock.top) / dock.height,
        wPct: r.width / dock.width, hPct: r.height / dock.height
      };
    });
    const ctrl = document.querySelector('.side-controls')?.getBoundingClientRect();
    return {
      dock: dock ? { w: Math.round(dock.width), h: Math.round(dock.height) } : null,
      sideControlsBox: ctrl && dock ? {
        leftPct: (ctrl.left - dock.left) / dock.width,
        rightPct: (dock.right - ctrl.right) / dock.width,
        topPct: (ctrl.top - dock.top) / dock.height,
        hPct: ctrl.height / dock.height
      } : null,
      buttons: btns
    };
  });
  console.log('CURRENT BUTTON GEOMETRY:', JSON.stringify(geo, null, 2));

  // 3) Mark button boxes + centers and capture the dock bottom for visual alignment.
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.side-control-button')) {
      b.style.outline = '1px solid rgba(255,0,80,0.9)';
      const dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px;background:#00e5ff;z-index:99;pointer-events:none;';
      b.appendChild(dot);
    }
  });
  const dock = page.locator('.player-side-dock').first();
  const box = await dock.boundingBox();
  await page.screenshot({
    path: new URL('dock-align-probe.png', outDir).pathname,
    clip: { x: box.x, y: box.y + box.height * 0.78, width: box.width, height: box.height * 0.22 }
  });
  console.log('SHOT → dock-align-probe.png (bottom 22% of dock, buttons outlined red, centers cyan)');
  console.log('DONE');
} catch (e) {
  console.error('PROBE ERROR:', e.message);
  console.error(info.output().slice(-1200));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (info.server.exitCode === null) { info.server.kill('SIGTERM'); await delay(400); info.server.kill('SIGKILL'); }
}
