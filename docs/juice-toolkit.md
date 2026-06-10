# Juice Toolkit — the cheap pathway

How to add juicy feedback (and lots of it) without regressing the frame-consistency
budgets. Background: [frame-consistency-appraisal.md](frame-consistency-appraisal.md)
proved the entire spike/stutter tail is animation **paint** load — the engine, React,
and the network are idle even at 6× CPU throttle. So the rule is simple:

> **Juice may move, scale, rotate, and fade things. It may not re-paint things
> every frame.**

The dividing line is whether an animation runs on the compositor (rasters the
element once, then transforms the cached texture) or invalidates the raster each
frame (re-runs paint + filters per frame — catastrophic on weak/software-GL
machines, which is what the probes simulate).

## Blessed primitives (build new effects ONLY from these)

| Primitive | How | Used by |
|---|---|---|
| Move / scale / rotate | `transform` keyframes (`translate3d`/`scale`); never `left/top/width` | `hero-strike`, `enemy-strike`, runner movement |
| Fade / flash / flicker | `opacity` keyframes; the damage flash is an opacity flicker, not a brightness tween | `combat-hit-shake`, `victim-hit` |
| Screen shake | `shake()` from `src/screen-shake.ts` — WAAPI translate3d, decays to zero, reduced-motion-aware, amplitude scales with hit magnitude | combat finishers |
| Hit-stop | `hitStop` state in `game-ui.tsx` — pauses overlay animations for a beat via the `hit-stop` class | combat finisher beats |
| Glow / shadow that must not tween | put it on a **static underlay element** (radial-gradient div / `::before`), or keep a *constant* `filter` on an element that is never scale-animated | `.combatant-glow`, `.combat-ground-shadow`, `.runner-sprite::before` |
| Silhouette "pop" shadow | zero-blur `drop-shadow(0 Npx 0 …)` is one offset stamp — cheap; blurred drop-shadows are gaussian passes per raster — expensive on anything scale-animated | combat sprite imgs |
| Sprite-sheet effects | `background-position-x` with `steps()` on a small fixed-size quad (documented exception) | `combat-fx-sheet` |
| Floaters / damage numbers | reuse the existing `.runner-floater` channel: same-tone floaters within 900ms merge (value summed), hard cap 4/panel. Never spawn a fresh animated node per event | loot/XP/damage floaters |
| Pre-baked filters | if a static look needs blur/mask/filter on a big surface, bake it into the PNG (`tmp/bake-parallax.mjs` pattern), don't apply it live | parallax backdrops v3 |

## Forbidden in animations (the expensive pathway)

- Keyframes that tween `filter` (brightness/saturate/blur/drop-shadow) — re-rasters
  the element **every frame**. This alone was ~half the in-combat frame cost before
  it was stripped from 9 keyframes.
- Keyframes that tween `box-shadow` (allowed only for tiny paint areas, by
  exception — see below).
- *Constant* blurred `drop-shadow`/`filter` on an element a keyframe **scales** —
  scale changes re-raster, and each raster re-runs the blur. Measured on the combat
  sprites: removing just the blurred glows took in-combat p50 from 61 → 16.8ms.
  Constant filters are fine on elements that only *translate* or sit still.
- Layout-property keyframes (`width`, `left`, `margin`, …) — paint **and** layout.
- Unbounded effect spawning (one DOM node + animation per event). Pool, merge, cap.

Enforcement is automated: `scripts/check-keyframe-purity.mjs` (runs in `npm run
lint`) fails on any keyframe animating outside the allowlist. Deliberate
exceptions live in that file with a reason, and must be disabled by quality-low.
The end-to-end budget is enforced by `scripts/jank-gate.mjs` (`npm run test:jank`,
also in `verify`): 60s forced-combat probes in both quality modes under software GL.

## Effect tiers — spend paint where it communicates

Quality-low (auto-engaged below 28fps via `src/quality-mode.ts`) keeps every
effect that carries gameplay information and drops decoration. When adding an
effect, decide its tier up front:

| Tier | Survives quality-low? | Examples |
|---|---|---|
| **1 — gameplay information** (must always read) | yes — full motion | strike lunges, damage flicker, damage/XP floaters (merged), hit-stop, active-enemy raise, HP bars, danger-tile marking |
| **2 — feel amplifiers** (read reinforcement) | yes, but filter-free (`filter:none !important` net over combat overlay + floaters) | screen shake, fx sheets, entry cues, floater text shadows |
| **3 — decoration** (mood only) | no — stopped or static | parallax motion, `trait-pulse`/`danger-pulse` shadow pulses, ambient glints, decorative panel shadows |

Tier-1 effects must be built exclusively from transform/opacity so they read
identically on a weak phone and a gaming rig — a player on a low-end device
still sees every hit, just with less garnish.

## Checklist for a new effect

1. Build it from the blessed primitives table (transform/opacity only).
2. Assign a tier; if tier 2–3, verify it degrades/disappears under quality-low.
3. `npm run lint` — keyframe purity must pass without new exceptions.
4. `npm run test:jank` — budgets must hold (run-to-run variance is real; read
   buckets, not decimals — see the appraisal).
5. If it spawns nodes per event, it must merge/cap like the floater channel.
