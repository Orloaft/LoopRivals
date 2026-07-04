# Boss Combat Overlay Polish - 2026-07-04

## Goal

Make boss fights read as special combat moments in the existing combat overlay without changing combat mechanics or protocol.

## Checklist

- [x] Repo preflight: `9b81e06`.
- [x] Add boss combat presentation inference in `src/game-ui.tsx`.
- [x] Add boss-specific cue/title/result copy:
  - `boss!`
  - `tyrant!`
  - `Act Boss`
  - `Loop Tyrant`
  - `Seal Broken`
  - final boss-broken copy.
- [x] Add seal progress display and boss overlay styling in `src/styles.css`.
- [x] Preserve normal combat entry copy as `fight!`.
- [x] Verify with `npm run lint`.
- [x] Verify with `npm run build`.
- [x] Capture desktop boss entry/result proof.
- [x] Capture mobile boss entry/result proof.
- [x] Capture Loop Tyrant entry proof.
- [x] Capture normal combat regression proof.
- [x] Confirm no listener left on ports `5200-5219`.

## Artifacts

- Report: `runs/boss-combat-overlay-polish-2026-07-04.report.md`
- Proof text: `.openclaw-artifacts/boss-combat-overlay-polish-2026-07-04/proof-text.json`
- Screenshots: `.openclaw-artifacts/boss-combat-overlay-polish-2026-07-04/`

## Acceptance Rule

Boss combat must be visually and textually distinct from ordinary fights on desktop and mobile, while ordinary combat still reads as a normal `fight!` encounter.
