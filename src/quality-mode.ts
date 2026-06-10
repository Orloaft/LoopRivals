// Render-quality mode (docs/weak-machine-perf-appraisal.md). The match UI is
// GPU-fill-rate-bound on weak/software-rendered machines, so when the
// compositor demonstrably can't keep up we flip `quality-low` on <html> and
// styles.css sheds the expensive blend work (parallax stack, decorative
// shadows and pulses). Main-thread cost was measured healthy, so this is the
// only degradation axis that matters.
//
// Preference (persisted): 'auto' (default) | 'high' (never degrade) |
// 'low' (always degraded). Auto-engagement is sticky for the session — a
// machine that dipped once will dip again, and flapping the backdrop on and
// off is worse than staying plain.

export type QualityPref = 'auto' | 'high' | 'low';

const STORAGE_KEY = 'loopduel.quality';
const LOW_CLASS = 'quality-low';

// ~5s of sustained sub-28fps presents before degrading — low mode measures a
// flat 60fps where full quality grinds at ~25–30, so below ~30 the trade is
// strictly better. 28 (not 30) so a machine pinned at exactly 30fps doesn't
// flap. The judged statistic
// is frames-per-window, not per-gap slowness: struggling compositors deliver
// rAF callbacks in bursts (clusters of fast callbacks between long stalls),
// which makes individual-gap shares look misleadingly healthy. Two
// consecutive slow windows are required so a single GC pause or one janky
// stretch can't trip it; the visibility resets keep background-tab rAF
// throttling from counting at all.
const WINDOW_MS = 2500;
const MIN_WINDOW_FPS = 28;
const SLOW_WINDOWS_TO_ENGAGE = 2;

let pref: QualityPref = loadPref();
let autoEngaged = false;
let rafHandle: number | null = null;
let debugWindowsSeen = 0;
let debugLastWindow: { frames: number; elapsedMs: number; fps: number; slow: boolean } | null = null;

function loadPref(): QualityPref {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'high' || stored === 'low' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function lowActive(): boolean {
  return pref === 'low' || (pref === 'auto' && autoEngaged);
}

function applyClass(): void {
  document.documentElement.classList.toggle(LOW_CLASS, lowActive());
}

export function getQualityPref(): QualityPref {
  return pref;
}

export function isQualityLowActive(): boolean {
  return lowActive();
}

export function setQualityPref(next: QualityPref): void {
  pref = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
  applyClass();
  if (pref === 'auto') startWatcher();
}

function startWatcher(): void {
  if (rafHandle !== null || autoEngaged || pref !== 'auto') return;
  if (typeof window.requestAnimationFrame !== 'function') return;

  let windowStartedAt = performance.now();
  let frames = 0;
  let slowWindows = 0;

  const resetWindow = (at: number) => {
    windowStartedAt = at;
    frames = 0;
  };

  // Background tabs get throttled rAF; those frames say nothing about the
  // compositor. Restart the measurement whenever visibility flips so the
  // hide→show stall never enters a window.
  document.addEventListener('visibilitychange', () => resetWindow(performance.now()));

  const step = (frameAt: number) => {
    rafHandle = null;
    if (pref !== 'auto' || autoEngaged) return;

    if (document.visibilityState !== 'visible') {
      resetWindow(frameAt);
      rafHandle = window.requestAnimationFrame(step);
      return;
    }

    frames += 1;
    const elapsedMs = frameAt - windowStartedAt;
    if (elapsedMs >= WINDOW_MS) {
      // Judge with the real elapsed time: when rAF stalls past the window
      // boundary the window closes late, and frames/WINDOW_MS would overstate
      // the rate.
      const fps = (frames * 1000) / elapsedMs;
      const slow = fps < MIN_WINDOW_FPS;
      debugWindowsSeen += 1;
      debugLastWindow = { frames, elapsedMs: Math.round(elapsedMs), fps: Math.round(fps * 10) / 10, slow };
      slowWindows = slow ? slowWindows + 1 : 0;
      resetWindow(frameAt);
      if (slowWindows >= SLOW_WINDOWS_TO_ENGAGE) {
        autoEngaged = true;
        applyClass();
        console.info('[loopduel] sustained low present rate — switching to low render quality (override in Menu)');
        return;
      }
    }
    rafHandle = window.requestAnimationFrame(step);
  };

  rafHandle = window.requestAnimationFrame(step);
}

export function initQualityMode(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  applyClass();
  startWatcher();
  // Introspection for the perf harness (scripts/playwright-autopsy.mjs, tmp probes).
  (window as Window & { __loopduelQuality?: unknown }).__loopduelQuality = {
    get pref() { return pref; },
    get lowActive() { return lowActive(); },
    get autoEngaged() { return autoEngaged; },
    get watcherRunning() { return rafHandle !== null; },
    get windowsSeen() { return debugWindowsSeen; },
    get lastWindow() { return debugLastWindow; }
  };
}
