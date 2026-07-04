Before any work, run `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere else.

You are working in exactly this repo: `/mnt/nxt-dev/loopduel`.

Goal: production-polish LoopDuel's title-to-menu flow without a full redesign. Keep the existing painterly dark fantasy indie RPG direction, and improve only the scoped surfaces below.

Context:
- Current manager preflight HEAD was `3db0d7c`.
- Stocktake report: `runs/title-menu-stocktake-2026-07-04.report.md`.
- Stocktake screenshots: `.openclaw-artifacts/title-menu-stocktake-2026-07-04/`.
- Current verdict: first front title is strong beta / near-production, but the join/hero-selection surface and mobile menu feel less production-polished.

Scope:
1. Tighten the mobile join/hero-selection title layout so the important join controls and hero selection feel intentional on `390x844`. The previous stocktake measured `scrollH 909` vs `innerH 844`; either make it fit better or add a clear, tasteful cue for the horizontal/vertical continuation. Do not remove functional controls.
2. Make the mobile shortcut menu's relationship to the full settings menu clear. The current `Room Menu` button is too vague beside missing desktop settings such as SFX, screen shake, render quality, rules, and reset. Use wording/layout that communicates "quick controls here, full settings there" without turning it into a help screen.
3. Add a small front-title audio/settings affordance. Keep it secondary and icon-led if possible. It should feel native to the current dark fantasy title, not a modern web-app toolbar. If a setting is not practical on the title screen, add only the affordance that can be wired honestly.
4. Preserve the current art direction, title composition, and core flow. No rename, no hero redesign, no broad lobby rewrite, no unrelated gameplay changes.

Implementation guidance:
- Prefer the repo's existing UI/state patterns. Likely files include `src/App.tsx`, `src/game-ui.tsx`, and `src/styles.css`, but inspect first.
- Keep UI copy concise and mood-compatible.
- Keep desktop from regressing while improving mobile.
- Add focused tests only if the repo has a natural test for the touched behavior; otherwise rely on type/build and live Playwright proof.

Server/proof requirements:
- Use dev server ports only in `5200-5219`; if a port is busy, pick another in range. Never kill processes outside that range.
- Write an early report stub at `runs/title-menu-polish-2026-07-04.report.md` before any long screenshot loop.
- Capture normal runtime Playwright screenshots for both desktop `1440x960` and mobile `390x844`:
  - front title at `/`
  - join/hero-selection title surface after `Enter the Loop`
  - room/settings menu after joining a local room
- Put proof under `.openclaw-artifacts/title-menu-polish-2026-07-04/`.
- For first-run tutorial gating, you may pre-seed `localStorage.loopduel.tutorialSeen=yes` only when reaching the room/settings menu, and document that in the report.
- Report any page errors/console errors.
- Stop the dev server before returning and verify no listener remains on the port you used.

Safety:
- Preserve unrelated dirty state. Do not revert user changes.
- Stage files by explicit path only. `git add -A`, `git add .`, and `git commit -a` are forbidden. Before committing, run `git status --short` and confirm every staged path belongs to your assigned stage.
- Do not touch Telegram bindings, gateway config, systemd units, cron jobs, or public/external integrations.

Return with:
- Status.
- Commit hash if you committed, or explicit reason if you did not.
- Changed files.
- Verification commands and results.
- Proof screenshot paths.
- Server start/stop cleanup and final repo/server status.
- Caveats/blockers, if any.
