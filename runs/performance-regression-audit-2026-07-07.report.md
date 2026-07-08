# Performance Regression Audit Report 2026-07-07

Status: PASS

HEAD tested: `9e7406e`

Artifact directory: `.openclaw-artifacts/performance-regression-audit-2026-07-07/`

## Verdict

No meaningful runtime regression from the full juice feedback pass was observed. Motion and jank checks stayed in the same rough band as the prior full-juice verification, long tasks stayed at 0, runner/sprite remounts stayed at 0, and runtime proof screenshots did not show runaway animation clutter.

The only notable variance is `npm run test:motion` frame-gap p99 at 24.1ms versus the prior 23.8ms. That is a 0.3ms movement and not material. High-quality jank was better than the prior sample on this run: fps average 57.9 versus 53.3, median 5s window fps 59.8 versus 59.2, and spikes/min 10 versus 33.

## Commands Run

- `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD` -> `9e7406e`
- `git status --short` at start:
  - `?? runs/performance-regression-audit-2026-07-07.md`
  - `?? runs/performance-regression-audit-2026-07-07.prompt.md`
- `npm run build`
- `PLAYWRIGHT_PORT=5200 PLAYWRIGHT_HMR_PORT=5201 npm run test:motion`
- `PLAYWRIGHT_PORT=5202 PLAYWRIGHT_HMR_PORT=5203 npm run test:jank`
- `PLAYWRIGHT_PORT=5204 PLAYWRIGHT_HMR_PORT=5205 node .openclaw-artifacts/performance-regression-audit-2026-07-07/capture-runtime-proof.mjs`
- `PLAYWRIGHT_PORT=5206 PLAYWRIGHT_HMR_PORT=5207 npm run test:e2e`

## Key Metrics

| Check | Prior full-juice result | Observed result | Assessment |
| --- | ---: | ---: | --- |
| Motion p99 frame gap | 23.8ms | 24.1ms | Same band |
| Motion runner remounts | 0 | 0 | Pass |
| Motion sprite remounts | 0 | 0 | Pass |
| Motion longTasks | 0 | 0 | Pass |
| Jank low fpsAvg | 59.3 | 59.8 | Same/better |
| Jank low window median fps | 60 | 60 | Same |
| Jank low p99 gap | 20.7ms | 19ms | Better |
| Jank low spikes/min | 2 | 2 | Same |
| Jank low longTasks | 0 | 0 | Pass |
| Jank high fpsAvg | 53.3 | 57.9 | Better |
| Jank high window median fps | 59.2 | 59.8 | Same/better |
| Jank high spikes/min | 33 | 10 | Better |
| Jank high in-combat p50 | 16.6ms | 16.7ms | Same band |
| Jank high longTasks | 0 | 0 | Pass |

`npm run test:e2e` also passed on port 5206 with HMR port 5207.

## Runtime Proof

Captured desktop and mobile gameplay-scale surfaces:

- `.openclaw-artifacts/performance-regression-audit-2026-07-07/desktop-normal-gameplay.png`
- `.openclaw-artifacts/performance-regression-audit-2026-07-07/mobile-normal-gameplay.png`

Captured animation-heavy placement-stamp moments:

- `.openclaw-artifacts/performance-regression-audit-2026-07-07/desktop-placement-stamp.png`
- `.openclaw-artifacts/performance-regression-audit-2026-07-07/mobile-placement-stamp.png`

The placement-stamp moment was reachable on both desktop and mobile in a bounded run. Runtime summary recorded 2 juice nodes and 10 active animations during the stamp on both surfaces, with no obvious large persistent effect or layout-moving clutter in the screenshots.

## Artifacts

- Build log: `.openclaw-artifacts/performance-regression-audit-2026-07-07/npm-run-build.log`
- Motion log: `.openclaw-artifacts/performance-regression-audit-2026-07-07/npm-run-test-motion.log`
- Jank log: `.openclaw-artifacts/performance-regression-audit-2026-07-07/npm-run-test-jank.log`
- Smoke log: `.openclaw-artifacts/performance-regression-audit-2026-07-07/npm-run-test-e2e.log`
- Runtime proof script/log/summary: `.openclaw-artifacts/performance-regression-audit-2026-07-07/capture-runtime-proof.mjs`, `runtime-proof.log`, `runtime-proof-summary.json`
- Metrics summary: `.openclaw-artifacts/performance-regression-audit-2026-07-07/audit-metrics-summary.json`

## Cleanup And Status

Port range 5200-5219 was checked before and after the run. No listeners were present at the end of the audit.

Final `git status --short`:

```text
?? runs/performance-regression-audit-2026-07-07.md
?? runs/performance-regression-audit-2026-07-07.prompt.md
?? runs/performance-regression-audit-2026-07-07.report.md
```

No product source under `src/**` was changed. No commit was made.
