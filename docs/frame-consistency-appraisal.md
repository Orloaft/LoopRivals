# Frame-Consistency Appraisal (2026-06-10)

> **STATUS: solutions 1–3 implemented + re-measured same day — see
> "Post-fix reappraisal" at the bottom.** Low-quality mode now matches the
> theoretical ceiling: 60.0fps with p99 19.5ms *through combat* on the
> software rasterizer; full quality dropped from 240 to ~140 spikes/min.

Follow-up to [weak-machine-perf-appraisal.md](weak-machine-perf-appraisal.md)
(which fixed average throughput: 8–11fps → 43–55fps full quality under software
GL). Question here: what keeps the frame rate from being *consistently* smooth —
the spike/stutter tail — and how to fix it.

Method: `tmp/jank-probe.mjs` / `tmp/jank-probe-combat.mjs` — 60s live 3-player
matches under software GL (weak-machine proxy), full quality, recording every
rAF gap with per-frame UI-state flags (combat overlay, beat active, floater
count, `document.getAnimations().length`), with dangerous terrain force-placed
every 5s so combat actually happens. CSS-injection runs isolate suspects.
Run-to-run variance is real (every run is a different match) — read the buckets,
not the decimals.

## Measurements

| 60s run (software GL, full quality) | fps avg | p50 | p95 | p99 | spikes>50ms/min |
|---|---|---|---|---|---|
| Roaming only (no combat triggered) | 47 | 16.7 | 45 | 56 | 71 |
| With combat (~20% of frames) | 37 | 16.8 | 61 | 160 | 240 |
| → in-combat frames only | — | **32.8** | 82 | 253 | — |
| + `filter:none` on combat overlay & floaters | 39 | 16.7 | 66 | 139 | 247 |
| → in-combat frames only | — | **16.8** | 84 | 269 | — |
| + floaters hidden too | 40 | 16.7 | 60 | 141 | 222 |
| **Ceiling: all animation/filter/box-shadow off** | **60** | **16.7** | **17.9** | **19** | **2** |

Long tasks in every run: **zero**. deltaApply ~0.2ms. The main thread is never
the problem; neither are combat overlay mounts, React re-renders, or DOM size —
the ceiling run keeps all of those and is perfectly smooth through combat.

## The challenges (ranked)

1. **Keyframes that animate `filter` re-rasterize their element every frame.**
   This is the *sustained* combat cost — removing filters halves in-combat p50
   (32.8 → 16.8ms). Offenders (styles.css): `hero-strike`, `enemy-strike`,
   `combat-hit-shake` (animate `drop-shadow(...) brightness(...)` on sprites),
   `victim-hit`, `event-burst-slam`, `event-pop`, `combat-entry-cue`
   (brightness/saturate), `runner-floater-rise` (brightness),
   `runner-floater-rise`'s shadowed text, `danger-pulse` (animates `box-shadow`).
   A *constant* filter on a transform-animated layer rasters once and is fine;
   it's the *changing* filter values that hurt.
2. **The residual spike tail is the breadth of simultaneously-running paint
   effects during beats** — 27–47 live animations at once (fx sheets scrubbing
   `background-position`, rings, cues, plaques), each a paint-side invalidation.
   Individually cheap, together they produce the 100–250ms worst frames. The
   ceiling run (2 spikes/min) proves the tail is 100% animation-side.
3. **Floater storms are unbounded.** Loot/XP bursts spawn up to ~12 concurrent
   `.runner-floater` nodes, each a fresh DOM node + new layer + brightness-
   animating keyframe → 300–430ms stalls even outside combat. There is no cap,
   no batching, no node reuse (game-ui.tsx:2485).
4. **Match-start hitch** (~1.5s of 120–240ms gaps in every non-ceiling run):
   first raster of the freshly-mounted animated panels/board. Disappears in the
   ceiling run, so it's the same paint-animation class, not image decode.

## How to solve it

1. **Re-author the offending keyframes to transform/opacity only** (biggest
   win, no visual ambition lost):
   - Brightness flashes → overlay element (pre-brightened sprite copy or a
     radial flare) cross-faded with `opacity`.
   - Sprite shadows → keep `drop-shadow` *constant* (or a static blurred
     ellipse under the sprite); never tween it.
   - `danger-pulse` box-shadow → put the shadow on a `::after` and animate its
     `opacity`.
   Expected: in-combat p50 33 → ~17ms and most of the p99 tail gone, per the
   injection runs.
2. **Floater discipline**: cap concurrent floaters (~4/runner), coalesce
   repeats ("+5 xp ×3"), reuse pooled nodes, and make `runner-floater-rise`
   transform/opacity-only. Kills the 300–430ms storm stalls.
3. **Quick safety net while 1–2 land** — extend `quality-low` with
   `html.quality-low .combat-overlay, html.quality-low .combat-overlay *,
   html.quality-low .runner-floater { filter: none !important; }`
   (`!important` beats keyframe values, so this neutralizes the re-raster
   without touching the animations). Weak machines get the flat-60fps profile
   immediately; full quality keeps today's look until the keyframes are
   re-authored.
4. **Optional polish**: stagger beat-driven effect starts by a frame or two so
   layer creation doesn't pile into one frame; only matters if the tail is
   still visible after 1–2.

What is explicitly NOT worth doing: React memoization, delta batching, worker
offload, or engine changes — the main thread is idle (0 long tasks at 6× CPU
throttle) and the ceiling run shows the non-animation UI is already
spike-free.

## Post-fix reappraisal (same day)

Implemented:

- **Filter tweens stripped from 9 keyframes** (`hero-strike`, `enemy-strike`,
  `combat-hit-shake`, `victim-hit`, `event-burst-slam`, `event-pop`,
  `combat-entry-cue`, `combat-entry-cue-pending`, `runner-floater-rise`) —
  transform/opacity only now. Sprites keep their *constant* base filter
  (`.combatant > img`), which also removes a mid-strike shadow-style pop the
  old keyframes caused. The `combat-hit-shake` opacity flicker still reads as
  the damage flash.
- **Floater discipline** (game-ui.tsx): same-tone floaters arriving within
  900ms merge into one node (value summed, rise restarted) instead of stacking
  a new animated/shadowed layer; per-panel node cap tightened 8 → 4.
- **`quality-low` filter net**: `filter: none !important` on the combat
  overlay + floaters in low mode (constant sprite drop-shadows re-raster on
  every scale-animation frame in software raster; `!important` also overrides
  keyframe values defensively).
- **Auto-engage threshold raised 15 → 28fps** (`MIN_WINDOW_FPS`): low mode
  measures flat-60 where full quality grinds at ~25–30, so the trade below
  ~30fps is strictly better. The autopsy now pins `loopduel.quality=high` so
  CI always measures worst-case visuals.
- `trait-pulse`/`danger-pulse` (small box-shadow pulses) deliberately left at
  full quality — tiny paint areas, already stopped in low mode.

Numbers (60s forced-combat runs, software GL):

| Metric | Before | After (full quality) | After (low mode) |
|---|---|---|---|
| fps avg | 37 | 42 | **60.0** |
| spikes >50ms /min | 240 | 139 | **1** |
| in-combat p50 / p99 | 32.8 / 253ms | 30.4 / 224ms | **16.7 / 20.1ms** |
| overall p99 | 160ms | 150ms | **19.5ms** |

Reading: low mode now equals the all-animations-off ceiling — weak machines
(which auto-engage below 28fps) get a flat 60. Full quality improved its tail
~40% but remains paint-bound during combat on software raster, because the
sprites' *constant* drop-shadow/glow filters re-raster on every frame of their
scale animations; real GPUs absorb this. If full-quality combat smoothness on
weak-but-not-terrible GPUs ever matters, the next lever is replacing the
combat sprites' CSS `drop-shadow` glow with a pre-baked sprite underlay —
deliberately not done now to preserve the full-quality look.

## Round 2 (same day): sprite-filter conversion — full quality reaches the ceiling

The "next lever" above turned out to be worth pulling immediately. A/B
injection runs (`tmp/ab-sprite-filters.sh`) attributed the residual
full-quality tail precisely: with combat forced, base measured 222 spikes/min;
removing only the blurred glow drop-shadows → 91; removing all drop-shadows →
30; removing the sprites' filters entirely → 10 (≈ the ceiling). Conclusion:
**every** component of a `filter` on a transform-animated element costs under
software raster — even plain brightness/saturate — because each re-raster
re-runs the whole filter chain. The runner sprites were the out-of-combat
half: `.runner-sprite` carried a blurred glow on a layer that moves every
frame *and* contains the hp plate + floaters, so every hp tick re-ran blur
passes.

Implemented (all keeping the same look):

- **Combat sprites are now filter-free.** The brightness/saturate lift is
  baked into the bitmap at runtime (`src/sprite-bake.ts`: canvas + `ctx.filter`,
  cached object URLs, prebaked at match start via `warmCriticalGameImages`;
  CSS-filter fallback where canvas filters are unsupported). The glow
  drop-shadow became the static `.combatant-glow` underlay; the hard
  drop-shadow folded into a slightly heavier `.combat-ground-shadow`.
- **Active-enemy pop without filters**: scale boost via `--enemy-active-boost`
  (flows through `--enemy-combat-scale` into the strike keyframes) + a gold
  radial `background-image` aura (plain gradient, no blur pass).
- **`.runner-sprite` filter removed** — its shadow/glow were already
  duplicated by the static `.runner-sprite::before` ground shadow and
  `.runner::after` glow.
- **Gates added** so this can't regress: `scripts/check-keyframe-purity.mjs`
  (in `npm run lint`) rejects keyframes animating paint-triggering properties;
  `scripts/jank-gate.mjs` (`npm run test:jank`, in `verify`) runs this probe
  in both quality modes and asserts budgets. Authoring guidance:
  `docs/juice-toolkit.md`.

Numbers (60s forced-combat, software GL):

| Metric | Morning baseline | Round 1 | **Round 2 (full quality)** | **Round 2 (low mode)** |
|---|---|---|---|---|
| fps avg | 37 | 42 | **58.9** | **59.8** |
| spikes >50ms /min | 240 | 139 | **11** | **1** |
| in-combat p50 / p99 | 32.8 / 253ms | 30.4 / 224ms | **16.7 / 61.6ms** | **16.7 / 19.9ms** |
| overall p99 | 160ms | 150ms | **21.9ms** | **19ms** |

Full quality on a software rasterizer now sits at the all-animations-off
ceiling measured in round 1. Long tasks: still zero everywhere. The remaining
worst frames (~130–230ms, a handful per minute) coincide with beat-driven
animation bursts (layer creation pile-ups), which is the "stagger effect
starts" polish item — low priority now.
