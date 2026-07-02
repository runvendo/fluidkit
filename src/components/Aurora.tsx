/**
 * Ambient background: slow-drifting, heavily blurred horizontal bands
 * stacked in the upper portion of the container. Pure CSS — the drift is a
 * `@keyframes` transform loop, so there is zero per-frame JS once mounted.
 *
 * Blending: the default `mix-blend-mode: screen` gives the aurora-glow read
 * on dark and mid-tone surfaces, but screen compositing mathematically
 * washes out toward white — on a pure `#fff` background bands are exactly
 * invisible (`screen(b, white) = white`) and on near-white they are heavily
 * attenuated, no matter the palette. For light surfaces, prefer
 * `blend="normal"` (opacity-only, with a slight opacity bump so bands read)
 * or `blend="multiply"` (darkens, ink-wash look).
 *
 * The component IS the background layer, not a child overlay: it renders
 * `position:absolute; inset:0; overflow:hidden; pointer-events:none`, so a
 * consumer places it inside a `position:relative` (or similarly positioned)
 * parent alongside their real content, e.g.:
 *
 *   <div style={{ position: "relative" }}>
 *     <Aurora />
 *     <YourContent />
 *   </div>
 *
 * Note for docs: `mix-blend-mode` composites against whatever is painted
 * behind the band — a transparent parent lets bands blend with arbitrary
 * page content behind it, so consumers should give the parent an opaque
 * background.
 *
 * Band placement and phase are derived deterministically from each color's
 * index (golden-angle/golden-ratio scheme, same as `MeshGradient` and
 * Droplets' `dropAngle` — no `Math.random`/`Date.now`), so two renders with
 * the same `colors` produce byte-identical band styles.
 *
 * Reduced motion / off-screen: under `prefers-reduced-motion` the drift
 * keyframes are dropped entirely (`animation-name: none`) and bands sit at
 * their static home position. When scrolled out of view (`useInView`), the
 * keyframes stay attached but `animation-play-state` is paused rather than
 * torn down, so drift resumes in-phase when it scrolls back.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useMemo } from "react";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import {
  GOLDEN_ANGLE,
  GOLDEN_RATIO_FRAC,
  MIN_SPEED,
} from "../utils/constants";
import { injectStyleOnce } from "../utils/injectStyleOnce";

export interface AuroraProps extends HTMLAttributes<HTMLDivElement> {
  /** Band colors, one band per entry. Defaults to 2-3 cool, light-mode-friendly hues. */
  colors?: string[];
  /** Band opacity scale, `0`-`1`. Defaults to `0.6`. */
  intensity?: number;
  /** Drift speed multiplier — higher divides the keyframe period down (faster). Defaults to `1`. */
  speed?: number;
  /**
   * How bands composite onto the surface behind them. Defaults to `"screen"`
   * (glow — reads on dark/mid surfaces, washes out toward invisible on
   * near-white). Use `"normal"` (opacity-only) or `"multiply"` (darkening)
   * on light surfaces.
   */
  blend?: "screen" | "normal" | "multiply";
}

/** Cool teal/green/violet set — restrained, light-mode-first. */
const DEFAULT_COLORS = ["#7dd8c8", "#8fd1a3", "#a68fe0"];

const KEYFRAMES_STYLE_ID = "fluidkit-aurora-keyframes";
const DRIFT_KEYFRAMES_NAME = "fluidkit-aurora-drift";

/** Opacity boost under `blend="normal"`: without screen compositing adding
 * light, bands rely on opacity alone, so scale it up slightly (capped at 1)
 * to keep the same subjective presence. */
const NORMAL_BLEND_OPACITY_BOOST = 1.3;

/** Band blur radius in px. Fixed (unlike MeshGradient's `blur` prop): bands
 * need to stay soft strips regardless of consumer tuning, since a sharp band
 * reads as a stray line rather than an aurora glow. */
const BAND_BLUR_PX = 40;

/** Band skew, degrees. Small per-band variation keeps a multi-band aurora
 * from looking like uniform stacked stripes. */
const BASE_SKEW_DEG = -8;
const SKEW_SPAN_DEG = 4;

/** Vertical placement: bands stack within the upper portion of the container. */
const TOP_SPAN_PCT = 60;
const BAND_HEIGHT_PCT = 30;

/** Drift keyframe period range in seconds, before dividing by `speed`. */
const MIN_PERIOD_S = 30;
const PERIOD_SPAN_S = 30; // 30-60s

const KEYFRAMES_CSS = `
@keyframes ${DRIFT_KEYFRAMES_NAME} {
  0% { transform: translate(-15%, 0%) skewY(var(--fluidkit-aurora-skew)); }
  25% { transform: translate(5%, -4%) skewY(var(--fluidkit-aurora-skew)); }
  50% { transform: translate(15%, 2%) skewY(var(--fluidkit-aurora-skew)); }
  75% { transform: translate(-5%, 5%) skewY(var(--fluidkit-aurora-skew)); }
  100% { transform: translate(-15%, 0%) skewY(var(--fluidkit-aurora-skew)); }
}
`;

interface Band {
  color: string;
  topPct: number;
  skewDeg: number;
  opacity: number;
  periodS: number;
  delayS: number;
}

function layoutBands(colors: string[], speed: number, intensity: number): Band[] {
  const count = colors.length;
  return colors.map((color, i) => {
    const angle = i * GOLDEN_ANGLE;
    const frac = (i * GOLDEN_RATIO_FRAC) % 1; // golden-ratio fractional phase, deterministic
    const periodS = (MIN_PERIOD_S + frac * PERIOD_SPAN_S) / speed;
    // Spread bands evenly down the upper TOP_SPAN_PCT, nudged by the
    // golden-ratio fraction so identically-spaced bands don't look mechanical.
    const slot = count > 1 ? (i / (count - 1)) * TOP_SPAN_PCT : TOP_SPAN_PCT / 2;
    return {
      color: resolveColor(color, DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
      topPct: Math.min(slot + (frac - 0.5) * 6, TOP_SPAN_PCT),
      skewDeg: BASE_SKEW_DEG + (Math.cos(angle) * SKEW_SPAN_DEG) / 2,
      opacity: Math.min(1, intensity * (0.7 + frac * 0.3)),
      periodS,
      // Negative delay starts each band mid-cycle instead of all in-phase at
      // 0%, so bands don't visibly synchronize.
      delayS: -(frac * periodS),
    };
  });
}

export function Aurora({
  colors = DEFAULT_COLORS,
  intensity = 0.6,
  speed = 1,
  blend = "screen",
  className,
  style,
  ...rest
}: AuroraProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  useEffect(() => {
    injectStyleOnce(KEYFRAMES_STYLE_ID, KEYFRAMES_CSS);
  }, []);

  const clampedSpeed = Math.max(speed, MIN_SPEED);
  // Without screen compositing adding light, bands rely on opacity alone —
  // boost it slightly so the same intensity keeps a comparable presence.
  const effectiveIntensity =
    blend === "normal" ? intensity * NORMAL_BLEND_OPACITY_BOOST : intensity;
  const bands = useMemo(
    () => layoutBands(colors, clampedSpeed, effectiveIntensity),
    [colors, clampedSpeed, effectiveIntensity]
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
      data-fluidkit="aurora"
      data-animating={animating}
      aria-hidden="true"
      className={className}
      style={wrapperStyle}
      {...rest}
    >
      {bands.map((band, i) => {
        const homeTransform = `translate(-15%, 0%) skewY(${band.skewDeg}deg)`;
        return (
          <div
            key={i}
            data-fluidkit="aurora-band"
            style={
              {
                position: "absolute",
                left: 0,
                top: `${band.topPct}%`,
                width: "130%",
                height: `${BAND_HEIGHT_PCT}%`,
                background: `linear-gradient(90deg, transparent, ${band.color}, transparent)`,
                filter: `blur(${BAND_BLUR_PX}px)`,
                mixBlendMode: blend,
                opacity: band.opacity,
                pointerEvents: "none",
                transformOrigin: "center",
                "--fluidkit-aurora-skew": `${band.skewDeg}deg`,
                transform: homeTransform,
                animationName: prefersReducedMotion ? "none" : DRIFT_KEYFRAMES_NAME,
                animationDuration: `${band.periodS}s`,
                animationDelay: `${band.delayS}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationPlayState: animating ? "running" : "paused",
                animationFillMode: "both",
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
