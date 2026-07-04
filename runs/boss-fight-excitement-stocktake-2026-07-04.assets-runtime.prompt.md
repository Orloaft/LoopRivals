Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

You are working only in `/mnt/nxt-dev/loopduel`.

Goal: read-only audit of boss-related assets and how bosses look in the normal combat view.

Context:
- Manager preflight after push: `cb59209`.
- Alex wants to analyze the bosses, the assets representing them, and how they look in combat view so boss fights can become more exciting.
- Useful starting points from a quick manager scan:
  - `public/assets/combat/enemy-briar-warden.png`
  - `public/assets/combat/enemy-crown-sentinel.png`
  - `public/assets/combat/enemy-loop-tyrant.png`
  - other combat enemies under `public/assets/combat/`
  - boss/seal tiles under `public/assets/tiles/v2/`
  - `src/game-assets.ts`, `src/game-ui.tsx`, combat-related scripts.

Scope:
- Inventory every boss or boss-class visual asset actually referenced by the app.
- Identify whether boss sprites are unique, readable, scaled differently, or visually distinct from normal enemies.
- Capture live normal-runtime combat-view screenshots for boss fights on desktop and mobile if reachable. Prefer actual in-app flow; use existing repo scripts/debug utilities only if they are already present and document exactly what path you used.
- Include a grayscale/readability proof for any screenshot or contact sheet used to judge silhouette/readability.
- If a real boss combat view cannot be reached within reasonable time, do not fake it. Report the blocker, capture the closest normal combat view plus boss asset contact sheet, and explain what proof is still missing.

Safety:
- Do not edit source files, committed assets, package files, config, or tests.
- You may write only:
  - `runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md`
  - ignored proof artifacts under `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/`
- Do not stage, commit, or push.
- Preserve unrelated dirty state.

Server/proof rules:
- Use dev server ports only in `5200-5219`; if a port is busy, pick another in range.
- Never kill processes outside `5200-5219`.
- Write an early report stub before long Playwright screenshot loops.
- Stop every dev server you start and verify no listener remains on the used port.
- Proof must be from the normal app surface, not a standalone art harness, unless clearly labeled as fallback.

Report:
- Write `runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md` with:
  - status
  - repo HEAD from preflight
  - boss asset inventory and reference paths
  - runtime capture method
  - screenshot/contact-sheet/grayscale artifact paths
  - what looks exciting now
  - visual/readability/staging gaps in combat view
  - concrete art/UI/VFX opportunities for more exciting bosses
  - server cleanup status and final repo status

Return:
- Status.
- Report path.
- Proof artifact paths.
- Server cleanup status.
- Any blockers/caveats.
