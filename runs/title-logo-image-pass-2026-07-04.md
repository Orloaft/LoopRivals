# Title Logo Image Pass - 2026-07-04

Goal: remove the small title-screen text above and below the game title, then replace the current rendered title text with a generated painterly `Loop Rivals` title-logo image.

Checklist:
- [x] Generate transparent painterly title-logo candidates - manager - expected artifact under OpenClaw managed media
- [x] Integrate selected logo and remove extra copy - manager recovery after stalled `agent:codex-dev:mgr-loopduel-title-logo-image-pass-2026-07-04` - expected commit plus report at `/mnt/nxt-dev/loopduel/runs/title-logo-image-pass-2026-07-04.report.md`
- [x] Verify live title screen proof - manager - expected desktop and mobile screenshots under `/mnt/nxt-dev/loopduel/.openclaw-artifacts/title-logo-image-pass-2026-07-04/`
- [x] Deliver final title-screen pictures to Telegram - manager - expected Telegram media messages `2399` and `2400`

Acceptance rule:
The front title screen must show no extra text above or below the main game title, must use the generated painterly image asset for the main `Loop Rivals` title, and must still read as dark fantasy indie RPG on desktop and mobile. Worker proof must include live Playwright captures for desktop and mobile from the normal app surface, plus build/lint results and server cleanup status. Reject if the generated title text is misspelled, unreadable, visibly cropped, or if a temporary server is left running on ports 5200-5219.
