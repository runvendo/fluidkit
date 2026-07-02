/**
 * Shared deterministic-placement constants for ambient background
 * components (`MeshGradient`, `Aurora`, ...). Same golden-angle scheme as
 * `Droplets`' `dropAngle` — irrational-ish steps that spread indexed items
 * around a circle / across a range without ever repeating a short cycle, and
 * without `Math.random`/`Date.now` (which would break SSR determinism and
 * render-to-render stability).
 *
 * Droplets keeps its own copies of these numbers; they're intentionally not
 * imported from here to avoid coupling an already-shipped component to this
 * newer shared module.
 */

/** Golden angle in radians (~137.5°), used to spread indexed items around a circle. */
export const GOLDEN_ANGLE = 2.399963;

/** Fractional part of the golden ratio, used as a deterministic per-index phase offset in [0, 1). */
export const GOLDEN_RATIO_FRAC = 0.618034;

/** Minimum drift speed multiplier for ambient backgrounds — kills the
 * divide-by-zero `Infinity` keyframe duration a `speed={0}` (or negative)
 * prop would otherwise produce. */
export const MIN_SPEED = 0.01;
