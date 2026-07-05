/**
 * Color normalization util.
 *
 * fluidkit primitives are theming-agnostic: they ship no brand color, so a
 * consumer-omitted `color` prop must fall back to `currentColor` (inherit
 * the surrounding text color) or a caller-provided fallback. This does not
 * parse or validate CSS color syntax — it only resolves presence, so any
 * valid CSS color value (hex, rgb(), named color, or a `var(--x)` custom
 * property reference) passes through untouched.
 */

import { supportsRelativeColor } from "./featureDetect";

/**
 * Resolves a consumer-provided `color` prop to a usable CSS color value.
 *
 * Returns `color` trimmed when it's a non-empty string; otherwise returns
 * `fallback` (defaults to `"currentColor"`).
 */
export function resolveColor(
  color?: string,
  fallback: string = "currentColor"
): string {
  const trimmed = color?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * `base` with its alpha REPLACED by `alpha`, composing with any CSS color
 * format via relative color syntax. Degrades to `base` unchanged where the
 * syntax is unsupported, and for `currentColor` (some engines accept
 * `rgb(from white …)` but cannot parse a `currentColor` origin — an
 * invalid declaration would drop the fill entirely, worse than the
 * default transparency).
 */
export function colorWithAlpha(base: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (base.trim() === "currentColor") return base;
  if (!supportsRelativeColor()) return base;
  return `rgb(from ${base} r g b / ${clamped})`;
}
