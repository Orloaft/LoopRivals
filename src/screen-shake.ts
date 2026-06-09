// Reusable decaying screen-shake (proposal §2.4). A single WAAPI animation on a
// caller-supplied wrapper, driving `transform: translate3d()` only, so it stays
// on the compositor and off the main thread. The keyframes ALWAYS decay to zero
// and the animation does not fill, so the element is never left displaced even
// if interrupted. Amplitude scales with event magnitude (a crit shakes harder
// than a glancing hit). Gated behind a persisted, user-toggleable preference and
// the OS reduced-motion setting.
import { prefersReducedMotion } from './motion-prefs';

let enabled = loadEnabledPref();

function loadEnabledPref(): boolean {
  try {
    return localStorage.getItem('loopduel.shake') !== 'off';
  } catch {
    return true;
  }
}

export function isShakeEnabled(): boolean {
  return enabled;
}

export function setShakeEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem('loopduel.shake', on ? 'on' : 'off');
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
}

type ShakeOptions = {
  // 0..~2.5; 1 ≈ a normal hit, ~1.6 a crit/finisher, ~0.6 a light board tick.
  magnitude?: number;
  durationMs?: number;
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function shake(el: HTMLElement | null | undefined, options: ShakeOptions = {}): void {
  if (!el || !enabled || prefersReducedMotion()) return;
  if (typeof el.animate !== 'function') return;
  const magnitude = clamp(options.magnitude ?? 1, 0, 2.5);
  if (magnitude <= 0) return;
  const amplitude = 2.5 + magnitude * 4.5; // px at the first impact
  const duration = options.durationMs ?? Math.round(200 + magnitude * 70);

  // Alternating, perpendicular-jittered offsets that taper linearly to zero. A
  // fixed pattern (no RNG) keeps it reproducible and allocation-light; the
  // decay envelope guarantees the wrapper settles exactly on origin.
  const steps = 7;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const decay = 1 - i / steps; // 1 → 0
    const dx = i === steps ? 0 : (i % 2 === 0 ? 1 : -1) * amplitude * decay;
    const dy = i === steps ? 0 : (i % 3 === 0 ? -1 : 1) * amplitude * 0.5 * decay;
    frames.push({ transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)` });
  }

  try {
    el.animate(frames, { duration, easing: 'ease-out', fill: 'none' });
  } catch {
    /* never let a juice effect throw into gameplay */
  }
}
