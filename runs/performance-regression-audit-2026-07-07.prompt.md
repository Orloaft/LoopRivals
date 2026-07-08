# Worker Prompt: Performance Regression Audit 2026-07-07

Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

You are `codex-dev` working on the pinned repo `/mnt/nxt-dev/loopduel`.

Goal: test LoopDuel performance after the full juice feedback pass at manager-observed HEAD `9e7406e` and report whether the animation/juice implementation caused any runtime regression.

Context:
- The full juice pass landed in `aaef2eb` and the run ledger landed in `9e7406e`.
- Previous full-juice verification reported:
  - `npm run test:motion`: p99 frame gap 23.8ms, runner/sprite remounts 0.
  - `npm run test:jank` low: fpsAvg 59.3, window median 60, p99 20.7ms, spikes/min 2, longTasks 0.
  - `npm run test:jank` high: fpsAvg 53.3, window median 59.2, spikes/min 33, in-combat p50 16.6ms, longTasks 0.
- The accepted performance constraint is event-bounded/compositor-friendly effects only: transform/opacity, capped nodes, reduced-motion safe, quality-low safe, no layout-moving UI, no persistent large-area animation.

Scope:
- Read-only performance audit unless a blocking harness issue prevents measurement. Do not change product source (`src/**`) for this audit.
- Create an early report stub at `runs/performance-regression-audit-2026-07-07.report.md` before long test or screenshot loops.
- Put runtime screenshots, logs, JSON metrics, and any temporary scripts under `.openclaw-artifacts/performance-regression-audit-2026-07-07/`.
- Use only ports in 5200-5219. If a port is busy, choose another in range. Do not kill processes outside that range.
- It is okay to leave tracked run/report dirt for the manager to inspect; do not commit unless you only need to commit the report and you can do so safely.

Required verification:
- `git status --short` at start and end.
- `npm run build`.
- `npm run test:motion` with explicit `PLAYWRIGHT_PORT` and `PLAYWRIGHT_HMR_PORT` in 5200-5219.
- `npm run test:jank` with explicit `PLAYWRIGHT_PORT` and `PLAYWRIGHT_HMR_PORT` in 5200-5219.
- If available and not duplicative, run any existing perf or Playwright smoke that captures gameplay-scale desktop/mobile surfaces.

Runtime proof:
- Capture at least desktop and mobile normal gameplay-scale surfaces.
- Try to include one animation-heavy moment from the juice pass: placement stamp, tile arrival/lap pulse, combat/result burst, loot pickup, or rival command/chip pulse.
- If a moment is not reachable in a bounded run, say exactly what was unreachable and keep the audit focused on measured performance.

Comparison/report:
- Compare observed metrics to the full-juice report numbers above.
- Give a blunt verdict: PASS / WATCH / FAIL.
- PASS means no meaningful regression: longTasks remain 0, remounts remain 0, p99/frame metrics and FPS stay in the same rough band, and screenshots show no obvious runaway animation clutter.
- WATCH means metrics moved enough to monitor but not enough to block.
- FAIL means clear regression, broken perf check, leaked server, runaway DOM/effects, or serious FPS/jank degradation.

Safety:
- You are not alone in the codebase; preserve unrelated dirt and never revert changes you did not make.
- Stage files by explicit path only. `git add -A`, `git add .`, and `git commit -a` are forbidden. Before committing, run `git status --short` and confirm every staged path belongs to your assigned stage.
- Report temp server start/stop cleanup and final port status. No listeners should remain on 5200-5219 unless pre-existing and explicitly identified.

Return block:
- Status: PASS / WATCH / FAIL.
- HEAD tested.
- Changed files or report path.
- Artifact directory.
- Commands run and key metrics.
- Desktop/mobile proof files.
- Caveats/blockers.
- Final repo status and port cleanup status.
