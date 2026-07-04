# Title/Menu Polish - 2026-07-04

## Goal

Production-polish LoopDuel's title-to-menu flow without redesigning the existing painterly dark fantasy direction.

## Checklist

- [x] Implement polish pass - `agent:codex-dev:mgr-loopduel-title-menu-polish-2026-07-04` / finish recovery `agent:codex-dev:mgr-loopduel-title-menu-polish-2026-07-04-finish` - report: `runs/title-menu-polish-2026-07-04.report.md`, proof: `.openclaw-artifacts/title-menu-polish-2026-07-04/`
- [x] Manager verify disk artifacts, git state, desktop/mobile screenshots, and server cleanup.
- [x] Report concise result to Alex.

## Acceptance Rule

Accept only if the normal runtime app has before/after or after screenshots for desktop `1440x960` and mobile `390x844` covering: front title, join/hero-selection title surface, and room/settings menu. The mobile join page must fit or communicate scrolling better than the stocktake failure (`scrollH 909` vs `innerH 844`), the mobile shortcut menu must clearly point to the full settings/menu surface, and the front title must gain a small settings/audio affordance without weakening the current dark fantasy indie RPG mood. Worker must report server start/stop cleanup and leave no listener on ports `5200-5219`.
