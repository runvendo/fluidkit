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
