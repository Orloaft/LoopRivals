# Full Juice Implementation 2026-07-07

Goal: implement the full ranked juice proposal from the 2026-07-07 fanout while keeping LoopDuel's current performance budget intact or better.

Baseline commit: `7eda46d` (`Add juice proposal audit reports`)

Checklist:

- [x] Commit existing fanout report dirt — manager-local — expected artifact: commit `7eda46d` — REPORTED in progress post 2026-07-07
- [x] Implement full juice proposal — session-key `full-juice-implementation-2026-07-07`; child session `agent:mgr-loopduel:subagent:655926b9-7382-4c2c-9fbe-02eb163cc17f`; run `63756ff7-1cdd-4d64-8942-7e5038644dd1` — expected artifacts: implementation commit `aaef2eb`, `runs/full-juice-implementation-2026-07-07.report.md`, desktop/mobile proof under `.openclaw-artifacts/full-juice-implementation-2026-07-07/` — REPORTED 2026-07-07
- [x] Manager verification — manager-local — expected artifacts: clean git status, report/proof inspection, status update to Alex — REPORTED 2026-07-07

Acceptance rule:

- Implement all five ranked proposal groups unless a reportable blocker is found: tile placement stamp/ripple; tile arrival plus lap-completion pulse/sweep; rarity-aware loot/relic pickup burst; combat hit/result/seal impact pass; multiplayer attack/response lines plus rival chip pulses.
- Effects must be event-bounded and compositor-friendly: transform/opacity only, capped nodes, no new animation libraries, no layout-moving UI, reduced-motion safe, and quality-low safe.
- Verification must include `npm run lint`, `npm run test`, `npm run build`, `npm run test:motion`, and `npm run test:jank` unless a command is blocked with a concrete reason.
- Runtime proof must include desktop and mobile Playwright captures of normal gameplay-scale surfaces. Proof should cover placement, movement/lap feedback, reward pickup, combat/result/boss-seal behavior where reachable, and multiplayer/rival feedback.
- Worker must report temp server start/stop cleanup and final repo/server status, with no listeners left on ports 5200-5219 unless pre-existing and explicitly identified.
