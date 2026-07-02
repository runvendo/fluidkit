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
 * Whether the current environment can create a WebGL rendering context.
 *
 * Internal (not exported from the utils barrel): gates the GPU-tier
 * primitives (`fluidkit/liquid-metal`, `fluidkit/water-field`) so they never
 * boot a shader/simulation on a device or browser that can't run one.
 *
 * The probe result is cached at module level after the first real probe:
 * browsers cap the number of live WebGL contexts per page (evicting the
 * oldest when the cap is exceeded), so creating a throwaway probe context
 * for every mounted GPU component would needlessly burn slots. Capability
 * doesn't change within a page load, so one probe is enough. Detection
 * stays lazy — nothing runs until the first component actually asks. The
 * SSR `false` (no `document`) is deliberately NOT cached, so the same
 * module instance answers correctly if `document` appears later.
 */
let cachedWebGLResult: boolean | undefined;

export function supportsWebGL(): boolean {
  if (cachedWebGLResult !== undefined) return cachedWebGLResult;
  try {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    cachedWebGLResult = !!(
      canvas.getContext("webgl2") || canvas.getContext("webgl")
    );
  } catch {
    cachedWebGLResult = false;
  }
  return cachedWebGLResult;
}
