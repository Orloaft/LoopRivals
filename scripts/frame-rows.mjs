// Measures the ornate frame box (atlas y of the top and bottom frame bars) for each of
// the 4 atlas rows in the tile source sheet. Used to derive rowCropPlan in
// scripts/slice-tile-art.mjs. Run: node scripts/frame-rows.mjs
import { decodePng, sourceAtlasPath } from './slice-tile-art.mjs';

const atlas = decodePng(sourceAtlasPath);
const { width: W, height: H } = atlas;
const bright = (o) => (atlas.pixels[o] + atlas.pixels[o + 1] + atlas.pixels[o + 2]) / 3;

// Full-width average brightness per scanline.
const profile = new Array(H).fill(0);
for (let y = 0; y < H; y += 1) {
  let sum = 0;
  for (let x = 2; x < W - 2; x += 1) sum += bright((y * W + x) * 4);
  profile[y] = sum / (W - 4);
}

// Inter-row dark gaps (near-black full-width bands) delimit the cells.
const gaps = [];
let start = -1;
for (let y = 0; y < H; y += 1) {
  if (profile[y] < 9) {
    if (start < 0) start = y;
  } else if (start >= 0) {
    if (y - start >= 4) gaps.push([start, y - 1]);
    start = -1;
  }
}
if (start >= 0) gaps.push([start, H - 1]);

// Each cell window sits between consecutive gaps; the frame box is the first/last
// scanline inside it that is clearly brighter than the dark interior.
const windows = [];
for (let i = 0; i < gaps.length - 1; i += 1) windows.push([gaps[i][1] + 1, gaps[i + 1][0] - 1]);

windows.forEach(([a, b], row) => {
  let top = -1;
  let bottom = -1;
  for (let y = a; y <= b; y += 1) if (profile[y] > 32) { top = y; break; }
  for (let y = b; y >= a; y -= 1) if (profile[y] > 28) { bottom = y; break; }
  console.log(`row${row}: frameTop ${top}  frameBot ${bottom}  H=${bottom - top + 1}`);
});
