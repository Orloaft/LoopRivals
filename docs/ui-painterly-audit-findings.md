# Painterly UI Replacement — Audit Findings (2026-06-09)

Audit of the agent work that replaced placeholder CSS panels (Guide, Popovers, Shop/Sell,
Hero Stats, Right Dock) with bespoke painterly assets, per `docs/ui-painterly-asset-audit.md`.

Method: code/asset reconnaissance + live screenshots of each surface via
`scripts/ui-audit-shots.mjs` (output in `tmp/ui-audit/`).

## Verdict

**Visually: good, not sloppy.** Guide first-run, Shop drawer, Hero Stats dossier, and
Popovers are genuinely on-style and cohesive with the board. The agents shipped real
bespoke frames and they read well in-game.

**Technically: sloppy on the brief's own guardrails.** Three concrete violations below.

## Findings

### 🔴 1. No 9-slice — all frames are full-stretch (`100% 100%`) → ornament distortion
- `grep border-image src/styles.css` → **0 matches.** Every painterly frame is painted as
  `var(--ui-...) center / 100% 100% no-repeat`.
- The brief explicitly said: *"Prefer 9-slice or inset-backed assets so panels can resize
  without distorted ornamentation."*
- Worst offender: `--ui-row-plaque` (source 1983×793, ~2.5:1) is reused at ~10 sites with
  very different aspect ratios (wide shop offer rows, feed lines, stat cells). Each stretches
  the same ornate corners to a different shape — corners visibly squash/elongate per use.
- Fix: convert frames to `border-image` 9-slice (or inset-backed) so corners stay fixed.

### 🔴 2. Assets are unoptimized — 8.9 MB for four UI frames
| asset | dims | size |
| --- | --- | ---: |
| side-drawer-frame | 948×1659 | 2.7 MB |
| guide-codex-frame | 2172×724 | 2.3 MB |
| popover-frame | 1774×887 | 2.25 MB |
| ui-row-plaque | 1983×793 | 1.95 MB |

- Brief said *"Save **optimized** runtime files."* These are raw full-res painterly renders.
  Vite copies `public/` verbatim — all 8.9 MB ships as-is.
- Fix: downscale to the largest on-screen footprint and run through pngquant/oxipng. These
  should be a few hundred KB total, not ~9 MB.

### 🟠 3. `staticCriticalImageUrls` guardrail violated
- Brief: *"Only add always-visible first-paint assets to `staticCriticalImageUrls`; defer
  warming for drawer-only assets."*
- `loopduel-guide-codex-frame-v1.png` (2.3 MB) is in the critical list (`game-assets.ts:175`)
  but is only ever shown in the first-run tutorial / help / in-play coach overlays — never on
  the always-visible board. 2.3 MB is force-warmed at first paint for nothing.
- Inconsistent too: `side-drawer-frame` (also overlay-only) was correctly left out, but
  `popover-frame` and `ui-row-plaque` were added.
- Fix: drop `guide-codex-frame` (and reconsider the others) from critical; defer-warm them.

## Lower-confidence / minor
- **Right Dock** is the one surface that diverged from "bespoke painted": it's CSS stone
  sockets with gold-tinted **Lucide line icons**, not the proposed painted button-state atlas.
  Looks acceptable in-game, but it's CSS-styled rather than bespoke art. No
  `loopduel-dock-bottom-bar` / `dock-toggle` asset was produced.
- **`image-rendering: auto`** (brief guardrail for painterly assets) is only set on
  `.item-sprite`; the frames rely on defaults. Low impact since frames are downscaled.

## What was NOT a problem
- No broken/404 image URLs — every `url()` in `styles.css` resolves.
- Visual cohesion, readable text in dark wells, layout/labels kept in DOM (not baked into art).
