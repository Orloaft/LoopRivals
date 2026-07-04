# LoopDuel Title Logo Image Pass - 2026-07-04

## Summary

Complete. The front title screen now uses the generated painterly transparent `Loop Rivals` title-logo PNG instead of rendered heading text, and the small front-title copy above and below the title/menu area has been removed. Title buttons, music control, title background art, and join-screen behavior were left intact.

## Changed Files

- `src/App.tsx`
  - Replaced the front title `<h1>`/kicker/body copy with an image logo using `alt="Loop Rivals"`.
  - Removed the front title `Press Enter` hint and local-profile footer text.
- `src/styles.css`
  - Added responsive `.title-logo` sizing/drop-shadow rules.
  - Removed unused front-title press-hint/footer styling and blink keyframes.
  - Added mobile title-logo sizing.
- `src/game-assets.ts`
  - Added the title-logo PNG to warm critical UI image preloading.
- `public/assets/ui/loop-rivals-title-logo-painterly-v1.png`
  - Committed app asset copied from the selected transparent source PNG.
- `runs/title-logo-image-pass-2026-07-04.report.md`
  - This verification report.

## Commit

- Implementation commit hash: `b0552ee` (`Replace title text with painterly logo`).

## Verification

- `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`
  - `2e525ca`
- `pwd`
  - `/mnt/nxt-dev/loopduel`
- `git rev-parse --show-toplevel`
  - `/mnt/nxt-dev/loopduel`
- `npm run build`
  - Passed.
  - Output included `tsc -b && vite build` and `✓ built in 393ms`.
- `npm run lint`
  - Passed.
  - Output included `eslint . && node scripts/check-keyframe-purity.mjs` and `[keyframe-purity] OK`.
- Dev server
  - First checked allowed range `5200-5219`; port `5200` was already occupied.
  - Started app on allowed port `5201`.
  - Initial capture without a custom HMR port showed Vite HMR websocket noise from occupied port `24678`, not an app rendering failure.
  - Restarted with `PORT=5201 LOOPDUEL_VITE_HMR_PORT=6201 npm run dev` for clean capture.
- Playwright desktop capture
  - Viewport: `1440x960`.
  - Logo selector: `.title-front .title-logo`.
  - Logo `alt`: `Loop Rivals`.
  - Logo rect: `x=340`, `y=183.796875`, `width=900`, `height=268.796875`.
  - Removed-copy selectors visible: none.
  - Console errors: none.
  - Page errors: none.
- Playwright mobile capture
  - Viewport: `390x844`.
  - Logo selector: `.title-front .title-logo`.
  - Logo `alt`: `Loop Rivals`.
  - Logo rect: `x=7.8125`, `y=189.828125`, `width=374.390625`, `height=149.703125`.
  - Removed-copy selectors visible: none.
  - Console errors: none.
  - Page errors: none.

## Screenshots

- `/mnt/nxt-dev/loopduel/.openclaw-artifacts/title-logo-image-pass-2026-07-04/front-title-desktop-2026-07-04.png`
- `/mnt/nxt-dev/loopduel/.openclaw-artifacts/title-logo-image-pass-2026-07-04/front-title-mobile-2026-07-04.png`

## Console / Page Error Status

Clean after the isolated-HMR rerun: no console errors and no page errors in either desktop or mobile Playwright capture.

## Server Cleanup

- Temporary dev server on `5201` was stopped with `Ctrl-C`.
- Post-cleanup check of ports `5200-5219` showed no listeners.

## Caveats

- Port `5200` was already busy before this work, so verification used allowed port `5201`.
- The generated logo source and committed app asset were byte-identical by `cmp`.
