/**
 * Ambient background: overlapping frosted glass panes — tall rounded
 * rectangles on a shared slight diagonal, sliding past each other in slow
 * motion. Glass-NATIVE: each pane composites the page behind it through its
 * own `backdrop-filter`, and each pane gets a DIFFERENT blur strength, so
 * overlaps read as physical depth (near pane frosts more than far pane).
 * The drift is pure CSS `@keyframes`; zero per-frame JS once mounted.
 *
 * Coverage guarantee: the panes tile the FULL surface — every point of the
 * container is behind at least one pane at all times. Because every pane
 * shares the same rotation, neighboring edges stay parallel, so coverage
 * reduces to 1-D interval math: pane width = slot spacing + an overlap
 * margin sized to absorb the drift amplitude, the per-pane jitter, and the
 * horizontal shift the shared rotation introduces at the container's top
 * and bottom edges; the slot row extends past both container edges for the
 * same reason.
 *
 * The component IS the background layer, not a child overlay: it renders
 * `position:absolute; inset:0; overflow:hidden; pointer-events:none`, so a
 * consumer places it inside a `position:relative` (or similarly positioned)
 * parent alongside their real content, e.g.:
 *
 *   <div style={{ position: "relative" }}>
 *     <GlassPanes />
 *     <YourContent />
 *   </div>
 *
 * Pane placement, depth, and phase are derived deterministically from each
 * pane's index (golden-ratio scheme, same as `MeshGradient` — no
 * `Math.random`/`Date.now`), so two renders with the same props produce
 * byte-identical pane styles.
 *
 * Degradation: without `backdrop-filter` support each pane falls back to a
 * frosted flat fill (the engine's own glass fallback color, tinted) —
 * still layered panes, no longer live blur. `supportsBackdropFilter()` is
 * read per render through the same guarded detector the engine's material
 * resolver uses. Under `prefers-reduced-motion` the slide keyframes are
 * dropped entirely (`animation-name: none`); off-screen the animation is
 * paused rather than torn down, so it resumes in-phase.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import { GOLDEN_RATIO_FRAC, MIN_SPEED } from "../utils/constants";
import { supportsBackdropFilter } from "../utils/featureDetect";
import { injectStyleOnce } from "../utils/injectStyleOnce";

export interface GlassPanesProps extends HTMLAttributes<HTMLDivElement> {
  /** Pane tints, cycled across panes — folded into the glass white so panes stay glass-first. Defaults to untinted glass. */
  colors?: string[];
  /** Pane count, `1`-`8`. Defaults to `3`. The panes always tile the full surface — higher counts mean narrower panes and more depth seams, never gaps. */
  count?: number;
  /** Tint strength, `0`-`1` — how much of each pane's color survives the frost. Defaults to `0.35`. */
  intensity?: number;
  /** Slide speed multiplier — higher divides the keyframe period down (faster). Defaults to `1`. */
  speed?: number;
}

const KEYFRAMES_STYLE_ID = "fluidkit-glass-panes-keyframes";
const SLIDE_KEYFRAMES_NAME = "fluidkit-glass-panes-slide";

const MAX_COUNT = 8;

/** Shared slight diagonal — one direction, one composition. */
const PANE_ANGLE_DEG = 8;

/** Pane blur depth range, px — depth is the point: far panes frost lightly, near panes heavily. */
const MIN_BLUR_PX = 4;
const BLUR_SPAN_PX = 8; // 4-12px

/** How far past each container edge the slot row extends, % of width —
 * absorbs the sideways shift the shared rotation causes at the container's
 * top/bottom (tan(8°) ≈ 0.14 over the pane's oversized height). */
const EDGE_BLEED_PCT = 8;

/** Overlap added on top of the slot spacing, % of width. Must exceed
 * (jitter span) + (drift amplitude ≈ 4% of pane width) with room to spare,
 * so neighboring panes never part even at opposite drift extremes. */
const MIN_OVERLAP_PCT = 12;
const OVERLAP_SPAN_PCT = 8; // 12-20%, varied per pane so seams don't align

/** Per-pane center jitter, % of width — keeps spacing organic. Kept well
 * under MIN_OVERLAP_PCT/2 so it can never open a gap. */
const JITTER_PCT = 2;

/** Slide keyframe period range in seconds, before dividing by `speed`. */
const MIN_PERIOD_S = 26;
const PERIOD_SPAN_S = 22; // 26-48s

/** Mirrors the engine's glass fallback fill (materials.ts) for the no-backdrop-filter case. */
const GLASS_FALLBACK_WHITE = "rgba(255,255,255,0.65)";

/** Rim + lift, shared: hairline light edge, soft shadow for separation. */
const PANE_SHADOW =
  "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 0 0 1px rgba(255,255,255,0.25), 0 16px 40px rgba(46,44,72,0.12)";

/** Slide along the shared diagonal with a gentle counter-drift — panes pass
 * each other rather than moving as one sheet. Rotation rides on a custom
 * property so one keyframes block serves every pane. */
const KEYFRAMES_CSS = `
@keyframes ${SLIDE_KEYFRAMES_NAME} {
  0% { transform: rotate(var(--fluidkit-panes-rot)) translate(0%, 0%); }
  50% { transform: rotate(var(--fluidkit-panes-rot)) translate(var(--fluidkit-panes-drift), -3.5%); }
  100% { transform: rotate(var(--fluidkit-panes-rot)) translate(0%, 0%); }
}
`;

interface Pane {
  color: string | undefined;
  leftPct: number;
  widthPct: number;
  blurPx: number;
  /** Alternating slide direction, as a translate percentage string. */
  driftPct: string;
  periodS: number;
  delayS: number;
}

function layoutPanes(colors: string[] | undefined, count: number, speed: number): Pane[] {
  // Slot centers march across an extended row (-EDGE_BLEED to 100+EDGE_BLEED)
  // so the outermost panes overhang the container on both sides.
  const rowSpan = 100 + 2 * EDGE_BLEED_PCT;
  const spacing = rowSpan / count;
  return Array.from({ length: count }, (_, i) => {
    const frac = (i * GOLDEN_RATIO_FRAC) % 1; // golden-ratio fractional phase, deterministic
    const periodS = (MIN_PERIOD_S + frac * PERIOD_SPAN_S) / speed;
    const slot = -EDGE_BLEED_PCT + (i + 0.5) * spacing;
    return {
      color: colors && colors.length > 0 ? resolveColor(colors[i % colors.length]) : undefined,
      leftPct: slot + (frac - 0.5) * 2 * JITTER_PCT,
      // Spacing plus overlap: adjacent panes always overlap, so the tiling
      // covers every point regardless of count.
      widthPct: spacing + MIN_OVERLAP_PCT + frac * OVERLAP_SPAN_PCT,
      blurPx: Math.round(MIN_BLUR_PX + frac * BLUR_SPAN_PX),
      driftPct: `${i % 2 === 0 ? 13 : -13}%`,
      periodS,
      // Negative delay starts each pane mid-cycle instead of all in-phase
      // at 0%, so panes don't visibly synchronize.
      delayS: -(frac * periodS),
    };
  });
}

/** Pane fill: the pane's color folded into translucent glass white; `mix` scales with intensity. */
function paneTint(color: string | undefined, intensity: number, frosted: boolean): string {
  const white = frosted ? "rgba(255,255,255,0.42)" : GLASS_FALLBACK_WHITE;
  if (!color) return white;
  const mixPct = Math.round(Math.min(1, Math.max(0, intensity)) * 55);
  return `color-mix(in srgb, ${color} ${mixPct}%, ${white})`;
}

export function GlassPanes({
  colors,
  count = 3,
  intensity = 0.35,
  speed = 1,
  className,
  style,
  ...rest
}: GlassPanesProps) {
  const rawPrefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  // Feature detection (reduced-motion + backdrop-filter support) is
  // static-safe during SSR and the first client render — it assumes reduced
  // motion and no backdrop-filter. Without re-checking after mount the panes
  // stay stuck on that flat, non-animated fallback in the browser. Flip a
  // mounted flag in an effect so we re-render once with the real values.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const prefersReducedMotion = mounted ? rawPrefersReducedMotion : true;
  const animating = !prefersReducedMotion && inView;

  useEffect(() => {
    injectStyleOnce(KEYFRAMES_STYLE_ID, KEYFRAMES_CSS);
  }, []);

  const clampedSpeed = Math.max(speed, MIN_SPEED);
  const clampedCount = Math.min(MAX_COUNT, Math.max(1, Math.round(count)));
  // Guarded pure function (never throws, false in SSR) — same detector the
  // engine's resolveMaterial uses, safe to call during render. Gate on
  // `mounted` so SSR/first render stays on the flat fallback and the client
  // upgrades to frosted glass after mount.
  const frosted = mounted && supportsBackdropFilter();
  const panes = useMemo(
    () => layoutPanes(colors, clampedCount, clampedSpeed),
    [colors, clampedCount, clampedSpeed]
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
      data-fluidkit="glass-panes"
      data-animating={animating}
      data-fallback={!frosted}
      aria-hidden="true"
      className={className}
      style={wrapperStyle}
      {...rest}
    >
      {panes.map((pane, i) => {
        const homeTransform = `rotate(${PANE_ANGLE_DEG}deg) translate(0%, 0%)`;
        const backdrop = `blur(${pane.blurPx}px) saturate(1.8)`;
        return (
          <div
            key={i}
            data-fluidkit="glass-panes-pane"
            style={
              {
                position: "absolute",
                left: `${pane.leftPct - pane.widthPct / 2}%`,
                // Oversized vertically so the rotated pane always bleeds
                // past both edges of the container.
                top: "-25%",
                height: "150%",
                width: `${pane.widthPct}%`,
                borderRadius: 28,
                background: paneTint(pane.color, intensity, frosted),
                ...(frosted
                  ? { backdropFilter: backdrop, WebkitBackdropFilter: backdrop }
                  : {}),
                boxShadow: PANE_SHADOW,
                pointerEvents: "none",
                transformOrigin: "center",
                "--fluidkit-panes-rot": `${PANE_ANGLE_DEG}deg`,
                "--fluidkit-panes-drift": pane.driftPct,
                transform: homeTransform,
                animationName: prefersReducedMotion ? "none" : SLIDE_KEYFRAMES_NAME,
                animationDuration: `${pane.periodS}s`,
                animationDelay: `${pane.delayS}s`,
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
