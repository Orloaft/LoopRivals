import { mkdir, writeFile } from 'node:fs/promises';
import { talentTrees } from '../server/rules.mjs';

const outDir = new URL('../public/assets/ui/talents/', import.meta.url);

const palettes = {
  'ember-knight': {
    dark: '#1a0c08',
    mid: '#8b2f1f',
    bright: '#e0863e',
    light: '#ffd27a',
    accent: '#d43d2f'
  },
  'moss-warden': {
    dark: '#0c160e',
    mid: '#325b2d',
    bright: '#76a24d',
    light: '#d1d98a',
    accent: '#6e4f2b'
  },
  'night-vagrant': {
    dark: '#0b1020',
    mid: '#2d3358',
    bright: '#8d81c9',
    light: '#e3d9ff',
    accent: '#caa35e'
  },
  'rune-archer': {
    dark: '#091620',
    mid: '#1d4d73',
    bright: '#62a7d5',
    light: '#d3f0ff',
    accent: '#c6b86a'
  },
  'grave-singer': {
    dark: '#121012',
    mid: '#4d3b50',
    bright: '#a994a8',
    light: '#eee1d2',
    accent: '#9f7a3f'
  }
};

function hashId(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

function pixelStars(seed, palette) {
  const stars = [];
  for (let i = 0; i < 6; i += 1) {
    const x = 10 + ((seed >> (i * 3)) % 44);
    const y = 8 + ((seed >> (i * 2 + 5)) % 45);
    const size = 1 + ((seed >> (i + 9)) % 2);
    stars.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${i % 2 ? palette.mid : palette.accent}" opacity=".58"/>`);
  }
  return stars.join('');
}

function iconKind(trait) {
  const id = trait.id;
  if (/step|soft|speed|cadence/.test(id)) return 'boot';
  if (/shield|guard|wall|ward|bark|plate|heart/.test(id)) return 'shield';
  if (/market|pocket|cache|gold|tithe|ledger|robber|haul/.test(id)) return 'coin';
  if (/map|cartographer|compass|sower|grove|terrain|code/.test(id)) return 'map';
  if (/rune|sigil|hex|mark|comet|star/.test(id)) return 'rune';
  if (/bone|grave|crypt|requiem|chorus|ossuary|verse|wraith/.test(id)) return 'bone';
  if (/moss|root|meadow|briar|thorn|haven|warden/.test(id)) return 'leaf';
  if (/knife|shot|archer|fletch|riposte|lash|brand/.test(id)) return 'blade';
  if (/ember|cinder|ash|flame|furnace|coal|overheat|sun/.test(id)) return 'flame';
  return 'loop';
}

function symbol(kind, palette) {
  const stroke = `stroke="${palette.dark}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  if (kind === 'boot') {
    return `<path d="M22 15h12v22l13 5v8H22z" fill="${palette.bright}" ${stroke}/><path d="M24 39h25v7H24z" fill="${palette.light}" ${stroke}/><rect x="28" y="18" width="7" height="16" fill="${palette.mid}"/>`;
  }
  if (kind === 'shield') {
    return `<path d="M32 10l17 7v15c0 11-7 17-17 22-10-5-17-11-17-22V17z" fill="${palette.bright}" ${stroke}/><path d="M32 15v35" stroke="${palette.light}" stroke-width="4"/><path d="M20 25h24" stroke="${palette.mid}" stroke-width="5"/>`;
  }
  if (kind === 'coin') {
    return `<circle cx="32" cy="32" r="18" fill="${palette.accent}" ${stroke}/><circle cx="32" cy="32" r="10" fill="${palette.light}" ${stroke}/><path d="M27 32h10M32 25v15" stroke="${palette.dark}" stroke-width="3"/>`;
  }
  if (kind === 'map') {
    return `<path d="M15 17l14-5 20 7v29l-16-6-18 7z" fill="${palette.light}" ${stroke}/><path d="M29 12v31M34 17v25" stroke="${palette.mid}" stroke-width="3"/><path d="M19 36l8-6 8 3 10-8" fill="none" stroke="${palette.accent}" stroke-width="4"/>`;
  }
  if (kind === 'rune') {
    return `<path d="M32 9l18 18-18 27-18-27z" fill="${palette.mid}" ${stroke}/><path d="M32 16v31M23 27h18M25 38l14-14" stroke="${palette.light}" stroke-width="4" stroke-linecap="square"/>`;
  }
  if (kind === 'bone') {
    return `<circle cx="21" cy="21" r="7" fill="${palette.light}" ${stroke}/><circle cx="43" cy="43" r="7" fill="${palette.light}" ${stroke}/><path d="M23 41l18-18" stroke="${palette.light}" stroke-width="10" stroke-linecap="round"/><path d="M24 40l16-16" stroke="${palette.dark}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (kind === 'leaf') {
    return `<path d="M18 39c1-20 17-27 34-24-3 19-14 33-34 24z" fill="${palette.bright}" ${stroke}/><path d="M20 39c9-8 19-14 31-23" stroke="${palette.light}" stroke-width="4"/><path d="M27 34l-4-11M36 28l-2-10" stroke="${palette.mid}" stroke-width="3"/>`;
  }
  if (kind === 'blade') {
    return `<path d="M41 8l9 9-24 30-8-8z" fill="${palette.light}" ${stroke}/><path d="M18 39l8 8-8 7-8-8z" fill="${palette.accent}" ${stroke}/><path d="M37 15l7 7" stroke="${palette.bright}" stroke-width="4"/>`;
  }
  if (kind === 'flame') {
    return `<path d="M32 55c-12-6-15-17-9-27 3-5 8-9 7-18 12 9 20 19 13 32-2 4-5 8-11 13z" fill="${palette.bright}" ${stroke}/><path d="M33 48c-7-4-8-11-3-18 4 5 8 10 3 18z" fill="${palette.light}"/>`;
  }
  return `<circle cx="32" cy="32" r="18" fill="${palette.mid}" ${stroke}/><path d="M20 32c0-9 10-14 18-8 7 5 4 17-6 17" fill="none" stroke="${palette.light}" stroke-width="5"/>`;
}

function svgFor(trait) {
  const palette = palettes[trait.heroId];
  const seed = hashId(trait.id);
  const kind = iconKind(trait);
  const rotate = (seed % 7) - 3;
  const dot = 12 + (seed % 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${trait.name}">
  <rect width="64" height="64" fill="none"/>
  <circle cx="32" cy="32" r="29" fill="${palette.dark}" opacity=".86"/>
  <path d="M13 32c0-11 8-20 19-20s19 9 19 20-8 20-19 20-19-9-19-20z" fill="${palette.mid}" opacity=".42"/>
  ${pixelStars(seed, palette)}
  <g transform="rotate(${rotate} 32 32)">
    ${symbol(kind, palette)}
  </g>
  <rect x="${dot}" y="54" width="8" height="3" fill="${palette.accent}" opacity=".88"/>
</svg>
`;
}

await mkdir(outDir, { recursive: true });

for (const tree of Object.values(talentTrees)) {
  for (const trait of tree) {
    await writeFile(new URL(`${trait.id}.svg`, outDir), svgFor(trait), 'utf8');
  }
}

console.log(`Generated ${Object.values(talentTrees).flat().length} talent icons in ${outDir.pathname}`);
