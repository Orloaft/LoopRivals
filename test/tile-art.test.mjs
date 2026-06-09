import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createTileSprite,
  comboTransformationSpritePlan,
  decodePng,
  replacementTileSourceDir,
  replacementTileTypes,
  sourceAtlasHeight,
  sourceAtlasPath,
  sourceAtlasWidth,
  spriteSize,
  tileSpritePlan,
  tileTypes
} from '../scripts/slice-tile-art.mjs';
import { terrainCards } from '../server/rules.mjs';

const expectedTileTypes = [
  'road',
  'camp',
  ...terrainCards.map((card) => card.tile),
  'ambush',
  'scorch'
];

const bossLoopTileTypes = [
  'rootwall',
  'bramblebloom',
  'wardensheart',
  'oldgrowth',
  'wyrmhead',
  'wyrmclaw',
  'wyrmcoil',
  'wyrmtail',
  'guardstance',
  'markedchallenge',
  'retaliation',
  'executionstance',
  'seal1',
  'seal2',
  'seal3',
  'innergate'
];

const comboTransformationTileTypes = comboTransformationSpritePlan.map((plan) => plan.tileType);

const roadShapes = ['ew', 'ns', 'en', 'es', 'nw', 'sw'];

function spriteMatchesAtlasCell(sprite, atlas, tileIndex) {
  const col = tileIndex % 6;
  const row = Math.floor(tileIndex / 6);
  const sourceX = col * 256;
  const sourceY = row * 256;
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const spritePixel = (y * sprite.width + x) * 4;
      const atlasPixel = ((sourceY + y) * atlas.width + sourceX + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (sprite.pixels[spritePixel + channel] !== atlas.pixels[atlasPixel + channel]) return false;
      }
    }
  }
  return true;
}

test('tile art uses one unique sprite per board tile type', () => {
  assert.deepEqual(tileTypes, expectedTileTypes);
  assert.equal(new Set(tileTypes).size, tileTypes.length);

  const styles = readFileSync('src/styles.css', 'utf8');
  const mappingBlock = styles.match(/\/\* Each v2 terrain tile[\s\S]*?\.hand-card:hover/);
  assert.ok(mappingBlock, 'missing v2 tile sprite mapping block');

  const tileSprites = new Map();
  const rulePattern = /([^{}]+)\{\s*--tile-art:\s*url\('([^']+)'\);\s*\}/g;
  for (const match of mappingBlock[0].matchAll(rulePattern)) {
    if (match[1].includes('.road-art-')) continue;
    const tileMatch = match[1].match(/\.tile\.([a-z0-9]+)/);
    if (!tileMatch) continue;
    tileSprites.set(tileMatch[1], match[2].trim());
  }

  for (const tileType of tileTypes) {
    assert.equal(tileSprites.get(tileType), `/assets/tiles/v2/${tileType}.png`);
  }

  const usedSprites = tileTypes.map((tileType) => tileSprites.get(tileType));
  assert.equal(new Set(usedSprites).size, usedSprites.length);
});

test('boss-loop tile art has board-ready sprites and class mappings', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  const mappingBlock = styles.match(/\/\* Each v2 terrain tile[\s\S]*?\.hand-card:hover/);
  assert.ok(mappingBlock, 'missing v2 tile sprite mapping block');

  for (const tileType of bossLoopTileTypes) {
    const sprite = readFileSync(`public/assets/tiles/v2/${tileType}.png`);
    assert.equal(sprite.toString('ascii', 1, 4), 'PNG', `${tileType} sprite is not a PNG`);
    assert.equal(sprite.readUInt32BE(16), 256, `${tileType} sprite width should be one board tile`);
    assert.equal(sprite.readUInt32BE(20), 256, `${tileType} sprite height should be one board tile`);
    assert.match(
      mappingBlock[0],
      new RegExp(`\\.tile\\.${tileType},[\\s\\S]*--tile-art:\\s*url\\('/assets/tiles/v2/${tileType}\\.png'\\)`),
      `${tileType} should map to its boss-loop sprite`
    );
  }
});

test('combo transformation tile art has full-tile sprites and class mappings', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  const mappingBlock = styles.match(/\/\* Each v2 terrain tile[\s\S]*?\.hand-card:hover/);
  assert.ok(mappingBlock, 'missing v2 tile sprite mapping block');

  for (const tileType of comboTransformationTileTypes) {
    const sprite = readFileSync(`public/assets/tiles/v2/${tileType}.png`);
    assert.equal(sprite.toString('ascii', 1, 4), 'PNG', `${tileType} sprite is not a PNG`);
    assert.equal(sprite.readUInt32BE(16), 256, `${tileType} sprite width should be one board tile`);
    assert.equal(sprite.readUInt32BE(20), 256, `${tileType} sprite height should be one board tile`);
    assert.match(
      mappingBlock[0],
      new RegExp(`\\.tile\\.${tileType},[\\s\\S]*--tile-art:\\s*url\\('/assets/tiles/v2/${tileType}\\.png'\\)`),
      `${tileType} should map to its combo transformation sprite`
    );
  }
});

test('road tiles use the flush v2 sprite plus the road-shape overlay', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  // Road tiles must render like every other tile: the flush v2 road sprite via --tile-art
  // and the default .tile::before `cover`. They must NOT re-slice the old v1 atlas, which
  // carried a dark frame margin and broke the flush look.
  assert.doesNotMatch(styles, /\.tile\.road::before\s*\{[\s\S]*loopduel-tiles-retro-gothic-v1\.png/);
  assert.doesNotMatch(styles, /background-size:\s*500% 200%/);
  assert.match(styles, /\.tile\.road,[\s\S]*?--tile-art:\s*url\('\/assets\/tiles\/v2\/road\.png'\)/);
  // The dirt path is still layered on top by the road-shape overlay sheet.
  assert.match(styles, /background-image: url\('\/assets\/roads\/loopduel-road-tiles-retro-gothic-dirt-v2\.png'\)/);
  assert.doesNotMatch(styles, /\/assets\/roads\/v2\/road-/);

  for (const shape of roadShapes) {
    assert.ok(
      styles.includes(`.road-shape-${shape}`),
      `missing road-shape ${shape} overlay mapping`
    );
  }
});

test('tile art crop plan uses measured atlas rows and explicit row-four replacements', () => {
  assert.deepEqual(
    tileSpritePlan.filter((plan) => plan.index % 6 === 0).map((plan) => ({
      sourceKind: plan.sourceKind,
      sourceY: plan.sourceY,
      sourceHeight: plan.sourceHeight
    })),
    [
      { sourceKind: 'atlas', sourceY: 17, sourceHeight: 262 },
      { sourceKind: 'atlas', sourceY: 297, sourceHeight: 263 },
      { sourceKind: 'atlas', sourceY: 577, sourceHeight: 263 },
      { sourceKind: 'atlas', sourceY: 858, sourceHeight: 262 },
      { sourceKind: 'replacement', sourceY: undefined, sourceHeight: undefined }
    ]
  );

  // The frame is inset ~11px on each side of its 256px cell, so atlas crops take the
  // measured frame box (x 11..244 -> width 234) rather than the full column.
  const FRAME_INSET_X = 11;
  const FRAME_WIDTH = 234;
  for (const plan of tileSpritePlan) {
    const row = Math.floor(plan.index / 6);
    assert.equal(plan.outputWidth, spriteSize, `${plan.tileType} output width should stay board-ready`);
    assert.equal(plan.outputHeight, spriteSize, `${plan.tileType} output height should stay board-ready`);
    if (row < 4) {
      assert.equal(plan.sourceKind, 'atlas', `${plan.tileType} should come from the measured atlas rows`);
      assert.equal(plan.sourceX, (plan.index % 6) * spriteSize + FRAME_INSET_X, `${plan.tileType} source x should start at the frame box inset inside its atlas column`);
      assert.equal(plan.sourceWidth, FRAME_WIDTH, `${plan.tileType} source width should match the measured frame box, not the full 256px column`);
      // Each row is cropped to its measured frame box on all four sides and bilinear-scaled
      // to fill the square output, so every tile's frame reaches all four edges flush and
      // tiles seam evenly. The box heights (~262-263px) differ slightly per row.
      assert.ok(plan.sourceHeight >= 240 && plan.sourceHeight <= 270, `${plan.tileType} crop height should match a measured frame box (~262-263px), not a flat 256 band`);
      assert.ok(plan.sourceY >= 0, `${plan.tileType} crop should start at or below the measured frame-box top`);
    } else {
      assert.equal(plan.sourceKind, 'replacement', `${plan.tileType} should not use the clipped atlas row`);
      assert.ok(replacementTileTypes.has(plan.tileType), `${plan.tileType} should have an explicit replacement source`);
      assert.equal(plan.sourcePath, `${replacementTileSourceDir}/${plan.tileType}.png`);
      assert.equal(plan.scaleY, false, `${plan.tileType} should not use the old vertical stretch fallback`);
      const source = readFileSync(plan.sourcePath);
      assert.equal(source.toString('ascii', 1, 4), 'PNG', `${plan.tileType} replacement source should be a PNG`);
    }
  }
});

test('atlas-backed terrain sprites preserve the source tile frame', () => {
  // The frame box is smaller than the square output on both axes, so each output pixel
  // maps to a bilinear-scaled source position. We mirror the slicer's sampling exactly
  // (bilinear on both axes, with edge clamping) and allow a 1-channel rounding tolerance.
  // (Exact byte-for-byte fidelity is also covered by the deterministic-output test.)
  const atlas = decodePng(sourceAtlasPath);
  const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
  function bilinear(image, x, y) {
    const x0 = clamp(Math.floor(x), image.width - 1);
    const y0 = clamp(Math.floor(y), image.height - 1);
    const x1 = clamp(x0 + 1, image.width - 1);
    const y1 = clamp(y0 + 1, image.height - 1);
    const wx = x - Math.floor(x);
    const wy = y - Math.floor(y);
    const at = (xx, yy) => {
      const o = (yy * image.width + xx) * 4;
      return [image.pixels[o], image.pixels[o + 1], image.pixels[o + 2], image.pixels[o + 3]];
    };
    const tl = at(x0, y0); const tr = at(x1, y0); const bl = at(x0, y1); const br = at(x1, y1);
    return tl.map((c, i) => {
      const top = c + (tr[i] - c) * wx;
      const bottom = bl[i] + (br[i] - bl[i]) * wx;
      return Math.round(top + (bottom - top) * wy);
    });
  }
  const TOLERANCE = 1;
  for (const tileType of ['forge', 'armory', 'wyrmgate', 'tollgate']) {
    const plan = tileSpritePlan.find((item) => item.tileType === tileType);
    assert.ok(plan, `${tileType} should have a sprite plan`);
    assert.equal(plan.sourceKind, 'atlas', `${tileType} should be atlas-backed`);
    const sprite = decodePng(`public/assets/tiles/v2/${tileType}.png`);
    for (const [x, y] of [[0, 0], [128, 0], [0, 128], [255, 255]]) {
      const srcX = plan.sourceX + ((x + 0.5) * plan.sourceWidth / plan.outputWidth) - 0.5;
      const srcY = plan.sourceY + ((y + 0.5) * plan.sourceHeight / plan.outputHeight) - 0.5;
      const expected = bilinear(atlas, srcX, srcY);
      const spriteOffset = (y * sprite.width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(sprite.pixels[spriteOffset + channel] - expected[channel]);
        assert.ok(
          delta <= TOLERANCE,
          `${tileType} should preserve source frame pixel ${x},${y} channel ${channel} (delta ${delta})`
        );
      }
    }
  }
});

test('tile art source atlas dimensions match the sprite grid', () => {
  const atlas = readFileSync(sourceAtlasPath);
  assert.equal(atlas.toString('ascii', 1, 4), 'PNG');
  assert.equal(atlas.readUInt32BE(16), sourceAtlasWidth);
  assert.equal(atlas.readUInt32BE(20), sourceAtlasHeight);
});

test('tile art sprites are full-size single-tile images', () => {
  for (const tileType of tileTypes) {
    const sprite = readFileSync(`public/assets/tiles/v2/${tileType}.png`);
    assert.equal(sprite.toString('ascii', 1, 4), 'PNG', `${tileType} sprite is not a PNG`);
    assert.equal(sprite.readUInt32BE(16), 256, `${tileType} sprite width should be one atlas cell`);
    assert.equal(sprite.readUInt32BE(20), 256, `${tileType} sprite height should be one atlas cell`);
  }

  const roadSheet = readFileSync('public/assets/roads/loopduel-road-tiles-retro-gothic-dirt-v2.png');
  assert.equal(roadSheet.toString('ascii', 1, 4), 'PNG', 'road shape sheet is not a PNG');
  assert.equal(roadSheet.readUInt32BE(16), 1536, 'road shape sheet should keep six 256px columns');
  assert.equal(roadSheet.readUInt32BE(20), 256, 'road shape sheet should keep one 256px row');
});

test('tile art sprites are deterministic output from the slicer', () => {
  const atlas = decodePng(sourceAtlasPath);
  const tileSprites = new Map();
  for (const plan of tileSpritePlan) {
    const actual = decodePng(`public/assets/tiles/v2/${plan.tileType}.png`);
    const expected = createTileSprite(atlas, plan);
    tileSprites.set(plan.tileType, expected);
    assert.equal(actual.width, expected.width, `${plan.tileType} sprite width changed`);
    assert.equal(actual.height, expected.height, `${plan.tileType} sprite height changed`);
    assert.equal(
      Buffer.compare(actual.pixels, expected.pixels),
      0,
      `${plan.tileType} sprite should be regenerated by scripts/slice-tile-art.mjs`
    );
  }

  for (const plan of comboTransformationSpritePlan) {
    const actual = decodePng(`public/assets/tiles/v2/${plan.tileType}.png`);
    const base = tileSprites.get(plan.base);
    assert.ok(base, `${plan.tileType} should derive from a known base tile`);
    assert.equal(actual.width, base.width, `${plan.tileType} sprite width changed`);
    assert.equal(actual.height, base.height, `${plan.tileType} sprite height changed`);
    assert.notEqual(
      Buffer.compare(actual.pixels, base.pixels),
      0,
      `${plan.tileType} should be a full tile identity, not an unmodified base sprite`
    );
  }
});

test('lower atlas rows are not exact boundary crops with neighboring-row bleed', () => {
  const atlas = decodePng(sourceAtlasPath);
  for (const [index, tileType] of tileTypes.entries()) {
    if (index < 6) continue;
    const plan = tileSpritePlan[index];
    const sprite = decodePng(`public/assets/tiles/v2/${tileType}.png`);
    assert.equal(sprite.width, 256, `${tileType} sprite width should stay board-ready`);
    assert.equal(sprite.height, 256, `${tileType} sprite height should stay board-ready`);
    if (plan.sourceKind === 'replacement') {
      assert.ok(replacementTileTypes.has(tileType), `${tileType} should come from explicit generated replacement art`);
      continue;
    }
    assert.equal(
      spriteMatchesAtlasCell(sprite, atlas, index),
      false,
      `${tileType} sprite should avoid exact atlas row boundaries because the source atlas rows overlap`
    );
  }
});
