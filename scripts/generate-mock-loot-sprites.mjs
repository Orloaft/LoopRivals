import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('public/assets/items');

const items = [
  ['weapon', 'Glass Pike', 'glass-pike', '#9be8ff'],
  ['weapon', 'Moonblade', 'moonblade', '#9fb7ff'],
  ['weapon', 'Ash Bow', 'ash-bow', '#c46d4a'],
  ['weapon', 'Thorn Mace', 'thorn-mace', '#73a55c'],
  ['weapon', 'Cinder Wand', 'cinder-wand', '#ff744d'],
  ['shield', 'Tin Aegis', 'tin-aegis', '#b9c2c0'],
  ['shield', 'Root Buckler', 'root-buckler', '#8f6a3c'],
  ['shield', 'Mirror Ward', 'mirror-ward', '#9fe0ff'],
  ['shield', 'Crypt Kite', 'crypt-kite', '#9d9a88'],
  ['shield', 'Cinder Guard', 'cinder-guard', '#f16b3d'],
  ['helm', 'Crowncap Helm', 'crowncap-helm', '#c89d4b'],
  ['helm', 'Ashen Sallet', 'ashen-sallet', '#9f9a8d'],
  ['helm', 'Moon Hood', 'moon-hood', '#7788d8'],
  ['helm', 'Bone Visor', 'bone-visor', '#d8cfaa'],
  ['helm', 'Rune Circlet', 'rune-circlet', '#66d4d8'],
  ['armor', 'Patchwork Mail', 'patchwork-mail', '#a8845c'],
  ['armor', 'Duel Cloak', 'duel-cloak', '#9d1f35'],
  ['armor', 'Grave Harness', 'grave-harness', '#8f8b77'],
  ['armor', 'Briar Plate', 'briar-plate', '#697d47'],
  ['armor', 'Loop Hauberk', 'loop-hauberk', '#d8aa4d'],
  ['gloves', 'Mire Grips', 'mire-grips', '#617d50'],
  ['gloves', 'Duelist Wraps', 'duelist-wraps', '#d8c8a0'],
  ['gloves', 'Ember Gaunts', 'ember-gaunts', '#f06b3e'],
  ['gloves', 'Thorn Claws', 'thorn-claws', '#7ba65b'],
  ['gloves', 'Hex Mitts', 'hex-mitts', '#7460c8'],
  ['boots', 'Road Boots', 'road-boots', '#7f6246'],
  ['boots', 'Softstep Greaves', 'softstep-greaves', '#8d93a8'],
  ['boots', 'Moss Treads', 'moss-treads', '#669055'],
  ['boots', 'Spur Sabatons', 'spur-sabatons', '#c39b55'],
  ['boots', 'Wyrm Soles', 'wyrm-soles', '#7e4f3f'],
  ['ring', 'Red Loop Ring', 'red-loop-ring', '#d53532'],
  ['ring', 'Lucky Band', 'lucky-band', '#e1bf58'],
  ['ring', 'Vow Signet', 'vow-signet', '#cfa45a'],
  ['ring', 'Black Market Seal', 'black-market-seal', '#2e2b32'],
  ['ring', 'Grove Coil', 'grove-coil', '#5c9d59'],
  ['charm', 'Lucky Tooth', 'lucky-tooth', '#e4d3a6'],
  ['charm', 'War Drum', 'war-drum', '#a84a34'],
  ['charm', 'Soft Lantern', 'soft-lantern', '#f2c86e'],
  ['charm', 'Hex Needle', 'hex-needle', '#8366d9'],
  ['charm', 'Green Sigil', 'green-sigil', '#5fb86d']
];

const glow = (color) => `<filter id="glow"><feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-color="#120907" flood-opacity=".85"/><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${color}" flood-opacity=".5"/></filter>`;
const outline = '#24140d';
const metal = '#d8c68f';
const shadow = 'rgba(0,0,0,.42)';

function weapon(name, color, i) {
  if (name.includes('Bow')) return `<path d="M24 12 C42 18 43 46 24 52" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/><path d="M24 12 C42 18 43 46 24 52" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/><path d="M25 12 L25 52" stroke="#e7d8ab" stroke-width="2"/><path d="M18 34 L43 24 L37 34 L43 44 Z" fill="#b07a45" stroke="${outline}" stroke-width="3"/>`;
  if (name.includes('Mace')) return `<path d="M21 48 L40 22" stroke="${outline}" stroke-width="8" stroke-linecap="round"/><path d="M21 48 L40 22" stroke="#bfa06a" stroke-width="4" stroke-linecap="round"/><path d="M36 11 L50 19 L47 33 L32 35 L25 23 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M35 14 L32 7 M48 20 L57 17 M47 32 L54 38" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`;
  if (name.includes('Wand')) return `<path d="M20 50 L43 17" stroke="${outline}" stroke-width="8" stroke-linecap="round"/><path d="M20 50 L43 17" stroke="#7b5034" stroke-width="4" stroke-linecap="round"/><path d="M41 9 L50 17 L44 27 L35 19 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><circle cx="45" cy="17" r="3" fill="#ffd078"/>`;
  const blade = name.includes('Moon') ? 'M21 50 C35 32 38 17 31 8 C45 14 51 27 44 42 Z' : 'M18 51 L34 8 L48 20 L27 54 Z';
  return `<path d="${blade}" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M25 45 L17 55 M27 46 L38 55" stroke="${metal}" stroke-width="4" stroke-linecap="round"/><path d="M33 14 L29 43" stroke="#fff3bc" stroke-width="${i % 2 ? 2 : 1.5}" opacity=".75"/>`;
}

function shield(name, color) {
  const shape = name.includes('Kite') ? 'M32 8 L51 17 L47 39 L32 57 L17 39 L13 17 Z' : 'M32 8 C44 11 51 17 51 17 C50 39 42 50 32 56 C22 50 14 39 13 17 C13 17 20 11 32 8 Z';
  const detail = name.includes('Mirror') ? '<ellipse cx="32" cy="29" rx="11" ry="15" fill="#b9f0ff" opacity=".72"/>' : name.includes('Root') ? '<path d="M32 13 C25 25 42 30 29 51 M24 35 C32 32 34 38 41 35" stroke="#553a24" stroke-width="3" fill="none"/>' : '<path d="M32 13 L32 51 M18 25 L46 25" stroke="#ffe08a" stroke-width="3" opacity=".72"/>';
  return `<path d="${shape}" fill="${color}" stroke="${outline}" stroke-width="4"/>${detail}<path d="M20 18 C28 13 37 13 45 18" stroke="#fff0b5" stroke-width="2" opacity=".55"/>`;
}

function helm(name, color) {
  if (name.includes('Circlet')) return `<ellipse cx="32" cy="34" rx="21" ry="9" fill="none" stroke="${outline}" stroke-width="7"/><ellipse cx="32" cy="34" rx="21" ry="9" fill="none" stroke="${color}" stroke-width="4"/><circle cx="32" cy="24" r="6" fill="#68e5e0" stroke="${outline}" stroke-width="3"/><path d="M22 32 L18 22 M42 32 L46 22" stroke="${metal}" stroke-width="3"/>`;
  if (name.includes('Hood')) return `<path d="M15 51 C17 24 24 10 33 9 C45 13 51 28 49 51 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M23 46 C24 29 29 22 34 21 C40 23 43 31 42 46 Z" fill="#171321" stroke="${outline}" stroke-width="3"/>`;
  return `<path d="M15 38 C17 18 27 9 39 13 C48 18 51 29 47 43 L18 49 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M18 36 L48 36" stroke="${metal}" stroke-width="4"/><path d="M28 15 L24 34 M38 16 L42 35" stroke="#fff0bc" stroke-width="2" opacity=".55"/>`;
}

function armor(name, color) {
  const cloak = name.includes('Cloak');
  if (cloak) return `<path d="M22 11 L42 11 C50 25 51 43 44 56 C35 51 27 51 19 56 C13 42 14 25 22 11 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M31 14 C27 28 27 42 24 54" stroke="#ffd98b" stroke-width="2" opacity=".7"/><circle cx="32" cy="14" r="5" fill="${metal}" stroke="${outline}" stroke-width="3"/>`;
  return `<path d="M21 10 L43 10 L51 24 L45 55 L19 55 L13 24 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M22 16 L42 16 L39 48 L25 48 Z" fill="#3a2a22" opacity=".28"/><path d="M18 28 L46 28 M21 40 L43 40" stroke="#ffe08a" stroke-width="2" opacity=".58"/>`;
}

function gloves(name, color) {
  const claws = name.includes('Claws') ? '<path d="M17 17 L12 7 M28 14 L27 4 M40 16 L47 7" stroke="#e5d1a1" stroke-width="3" stroke-linecap="round"/>' : '';
  return `${claws}<path d="M17 18 C27 10 45 17 43 32 L40 52 L20 52 L13 33 C10 25 11 21 17 18 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M21 25 L18 42 M31 22 L31 43 M40 27 L37 43" stroke="#fff0b8" stroke-width="2" opacity=".52"/>`;
}

function boots(name, color) {
  const spur = name.includes('Spur') ? '<path d="M43 39 L56 34 L49 45 Z" fill="#d8b15a" stroke="#24140d" stroke-width="3"/>' : '';
  return `<path d="M22 10 L38 12 L38 35 C44 35 50 39 52 47 C41 52 28 51 16 48 L19 35 Z" fill="${color}" stroke="${outline}" stroke-width="4"/>${spur}<path d="M20 46 C31 49 42 48 51 45" stroke="#ffe08a" stroke-width="3" opacity=".58"/><path d="M24 17 L37 18" stroke="#19100b" stroke-width="3"/>`;
}

function ring(name, color) {
  const stone = name.includes('Seal') ? '#111014' : color;
  return `<ellipse cx="32" cy="35" rx="18" ry="15" fill="none" stroke="${outline}" stroke-width="9"/><ellipse cx="32" cy="35" rx="18" ry="15" fill="none" stroke="${metal}" stroke-width="5"/><path d="M24 18 L40 18 L45 29 L32 38 L19 29 Z" fill="${stone}" stroke="${outline}" stroke-width="4"/><path d="M27 22 L37 22 L32 31 Z" fill="#fff2b2" opacity=".48"/>`;
}

function charm(name, color) {
  if (name.includes('Drum')) return `<ellipse cx="32" cy="23" rx="16" ry="8" fill="${metal}" stroke="${outline}" stroke-width="4"/><path d="M17 24 L23 51 C29 56 38 56 44 51 L47 24 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M22 30 L43 47 M42 30 L21 47" stroke="#f3d18b" stroke-width="2"/>`;
  if (name.includes('Lantern')) return `<path d="M24 13 C24 8 40 8 40 13" fill="none" stroke="${outline}" stroke-width="4"/><path d="M22 20 L42 20 L47 49 L17 49 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M26 25 L38 25 L40 45 L24 45 Z" fill="#ffe08a" opacity=".76"/>`;
  if (name.includes('Needle')) return `<path d="M18 54 L44 10" stroke="${outline}" stroke-width="8" stroke-linecap="round"/><path d="M18 54 L44 10" stroke="${color}" stroke-width="4" stroke-linecap="round"/><circle cx="45" cy="9" r="6" fill="none" stroke="${outline}" stroke-width="4"/><circle cx="45" cy="9" r="3" fill="none" stroke="#d7c7ff" stroke-width="2"/>`;
  if (name.includes('Tooth')) return `<path d="M23 10 C39 14 46 25 42 39 C39 50 29 56 24 55 C29 45 21 37 18 27 C15 20 17 13 23 10 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M25 15 C32 18 36 24 36 32" stroke="#fff7cf" stroke-width="2" opacity=".65"/>`;
  return `<path d="M32 8 L51 25 L44 51 L20 51 L13 25 Z" fill="${color}" stroke="${outline}" stroke-width="4"/><path d="M32 17 L39 32 L32 46 L25 32 Z" fill="#102716" stroke="#d9f2a4" stroke-width="3"/><path d="M20 26 L44 26" stroke="#ffe08a" stroke-width="2" opacity=".55"/>`;
}

function art(slot, name, color, index) {
  const fns = { weapon, shield, helm, armor, gloves, boots, ring, charm };
  return fns[slot](name, color, index);
}

function sprite(slot, name, color, index) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${name}">
  <defs>${glow(color)}</defs>
  <ellipse cx="32" cy="55" rx="19" ry="5" fill="${shadow}"/>
  <g filter="url(#glow)">${art(slot, name, color, index)}</g>
</svg>
`;
}

function sheet() {
  const cells = items.map(([slot, name, , color], index) => {
    const x = (index % 8) * 64;
    const y = Math.floor(index / 8) * 64;
    return `<g transform="translate(${x} ${y})">${art(slot, name, color, index)}</g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320">
  <defs>${glow('#e2b96b')}</defs>
  <rect width="512" height="320" fill="none"/>
  <g filter="url(#glow)">${cells}</g>
</svg>
`;
}

await mkdir(outDir, { recursive: true });
await Promise.all(items.map(([slot, name, slug, color], index) => (
  writeFile(path.join(outDir, `${slug}.svg`), sprite(slot, name, color, index))
)));
await writeFile(path.join(outDir, 'mock-loot-sheet.svg'), sheet());
