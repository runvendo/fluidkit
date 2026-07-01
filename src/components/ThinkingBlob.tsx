/**
 * Organic "working"/"thinking" indicator: three same-color blobs that merge
 * and split on a loop via the shared goo filter, read as ambient activity
 * rather than a literal progress signal.
 *
 * Under `prefers-reduced-motion` this collapses to a calm 3-dot indicator —
 * no goo fusion, no transform/scale movement, at most a gentle opacity-only
 * pulse — since the merge/split motion reads as animated in a way vestibular
 * users may want to avoid.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { motion } from "motion/react";
import { useGoo } from "../hooks";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";

export interface ThinkingBlobProps extends HTMLAttributes<HTMLDivElement> {
  /** Blob color. Defaults to `currentColor`. */
  color?: string;
  /** Blob diameter in px. */
  size?: number;
  /** Animation speed multiplier (higher = faster => shorter duration). */
  speed?: number;
  /** When false, renders static (no looping animation). */
  active?: boolean;
}

const DEFAULT_SIZE = 20;
const DEFAULT_SPEED = 1;
const BASE_DURATION_S = 1.8;

/** Container/blob geometry derived from `size`, matching the ~88x34 @ 20px
 * proportions of the prototype's `.think` indicator. */
function layout(size: number) {
  return {
    width: size * 4 + 8,
    height: size + 14,
    top: 7 * (size / DEFAULT_SIZE),
    lefts: [size * 0.3, size * 1.5, size * 2.7],
    travel: size * 0.8,
  };
}

export function ThinkingBlob({
  color,
  size = DEFAULT_SIZE,
  speed = DEFAULT_SPEED,
  active = true,
  className,
  style,
  "aria-label": ariaLabel = "Thinking",
  ...rest
}: ThinkingBlobProps) {
  const { style: gooStyle } = useGoo();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  const animating = active && !prefersReducedMotion && inView;
  const calmPulse = prefersReducedMotion && active && inView;
  const resolvedColor = resolveColor(color);
  const { width, height, top, lefts, travel } = layout(size);

  const containerStyle: CSSProperties = {
    position: "relative",
    width,
    height,
    ...gooStyle,
    ...style,
  };

  const loopTransition = {
    duration: BASE_DURATION_S / speed,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  };

  // translateX targets and scale targets per blob, matching the prototype's
  // tb1/tb2/tb3 keyframes: outer blobs drift toward center and shrink, the
  // middle blob grows, reading as the three flowing into and out of each
  // other.
  const scaleTargets = [0.8, 1.25, 0.8];
  const xTargets = [travel, 0, -travel];

  return (
    <div
      ref={ref}
      className={className}
      style={containerStyle}
      data-animating={animating}
      role="status"
      aria-label={ariaLabel}
      {...rest}
    >
      {lefts.map((left, index) => {
        const blobStyle: CSSProperties = {
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: resolvedColor,
        };

        if (animating) {
          return (
            <motion.div
              key={index}
              data-fluidkit="thinking-blob"
              data-motion="loop"
              style={blobStyle}
              animate={{ x: [0, xTargets[index]], scale: [1, scaleTargets[index]] }}
              transition={loopTransition}
            />
          );
        }

        if (calmPulse) {
          return (
            <motion.div
              key={index}
              data-fluidkit="thinking-blob"
              data-motion="pulse"
              style={blobStyle}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: BASE_DURATION_S / speed,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (index * (BASE_DURATION_S / speed)) / 3,
              }}
            />
          );
        }

        return (
          <div
            key={index}
            data-fluidkit="thinking-blob"
            data-motion="static"
            style={blobStyle}
          />
        );
      })}
    </div>
  );
}
