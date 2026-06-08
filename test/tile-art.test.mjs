import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  cropSprite,
  comboTransformationSpritePlan,
  decodePng,
  sourceAtlasPath,
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

test('board road art keeps the established road-shape overlay sheet', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  assert.match(styles, /\.tile\.road::before\s*\{[\s\S]*loopduel-tiles-retro-gothic-v1\.png/);
  assert.match(styles, /background-image: url\('\/assets\/roads\/loopduel-road-tiles-retro-gothic-dirt-v2\.png'\)/);
  assert.doesNotMatch(styles, /\/assets\/roads\/v2\/road-/);

  for (const shape of roadShapes) {
    assert.ok(
      styles.includes(`.road-shape-${shape}`),
      `missing road-shape ${shape} overlay mapping`
    );
  }
});

test('tile art crop plan avoids the overlapped source atlas row boundaries', () => {
  assert.deepEqual(
    tileSpritePlan.filter((plan) => plan.index % 6 === 0).map((plan) => ({
      sourceY: plan.sourceY,
      sourceHeight: plan.sourceHeight
    })),
    [
      { sourceY: 0, sourceHeight: 256 },
      { sourceY: 296, sourceHeight: 256 },
      { sourceY: 577, sourceHeight: 256 },
      { sourceY: 858, sourceHeight: 256 },
      { sourceY: 1124, sourceHeight: 156 }
    ]
  );

  for (const plan of tileSpritePlan) {
    const row = Math.floor(plan.index / 6);
    assert.equal(plan.sourceX, (plan.index % 6) * spriteSize, `${plan.tileType} source x should follow its atlas column`);
    if (row > 0) {
      assert.ok(plan.sourceY > row * spriteSize, `${plan.tileType} should not start at the exact overlapped atlas row boundary`);
    }
  }
});

test('tile art source atlas dimensions match the sprite grid', () => {
  const atlas = readFileSync(sourceAtlasPath);
  assert.equal(atlas.toString('ascii', 1, 4), 'PNG');
  assert.equal(atlas.readUInt32BE(16), 1536);
  assert.equal(atlas.readUInt32BE(20), 1280);
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
    const expected = cropSprite(atlas, plan);
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
    const sprite = decodePng(`public/assets/tiles/v2/${tileType}.png`);
    assert.equal(sprite.width, 256, `${tileType} sprite width should stay board-ready`);
    assert.equal(sprite.height, 256, `${tileType} sprite height should stay board-ready`);
    assert.equal(
      spriteMatchesAtlasCell(sprite, atlas, index),
      false,
      `${tileType} sprite should avoid exact atlas row boundaries because the source atlas rows overlap`
    );
  }
});
