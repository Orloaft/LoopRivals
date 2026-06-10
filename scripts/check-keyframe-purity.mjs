// Keyframe-purity gate: @keyframes may only animate compositor-friendly
// properties (transform/opacity & friends). Animating filter, box-shadow,
// colors, or layout properties re-paints the element every frame, which is
// exactly what produced the combat spike tail measured in
// docs/frame-consistency-appraisal.md. New juice must use the cheap pathway
// (see docs/juice-toolkit.md); deliberate exceptions go in EXCEPTIONS with a
// reason.
import { readFileSync } from 'node:fs';

const CSS_PATH = new URL('../src/styles.css', import.meta.url);

// Compositor-driven (or otherwise per-frame-paint-free) properties.
const ALLOWED = new Set([
  'transform',
  'translate',
  'rotate',
  'scale',
  'opacity',
  'transform-origin',
  'offset-distance',
  'visibility', // discrete; flips once, no per-frame paint
  'animation-timing-function', // per-keyframe easing, not a painted property
]);

// keyframe name -> { props: [...], reason }
// Keep this list SHORT. Every entry is paint work on every animation frame.
const EXCEPTIONS = new Map([
  ['combat-fx-sheet', {
    props: ['background-position-x'],
    reason: 'sprite-sheet scrubbing; steps() timing, small fixed-size fx quad',
  }],
  ['combat-fx-sheet-flip', {
    props: ['background-position-x'],
    reason: 'sprite-sheet scrubbing; steps() timing, small fixed-size fx quad',
  }],
  ['danger-pulse', {
    props: ['box-shadow'],
    reason: 'tiny paint area (tile ring); stopped in quality-low',
  }],
  ['trait-pulse', {
    props: ['box-shadow'],
    reason: 'tiny paint area (trait chip); stopped in quality-low',
  }],
]);

const css = readFileSync(CSS_PATH, 'utf8');

// Strip comments so commented-out declarations don't trip the scan.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const violations = [];
const seenExceptionProps = new Map();

const re = /@keyframes\s+([\w-]+)\s*\{/g;
let match;
while ((match = re.exec(stripped)) !== null) {
  const name = match[1];
  // Walk to the matching closing brace of the @keyframes block.
  let depth = 1;
  let i = re.lastIndex;
  while (i < stripped.length && depth > 0) {
    const ch = stripped[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  const body = stripped.slice(re.lastIndex, i - 1);
  re.lastIndex = i;

  // Declarations inside frame blocks: "prop: value;"
  for (const decl of body.matchAll(/([\w-]+)\s*:/g)) {
    const prop = decl[1].toLowerCase();
    if (ALLOWED.has(prop)) continue;
    const exception = EXCEPTIONS.get(name);
    if (exception?.props.includes(prop)) {
      if (!seenExceptionProps.has(name)) seenExceptionProps.set(name, new Set());
      seenExceptionProps.get(name).add(prop);
      continue;
    }
    const line = stripped.slice(0, match.index).split('\n').length;
    violations.push({ name, prop, line });
  }
}

// Flag stale exceptions so the list can't rot.
for (const [name, entry] of EXCEPTIONS) {
  const seen = seenExceptionProps.get(name);
  for (const prop of entry.props) {
    if (!seen?.has(prop)) {
      console.warn(`[keyframe-purity] stale exception: ${name} no longer animates ${prop} — remove it from EXCEPTIONS`);
    }
  }
}

if (violations.length > 0) {
  console.error('[keyframe-purity] FAIL — keyframes animating paint-triggering properties:\n');
  for (const v of violations) {
    console.error(`  @keyframes ${v.name} (near styles.css:${v.line}) animates "${v.prop}"`);
  }
  console.error(
    '\nAnimate transform/opacity instead (docs/juice-toolkit.md has the cheap recipes:' +
    '\npre-baked glow/flash overlays cross-faded with opacity, shadows on static' +
    '\nunderlays, brightness flashes as overlay sprites). If this paint animation is' +
    '\ngenuinely tiny and intentional, add it to EXCEPTIONS in scripts/check-keyframe-purity.mjs' +
    '\nwith a reason and make sure quality-low disables it.'
  );
  process.exit(1);
}

console.log('[keyframe-purity] OK — all @keyframes are transform/opacity-clean (plus documented exceptions)');
