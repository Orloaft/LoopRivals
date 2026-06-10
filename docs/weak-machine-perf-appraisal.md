# Weak-Machine UI Performance Appraisal (2026-06-10)

> **STATUS: fixes implemented + re-measured same day — see "Post-fix reappraisal"
> at the bottom.** In-match under software GL went from ~8–11fps to 43–55fps at
> full quality, and a locked 60fps in the new auto-engaging low-quality mode.

Question: where does the loopduel UI drop frames on weak machines?

Method: production build, live 3-player match, headless Chromium forced onto a
**software rasterizer** (`--use-angle=swiftshader`) — representative of machines
where Chrome falls back to software rendering (blocklisted/old GPUs, VMs, remote
desktop) — plus CDP CPU throttling at 1×/4×/6× to emulate slow CPUs separately.
Probes: `tmp/weak-machine-probe.mjs` (CPU tiers), `tmp/weak-machine-attrib.mjs`
and `tmp/weak-machine-attrib2.mjs` (cost attribution by CSS toggles).

## Verdict

The UI is **CPU-healthy and GPU-fill-rate-bound**. Slow CPUs are fine; weak or
software-rendered GPUs collapse to ~8–11fps in-match, and the cost is almost
entirely decorative compositing: the full-screen parallax backdrop
(filters + mask gradients on 4 huge layers) and the density of
`drop-shadow`/`box-shadow` in the match UI.

## Evidence

CPU tiers (software GL, in-match, 8s samples):

| CPU throttle | rAF fps | long tasks | script ms/s | deltaApply p95 |
|---|---|---|---|---|
| 1× | 8.0 | 0 | 3.8 | 0.3ms |
| 4× | 9.1 | 0 | 19.4 | 0.8ms |
| 6× | 9.5 | 0 | 20.6 | 0.1ms |

fps does **not** degrade with 6× CPU throttle → main thread is not the
bottleneck. Zero long tasks; the ~4Hz `setGame` React re-render of the match
tree is absorbed easily (DOM ≈ 1,190 nodes, 8–10 live animations).

Attribution (software GL, in-match, 6s samples; baseline re-measured at the end
gave 8–17fps, so treat single fps numbers as ±3):

| Condition | fps | p50 gap |
|---|---|---|
| Menu screen | 51–60 | 16.7ms |
| **Match baseline** | **8–11** | **~105ms** |
| Parallax `display:none` | **51** | 16.7ms |
| Parallax mask-image off only | 19 | 17.3ms |
| Parallax filter off only | 14 | 64ms |
| Parallax frozen (no motion, filters/masks kept) | 12 | 87ms |
| `.game-shell` filters/box-shadows off | 23 | 16.9ms |
| All CSS animations paused | 13 | 91ms |
| Everything off ("bare") | 55 | 16.7ms |

Reading: it's not the *motion* (freezing transforms barely helps; pausing
animations barely helps). It's the *static per-present blend cost* of
full-screen layers carrying `filter: brightness() saturate()` +
`mask-image` gradients (styles.css `.parallax-sky/spires/graves/brambles`),
stacked with the match UI's 78 `drop-shadow` / 104 `box-shadow` usages.

## What's already good

- Runner/parallax motion is rAF + ref style writes, not React state (App.tsx:132-186).
- Server deltas at 260ms; engine `deltaApplyMs` ≈ 0.2ms; no layout thrash (≈1 layout/s).
- `prefers-reduced-motion` opt-out is a blanket default (styles.css:337).
- The heaviest keyframes (`parallaxDrift` background-position scroll, `fogCrawl`
  animated `blur()`) belong to `.parallax-clouds/.parallax-fog/.parallax-moon`,
  which are **not in the current markup** — dead CSS, no live cost (keep it dead).

## Recommendations (ranked by measured win ÷ effort)

1. **Bake the parallax filters into the PNGs.** `brightness(1.08) saturate(1.05)`
   on three full-screen layers is a constant color correction re-run every
   present. Pre-bake into the assets, delete the `filter:` lines. Zero visual
   change.
2. **Bake the mask gradients into the PNG alpha channels.** The
   `mask-image: linear-gradient(...)` fade on sky/spires/graves/brambles is also
   constant. Biggest single parallax line-item (10.8 → 18.7fps alone). Zero
   visual change.
3. **Add a low-quality mode, auto-triggered.** The smoothness harness
   (`window.__loopduelSmoothness`) already measures present-rate; if rAF p95
   stays > ~80ms for a few seconds, set a `quality-low` class on the root that:
   swaps the parallax stack for one static pre-composited layer, drops
   decorative `drop-shadow`/`box-shadow`, and pauses infinite pulse animations.
   Measured ceiling: ~10fps → ~55fps. Also expose it as a settings toggle.
4. **Thin out in-shell shadows** independently of the toggle: sprite
   `filter: drop-shadow(...)` (hero-strike/enemy-strike keyframes animate it,
   which re-rasterizes the sprite every frame) can be baked into sprite art or
   replaced with a static blurred ellipse under the sprite.
5. **Delete the dead cloud/fog/moon CSS** (`parallaxDrift`, `fogCrawl`,
   `fogSlide`, `moonLilt`, `cloudSail*` + their rules) so the worst offenders
   (animated blur, background-position scroll) can't silently return.

## Caveats

- Numbers are from swiftshader on a dev box; real weak GPUs land somewhere
  between this and the 60fps GPU path, but the *ranking* of cost centers holds.
- Run-to-run variance in the attribution probe is real (baseline 8–17fps);
  conclusions rest on the order-of-magnitude splits, not exact fps.
- Correction to earlier autopsy lore: swiftshader GL args give 60fps on the
  *menu*, not in-match. The in-match rAF-gap warning on headless boxes is partly
  measuring this real fill-rate cost, not purely a harness artifact.

## Post-fix reappraisal (same day)

Implemented (recommendations 1, 2, 3, 5; #4 folded into the low-quality mode so
full quality keeps its look):

- **v3 parallax assets** (`tmp/bake-parallax.mjs`): scrim gradients,
  `brightness/saturate` filters, and `mask-image` fades baked into the PNGs in
  Chromium canvas (identical color math). `styles.css` parallax layers are now
  plain `url()` backgrounds — no live filter, mask, or extra gradient layer.
- **`src/quality-mode.ts`**: persisted pref `loopduel.quality`
  (`auto`/`high`/`low`), menu toggle ("Render quality") next to the
  sfx/shake toggles. Auto mode watches the rAF present rate
  (frames-per-2.5s-window; **per-gap statistics are misleading because
  struggling compositors deliver rAF in bursts**), engages `quality-low` on
  `<html>` after ~5s below 15fps, sticky for the session, visibility-aware.
  Introspection at `window.__loopduelQuality`.
- **`quality-low` CSS**: parallax spans hidden (base gradient stays),
  `box-shadow`/`text-shadow` stripped in the shell, decorative infinite pulses
  stopped. Functional filters (grayscale disabled-states, combat flashes) kept.
- **Dead cloud/fog/moon CSS deleted** (`parallaxDrift`, `fogCrawl`, `fogSlide`,
  `moonLilt`, `cloudSail*`).

Numbers (same harness, software GL, in-match, 3-player live room):

| Condition | Before | After (high) | After (low) |
|---|---|---|---|
| 1× CPU | 8.0fps / p50 130ms | **45fps / p50 16.7ms** | **60fps / p50 16.7ms** |
| 4× CPU | 9.1fps | 43fps | 59.5fps |
| 6× CPU | 9.5fps | 43fps | 60fps |

Attribution after: hiding the parallax no longer changes fps (52 → 50);
the residual p95 tail (~40ms) is the in-shell drop-shadows, which is exactly
what `quality-low` removes (p95 18.6ms at 6× CPU).

Auto-engage verified end-to-end (`tmp/auto-engage-debug.mjs`): healthy run
never engages; under artificial GPU load the page flips to `quality-low`
within ~7s and the watcher stops.

Side effect: the stock autopsy on plain headless (no GL args) now reports
desktop p50 ~21–23ms / p95 ~45ms — the old 80–130ms "headless compositor
artifact" was mostly this real fill-rate cost, and the rAF warn-gate should
stop firing in CI.

Gates after: `test:motion` ✅, full autopsy ✅, `tsc -b` ✅, eslint ✅. Visuals
eyeballed via autopsy screenshot (full quality, backdrop identical) and
`tmp/match-quality-low.png` (low mode: flat gradient backdrop, UI intact).
