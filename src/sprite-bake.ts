// Pre-bake constant CSS filters into sprite bitmaps (juice-toolkit "pre-baked
// filters" primitive). A constant `filter` on a scale-animated element re-runs
// the whole filter chain on every animation frame under software raster —
// measured in docs/frame-consistency-appraisal.md, even plain
// brightness/saturate on the combat sprites costs ~20 spikes/min. Baking the
// same filter into the bitmap once makes the animated element filter-free.
//
// Only non-bounds-expanding filters belong here (color ops). Shadows/glows go
// on static underlay elements instead — see docs/juice-toolkit.md.
import { useEffect, useReducer } from 'react';

export const COMBAT_SPRITE_FILTER = 'brightness(1.08) saturate(1.08)';

const baked = new Map<string, string>(); // original url -> baked object URL
const pending = new Map<string, Promise<void>>();

let filterSupport: boolean | null = null;

function canvasFilterSupported(): boolean {
  if (filterSupport !== null) return filterSupport;
  try {
    const probe = document.createElement('canvas').getContext('2d');
    if (probe) {
      probe.filter = 'brightness(1.5)';
      filterSupport = probe.filter !== 'none';
    } else {
      filterSupport = false;
    }
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

/** True when the browser cannot bake; callers should fall back to a CSS filter class. */
export function spriteBakeUnsupported(): boolean {
  return !canvasFilterSupported();
}

function bake(url: string, filter: string): Promise<void> {
  const existing = pending.get(url);
  if (existing) return existing;
  const job = (async () => {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = filter;
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) baked.set(url, URL.createObjectURL(blob));
  })().catch(() => {
    // Bake failure (decode error, tainted canvas…) — leave the original URL in
    // place; the sprite just renders without the brightness/saturate lift.
  });
  pending.set(url, job);
  return job;
}

/**
 * Warm the bake cache during idle time (e.g. at match start) so the first
 * combat mount doesn't pay decode+bake+src-swap mid-fight.
 */
export function prebakeSprites(urls: string[], filter: string = COMBAT_SPRITE_FILTER): void {
  if (spriteBakeUnsupported()) return;
  const queue = urls.filter((url) => !baked.has(url));
  if (queue.length === 0) return;
  const kickOff = () => {
    for (const url of queue) void bake(url, filter);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(kickOff, { timeout: 4000 });
  else setTimeout(kickOff, 250);
}

/**
 * Returns the filter-baked version of a sprite URL, or the original until the
 * bake finishes (the swap is imperceptible: same pixels ±8% brightness).
 */
export function useBakedSprite(url: string, filter: string = COMBAT_SPRITE_FILTER): string {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const ready = baked.get(url);
  useEffect(() => {
    if (ready !== undefined || spriteBakeUnsupported()) return undefined;
    let alive = true;
    void bake(url, filter).then(() => {
      if (alive) rerender();
    });
    return () => {
      alive = false;
    };
  }, [url, filter, ready]);
  return ready ?? url;
}
