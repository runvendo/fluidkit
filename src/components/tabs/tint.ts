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
 * merging — so callers must pass non-overlapping intervals (the tab flows
 * always pass a single interval).
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

/** Mix `from`→`to` by weight `w` (0..1) into a `rgb(r, g, b)` string. */
export function mixColor(from: RGB, to: RGB, w: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * w);
  const g = Math.round(from[1] + (to[1] - from[1]) * w);
  const b = Math.round(from[2] + (to[2] - from[2]) * w);
  return `rgb(${r}, ${g}, ${b})`;
}
