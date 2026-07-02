/**
 * Whether the current environment can create a WebGL rendering context.
 *
 * Used to gate the GPU-tier primitives (`fluidkit/liquid-metal`,
 * `fluidkit/water-field`) so they never boot a shader/simulation on a device
 * or browser that can't run one. A function (never a top-level constant) so
 * nothing runs at module import time, and it swallows errors so it never
 * throws — including in SSR, where `document` may be absent entirely.
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

let cachedResult: boolean | undefined;

export function supportsWebGL(): boolean {
  if (cachedResult !== undefined) return cachedResult;
  try {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    cachedResult = !!(
      canvas.getContext("webgl2") || canvas.getContext("webgl")
    );
  } catch {
    cachedResult = false;
  }
  return cachedResult;
}
