import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { terrainCards } from '../server/rules.mjs';

const sourceAtlasPath = 'dev-assets/source/assets/tiles/loopduel-tiles-retro-gothic-v2.png';
const outputDir = 'public/assets/tiles/v2';
const spriteSize = 256;

const tileTypes = [
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

const bossLoopSpritePlan = [
  { tileType: 'rootwall', base: 'thornmaze', accent: [101, 151, 72], symbol: 'thorns' },
  { tileType: 'bramblebloom', base: 'grove', accent: [143, 72, 126], symbol: 'bloom' },
  { tileType: 'wardensheart', base: 'grove', accent: [166, 56, 55], symbol: 'heart' },
  { tileType: 'oldgrowth', base: 'grove', accent: [182, 139, 72], symbol: 'rings' },
  { tileType: 'wyrmhead', base: 'dragonroost', accent: [180, 87, 45], symbol: 'head' },
  { tileType: 'wyrmclaw', base: 'scorch', accent: [217, 154, 71], symbol: 'claw' },
  { tileType: 'wyrmcoil', base: 'mire', accent: [104, 159, 142], symbol: 'coil' },
  { tileType: 'wyrmtail', base: 'dragonroost', accent: [193, 123, 62], symbol: 'tail' },
  { tileType: 'guardstance', base: 'armory', accent: [198, 164, 88], symbol: 'shield' },
  { tileType: 'markedchallenge', base: 'obelisk', accent: [151, 82, 203], symbol: 'mark' },
  { tileType: 'retaliation', base: 'forge', accent: [205, 82, 54], symbol: 'crossed' },
  { tileType: 'executionstance', base: 'ruinedkeep', accent: [211, 180, 114], symbol: 'blade' },
  { tileType: 'seal1', base: 'waystone', accent: [104, 199, 218], symbol: 'seal1' },
  { tileType: 'seal2', base: 'reliquary', accent: [178, 117, 221], symbol: 'seal2' },
  { tileType: 'seal3', base: 'crypt', accent: [211, 180, 94], symbol: 'seal3' },
  { tileType: 'innergate', base: 'tollgate', accent: [222, 140, 57], symbol: 'gate' }
];

const rowCropPlan = [
  { sourceY: 0, sourceHeight: 256 },
  { sourceY: 296, sourceHeight: 256 },
  { sourceY: 577, sourceHeight: 256 },
  { sourceY: 858, sourceHeight: 256 },
  { sourceY: 1124, sourceHeight: 156 }
];

const tileSpritePlan = tileTypes.map((tileType, index) => {
  const row = Math.floor(index / 6);
  const col = index % 6;
  const crop = rowCropPlan[row];
  if (!crop) throw new Error(`Missing crop plan for tile row ${row}`);
  return {
    tileType,
    index,
    sourceX: col * spriteSize,
    sourceY: crop.sourceY,
    sourceWidth: spriteSize,
    sourceHeight: crop.sourceHeight,
    outputWidth: spriteSize,
    outputHeight: spriteSize
  };
});

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePng(filePath) {
  const source = readFileSync(filePath);
  if (source.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${filePath} is not a PNG`);
  const width = source.readUInt32BE(16);
  const height = source.readUInt32BE(20);
  const bitDepth = source[24];
  const colorType = source[25];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${filePath} must use 8-bit RGB or RGBA pixels`);
  }

  const channelCount = colorType === 6 ? 4 : 3;
  const rowBytes = width * channelCount;
  const chunks = [];
  let offset = 8;
  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === 'IDAT') chunks.push(source.subarray(dataStart, dataStart + length));
    offset = dataStart + length + 4;
    if (type === 'IEND') break;
  }

  const inflated = inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(width * height * 4);
  const previous = Buffer.alloc(rowBytes);
  const current = Buffer.alloc(rowBytes);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[inputOffset + x];
      const left = x >= channelCount ? current[x - channelCount] : 0;
      const up = previous[x];
      const upLeft = x >= channelCount ? previous[x - channelCount] : 0;
      if (filter === 0) current[x] = raw;
      else if (filter === 1) current[x] = (raw + left) & 255;
      else if (filter === 2) current[x] = (raw + up) & 255;
      else if (filter === 3) current[x] = (raw + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) current[x] = (raw + paethPredictor(left, up, upLeft)) & 255;
      else throw new Error(`${filePath} uses unsupported PNG filter ${filter}`);
    }
    inputOffset += rowBytes;

    for (let x = 0; x < width; x += 1) {
      const inputPixel = x * channelCount;
      const outputPixel = (y * width + x) * 4;
      pixels[outputPixel] = current[inputPixel];
      pixels[outputPixel + 1] = current[inputPixel + 1];
      pixels[outputPixel + 2] = current[inputPixel + 2];
      pixels[outputPixel + 3] = channelCount === 4 ? current[inputPixel + 3] : 255;
    }
    previous.set(current);
  }

  return { width, height, pixels };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function encodePng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (rowBytes + 1);
    raw[rawOffset] = 0;
    pixels.copy(raw, rawOffset + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function samplePixel(image, x, y) {
  const clampedX = Math.max(0, Math.min(image.width - 1, x));
  const clampedY = Math.max(0, Math.min(image.height - 1, y));
  const offset = (clampedY * image.width + clampedX) * 4;
  return [
    image.pixels[offset],
    image.pixels[offset + 1],
    image.pixels[offset + 2],
    image.pixels[offset + 3]
  ];
}

function sampleVertical(image, x, y) {
  const y0 = Math.floor(y);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const weight = y - y0;
  const top = samplePixel(image, x, y0);
  const bottom = samplePixel(image, x, y1);
  return top.map((channel, index) => Math.round(channel + (bottom[index] - channel) * weight));
}

function cropSprite(atlas, plan) {
  const pixels = Buffer.alloc(plan.outputWidth * plan.outputHeight * 4);
  for (let y = 0; y < plan.outputHeight; y += 1) {
    const sourceY = plan.sourceHeight === plan.outputHeight
      ? plan.sourceY + y
      : plan.sourceY + ((y + 0.5) * plan.sourceHeight / plan.outputHeight) - 0.5;
    for (let x = 0; x < plan.outputWidth; x += 1) {
      const [red, green, blue, alpha] = plan.sourceHeight === plan.outputHeight
        ? samplePixel(atlas, plan.sourceX + x, sourceY)
        : sampleVertical(atlas, plan.sourceX + x, sourceY);
      const output = (y * plan.outputWidth + x) * 4;
      pixels[output] = red;
      pixels[output + 1] = green;
      pixels[output + 2] = blue;
      pixels[output + 3] = alpha;
    }
  }
  return { width: plan.outputWidth, height: plan.outputHeight, pixels };
}

function cloneImage(image) {
  return {
    width: image.width,
    height: image.height,
    pixels: Buffer.from(image.pixels)
  };
}

function blendPixel(image, x, y, color, alpha = 0.8) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4;
  const sourceAlpha = (color[3] ?? 255) / 255 * alpha;
  image.pixels[offset] = Math.round(image.pixels[offset] * (1 - sourceAlpha) + color[0] * sourceAlpha);
  image.pixels[offset + 1] = Math.round(image.pixels[offset + 1] * (1 - sourceAlpha) + color[1] * sourceAlpha);
  image.pixels[offset + 2] = Math.round(image.pixels[offset + 2] * (1 - sourceAlpha) + color[2] * sourceAlpha);
  image.pixels[offset + 3] = Math.max(image.pixels[offset + 3], color[3] ?? 255);
}

function drawDisk(image, cx, cy, radius, color, alpha = 0.8) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) blendPixel(image, x, y, color, alpha);
    }
  }
}

function drawLine(image, x0, y0, x1, y1, color, width = 3, alpha = 0.85) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (steps === 0) {
    drawDisk(image, x0, y0, width / 2, color, alpha);
    return;
  }
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawDisk(
      image,
      Math.round(x0 + (x1 - x0) * t),
      Math.round(y0 + (y1 - y0) * t),
      width / 2,
      color,
      alpha
    );
  }
}

function drawCircle(image, cx, cy, radius, color, width = 3, alpha = 0.85) {
  const steps = Math.max(48, Math.ceil(radius * 6));
  let previous = null;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const point = [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    if (previous) drawLine(image, previous[0], previous[1], point[0], point[1], color, width, alpha);
    previous = point;
  }
}

function drawPolygon(image, points, color, width = 3, alpha = 0.85) {
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    drawLine(image, from[0], from[1], to[0], to[1], color, width, alpha);
  }
}

function tintInterior(image, color, alpha = 0.15) {
  for (let y = 36; y < 220; y += 1) {
    for (let x = 36; x < 220; x += 1) {
      const dx = Math.abs(x - 128) / 92;
      const dy = Math.abs(y - 128) / 92;
      const falloff = Math.max(0, 1 - Math.max(dx, dy));
      if (falloff > 0) blendPixel(image, x, y, color, alpha * falloff);
    }
  }
}

function drawBossSymbol(image, symbol, accent) {
  const bright = [Math.min(255, accent[0] + 42), Math.min(255, accent[1] + 42), Math.min(255, accent[2] + 42), 255];
  const dark = [Math.max(0, accent[0] - 64), Math.max(0, accent[1] - 64), Math.max(0, accent[2] - 64), 255];
  tintInterior(image, accent, 0.22);

  if (symbol === 'thorns') {
    for (const [x0, y0, x1, y1] of [[58, 158, 205, 75], [66, 95, 199, 168], [86, 196, 174, 54], [104, 61, 159, 205]]) {
      drawLine(image, x0, y0, x1, y1, dark, 7, 0.9);
      drawLine(image, x0, y0, x1, y1, bright, 3, 0.75);
    }
    for (const [x, y] of [[83, 132], [117, 111], [146, 149], [172, 101], [133, 181], [96, 73]]) {
      drawPolygon(image, [[x, y], [x + 13, y - 12], [x + 3, y + 16]], bright, 2, 0.8);
    }
  } else if (symbol === 'bloom') {
    drawCircle(image, 128, 128, 48, dark, 6, 0.9);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      drawDisk(image, 128 + Math.cos(angle) * 34, 128 + Math.sin(angle) * 34, 16, accent, 0.75);
      drawCircle(image, 128 + Math.cos(angle) * 34, 128 + Math.sin(angle) * 34, 14, bright, 3, 0.8);
    }
    drawDisk(image, 128, 128, 15, bright, 0.85);
  } else if (symbol === 'heart') {
    drawDisk(image, 111, 113, 20, accent, 0.8);
    drawDisk(image, 145, 113, 20, accent, 0.8);
    drawPolygon(image, [[91, 123], [128, 183], [165, 123]], bright, 5, 0.9);
    drawLine(image, 128, 83, 128, 185, dark, 5, 0.65);
    drawCircle(image, 128, 128, 63, bright, 3, 0.5);
  } else if (symbol === 'rings') {
    for (const radius of [22, 38, 55, 72]) drawCircle(image, 128, 128, radius, bright, 3, 0.72);
    drawLine(image, 128, 54, 128, 202, dark, 4, 0.75);
    drawLine(image, 62, 128, 195, 128, dark, 4, 0.55);
  } else if (symbol === 'head') {
    drawPolygon(image, [[128, 56], [180, 122], [154, 190], [128, 166], [102, 190], [76, 122]], dark, 8, 0.9);
    drawPolygon(image, [[128, 66], [168, 123], [146, 169], [128, 150], [110, 169], [88, 123]], bright, 4, 0.86);
    drawDisk(image, 111, 119, 5, [255, 210, 100, 255], 0.9);
    drawDisk(image, 145, 119, 5, [255, 210, 100, 255], 0.9);
  } else if (symbol === 'claw') {
    for (const x of [104, 128, 152]) {
      drawLine(image, x + 24, 62, x - 16, 193, dark, 9, 0.9);
      drawLine(image, x + 24, 62, x - 16, 193, bright, 4, 0.8);
    }
  } else if (symbol === 'coil') {
    for (let radius = 62; radius >= 16; radius -= 12) drawCircle(image, 128, 128, radius, radius % 24 === 2 ? dark : bright, 5, 0.82);
    drawLine(image, 128, 128, 190, 91, bright, 5, 0.8);
  } else if (symbol === 'tail') {
    drawLine(image, 61, 166, 120, 121, dark, 12, 0.9);
    drawLine(image, 120, 121, 179, 91, dark, 12, 0.9);
    drawPolygon(image, [[179, 91], [206, 77], [190, 115]], bright, 4, 0.86);
    drawLine(image, 61, 166, 190, 91, bright, 4, 0.72);
  } else if (symbol === 'shield') {
    drawPolygon(image, [[128, 54], [178, 79], [164, 165], [128, 199], [92, 165], [78, 79]], dark, 7, 0.9);
    drawPolygon(image, [[128, 66], [163, 86], [153, 155], [128, 181], [103, 155], [93, 86]], bright, 4, 0.85);
    drawLine(image, 128, 66, 128, 181, bright, 3, 0.65);
  } else if (symbol === 'mark') {
    drawCircle(image, 128, 128, 67, bright, 4, 0.82);
    drawLine(image, 128, 61, 128, 195, bright, 4, 0.82);
    drawLine(image, 61, 128, 195, 128, bright, 4, 0.82);
    drawCircle(image, 128, 128, 19, dark, 5, 0.9);
  } else if (symbol === 'crossed') {
    drawLine(image, 79, 187, 178, 63, dark, 10, 0.9);
    drawLine(image, 80, 64, 177, 188, dark, 10, 0.9);
    drawLine(image, 79, 187, 178, 63, bright, 4, 0.86);
    drawLine(image, 80, 64, 177, 188, bright, 4, 0.86);
  } else if (symbol === 'blade') {
    drawPolygon(image, [[128, 50], [146, 151], [128, 203], [110, 151]], bright, 5, 0.9);
    drawLine(image, 101, 151, 155, 151, dark, 7, 0.9);
    drawLine(image, 128, 50, 128, 203, dark, 3, 0.7);
  } else if (symbol.startsWith('seal')) {
    const sides = symbol === 'seal1' ? 3 : symbol === 'seal2' ? 4 : 5;
    const points = Array.from({ length: sides }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
      return [128 + Math.cos(angle) * 62, 128 + Math.sin(angle) * 62];
    });
    drawPolygon(image, points, bright, 5, 0.86);
    drawCircle(image, 128, 128, 34, dark, 5, 0.75);
    drawLine(image, 128, 78, 128, 178, bright, 3, 0.65);
    drawLine(image, 86, 153, 170, 103, bright, 3, 0.65);
  } else if (symbol === 'gate') {
    drawLine(image, 82, 190, 82, 92, dark, 9, 0.9);
    drawLine(image, 174, 190, 174, 92, dark, 9, 0.9);
    drawCircle(image, 128, 95, 46, bright, 5, 0.82);
    drawLine(image, 82, 95, 174, 95, dark, 8, 0.88);
    drawLine(image, 128, 95, 128, 190, bright, 4, 0.72);
  }
}

function writeBossLoopSprites(tileSprites) {
  for (const plan of bossLoopSpritePlan) {
    const base = tileSprites.get(plan.base);
    if (!base) throw new Error(`Missing base tile sprite ${plan.base} for ${plan.tileType}`);
    const sprite = cloneImage(base);
    drawBossSymbol(sprite, plan.symbol, plan.accent);
    writeFileSync(path.join(outputDir, `${plan.tileType}.png`), encodePng(sprite));
  }
}

function writeTileSprites() {
  const atlas = decodePng(sourceAtlasPath);
  if (atlas.width !== 1536 || atlas.height !== 1280) {
    throw new Error(`${sourceAtlasPath} must be a 1536x1280 atlas`);
  }

  mkdirSync(outputDir, { recursive: true });
  const tileSprites = new Map();
  for (const plan of tileSpritePlan) {
    const sprite = cropSprite(atlas, plan);
    tileSprites.set(plan.tileType, sprite);
    writeFileSync(path.join(outputDir, `${plan.tileType}.png`), encodePng(sprite));
  }
  writeBossLoopSprites(tileSprites);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  writeTileSprites();
}

export {
  cropSprite,
  decodePng,
  bossLoopSpritePlan,
  bossLoopTileTypes,
  sourceAtlasPath,
  spriteSize,
  tileSpritePlan,
  tileTypes,
  writeTileSprites
};
