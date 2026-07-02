/**
 * Ambient background: large, softly blurred radial-gradient blobs drifting
 * slowly behind content. Pure CSS — the drift is a `@keyframes` transform
 * loop, so there is zero per-frame JS once mounted.
 *
 * The component IS the background layer, not a child overlay: it renders
 * `position:absolute; inset:0; overflow:hidden; pointer-events:none`, so a
 * consumer places it inside a `position:relative` (or similarly positioned)
 * parent alongside their real content, e.g.:
 *
 *   <div style={{ position: "relative" }}>
 *     <MeshGradient />
 *     <YourContent />
 *   </div>
 *
 * Blob placement and phase are derived deterministically from each color's
 * index (golden-angle spread, same scheme as Droplets' `dropAngle` — no
 * `Math.random`/`Date.now`), so two renders with the same `colors` produce
 * byte-identical blob styles.
 *
 * Reduced motion / off-screen: under `prefers-reduced-motion` the drift
 * keyframes are dropped entirely (`animation-name: none`) and blobs sit at
 * their static home position. When scrolled out of view (`useInView`), the
 * keyframes stay attached but `animation-play-state` is paused rather than
 * torn down, so drift resumes in-phase when it scrolls back.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useMemo } from "react";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import { GOLDEN_ANGLE, GOLDEN_RATIO_FRAC } from "../utils/constants";
import { injectStyleOnce } from "../utils/injectStyleOnce";

export interface MeshGradientProps extends HTMLAttributes<HTMLDivElement> {
  /** Blob colors, one blob per entry. Defaults to a soft pastel light-mode set. */
  colors?: string[];
  /** Drift speed multiplier — higher divides the keyframe period down (faster). Defaults to `1`. */
  speed?: number;
  /** Blob blur radius in px. Defaults to `60`. */
  blur?: number;
}

/** Soft pastel blue/violet/pink set — restrained, light-mode-first. */
const DEFAULT_COLORS = ["#dbe4ff", "#e7d6f7", "#fbdce6"];

const KEYFRAMES_STYLE_ID = "fluidkit-mesh-gradient-keyframes";
const DRIFT_KEYFRAMES_NAME = "fluidkit-mesh-drift";

/** Blob diameter range, as a percentage of the container (both axes — no
 * measurement needed, so it degrades gracefully to whatever box the
 * consumer sizes the wrapper to). */
const MIN_SIZE_PCT = 60;
const SIZE_SPAN_PCT = 20; // 60-80%

/** How far blob centers spread from the container's center, as a percentage. */
const SPREAD_PCT = 24;

/** Drift keyframe period range in seconds, before dividing by `speed`. */
const MIN_PERIOD_S = 20;
const PERIOD_SPAN_S = 40; // 20-60s

const KEYFRAMES_CSS = `
@keyframes ${DRIFT_KEYFRAMES_NAME} {
  0% { transform: translate(-50%, -50%) translate(0%, 0%); }
  25% { transform: translate(-50%, -50%) translate(6%, -5%); }
  50% { transform: translate(-50%, -50%) translate(-4%, 6%); }
  75% { transform: translate(-50%, -50%) translate(-6%, -3%); }
  100% { transform: translate(-50%, -50%) translate(0%, 0%); }
}
`;

/** Deterministic per-blob angle — same golden-angle scheme as Droplets' `dropAngle`. */
function blobAngle(index: number): number {
  return index * GOLDEN_ANGLE;
}

/** Minimum drift speed multiplier — kills the divide-by-zero `Infinity`
 * keyframe duration a `speed={0}` (or negative) prop would otherwise produce. */
const MIN_SPEED = 0.01;

interface Blob {
  color: string;
  leftPct: number;
  topPct: number;
  sizePct: number;
  periodS: number;
  delayS: number;
}

function layoutBlobs(colors: string[], speed: number): Blob[] {
  return colors.map((color, i) => {
    const angle = blobAngle(i);
    const frac = (i * GOLDEN_RATIO_FRAC) % 1; // golden-ratio fractional phase, deterministic
    const periodS = (MIN_PERIOD_S + frac * PERIOD_SPAN_S) / speed;
    return {
      color: resolveColor(color, DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
      leftPct: 50 + Math.cos(angle) * SPREAD_PCT,
      topPct: 50 + Math.sin(angle) * SPREAD_PCT,
      sizePct: MIN_SIZE_PCT + frac * SIZE_SPAN_PCT,
      periodS,
      // Negative delay starts each blob mid-cycle instead of all in-phase at
      // 0%, so blobs don't visibly synchronize.
      delayS: -(frac * periodS),
    };
  });
}

export function MeshGradient({
  colors = DEFAULT_COLORS,
  speed = 1,
  blur = 60,
  className,
  style,
  ...rest
}: MeshGradientProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  useEffect(() => {
    injectStyleOnce(KEYFRAMES_STYLE_ID, KEYFRAMES_CSS);
  }, []);

  const clampedSpeed = Math.max(speed, MIN_SPEED);
  const blobs = useMemo(
    () => layoutBlobs(colors, clampedSpeed),
    [colors, clampedSpeed]
  );

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    ...style,
  };

  return (
    <div
      ref={ref}
      data-fluidkit="mesh-gradient"
      data-animating={animating}
      aria-hidden="true"
      className={className}
      style={wrapperStyle}
      {...rest}
    >
      {blobs.map((blob, i) => (
        <div
          key={i}
          data-fluidkit="mesh-blob"
          style={{
            position: "absolute",
            left: `${blob.leftPct}%`,
            top: `${blob.topPct}%`,
            width: `${blob.sizePct}%`,
            height: `${blob.sizePct}%`,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${blob.color}, transparent 70%)`,
            // Standalone ambient background layer, not a clipped liquid-engine
            // layer — the Chromium filtered-clip seam bug that forbids
            // `filter: blur()` elsewhere in this library doesn't apply here.
            filter: `blur(${blur}px)`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            animationName: prefersReducedMotion ? "none" : DRIFT_KEYFRAMES_NAME,
            animationDuration: `${blob.periodS}s`,
            animationDelay: `${blob.delayS}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationPlayState: animating ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}
