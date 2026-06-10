// Frame-consistency gate: runs the 60s forced-combat jank probe under
// software GL (weak-machine proxy) in both quality modes and asserts budgets.
// This is what keeps new juice from silently regressing the spike tail —
// budgets come from the measured results in docs/frame-consistency-appraisal.md.
//
// Low mode is held to (near) the measured ceiling: the whole point of
// quality-low is a flat 60fps through combat on weak machines. Full quality is
// held to "no worse than the post-fix profile, with run-to-run headroom" —
// every probe run is a different live match, so budgets are buckets, not
// decimals. Override any budget via env (JANK_* below) when intentionally
// re-baselining; tighten them as offenders are converted to the cheap pathway.
import { spawn } from 'node:child_process';

const env = (name, fallback) => Number(process.env[name] ?? fallback);

const BUDGETS = {
  low: {
    fpsAvgMin: env('JANK_LOW_FPS_MIN', 54),
    gapP99MaxMs: env('JANK_LOW_P99_MAX_MS', 35),
    spikesPerMinuteMax: env('JANK_LOW_SPIKES_MAX', 12),
    longTasksMax: env('JANK_LOW_LONGTASKS_MAX', 5),
  },
  high: {
    // Post sprite-filter conversion (2026-06-10) full quality measures
    // ~59fps / 11 spikes/min on software GL; budgets leave run-to-run
    // headroom (every probe run is a different live match).
    fpsAvgMin: env('JANK_HIGH_FPS_MIN', 48),
    inCombatP50MaxMs: env('JANK_HIGH_COMBAT_P50_MAX_MS', 26),
    spikesPerMinuteMax: env('JANK_HIGH_SPIKES_MAX', 60),
    longTasksMax: env('JANK_HIGH_LONGTASKS_MAX', 5),
  },
};

const modes = (process.env.JANK_GATE_MODES ?? 'low,high').split(',').map((m) => m.trim()).filter(Boolean);

function runProbe(quality) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [new URL('jank-probe.mjs', import.meta.url).pathname], {
      env: { ...process.env, PROBE_QUALITY: quality },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(`probe (${quality}) exited ${code}`)); return; }
      try { resolve(JSON.parse(out).jank); } catch (error) { reject(new Error(`probe (${quality}) emitted unparseable output: ${error}`)); }
    });
  });
}

let failed = false;
const check = (mode, label, actual, ok) => {
  const verdict = ok ? 'ok' : 'FAIL';
  console.log(`  [${mode}] ${label}: ${actual} ${ok ? '' : '<-- over budget'} (${verdict})`);
  if (!ok) failed = true;
};

for (const mode of modes) {
  const budget = BUDGETS[mode];
  if (!budget) { console.error(`unknown gate mode "${mode}" (use low,high)`); process.exit(2); }
  console.log(`[jank-gate] probing quality=${mode} (60s forced-combat match, software GL)…`);
  const report = await runProbe(mode);
  console.log(`  fpsAvg=${report.fpsAvg} p50=${report.gapMs.p50} p95=${report.gapMs.p95} p99=${report.gapMs.p99} spikes/min=${report.spikesPerMinute} inCombatP50=${report.inCombatGapMs.p50} longTasks=${report.longTasks} combatShare=${report.combatShareOfFrames}`);
  if (report.combatShareOfFrames < 0.05) {
    console.warn(`  [${mode}] WARNING: combat covered <5% of frames — sample barely exercised the expensive path; treat this run as weak evidence`);
  }
  check(mode, `fpsAvg >= ${budget.fpsAvgMin}`, report.fpsAvg, report.fpsAvg >= budget.fpsAvgMin);
  check(mode, `spikes/min <= ${budget.spikesPerMinuteMax}`, report.spikesPerMinute, report.spikesPerMinute <= budget.spikesPerMinuteMax);
  check(mode, `longTasks <= ${budget.longTasksMax}`, report.longTasks, report.longTasks <= budget.longTasksMax);
  if (budget.gapP99MaxMs !== undefined) {
    check(mode, `gap p99 <= ${budget.gapP99MaxMs}ms`, report.gapMs.p99, report.gapMs.p99 <= budget.gapP99MaxMs);
  }
  if (budget.inCombatP50MaxMs !== undefined) {
    check(mode, `in-combat p50 <= ${budget.inCombatP50MaxMs}ms`, report.inCombatGapMs.p50, report.inCombatGapMs.p50 <= budget.inCombatP50MaxMs);
  }
}

if (failed) {
  console.error('\n[jank-gate] FAIL — frame-consistency budget exceeded. If a new effect did this,');
  console.error('rebuild it from the cheap primitives in docs/juice-toolkit.md before raising budgets.');
  process.exit(1);
}
console.log('\n[jank-gate] OK — frame-consistency budgets hold in all probed modes');
