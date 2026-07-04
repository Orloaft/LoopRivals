Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

Finish-only recovery for LoopDuel title/menu polish in `/mnt/nxt-dev/loopduel`.

Context:
- The implementation worker was cancelled after it landed dirty edits and six screenshots but before final report/cleanup.
- Existing dirty source files are expected and assigned for this finish pass: `src/App.tsx`, `src/game-ui.tsx`, `src/styles.css`.
- Existing run files are expected: `runs/title-menu-polish-2026-07-04.md`, `runs/title-menu-polish-2026-07-04.prompt.md`, `runs/title-menu-polish-2026-07-04.report.md`, and this finish prompt.
- Existing proof directory: `.openclaw-artifacts/title-menu-polish-2026-07-04/`.
- Manager visual inspection accepted the mobile direction and rejected only `desktop-1440x960-01-front-title.png` because it captured a loading/blank title state instead of the full front title art/menu.

Your job:
1. Inspect the existing dirty diff. Do not redesign or broaden the polish.
2. Run the appropriate project verification command(s).
3. Produce a corrected `desktop-1440x960-01-front-title.png` after the full title art/menu is visibly loaded. Preserve/replace the existing path so the proof set remains complete. Use normal runtime app at `1440x960`.
4. If needed, recapture any other obviously broken proof, but do not regenerate screenshots unnecessarily.
5. Finalize `runs/title-menu-polish-2026-07-04.report.md` with:
   - status
   - changed files
   - verification commands/results
   - proof paths
   - mobile join metric confirmation if available
   - server start/stop cleanup and final server status
   - final repo status
6. Stop any LoopDuel dev server you start or inherit on ports `5200-5219`; do not kill processes outside that range.
7. Commit the assigned source/report/run files if verification passes and the staged set is only this polish work. If you cannot commit safely, explain why in the report.

Safety:
- Preserve unrelated dirty state. Do not revert user changes.
- Stage files by explicit path only. `git add -A`, `git add .`, and `git commit -a` are forbidden. Before committing, run `git status --short` and confirm every staged path belongs to your assigned stage.
- Do not touch Telegram bindings, gateway config, systemd units, cron jobs, or public/external integrations.

Return with:
- Status.
- Commit hash if committed, or explicit reason if not.
- Changed files.
- Verification result.
- Corrected screenshot path.
- Server cleanup status.
- Caveats/blockers.
