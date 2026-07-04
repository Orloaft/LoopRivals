# LoopDuel Title/Menu Polish - 2026-07-04

## Status

Complete. Scoped production-polish pass applied to the title-to-menu flow at HEAD `3db0d7c`.

## Scope

- Mobile join/hero-selection layout polish at `390x844`.
- Mobile quick menu wording/layout so the full settings relationship is clear.
- Small front-title audio/settings affordance wired to existing music preference.

## Changes

- Added a secondary front-title `Music On/Off` plaque using the existing `loopduel.bgm` preference. Playback remains honestly room-gated by the existing audio path.
- Tightened the mobile join/hero-selection surface: shorter second-title stage, denser join rail/profile stats, smaller runner cards, and a visible `Swipe runners` cue with a fade on the horizontal runner strip.
- Renamed the mobile shortcut entry from `Room Menu` to `Full Settings`, added concise quick-controls copy, clarified `Pace: steady`, and surfaced `Music On/Off` copy in the drawer.

## Verification

- `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD` -> `3db0d7c`
- `pwd` and `git rev-parse --show-toplevel` -> `/mnt/nxt-dev/loopduel`
- `npm run build` -> passed
- `npm run lint` -> passed, including `[keyframe-purity] OK`
- Playwright normal runtime capture -> passed, no page errors or console errors
- Mobile join title metrics: `innerH 844`, `scrollH 844`, `bodyScrollH 844`
- Desktop join title metrics: `innerH 960`, `scrollH 960`, `bodyScrollH 960`

## Screenshots

- `.openclaw-artifacts/title-menu-polish-2026-07-04/desktop-1440x960-01-front-title.png`
- `.openclaw-artifacts/title-menu-polish-2026-07-04/desktop-1440x960-02-join-title.png`
- `.openclaw-artifacts/title-menu-polish-2026-07-04/desktop-1440x960-03-room-menu.png`
- `.openclaw-artifacts/title-menu-polish-2026-07-04/mobile-390x844-01-front-title.png`
- `.openclaw-artifacts/title-menu-polish-2026-07-04/mobile-390x844-02-join-title.png`
- `.openclaw-artifacts/title-menu-polish-2026-07-04/mobile-390x844-03-room-menu.png`
- `.openclaw-artifacts/title-menu-polish-2026-07-04/playwright-observations.json`

## Runtime Notes

- Dev server used allowed port `5200`: `PORT=5200 LOOPDUEL_VITE_HMR_PORT=6200 npm run dev`.
- Room/settings menu captures pre-seeded `localStorage.loopduel.tutorialSeen=yes` before page initialization so the first-run tutorial would not block the menu, per the assignment allowance.
- Front-title and join-title captures did not pre-seed tutorial state.
- No server cleanup had happened yet when this report was written; final cleanup is reported in the assistant response.
