// Shared OS reduced-motion check. The CSS opt-out (styles.css) handles all CSS
// animation/transition; this is for JS-driven effects (WAAPI shakes, the
// card-exit ghost) that bypass CSS and must opt out explicitly.
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
