/* global window */
/*
 * tile-align-audit.mjs
 *
 * OBJECTIVE verification harness for board-tile sprite alignment.
 *
 * Every board tile sprite in public/assets/tiles/v2/*.png is a 256x256 PNG.
 * The atlas-cropped tiles plus the boss/combo tiles derived from them all share
 * the SAME ornate gothic border frame; `road` is the reference. A slicing bug
 * (wrong per-row sourceY in slice-tile-art.mjs) used to shift whole rows of
 * frames vertically -- e.g. `village` sat ~14px lower than `road`. Because every
 * tile renders through identical CSS (`background-size: cover;
 * background-position: center`), any per-sprite frame offset shows up directly as
 * a vertical misalignment on the board.
 *
 * METRIC A (PRIMARY, no browser) -- FRAME CROSS-CORRELATION:
 * Earlier versions measured "dark band" margins, but interior darkness (mire's
 * swamp) and painted boss symbols (seal1) fooled that into false positives. This
 * version is CONTENT-INDEPENDENT: it correlates only the outer border RING of
 * each sprite against road's ring, sweeping vertical/horizontal pixel shifts and
 * taking the shift with minimum mean abs difference (SAD).
 *   - bestDy / bestDx : the shift (px) that best aligns the tile's frame to road.
 *                       0 = perfectly aligned with road. This is the real metric.
 *   - matchSad        : SAD at that best shift = how well the frame matches road.
 *                       Tiles sharing road's frame score low (~7-12). The row-4
 *                       REPLACEMENT tiles (thornmaze, graveyard, reliquary,
 *                       dragonroost, ambush, scorch) use a DIFFERENT frame by
 *                       design and score high (~28-31); they are classified
 *                       'diff-frame' and checked for self-centering instead of
 *                       being compared to road's frame.
 *
 * PASS only if every shared-frame tile is within TOLERANCE_PX of road AND every
 * diff-frame tile is self-centered within CENTER_TOLERANCE_PX.
 *
 * METRIC B (SECONDARY, optional `--browser`): Boots the real server, joins a
 * room, and screenshots the focused board so a human can eyeball alignment.
 *
 * Usage:
 *   node scripts/tile-align-audit.mjs            # metric A only (fast)
 *   node scripts/tile-align-audit.mjs --browser  # also capture board screenshot
 *   node scripts/tile-align-audit.mjs --json     # emit machine-readable JSON
 */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './slice-tile-art.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const tilesDir = path.join(repoRoot, 'public/assets/tiles/v2');
const referenceTile = 'road';

const CANVAS_SIZE = 256;
const SHIFT_RANGE = 24;        // sweep +/- this many px when correlating
const RING_PX = 30;            // outer border-ring thickness used for matching
const TOLERANCE_PX = 2;        // shared-frame tile must align within this of road
const FRAME_MATCH_MAX = 18;    // matchSad below this => shares road's frame
const CENTER_TOLERANCE_PX = 6; // diff-frame tile content must be centered within

function lumaOf(image) {
  const { width, height, pixels } = image;
  const luma = new Float64Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    luma[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3;
  }
  return luma;
}

function isRingPixel(x, y) {
  return x < RING_PX || x >= CANVAS_SIZE - RING_PX || y < RING_PX || y >= CANVAS_SIZE - RING_PX;
}

/**
 * Mean abs difference over the border ring between `luma` shifted by (dx,dy) and
 * the reference. Only ring pixels that map in-bounds are compared.
 */
function ringSad(luma, ref, dx, dy) {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < CANVAS_SIZE; y += 1) {
    const ry = y - dy;
    if (ry < 0 || ry >= CANVAS_SIZE) continue;
    for (let x = 0; x < CANVAS_SIZE; x += 1) {
      if (!isRingPixel(x, y)) continue;
      const rx = x - dx;
      if (rx < 0 || rx >= CANVAS_SIZE) continue;
      sum += Math.abs(luma[y * CANVAS_SIZE + x] - ref[ry * CANVAS_SIZE + x + (rx - x)]);
      count += 1;
    }
  }
  return count ? sum / count : Infinity;
}

/** Best (dx,dy) aligning `luma`'s frame ring to the reference ring. */
function bestShift(luma, ref) {
  let best = { dx: 0, dy: 0, sad: Infinity };
  for (let dy = -SHIFT_RANGE; dy <= SHIFT_RANGE; dy += 1) {
    for (let dx = -SHIFT_RANGE; dx <= SHIFT_RANGE; dx += 1) {
      const sad = ringSad(luma, ref, dx, dy);
      if (sad < best.sad) best = { dx, dy, sad };
    }
  }
  return best;
}

/** Content bounding box (bright pixels) for self-centering of diff-frame tiles. */
function contentBounds(luma) {
  let minX = CANVAS_SIZE;
  let minY = CANVAS_SIZE;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < CANVAS_SIZE; y += 1) {
    for (let x = 0; x < CANVAS_SIZE; x += 1) {
      if (luma[y * CANVAS_SIZE + x] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: CANVAS_SIZE - 1, maxY: CANVAS_SIZE - 1 };
  return { minX, minY, maxX, maxY };
}

function measureTile(tileType, refLuma) {
  const image = decodePng(path.join(tilesDir, `${tileType}.png`));
  if (image.width !== CANVAS_SIZE || image.height !== CANVAS_SIZE) {
    throw new Error(`${tileType}.png must be ${CANVAS_SIZE}x${CANVAS_SIZE}, got ${image.width}x${image.height}`);
  }
  const luma = lumaOf(image);
  const { dx, dy, sad } = bestShift(luma, refLuma);
  const sharesFrame = sad <= FRAME_MATCH_MAX;

  let misaligned;
  let detail;
  if (tileType === referenceTile) {
    misaligned = false;
    detail = 'reference';
  } else if (sharesFrame) {
    misaligned = Math.abs(dx) > TOLERANCE_PX || Math.abs(dy) > TOLERANCE_PX;
    detail = 'shared-frame';
  } else {
    // Different frame art (row-4 replacements): not comparable to road's frame.
    // Require the tile's own content to be roughly centered in the canvas.
    const b = contentBounds(luma);
    const vCenterOff = ((b.minY + (CANVAS_SIZE - 1 - b.maxY)) / 2) - (CANVAS_SIZE - 1 - b.maxY);
    const hCenterOff = ((b.minX + (CANVAS_SIZE - 1 - b.maxX)) / 2) - (CANVAS_SIZE - 1 - b.maxX);
    misaligned = Math.abs(vCenterOff) > CENTER_TOLERANCE_PX || Math.abs(hCenterOff) > CENTER_TOLERANCE_PX;
    detail = `diff-frame center(${vCenterOff.toFixed(1)},${hCenterOff.toFixed(1)})`;
  }

  return {
    tileType,
    bestDx: dx,
    bestDy: dy,
    matchSad: Number(sad.toFixed(1)),
    sharesFrame,
    offset: Math.max(Math.abs(dx), Math.abs(dy)),
    misaligned,
    detail
  };
}

function listTileTypes() {
  return readdirSync(tilesDir)
    .filter((file) => file.endsWith('.png'))
    .map((file) => file.replace(/\.png$/, ''))
    .sort();
}

function runMetricA() {
  const tileTypes = listTileTypes();
  if (!tileTypes.includes(referenceTile)) {
    throw new Error(`Reference tile ${referenceTile}.png not found in ${tilesDir}`);
  }
  const refLuma = lumaOf(decodePng(path.join(tilesDir, `${referenceTile}.png`)));
  const rows = tileTypes
    .map((t) => measureTile(t, refLuma))
    .sort((a, b) => Number(b.misaligned) - Number(a.misaligned)
      || b.offset - a.offset
      || a.tileType.localeCompare(b.tileType));
  return { rows, refLuma };
}

function printTable({ rows }) {
  const flagged = rows.filter((r) => r.misaligned);
  const pass = flagged.length === 0;

  console.log('');
  console.log('Tile sprite alignment audit (metric A: frame cross-correlation)');
  console.log(`  source         : ${path.relative(repoRoot, tilesDir)}/*.png`);
  console.log(`  reference tile : ${referenceTile} (frame ring, +/-${SHIFT_RANGE}px sweep)`);
  console.log(`  tolerance      : shared-frame within +/-${TOLERANCE_PX}px of road; diff-frame centered within +/-${CENTER_TOLERANCE_PX}px`);
  console.log('');

  const header = [
    'tile'.padEnd(18),
    'dx'.padStart(4),
    'dy'.padStart(4),
    'sad'.padStart(6),
    'frame'.padStart(7),
    'offPx'.padStart(6),
    'status'.padStart(11),
    'detail'
  ].join(' ');
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of rows) {
    const status = r.tileType === referenceTile ? 'REFERENCE' : r.misaligned ? 'MISALIGNED' : 'ok';
    console.log([
      r.tileType.padEnd(18),
      String(r.bestDx).padStart(4),
      String(r.bestDy).padStart(4),
      String(r.matchSad).padStart(6),
      (r.sharesFrame ? 'road' : 'diff').padStart(7),
      String(r.offset).padStart(6),
      status.padStart(11),
      r.detail
    ].join(' '));
  }

  console.log('');
  console.log(`Tiles audited : ${rows.length}`);
  console.log(`Misaligned    : ${flagged.length}${flagged.length ? ' -> ' + flagged.map((r) => `${r.tileType}(${r.offset}px)`).join(', ') : ''}`);
  console.log('');
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'} (all board tile frames aligned to ${referenceTile})`);
  console.log('');
  return pass;
}

/**
 * Validate the metric itself before trusting a PASS, using synthetic cases that
 * don't depend on the current (good) sprite state:
 *   - road vs itself must be 0px (baseline sane).
 *   - road shifted by a known +6px must be detected as ~6px (metric is sensitive).
 *   - a known diff-frame tile (thornmaze) must be classified diff-frame.
 */
function selfCheck({ refLuma, rows }) {
  const problems = [];

  const selfShift = bestShift(refLuma, refLuma);
  if (selfShift.dx !== 0 || selfShift.dy !== 0) {
    problems.push(`road vs itself returned (${selfShift.dx},${selfShift.dy}), expected (0,0)`);
  }

  // Build road shifted down by 6px and confirm the metric recovers ~+6.
  const SHIFT = 6;
  const shifted = new Float64Array(CANVAS_SIZE * CANVAS_SIZE);
  for (let y = 0; y < CANVAS_SIZE; y += 1) {
    const sy = y - SHIFT;
    for (let x = 0; x < CANVAS_SIZE; x += 1) {
      shifted[y * CANVAS_SIZE + x] = sy >= 0 ? refLuma[sy * CANVAS_SIZE + x] : 0;
    }
  }
  const recovered = bestShift(shifted, refLuma);
  if (Math.abs(recovered.dy - SHIFT) > 1) {
    problems.push(`metric failed to detect a synthetic ${SHIFT}px shift (got dy=${recovered.dy}) -- not sensitive`);
  }

  const thornmaze = rows.find((r) => r.tileType === 'thornmaze');
  if (thornmaze && thornmaze.sharesFrame) {
    problems.push(`thornmaze classified as shared-frame (sad=${thornmaze.matchSad}) -- frame-match threshold is wrong`);
  }

  if (problems.length) {
    console.error('SELF-CHECK FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    return false;
  }
  console.log('Self-check OK: zero self-shift, +6px synthetic shift detected, diff-frame tiles classified.');
  return true;
}

async function runMetricB() {
  // Imported lazily so metric A has no playwright dependency.
  const { spawn } = await import('node:child_process');
  const { setTimeout: delay } = await import('node:timers/promises');
  const { chromium } = await import('playwright');

  const port = Number(process.env.PLAYWRIGHT_PORT ?? 4300 + Math.floor(Math.random() * 1000));
  const hmrPort = Number(process.env.PLAYWRIGHT_HMR_PORT ?? port + 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const roomCode = `align-${Date.now().toString(36)}`;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(repoRoot, 'test-results/tile-align', stamp);
  mkdirSync(outDir, { recursive: true });

  let output = '';
  const server = spawn(process.execPath, ['server/index.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), LOOPDUEL_VITE_HMR_PORT: String(hmrPort), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (c) => { output += c.toString(); });
  server.stderr.on('data', (c) => { output += c.toString(); });

  async function stopServer() {
    if (server.exitCode !== null) return;
    server.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      delay(3000).then(() => server.kill('SIGKILL'))
    ]);
  }

  let browser;
  try {
    const deadline = Date.now() + 20_000;
    for (;;) {
      if (server.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${baseUrl}:\n${output}`);
      try {
        const response = await fetch(`${baseUrl}/healthz`);
        if (response.ok) break;
      } catch {
        // keep polling while Vite starts
      }
      await delay(250);
    }

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    await page.goto(baseUrl);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('loopduel.tutorialSeen', 'yes');
    });
    await page.reload();
    await page.fill('#player-name', 'Align');
    await page.fill('#room-code', roomCode);
    await page.click('.primary-action');

    await page.waitForSelector('.player-panel.active.focused .board');
    await page.waitForSelector('.hand-card');
    // Dismiss the intro dialog if it appears so it does not cover the board.
    const cont = page.getByRole('button', { name: /^continue$/i });
    if (await cont.count().catch(() => 0)) await cont.first().click().catch(() => {});
    await page.waitForTimeout(300);

    const board = page.locator('.player-panel.active.focused .board').first();
    const boardPath = path.join(outDir, 'board.png');
    await board.screenshot({ path: boardPath });

    const tileInfo = await page.$$eval('.player-panel.active.focused .tile', (tiles) =>
      tiles.map((el) => {
        const rect = el.getBoundingClientRect();
        const before = window.getComputedStyle(el, '::before');
        return {
          className: el.className,
          rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
          tileArt: el.style.getPropertyValue('--tile-art') || before.getPropertyValue('background-image')
        };
      })
    );
    writeFileSync(path.join(outDir, 'tiles.json'), JSON.stringify(tileInfo, null, 2));

    console.log('');
    console.log('Metric B (in-DOM board screenshot proof)');
    console.log(`  board screenshot : ${path.relative(repoRoot, boardPath)}`);
    console.log(`  tile metadata    : ${path.relative(repoRoot, path.join(outDir, 'tiles.json'))} (${tileInfo.length} tiles)`);
    console.log('  Eyeball board.png: all tile frames should line up row-to-row.');
    console.log('');
  } finally {
    if (browser) await browser.close();
    await stopServer();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = runMetricA();

  if (args.has('--json')) {
    const flagged = result.rows.filter((r) => r.misaligned);
    console.log(JSON.stringify({
      reference: referenceTile,
      tolerancePx: TOLERANCE_PX,
      pass: flagged.length === 0,
      tiles: result.rows
    }, null, 2));
  } else {
    printTable(result);
  }

  const selfOk = selfCheck(result);
  const pass = result.rows.every((r) => !r.misaligned);

  if (args.has('--browser')) {
    await runMetricB();
  }

  process.exitCode = pass && selfOk ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
