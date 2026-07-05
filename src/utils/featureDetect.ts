/**
 * Feature-detection utilities.
 *
 * These guard runtime capability checks so primitives (e.g. the glass material) can
 * pick their best-available rendering path and degrade gracefully. Every
 * detector is a function (never a top-level constant) so nothing runs at
 * module import time, and every detector swallows errors so it never throws
 * — including in SSR, where `CSS` and `document` may be absent entirely.
 */

function cssSupports(property: string, value: string): boolean {
  try {
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return false;
    }
    return CSS.supports(property, value);
  } catch {
    return false;
  }
}

/** Whether the browser can render `backdrop-filter` (or its -webkit- prefixed form). */
export function supportsBackdropFilter(): boolean {
  return (
    cssSupports("backdrop-filter", "blur(1px)") ||
    cssSupports("-webkit-backdrop-filter", "blur(1px)")
  );
}

/**
 * Whether the real refraction path can run: SVG displacement filters inside
 * `backdrop-filter`. Effectively Chromium-only today.
 */
export function supportsRefraction(): boolean {
  return (
    cssSupports("backdrop-filter", "url(#x)") ||
    cssSupports("-webkit-backdrop-filter", "url(#x)")
  );
}

/**
 * Whether CSS relative color syntax (`rgb(from <color> r g b / a)`) works —
 * the pack's `opacity` knob rewrites a tint's alpha with it. Evergreen
 * browsers since 2024; where unsupported, `opacity` is ignored and the
 * material's default transparency renders.
 */
export function supportsRelativeColor(): boolean {
  return cssSupports("color", "rgb(from white r g b / 0.5)");
}

/** Whether the View Transitions API (`document.startViewTransition`) is available. */
export function supportsViewTransition(): boolean {
  try {
    return (
      typeof document !== "undefined" &&
      typeof document.startViewTransition === "function"
    );
  } catch {
    return false;
  }
}
