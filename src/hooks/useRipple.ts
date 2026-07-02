/**
 * Headless primitive behind `<Ripple>` — a Material-style water ripple that
 * expands from the pointer's position on tap/click and fades out.
 *
 * The hook owns the ripple lifecycle (spawn on pointer down, remove once the
 * caller's exit animation finishes) but renders nothing itself; `<Ripple>`
 * is responsible for drawing each entry in `ripples` and calling `remove`.
 *
 * Ripple ids come from an incrementing `useRef` counter rather than
 * `Date.now()`/`Math.random()` — deterministic, monotonically unique per
 * hook instance, and side-effect-free to compute.
 *
 * Under `prefers-reduced-motion`, `onPointerDown` is a no-op: no ripple ever
 * spawns, keeping the reduced path calm rather than just shortening the
 * animation.
 */

import { useRef, useState, type PointerEvent } from "react";
import { resolveColor, usePrefersReducedMotion } from "../utils";

export interface RippleData {
  /** Unique per hook instance; ripple-counter-derived, not time/random. */
  id: number;
  /** Ripple origin, relative to the target element's box. */
  x: number;
  /** Ripple origin, relative to the target element's box. */
  y: number;
  /** Diameter large enough to cover the element from (x, y). */
  size: number;
}

export interface UseRippleOptions {
  /** Ripple color. Defaults to `currentColor`. */
  color?: string;
  /** Ripple lifetime in ms. Defaults to `600`. */
  duration?: number;
}

export interface UseRippleHandlers {
  /** Spread onto the target element to spawn ripples from pointer taps. */
  onPointerDown: (e: PointerEvent) => void;
}

export interface UseRippleResult {
  /** Spread onto the target element. */
  handlers: UseRippleHandlers;
  /** Currently active ripples, oldest first. */
  ripples: RippleData[];
  /** Removes a ripple by id; call once its exit animation completes. */
  remove: (id: number) => void;
  /** Resolved ripple color, for the consumer to render with. */
  color: string;
  /** Resolved ripple duration in ms, for the consumer to render with. */
  duration: number;
}

const DEFAULT_DURATION_MS = 600;

/**
 * Headless primitive behind `<Ripple>`: owns the ripple lifecycle (spawn on
 * pointer down, `remove` once the caller's exit animation finishes) but
 * renders nothing itself. Under reduced motion no ripple ever spawns.
 */
export function useRipple({
  color,
  duration = DEFAULT_DURATION_MS,
}: UseRippleOptions = {}): UseRippleResult {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [ripples, setRipples] = useState<RippleData[]>([]);

  // Monotonic id source: no Date.now()/Math.random(), just a counter that
  // survives across renders via the ref.
  const nextId = useRef(0);

  function onPointerDown(e: PointerEvent) {
    if (prefersReducedMotion) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Size the ripple to cover the element from its origin: twice the
    // farthest of the four corners guarantees the fully-scaled circle
    // reaches every edge.
    const distances = [
      Math.hypot(x, y),
      Math.hypot(rect.width - x, y),
      Math.hypot(x, rect.height - y),
      Math.hypot(rect.width - x, rect.height - y),
    ];
    const size = 2 * Math.max(...distances);

    const id = nextId.current;
    nextId.current += 1;

    setRipples((prev) => [...prev, { id, x, y, size }]);
  }

  function remove(id: number) {
    setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
  }

  return {
    handlers: { onPointerDown },
    ripples,
    remove,
    color: resolveColor(color),
    duration,
  };
}
