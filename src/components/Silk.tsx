/**
 * Ambient background: smooth flowing silk — full-height diagonal gradient
 * sheets that drift and breathe like slow-motion fabric. Pure CSS — the
 * undulation is a `@keyframes` transform loop, so there is zero per-frame
 * JS once mounted.
 *
 * Sheets hang across the FULL height on a shared diagonal — the one flow
 * direction keeps the composition coherent (same reasoning as
 * `MeshGradient`'s single light direction). `count` controls how many
 * sheets hang (cycling through `colors`), so density and palette scale
 * independently.
 *
 * Materials: `material="color"` (default) renders each sheet as a blurred
 * gradient of its own color. `material="glass"` renders frosted sheets —
 * a white-mixed tint of each color plus `backdrop-filter` blur/saturation
 * (same recipe as the liquid engine's glass material, via
 * `resolveMaterial`), so sheets frost whatever is painted behind them,
 * including each other. When `backdrop-filter` is unsupported,
 * `resolveMaterial` degrades glass to the plain tinted gradient.
 *
 * The component IS the background layer, not a child overlay: it renders
 * `position:absolute; inset:0; overflow:hidden; pointer-events:none`, so a
 * consumer places it inside a `position:relative` (or similarly positioned)
 * parent alongside their real content, e.g.:
 *
 *   <div style={{ position: "relative" }}>
 *     <Silk />
 *     <YourContent />
 *   </div>
 *
 * Sheet placement and phase are derived deterministically from each sheet's
 * index (golden-ratio scheme, same as `MeshGradient` — no
 * `Math.random`/`Date.now`), so two renders with the same props produce
 * byte-identical sheet styles.
 *
 * Reduced motion / off-screen: under `prefers-reduced-motion` the
 * undulation keyframes are dropped entirely (`animation-name: none`) and
 * sheets sit at their static home position. When scrolled out of view
 * (`useInView`), the keyframes stay attached but `animation-play-state` is
 * paused rather than torn down, so motion resumes in-phase when it scrolls
 * back.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useMemo } from "react";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import { GOLDEN_RATIO_FRAC, MIN_SPEED } from "../utils/constants";
import { injectStyleOnce } from "../utils/injectStyleOnce";
import { resolveMaterial } from "../liquid/materials";

export interface SilkProps extends HTMLAttributes<HTMLDivElement> {
  /** Sheet colors, cycled across sheets. Defaults to a soft lilac/rose/sky set. */
  colors?: string[];
  /** Number of sheets, `1`-`12`. Defaults to `colors.length` — one sheet per color. */
  count?: number;
  /** Sheet look: `"color"` (blurred color gradients) or `"glass"` (frosted, backdrop-blurring white-tinted sheets). Defaults to `"color"`. */
  material?: "color" | "glass";
  /** Sheet opacity scale, `0`-`1`. Defaults to `0.55`. */
  intensity?: number;
  /** Flow speed multiplier — higher divides the keyframe period down (faster). Defaults to `1`. */
  speed?: number;
}

/** Soft lilac/rose/sky — light-mode-first with enough chroma to read as fabric, not fog. */
const DEFAULT_COLORS = ["#cfc0f2", "#f2c0d8", "#b8d4f2"];

const KEYFRAMES_STYLE_ID = "fluidkit-silk-keyframes";
const FLOW_KEYFRAMES_NAME = "fluidkit-silk-flow";

const MAX_COUNT = 12;

/** Sheet softening blur, px (color material only — glass sheets rely on
 * their gradient feather + backdrop blur instead, since stacking a self
 * blur on top of backdrop-filter doubles the cost for no visible gain). */
const SHEET_BLUR_PX = 32;

/** Shared diagonal for every sheet — one flow direction, one composition. */
const SHEET_ANGLE_DEG = 24;

/** Horizontal placement: sheet centers spread across the container width. */
const LEFT_SPAN_PCT = 90;

/** Sheet width as a percentage of the container. */
const MIN_WIDTH_PCT = 34;
const WIDTH_SPAN_PCT = 18; // 34-52%

/** Flow keyframe period range in seconds, before dividing by `speed`. */
const MIN_PERIOD_S = 22;
const PERIOD_SPAN_S = 26; // 22-48s

/** Drift along the shared diagonal with a subtle counter-sway — reads as a
 * hanging sheet breathing, not a stripe sliding. The per-sheet skew rides
 * on a custom property so one keyframes block serves every sheet. */
const KEYFRAMES_CSS = `
@keyframes ${FLOW_KEYFRAMES_NAME} {
  0% { transform: rotate(${SHEET_ANGLE_DEG}deg) skewX(var(--fluidkit-silk-skew)) translate(0%, 0%); }
  33% { transform: rotate(${SHEET_ANGLE_DEG}deg) skewX(var(--fluidkit-silk-skew)) translate(5%, -3%); }
  66% { transform: rotate(${SHEET_ANGLE_DEG}deg) skewX(var(--fluidkit-silk-skew)) translate(-4%, 3%); }
  100% { transform: rotate(${SHEET_ANGLE_DEG}deg) skewX(var(--fluidkit-silk-skew)) translate(0%, 0%); }
}
`;

interface Sheet {
  color: string;
  leftPct: number;
  widthPct: number;
  skewDeg: number;
  opacity: number;
  periodS: number;
  delayS: number;
}

function layoutSheets(
  colors: string[],
  count: number,
  speed: number,
  intensity: number
): Sheet[] {
  return Array.from({ length: count }, (_, i) => {
    const frac = (i * GOLDEN_RATIO_FRAC) % 1; // golden-ratio fractional phase, deterministic
    const periodS = (MIN_PERIOD_S + frac * PERIOD_SPAN_S) / speed;
    const slot = count > 1 ? (i / (count - 1)) * LEFT_SPAN_PCT : LEFT_SPAN_PCT / 2;
    const color = colors[i % colors.length];
    return {
      color: resolveColor(color, DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
      leftPct: slot + (frac - 0.5) * 8,
      widthPct: MIN_WIDTH_PCT + frac * WIDTH_SPAN_PCT,
      // Small per-sheet skew variation — folds, not identical planks.
      skewDeg: -6 + frac * 12,
      opacity: Math.min(1, intensity * (0.75 + frac * 0.25)),
      periodS,
      // Negative delay starts each sheet mid-cycle instead of all in-phase
      // at 0%, so sheets don't visibly synchronize.
      delayS: -(frac * periodS),
    };
  });
}

/** Glass tint: the sheet's own hue folded into translucent white, so the
 * frost keeps a whisper of the palette instead of going gray. */
function glassTint(color: string): string {
  return `color-mix(in srgb, ${color} 30%, rgba(255,255,255,0.72))`;
}

export function Silk({
  colors = DEFAULT_COLORS,
  count,
  material = "color",
  intensity = 0.55,
  speed = 1,
  className,
  style,
  ...rest
}: SilkProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  useEffect(() => {
    injectStyleOnce(KEYFRAMES_STYLE_ID, KEYFRAMES_CSS);
  }, []);

  const clampedSpeed = Math.max(speed, MIN_SPEED);
  const clampedCount = Math.min(
    MAX_COUNT,
    Math.max(1, Math.round(count ?? colors.length))
  );
  const sheets = useMemo(
    () => layoutSheets(colors, clampedCount, clampedSpeed, intensity),
    [colors, clampedCount, clampedSpeed, intensity]
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
      data-fluidkit="silk"
      data-animating={animating}
      data-material={material}
      aria-hidden="true"
      className={className}
      style={wrapperStyle}
      {...rest}
    >
      {sheets.map((sheet, i) => {
        const homeTransform = `rotate(${SHEET_ANGLE_DEG}deg) skewX(${sheet.skewDeg}deg) translate(0%, 0%)`;
        const gradient = (fill: string) =>
          `linear-gradient(90deg, transparent, ${fill}, transparent)`;
        // Glass runs through the engine's material resolver so the frost
        // recipe (and its no-backdrop-filter degradation) stays consistent
        // library-wide; the gradient rides in as the tint.
        const materialStyle: CSSProperties =
          material === "glass"
            ? resolveMaterial("glass", { tint: gradient(glassTint(sheet.color)) }).fillStyle
            : { background: gradient(sheet.color), filter: `blur(${SHEET_BLUR_PX}px)` };
        return (
          <div
            key={i}
            data-fluidkit="silk-sheet"
            style={
              {
                position: "absolute",
                left: `${sheet.leftPct - sheet.widthPct / 2}%`,
                // Oversized vertically so the rotated sheet always bleeds
                // past both edges of the container.
                top: "-40%",
                height: "180%",
                width: `${sheet.widthPct}%`,
                ...materialStyle,
                opacity: sheet.opacity,
                pointerEvents: "none",
                transformOrigin: "center",
                "--fluidkit-silk-skew": `${sheet.skewDeg}deg`,
                transform: homeTransform,
                animationName: prefersReducedMotion ? "none" : FLOW_KEYFRAMES_NAME,
                animationDuration: `${sheet.periodS}s`,
                animationDelay: `${sheet.delayS}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationPlayState: animating ? "running" : "paused",
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
