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
import { resolveMaterial } from "../liquid/materials";
import { INTENSITY_PRESETS, resolveIntensity } from "./intensity";
import type { SurfaceStyleProps } from "./surface";

// Ripple takes no `light`/`reflection`/`refraction`/`shadow` from the surface
// style pack: a momentary expanding wave has no resting surface for the scene
// light to play on and casts no shadow.
export interface RippleProps
  extends Omit<
      SurfaceStyleProps,
      "light" | "reflection" | "refraction" | "shadow"
    >,
    HTMLAttributes<HTMLDivElement> {
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

/** Peak opacity of a ripple at the default intensity — this (not the
 * background itself) is what makes it read as a translucent wash of
 * `currentColor` rather than a solid disc. The opacity holds near this while
 * the ripple expands, then fades at the end, so the growing ring stays legible
 * instead of dissolving as soon as it grows. `intensity` scales this peak,
 * normalized so the default (`"whisper"` = 0.35) keeps 0.4 exactly. */
const RIPPLE_PEAK_OPACITY = 0.4;

/**
 * Blur override for the shared glass recipe: the shared 16px frost is a
 * panel's — on a momentary expanding lens it smears the backdrop into fog
 * before the ripple can read as water. 5px keeps the lens light and crisp,
 * so only the blur radius diverges from the resolver (like LiquidText's
 * GLYPH_BLUR_PX).
 */
const RIPPLE_BLUR_PX = 5;

/** Thin rim on the glass lens, Ripple's own on top of the resolved fill —
 * the meniscus edge that makes it read as liquid, not just a blur region. */
const GLASS_RIM = "inset 0 0 0 1px rgba(255,255,255,0.45)";

export function Ripple({
  color,
  tint,
  duration,
  material = "flat",
  intensity = "whisper",
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

  // Loudness: `intensity` scales the peak opacity the ripple holds while it
  // expands. Normalized against the default volume so `"whisper"` (0.35)
  // renders today's 0.4 peak pixel-identically and higher volumes read louder.
  // This deliberately diverges from the surface family's shared `0.4 × volume`
  // specular rule (LiquidCard, LiquidButton, LiquidTabs, ...): a ripple's wash
  // opacity is the whole read, not a glint layered on a lit surface, so it
  // stays pinned to the pre-pack 0.4 instead of scaling straight off volume.
  // Do not "harmonize" this to `0.4 * volume` — that would halve the default.
  const volume = resolveIntensity(intensity);
  const peakOpacity = Math.min(
    1,
    RIPPLE_PEAK_OPACITY * (volume / INTENSITY_PRESETS.whisper)
  );

  // Glass routes through the shared material resolver (tint + saturation +
  // degraded fallback), keeping only Ripple's light 5px frost and rim.
  const fillStyle: CSSProperties =
    material === "glass"
      ? {
          ...resolveMaterial("glass", { tint, blurPx: RIPPLE_BLUR_PX })
            .fillStyle,
          boxShadow: GLASS_RIM,
        }
      : { background: resolvedColor };

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
                ...fillStyle,
              }}
              initial={{ scale: 0, opacity: peakOpacity }}
              animate={{
                scale: 1,
                opacity: [peakOpacity, peakOpacity, 0],
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
