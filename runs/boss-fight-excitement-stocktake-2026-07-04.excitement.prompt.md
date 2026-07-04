Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

You are working only in `/mnt/nxt-dev/loopduel`.

Goal: read-only design audit of how to make LoopDuel boss fights feel more exciting without a broad redesign.

Context:
- Manager preflight after push: `cb59209`.
- Alex wants a boss-fight excitement pass after the title/menu polish.
- Other lanes are auditing mechanics and visual assets/runtime proof in parallel. Do not wait for them; make an independent code/design read.
- Start from local project reality, not generic boss advice.

Scope:
- Inspect current boss-facing UI, copy, combat entry/exit, rewards, combat event presentation, pacing, and player feedback.
- Find where boss fights should feel different from normal fights and whether the current implementation signals that difference.
- Propose focused slices that can be implemented one at a time. Prefer changes that reuse current assets/code paths and improve perceived drama quickly.
- Include risks and verification needs for each slice, especially runtime screenshot/video proof where visual changes are involved.
- Do not edit source.

Safety:
- Read-only source/design audit. Do not modify source files, assets, package files, config, or tests.
- You may write only `runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md`.
- Do not stage, commit, or push.
- Preserve unrelated dirty state.

Report:
- Write `runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md` with:
  - status
  - repo HEAD from preflight
  - files inspected
  - current boss-fight fantasy and where it lands/does not land
  - boss-excitement gaps ranked by user impact
  - quick-win slice, medium slice, and larger slice recommendations
  - verification plan for any recommended visual/combat change
  - first implementation prompt you would hand to a commit-capable worker
  - final repo status

Return:
- Status.
- Report path.
- Top recommendation.
- Any blockers/caveats.
