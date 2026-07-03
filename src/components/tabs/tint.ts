/**
 * Coverage-driven label tinting for LiquidTabs.
 *
 * A tab label's color is a pure function of how much of the tab box the
 * liquid indicator currently covers — never of click/selection state. The
 * flow reports the x-intervals its ink occupies; each label mixes from a base
 * color to an active color by its smoothstepped coverage, so labels and
 * liquid always move together.
 */

/** Inclusive x-range [start, end] covered by ink, in container pixels. */
export type Interval = [number, number];

/** An RGB triple, 0..255 per channel. */
export type RGB = readonly [number, number, number];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Hermite smoothstep of `x` across the edge pair [a, b]. */
export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * Fraction (0..1) of the tab box `[left, left+width]` covered by `intervals`,
 * then smoothstepped so a label brightens only once the liquid is meaningfully
 * under it and reaches full active color before full overlap.
 *
 * Each interval's overlap with the tab box is summed independently — no
 * merging. Overlapping intervals are tolerated: the summed coverage is
 * smoothstep-clamped to 1, so raw values above the upper edge simply saturate
 * (slideFlow can pass a body + tail interval that briefly overlap when the
 * tail is near the body).
 */
export function tabCoverage(
  left: number,
  width: number,
  intervals: readonly Interval[]
): number {
  if (width <= 0) return 0;
  const right = left + width;
  let covered = 0;
  for (const [a, b] of intervals) {
    covered += Math.max(0, Math.min(b, right) - Math.max(a, left));
  }
  return smoothstep(0.35, 0.7, covered / width);
}

/**
 * Parse a CSS color into an RGB triple for mixing. Supports `#rgb`,
 * `#rrggbb`, and `rgb()`/`rgba()` — the formats that can be mixed
 * numerically without a browser. Anything else (named colors, `var()`,
 * `oklch()`) returns null so callers fall back to their default.
 */
export function parseColor(color?: string): RGB | null {
  if (!color) return null;
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const s =
      hex[1].length === 3 ? [...hex[1]].map((ch) => ch + ch).join("") : hex[1];
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** Mix `from`→`to` by weight `w` (0..1) into a `rgb(r, g, b)` string. */
export function mixColor(from: RGB, to: RGB, w: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * w);
  const g = Math.round(from[1] + (to[1] - from[1]) * w);
  const b = Math.round(from[2] + (to[2] - from[2]) * w);
  return `rgb(${r}, ${g}, ${b})`;
}
