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
  /** Ripple color (flat material). Defaults to `currentColor`. */
  color?: string;
  /** Ripple lifetime in ms. Defaults to `600`. */
  duration?: number;
  /**
   * `flat` (default): a translucent wash of `color`.
   * `glass`: a frosted water lens — white tint + backdrop blur with a thin
   * rim, so the ripple reads as liquid over the surface instead of a dye.
   */
  material?: "flat" | "glass";
  children: ReactNode;
}

/** Peak opacity of a ripple — this (not the background itself) is what makes
 * it read as a translucent wash of `currentColor` rather than a solid disc.
 * The opacity holds near this while the ripple expands, then fades at the end,
 * so the growing ring stays legible instead of dissolving as soon as it grows. */
const RIPPLE_PEAK_OPACITY = 0.4;

/** The glass ripple's material: frosted lens instead of a color wash. */
const GLASS_RIPPLE_STYLE: CSSProperties = {
  background: "rgba(255,255,255,0.28)",
  backdropFilter: "blur(5px) saturate(1.6)",
  WebkitBackdropFilter: "blur(5px) saturate(1.6)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)",
};

/**
 * Material-style water ripple: expands from the pointer's tap/click position
 * and fades out, clipped to the surface's box and border-radius. `material`
 * here is the two-value subset `"flat" | "glass"` (no mercury ripple).
 * Under reduced motion no ripple ever spawns.
 */
export function Ripple({
  color,
  duration,
  material = "flat",
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
                translateX: "-50%",
                translateY: "-50%",
                ...(material === "glass"
                  ? GLASS_RIPPLE_STYLE
                  : { background: resolvedColor }),
              }}
              initial={{ scale: 0, opacity: RIPPLE_PEAK_OPACITY }}
              animate={{
                scale: 1,
                opacity: [RIPPLE_PEAK_OPACITY, RIPPLE_PEAK_OPACITY, 0],
              }}
              transition={{
                // Both the top-level duration and the per-property `opacity`
                // block need their own `duration`: Motion does NOT inherit the
                // top-level duration into a per-value transition object, so a
                // bare `opacity: { times }` would silently fall back to
                // Motion's ~0.3s default and cut the ripple short.
                duration: resolvedDuration / 1000,
                ease: "easeOut", // applies to scale
                opacity: {
                  duration: resolvedDuration / 1000,
                  // Hold near peak while it expands, then fade over the last ~35%.
                  times: [0, 0.65, 1],
                  ease: "easeIn",
                },
              }}
              onAnimationComplete={() => remove(ripple.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
