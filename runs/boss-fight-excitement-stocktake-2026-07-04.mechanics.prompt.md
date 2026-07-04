Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

You are working only in `/mnt/nxt-dev/loopduel`.

Goal: read-only audit of how LoopDuel boss fights currently work in code/data.

Context:
- Manager preflight after push: `cb59209`.
- Alex wants bosses, their represented assets, and combat-view presentation analyzed so boss fights can become more exciting.
- This lane focuses on mechanics/data/flow, not visual judgment.
- Useful starting points from a quick manager scan: `src/game-ui.tsx`, `src/types.ts`, `src/room-projection.ts`, `src/App.tsx`, `src/game-assets.ts`, and any server/shared logic you find.

Scope:
- Identify the real boss roster and boss-class enemies in code, including act bosses, the Loop Tyrant, and any boss-class tile/enemy names.
- Map where bosses are triggered: loop thresholds, boss tiles/seals, act progression, ante/wager rules, corruption/difficulty scaling, deaths/resets, rewards, and log/HUD events.
- Summarize the actual player-facing boss flow from board/combat entry through outcome.
- Call out mechanics that already create excitement and mechanics that may be invisible, flat, repetitive, or under-signaled.
- Produce concrete implementation opportunities, but do not edit source.

Safety:
- Read-only source audit. Do not modify source files, assets, package files, config, or tests.
- You may write only `runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md`.
- Do not stage, commit, or push.
- Preserve unrelated dirty state.

Verification:
- Run no build unless you need it for confidence; this is a code/data audit.
- If you run probes where no matches are possible, make them non-failing or explain the no-match.

Report:
- Write `runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md` with:
  - status
  - repo HEAD from preflight
  - files inspected
  - boss roster and trigger map
  - current boss-fight player experience
  - excitement strengths
  - top mechanics/pacing gaps with file/line evidence
  - 3-5 candidate implementation slices, ordered by impact and risk
  - final repo status

Return:
- Status.
- Report path.
- Any blockers/caveats.
