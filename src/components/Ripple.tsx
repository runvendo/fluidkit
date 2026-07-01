/**
 * Material-style water ripple: expands from the pointer's tap/click position
 * and fades out, clipped to the surface's box (and its border-radius).
 *
 * Structure: a `position:relative; overflow:hidden` wrapper carries the
 * consumer's children plus an absolutely-positioned, `pointer-events:none`
 * overlay that draws each active ripple as a `motion.span`. `overflow:hidden`
 * on the wrapper is what clips ripples to the surface — including rounded
 * corners, since the overlay's `borderRadius` is set to `inherit`.
 * `pointer-events:none` on the overlay keeps the children (buttons, links,
 * ...) fully interactive underneath it.
 *
 * Ripple spawning/removal is delegated entirely to `useRipple`: pointer down
 * pushes a ripple, and each ripple removes itself via `onAnimationComplete`
 * once its exit animation finishes (no timers to get out of sync with
 * Motion's actual animation duration).
 *
 * Under `prefers-reduced-motion`, `useRipple`'s `onPointerDown` no-ops, so no
 * ripple ever spawns and the wrapper just renders children normally.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRipple } from "../hooks";

export interface RippleProps extends HTMLAttributes<HTMLDivElement> {
  /** Ripple color. Defaults to `currentColor`. */
  color?: string;
  /** Ripple lifetime in ms. Defaults to `600`. */
  duration?: number;
  children: ReactNode;
}

/** Opacity a freshly-spawned ripple starts at, fading to 0 as it expands —
 * this (not the background itself) is what makes the ripple read as a
 * translucent wash of `currentColor` rather than a solid disc. */
const RIPPLE_START_OPACITY = 0.35;

export function Ripple({
  color,
  duration,
  className,
  style,
  children,
  onPointerDown,
  ...rest
}: RippleProps) {
  const {
    handlers,
    ripples,
    remove,
    color: resolvedColor,
    duration: resolvedDuration,
  } = useRipple({ color, duration });

  const wrapperStyle: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    ...style,
  };

  return (
    <div
      data-fluidkit="ripple-surface"
      className={className}
      style={wrapperStyle}
      onPointerDown={(e) => {
        handlers.onPointerDown(e);
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {children}

      <div
        data-fluidkit="ripple-overlay"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      >
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              data-fluidkit="ripple"
              style={{
                position: "absolute",
                left: ripple.x,
                top: ripple.y,
                width: ripple.size,
                height: ripple.size,
                borderRadius: "50%",
                background: resolvedColor,
                translateX: "-50%",
                translateY: "-50%",
              }}
              initial={{ scale: 0, opacity: RIPPLE_START_OPACITY }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: resolvedDuration / 1000 }}
              onAnimationComplete={() => remove(ripple.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
