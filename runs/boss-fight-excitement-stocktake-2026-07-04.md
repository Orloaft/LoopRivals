# Boss Fight Excitement Stocktake - 2026-07-04

Goal: fan out a read-only audit of LoopDuel bosses, their combat assets, and their live combat-view presentation, then synthesize the best next slices for more exciting boss fights.

Checklist:
- [x] Boss mechanics/data audit - `agent:codex-dev:mgr-loopduel-boss-mech-20260704` - expected report `runs/boss-fight-excitement-stocktake-2026-07-04.mechanics.report.md`
- [x] Boss asset/runtime visual audit - `agent:codex-dev:mgr-loopduel-boss-visual-20260704` - expected report `runs/boss-fight-excitement-stocktake-2026-07-04.assets-runtime.report.md` and proof under `.openclaw-artifacts/boss-fight-excitement-stocktake-2026-07-04/assets-runtime/`
- [x] Boss excitement/design audit - `agent:codex-dev:mgr-loopduel-boss-fight-excitement-stocktake-2026-07-04-excitement` - expected report `runs/boss-fight-excitement-stocktake-2026-07-04.excitement.report.md`
- [x] Manager synthesis - manager - expected report `runs/boss-fight-excitement-stocktake-2026-07-04.report.md`

Acceptance rule:
This phase is read-only except for run reports and ignored proof artifacts. Accept only if the lanes identify the actual boss roster/triggers, inventory the boss-relevant art used by combat, inspect normal runtime combat-view proof on desktop and mobile or explain the blocker precisely, include a grayscale/readability pass for visual claims, and converge on a short prioritized implementation plan for making boss fights more exciting. Reject synthesis if it relies only on asset filenames without runtime context, if screenshots are from a harness unrelated to the normal game, or if any worker leaves a dev server listening on ports `5200-5219`.
