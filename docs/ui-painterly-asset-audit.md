# Painterly UI Asset Audit

Loopduel's board, cards, hero portraits, talent panel, start button, and right dock already establish a bespoke retro-gothic painterly style. The surfaces below still read as plain React/CSS panels. Future work should add bitmap underlays, 9-slice frames, and painted icon plates while keeping layout, labels, and readable text in React/CSS.

## Priority Surfaces

### Guide UI

- Components: `OnboardingCoach` in `src/game-ui.tsx`, first-run tutorial in `src/App.tsx`, help overlay in `src/game-ui.tsx`.
- Current issue: translucent CSS panels and identical modal cards feel like tutorial/debug overlays beside the painted board.
- Asset direction: a Warden/codex parchment frame, a small rune/omen card frame, and painted lesson plaques. Text should stay in dark inset wells.

### Popovers

- Component: `InfoPopover` in `src/game-ui.tsx`.
- Current issue: one rectangular gold-bordered tooltip is reused for cards, items, dock controls, stats, and shop offers.
- Asset direction: contextual 9-slice frames: parchment tags for cards/tiles, iron plaques for dock controls, and receipt-like frames for shop offers. Do not bake text into the images.

### Shop And Sell UI

- Components: `ShopDrawer`, shop offers, and `SellZone` in `src/game-ui.tsx`.
- Current issue: strong glyphs and item art sit inside a flat brown drawer/list panel.
- Asset direction: painted market-ledger drawer frame, coin-tray row backing, parchment price tags, and a cauldron/scale/bargain-bin sell target.

### Hero Stats UI

- Component: `HeroStatsDrawer` in `src/game-ui.tsx`.
- Current issue: stat grids and sections read like a spreadsheet rather than a hero dossier.
- Asset direction: hero dossier sheet, portrait/sprite watermark, stat medal/rune cells, and an HP vial/bar sprite. Preserve the numeric grid for scan speed.

### Right Dock Bottom Bar

- Component: `PlayerSideDock` controls in `src/game-ui.tsx`; CSS hooks are `.side-controls` and `.side-control-button`.
- Current issue: Lucide buttons float over the bespoke dock art and read like an HTML toolbar.
- Asset direction: a bottom-bar socket underlay plus button-state atlas matching the dock sockets. Keep aria labels and tooltip text in DOM.

## Existing References

- Runtime dock: `public/assets/ui/right-dock-loophero-gothic-v4.png`
- Dock reference: `dev-assets/reference/assets/ui/right-dock-loophero-gothic-v3.png`
- Paperdoll source: `dev-assets/source/assets/ui/paperdoll-dock-retro-gothic-v1-source.png`
- Panel reference: `dev-assets/reference/assets/ui/paperdoll-panel-v1.png`
- Card/frame reference: `dev-assets/reference/assets/ui/card-surfaces-sheet-v1.png`
- Talent panel: `public/assets/ui/talent-tree-panel-v1.png`
- Rune/node ornaments: `public/assets/ui/talent-node-*.png`, `public/assets/ui/talent-alert-gem-v1.png`, `public/assets/ui/trait-rune-frame-v1.png`

## Proposed Runtime Assets

Save optimized runtime files under `public/assets/ui/`. Keep source/reference generations under `dev-assets/source/assets/ui/`.

| Runtime asset | Suggested size | Primary CSS target |
| --- | ---: | --- |
| `loopduel-guide-panel-painterly-v1.png` | 960x360 | `.onboarding-coach` |
| `loopduel-guide-rune-painterly-v1.png` | 320x192 | `.coach-rune` |
| `loopduel-popover-frame-painterly-v1.png` | 768x384 | `.hover-pop` |
| `loopduel-drawer-frame-painterly-v1.png` | 768x1344 | `.shop-drawer`, `.hero-stats-drawer` |
| `loopduel-drawer-row-painterly-v1.png` | 640x128 | `.shop-drawer-offer`, stat rows |
| `loopduel-dock-bottom-bar-painterly-v1.png` | 960x160 | `.side-controls` |
| `loopduel-dock-toggle-painterly-v1.png` | 160x224 | shop/stats toggles |

## Guardrails

- Use bitmap art as underlays, frames, and button plates; do not move copy or controls into images.
- Keep dimensions, padding, overflow, and responsive behavior owned by CSS.
- Put a dark readability layer between busy art and text.
- Use `image-rendering: auto` for painterly UI assets.
- Only add always-visible first-paint assets to `staticCriticalImageUrls`; defer warming for drawer-only assets.
- Prefer 9-slice or inset-backed assets so panels can resize without distorted ornamentation.
