# Game-Feel / "Juice" Research for a DOM + CSS Browser Game

**Target stack:** React 19 + Vite + TypeScript, rendered with **DOM + CSS** (CSS `@keyframes`/transitions + sprite-sheets). **No canvas/WebGL, no animation library** (hand-rolled CSS). Realtime multiplayer loop-runner / roguelite with card play, board tiles, and a combat overlay. **Hard constraint: ~60fps including on mid-range laptops, with multiple player panels on screen at once.**

Everything below is tailored to that constraint. The recurring theme: **juice on a DOM/CSS stack is a budgeting problem.** The canonical techniques (screenshake, hit-stop, particles, damage numbers, squash & stretch) all translate to DOM, but they must be expressed almost exclusively through `transform` and `opacity` so the work stays on the GPU compositor and off the main thread, where React's reconciliation already lives.

---

## (a) Principles & Techniques

### The three pillars (Swink, *Game Feel*)
Steve Swink defines game feel as **"real-time control of virtual objects in a simulated space, with interactions emphasised by polish."** The Venn diagram is: **real-time response** (sub-100ms reaction to input), **simulated space** (weight, gravity, momentum), and **polish** (the subtle visual/aural cues that sell impact). For a card/board game the "simulated space" is light, so **response and polish carry the feel**. The practical takeaway: every player action should produce a perceptible reaction within ~100ms, and that reaction should be *exaggerated* beyond what physics strictly requires.

### Vlambeer — "The Art of Screenshake" (Jan Willem Nijman)
Nijman's talk is the canonical checklist. He iteratively turns a flat shooter into a satisfying one by stacking small effects. The reusable techniques (mapped to our genre):

- **Bigger / faster projectiles & more of them** → in a card game: bigger, bolder effect visuals; let multiple effects overlap rather than queue.
- **Muzzle flash / impact flash** → a 1–2 frame bright flash at the moment of action (card play, hit).
- **Hit animation + knockback** → both attacker and target react; the *source* of an action should recoil too, not just the target.
- **Camera lerp / camera lead** → the "camera" smoothly eases toward focus; never snap.
- **Screen shake** → short, decaying positional jitter on impact.
- **Sleep / hit-pause** → freeze for ~**20–50ms** on impact (see hit-stop below).
- **Permanence** → leave evidence: smoke, shells, scorch marks, spent cards drifting to a discard pile. Memory of past actions makes the world feel real.
- **Recoil / kickback / delay on the "weapon"** → the acting element animates *before* the result resolves (anticipation).
- **More bass in audio** → low-end punch sells weight more than any visual.

Source order matters: he adds **animation + sound first**, because those two changes alone account for most of the perceived improvement.

### Jonasson & Purho — "Juice It or Lose It"
The complementary GDC classic. Core thesis: **"a juicy game feels alive and responds to everything you do — with tons of cascading action and reaction for minimal user input."** Demonstrated techniques (all genre-relevant): tweened/eased motion instead of linear, **squash & stretch** on objects, **particle bursts** on every event, screen shake, color flashes, trails, animated/bouncing UI, sound on every interaction, and **"crank everything to 11"** — over-exaggerate, then dial back.

### Squash & stretch / anticipation / follow-through (classic animation)
- **Squash & stretch**: an element compresses on impact and stretches along its motion vector. On a card: scale to `(1.15, 0.85)` at the moment of play, springing back to `(1,1)`. Preserve volume (one axis up, the other down) to avoid looking like a simple scale.
- **Anticipation**: a small reverse move *before* the main action (card dips back slightly before launching). Sells intent.
- **Follow-through / secondary motion**: things keep moving after the primary motion stops (overshoot + settle), and attached/nearby elements lag behind the leader (e.g., a played card's shadow or trailing cards wobble after it).

### Hit-stop / freeze-frame (impact feedback)
Hit-stop (a.k.a. hitlag, hitfreeze, hitpause, impact freeze) **briefly freezes the actors at the moment of collision**. It exploits the brain's ~**100ms** processing window: pausing gives the eye time to register the hit, making it read as heavier. Research and practitioner consensus put effective durations around **~50ms (.05s)** up to ~150ms for heavy hits. In our game: on a damage event, pause the combat overlay's animations for 2–4 frames, *then* release with the screen shake + damage number. Hit-stop **before** shake/number is the correct order — freeze, then erupt.

### Screen / impact "punch"
Short, **decaying** random offset applied to a container (`transform: translate()`), plus an optional scale "punch" (`scale(1.0 → 1.04 → 1.0`). Keep amplitude small and duration short (~150–250ms) and **always decay to zero** so it never feels like vibration. Reserve large shakes for big moments; over-shaking is the most common juice mistake.

### Damage numbers / floating combat text
The "juicy +N" pop. Best-practice anatomy (from RPG/MMO conventions): number **spawns large, pops/bounces** (overshoot scale), **drifts up and slightly to the side**, then **scales down and fades** — "less visible the less relevant it is." Crit/big hits get bigger, bolder, color-coded text (red = crit, yellow = medium, etc.) and match visual intensity to hit significance. **Watch for popup overload** — pool/cap simultaneous numbers so the screen isn't a blizzard of "+1"s.

### Easing curves
Linear motion reads as robotic; **easing is most of the juice.**
- **ease-out** (fast start, slow settle): the workhorse for things entering/arriving — cards dealt, panels appearing, numbers popping.
- **ease-in-out**: elements that stay on screen and change.
- **Overshoot / back / spring**: `cubic-bezier` with a y-value `>1` or `<0` produces overshoot/bounce — the signature "alive" feel (springs are defined by stiffness, damping, mass; CSS approximates them via a back/elastic bezier or the newer `linear()` easing for arbitrary curves).

### Audio's role
Across every source, **sound is the highest-leverage juice per unit effort** — Nijman adds it first; "more bass" sells weight; Jonasson/Purho put sound on every interaction. Even on a visual-only DOM stack, a small WebAudio layer (click, play, hit, crit, defeat) will do more for feel than most CSS work. Pitch-vary repeated sounds slightly to avoid machine-gun sameness.

---

## (b) DOM/CSS Implementation Patterns

### The golden rule: animate **only `transform` and `opacity`**
web.dev's guidance is unambiguous: **"Restrict animations to opacity and transform to keep animations on the compositing stage."** The browser hardware-accelerates `transform` and `opacity` automatically because they don't trigger layout or paint — they're handled by the **compositor thread**, independent of the (React-busy) main thread. Animating `top/left/width/height/margin` forces **layout (reflow)**; animating `color/background/box-shadow/border-radius` forces **paint**. Both are expensive and can cascade to other elements.

**Translate this to every effect:**
| Juice effect | Implement with | Avoid |
|---|---|---|
| Screen shake | `transform: translate3d(x,y,0)` on a wrapper | animating `left/top` |
| Squash & stretch | `transform: scale(x,y)` | animating `width/height` |
| Card move/deal (layout change) | **FLIP** (see below), `transform: translate3d()` | animating grid/flex position |
| Damage number pop+drift+fade | `transform: translateY()+scale()` + `opacity` | `top` + `font-size` |
| Flash / glow | `opacity` of an overlay layer | animating `box-shadow`/`filter` (paint) |
| Hover tilt (Balatro-style) | `transform: rotate()/perspective` | — |

### CSS animations vs WAAPI vs requestAnimationFrame
- **CSS `@keyframes` / transitions** — *Default choice.* Declarative, the browser can run `transform`/`opacity` keyframes on the compositor, off main thread. Best for self-contained, fire-and-forget effects (pop, flash, shake, particle). Use heavily.
- **Web Animations API (`element.animate()`)** — *Use when JS must drive timing/params.* Same compositor benefits as CSS for `transform`/`opacity`, but lets you set durations/values dynamically and `await anim.finished` — ideal for **hit-stop sequencing**, damage values computed at runtime, and chaining. More performant than rAF for these. Strongly recommended over hand-rolled rAF for this project since it keeps work off the main thread.
- **requestAnimationFrame** — *Last resort.* Runs **on the main thread**, so it competes with React rendering and is **vulnerable to jank whenever the main thread blocks**. Only use for things genuinely needing per-frame JS logic (e.g., a physics-y trail, springy cursor-follow). If you do, the callback must fit the frame budget (see (d)).

**Net recommendation for this stack:** CSS keyframes for static effects + **WAAPI for anything parameterized or sequenced**. Avoid building a rAF animation loop unless a specific effect demands it.

### FLIP for "layout" animations without layout cost
When cards/tiles change position (deal, reorder, move to discard), animating their real layout position is a reflow nightmare. Use **FLIP (First, Last, Invert, Play)** (Paul Lewis): measure **First** position, apply the **Last** DOM state, compute the inverse `transform` that visually returns it to First, then **Play** by transitioning the transform to identity. The element ends in correct layout flow but the *animation* is pure `transform` — GPU-cheap. This is the standard technique for list/board reordering and is exactly what animation libraries do under the hood; here you hand-roll it with `getBoundingClientRect()` + WAAPI.

### `will-change` and compositor-layer budgeting
- Promoting an element to its own compositor layer (`will-change: transform`, or legacy `transform: translateZ(0)`) lets it animate without repainting siblings.
- **But layers cost GPU memory and compositing time.** web.dev: *"Because layer creation can cause other performance issues, we don't recommend using it early."* Apply `will-change` **just-in-time via JS right before an animation and remove it after**, not permanently in CSS. A panel that permanently declares `will-change` on dozens of children will *hurt* fps.
- With **multiple player panels**, this is the central risk: don't blanket-promote everything. Promote only the actively-animating element, briefly.

### Particles in DOM — and when to switch to canvas
- **DOM particles are fine for small, decorative bursts.** Practical threshold from practitioners: DOM stays smooth up to **~50, comfortably a few hundred at most**, each a tiny `<div>` animated with `transform`+`opacity` and removed on completion.
- **Failure mode:** ~250 DOM particles/frame = the style engine doing ~15,000 style recalcs/sec — the main thread can't keep up and it **freezes**. The browser's style/cascade engine "is designed for documents, not particle systems."
- **The escape hatch:** the stack rule is "no canvas," but a **single `<canvas>` used purely as an effects overlay** (one DOM node, never restyled, pixel-drawn) is the industry answer for dense particles and is worth flagging as the one justified exception if confetti-on-victory / big crit bursts are wanted. Keep it as a separate component so the "no canvas" rule holds for *gameplay* rendering.
- **Recommendation:** pool particle DOM nodes, cap concurrent count hard (e.g. ≤ 40 on screen total across all panels), prefer one sprite-sheet burst over many divs, and reserve canvas as a documented exception for celebration-scale effects only.

### Sprite-sheet animations
Already in the stack. Drive via `background-position` **stepped with `steps()` timing** on a `@keyframes`, or `transform`-based atlas offset. Note `background-position` is a paint operation; for hot/many sprites prefer translating the sheet via `transform` inside an `overflow:hidden` frame, which stays on the compositor.

### `prefers-reduced-motion` (do this from day one)
Wrap non-essential motion in `@media (prefers-reduced-motion: reduce)` and **disable or replace** shake, big translations, particle storms, and spins. MDN/WCAG (technique C39): the preference doesn't mean *remove all motion* — it means **users expect non-essential motion disabled** unless essential to functionality. Motion can trigger vestibular disorders, migraine, and ADHD distraction; flashing risks photosensitive epilepsy. Pattern:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
…then re-enable *essential, gentle* feedback (e.g., a brief opacity flash instead of a shake) selectively. Also gate screen shake behind a user toggle regardless of the OS setting.

---

## (c) Genre Comparisons — what "good feel" looks like here

### Balatro (the gold standard for card juice)
Its reputation rests on **card movement and shaders**, not mechanics. The defining, *DOM-reproducible* techniques:
- **Cursor-following tilt**: hovered/held cards rotate (3D `perspective` + `rotateX/Y`) proportional to **pointer velocity/offset**, then **spring back**. This is the single most-imitated effect and is pure `transform` — perfect for CSS/WAAPI.
- **Idle wobble / jiggle**: subtle continuous secondary motion so cards never sit perfectly still.
- **Hover scale + lift + shadow**: card scales up and rises on hover.
- **Score juice**: numbers **pop and bounce**, chips/mult escalate with stacked feedback, plus screen shake on big scores. Exaggeration scales with payoff.
- **CRT/atmosphere**: a fuzz/scanline overlay + synthwave audio create flow-state mood. (CRT-as-DOM-overlay is a `filter`/paint cost — use a static image overlay or a single canvas, not animated filters.)
*(Note: public recreations — Mix and Jam's "Balatro-Feel", 80.lv breakdowns — are in Unity/DOTween, but the techniques are transform/easing-based and map cleanly to CSS/WAAPI.)*

### Slay the Spire (deckbuilder UX)
- **Card draw/discard streaks/trails** that both look good *and communicate game-flow* (where did that card go).
- **Exaggerated, weighty spell SFX + VFX** so cards "feel like they have physicality."
- **Non-blocking animation**: *"you can cast cards as fast as you like; animations do their own pace"* — **never gate input on animation completion.** Critical for a realtime multiplayer loop: queue/overlap effects, don't serialize them.
- **Escalating icon/threshold feedback** (e.g., intent icons change at damage thresholds) reads faster than raw numbers.

### .io games & browser roguelikes
- **Smooth interpolation everywhere** — entities lerp between network states; nothing snaps. For our multiplayer loop, **client-side interpolation/easing of other players' panels** is essential to hide network granularity.
- **Juice as the differentiator**: "the screen shake when you score a hit, the satisfying pop when you collect a coin" — small, cheap, constant feedback on every event. .io games keep effects *lightweight* precisely because they run in-browser at scale — a good model for our fps constraint.

**Genre synthesis for our game:** card tilt/spring on hover, pop+bounce on play, non-blocking overlapping effects, floating damage numbers with bounce/fade, brief hit-stop + small decaying shake on combat hits, interpolated remote-player panels, and a WebAudio hit/crit/play layer. All achievable in `transform`/`opacity`.

---

## (d) Performance Rules + Accessibility

### Frame budget
- 60fps = **16.7ms/frame** total for everything (JS + style + layout + paint + composite).
- **RAIL "Animation" budget: aim for ≤10ms of *your* work per frame** — the browser needs ~6ms to produce the frame itself.
- **RAIL "Response": react to input within 100ms** (process input handlers within ~50ms) so play/hover feels instant.
- **RAIL "Idle": chunk background work into ≤50ms blocks** so it never blocks input/animation. (Relevant for React state churn in a realtime loop.)

### Concurrent-animation rules of thumb
- Compositor-only (`transform`/`opacity`) animations are **cheap and scale well** — dozens to low-hundreds are fine *because the main thread isn't involved*.
- The cost explodes when animations touch **layout or paint** (then count matters a lot) or when **node count per frame is high** (the ~250-DOM-particle freeze). With **multiple player panels**, multiply per-panel effect counts by player count — budget accordingly and cap total on-screen particles/numbers globally, not per-panel.
- **Layer count**: each `will-change`/promoted element is a layer with GPU-memory and compositing cost. Keep promoted layers to **only what's actively animating**; promote JIT, demote after. Too many layers regresses fps even with cheap properties.

### Profiling approach
1. **Chrome DevTools → Performance**: record during heavy combat; watch for **dropped frames** (FPS meter), long main-thread tasks, and nonzero Rendering/Painting in the Summary.
2. **Paint Flashing** (Rendering tab): green flashes reveal anything triggering repaints — every flash during a `transform` animation is a bug to fix.
3. **Layers panel**: audit compositor layer count; hunt for accidental/permanent promotions.
4. **Long Animation Frames (LoAF) API** (Chrome 123+): identifies which script blocked a frame — pairs well with React profiling to catch reconciliation stalls during animation.
5. Test on a **mid-range laptop / throttled CPU (4–6× slowdown)**, not just the dev machine — the constraint is mid-range hardware with multiple panels.

### Accessibility (non-negotiable)
- Honor **`prefers-reduced-motion: reduce`**: disable/replace shake, large translations, spins, particle storms; keep essential feedback as gentle opacity/color cues. (MDN, WCAG C39.)
- Provide an **in-game "reduce/disable effects" + "disable screen shake" toggle** independent of OS setting.
- Avoid **flashing** faster than 3/sec (photosensitive-epilepsy / WCAG). Keep flashes brief and low-frequency.
- Never gate gameplay *information* solely on motion/color — pair color-coded damage with text.

### Quick do/don't
**Do:** `transform`+`opacity` only; WAAPI for sequencing/hit-stop; FLIP for layout moves; JIT `will-change`; pool & cap particles/numbers; non-blocking overlapping effects; add audio; honor reduced-motion.
**Don't:** animate `top/left/width/height/box-shadow/filter`; permanent blanket `will-change`; rAF loops competing with React; hundreds of DOM particles; block input on animations; over-shake.

---

## Sources

**Foundational game feel / juice**
- Jan Willem Nijman (Vlambeer) — *The Art of Screenshake* (talk): https://www.youtube.com/watch?v=SkgkIXZ_13Y — technique breakdown: https://theengineeringofconsciousexperience.com/jan-willem-nijman-vlambeer-the-art-of-screenshake/
- Martin Jonasson & Petri Purho — *Juice It or Lose It* (talk): https://www.youtube.com/watch?v=Fy0aCDmgnxg — GDC Vault: https://www.gdcvault.com/play/1016487/Juice-It-or-Lose — write-up: https://roblog.co.uk/2024/03/juicy-games/
- Steve Swink — *Game Feel: A Game Designer's Guide to Virtual Sensation* — Ch.1 (free PDF): http://mycours.es/gamedesign2014/files/2014/10/Game-Feel-Steve-Swink-chapter-1.pdf — overview: https://en.wikipedia.org/wiki/Game_feel
- Hit-stop / impact feedback research: https://www.oreateai.com/blog/research-on-the-mechanism-of-screen-shake-and-hit-stop-effects-on-game-impact/decf24388684845c565d0cc48f09fa24 — practitioner: https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/ — survey paper: https://arxiv.org/pdf/2011.09201 — impact-feedback study: https://arxiv.org/pdf/2208.06155
- Damage numbers / combat text: https://shweep.medium.com/damage-numbers-in-rpgs-1f0e3b1bc23a — juicy damage UI: https://acagamic.medium.com/juicy-damage-feedback-in-games-7c1758d69a42

**DOM / CSS implementation**
- web.dev — *How to create high-performance CSS animations*: https://web.dev/articles/animations-guide
- web.dev — *CSS versus JavaScript animations*: https://web.dev/articles/css-vs-javascript
- MDN — *CSS and JavaScript animation performance*: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance
- Motion — *Web Animation Performance Tier List*: https://motion.dev/magazine/web-animation-performance-tier-list
- Paul Lewis — *FLIP Your Animations*: https://aerotwist.com/blog/flip-your-animations/ — CSS-Tricks FLIP: https://css-tricks.com/animating-layouts-with-the-flip-technique/
- Chrome — *linear() easing for complex curves*: https://developer.chrome.com/docs/css-ui/css-linear-easing-function — MDN `<easing-function>`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/easing-function
- DOM-vs-canvas particles: https://tigerabrodi.blog/i-animated-250-particles-in-react-and-it-froze-canvas-fixed-it-in-100-lines — https://css-tricks.com/adding-particle-effects-to-dom-elements-with-canvas/
- MDN — `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — WCAG C39: https://www.w3.org/WAI/WCAG21/Techniques/css/C39

**Performance budget**
- web.dev — *Measure performance with the RAIL model*: https://web.dev/articles/rail
- web.dev — *Jank busting for better rendering performance*: https://web.dev/articles/speed-rendering
- Performant game loops in JS: https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/

**Genre comparisons**
- Balatro card movements/shaders breakdown (80.lv): https://80.lv/articles/balatro-s-card-movements-shaders-recreated-in-unity — Mix and Jam "Balatro-Feel": https://github.com/mixandjam/balatro-feel — video: https://m.youtube.com/watch?v=I1dAZuWurw4
- Slay the Spire UI analysis: https://www.cloudfallstudios.com/blog/2018/2/20/flash-thoughts-slay-the-spires-ui
- .io / browser-game juice: https://gamedev4u.medium.com/when-you-play-a-great-game-it-feels-good-d23761b6eccf
