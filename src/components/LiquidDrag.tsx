/**
 * `<LiquidDrag>` — a behavior wrapper around Motion's OWN drag gesture
 * (`drag`, `dragConstraints`, `dragSnapToOrigin`) — dragging itself is never
 * reimplemented. The liquid feel comes entirely from a stretch pipeline
 * layered on top: `useVelocity` on the drag `x`/`y` motion values feeds
 * `useTransform`, which maps velocity into a volume-preserving scale
 * (`scaleX · scaleY` stays ~1, the same trick as `useSquish`/`JellyButton`):
 * total stretch grows with overall speed, clamped to at most
 * `1 + elasticity · 0.25`, and is split CONTINUOUSLY between the axes by
 * each axis's squared-velocity share — a fast horizontal drag stretches X
 * and compresses Y, an exactly-45° drag is shear-free (both scales 1), and
 * rolling the drag angle between them glides smoothly with no step at the
 * diagonal (see `velocityToStretch` for why a binary dominant-axis pick is
 * not acceptable here). A `useSpring` smooths the raw target, so a hard
 * release doesn't snap the shape — it wobbles back to 1 with the spring's
 * natural overshoot. Every step of this pipeline is Motion values driving
 * Motion's own render loop; the component never calls `setState` per drag
 * frame (see the Profiler constraint test).
 *
 * `elasticity` closes over the CURRENT render's value inside the
 * `useTransform` callbacks — Motion's `useCombineMotionValues` internals
 * re-subscribe on every render, so a changed `elasticity` prop is live on
 * the very next velocity sample, never a stale capture from mount.
 *
 * Reduced motion and `elasticity={0}` both BYPASS the stretch pipeline
 * outright: `scaleX`/`scaleY` are fed the literal number `1` in `style`,
 * not a spring merely re-targeted to `1`. A retargeted spring still takes a
 * moment to arrive and can be mid-flight exactly when a gate flips (reduced
 * motion turning on mid-drag, or `elasticity` dropping to `0` at runtime) —
 * a literal `1` snaps instantly, so the wrapper is never left stretched.
 * Dragging itself is NOT gated by reduced motion (Motion's own drag stays
 * fully functional either way) — only the deformation is.
 *
 * Content deforms along with the wrapper BY DESIGN — this wraps arbitrary
 * children in a `motion.div` and stretches that element directly, the same
 * trade-off `useSquish` documents. Consumers who need text or other
 * scale-sensitive content to stay crisp should wrap a non-text visual
 * (an icon, a swatch, a card face) rather than a label.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type HTMLMotionProps,
} from "motion/react";
import type { SpringConfig } from "../liquid/useMotionSprings";
import { usePrefersReducedMotion } from "../utils";

// Same gotcha as FlowStagger/Magnetic: Motion's `motion.div` redefines a
// handful of DOM event handlers with gesture-aware signatures that conflict
// with the plain DOM `HTMLAttributes` versions. `onDragStart`/`onDragEnd`
// are omitted here too, even though LiquidDrag redeclares them below —
// dragging is the whole point, so they come back typed with Motion's
// `PanInfo` signature, not the DOM's `DragEvent` one.
type ConflictingDomHandlers =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

export interface LiquidDragProps
  extends Omit<HTMLAttributes<HTMLDivElement>, ConflictingDomHandlers> {
  /**
   * Fraction (0-1) of how strongly drag velocity stretches the shape.
   * Defaults to `0.4`. `0` disables the deformation pipeline entirely — the
   * element still drags, it just never stretches.
   */
  elasticity?: number;
  /** Restricts dragging to one axis; passed straight through to Motion's `drag` prop. Defaults to both axes. */
  axis?: "x" | "y";
  /** Passthrough to Motion's `dragConstraints`. */
  dragConstraints?: HTMLMotionProps<"div">["dragConstraints"];
  /** Passthrough to Motion's `dragSnapToOrigin`. Defaults to `false`. */
  dragSnapToOrigin?: boolean;
  /** Passthrough to Motion's `onDragStart` (its `PanInfo` signature, not the DOM's). */
  onDragStart?: HTMLMotionProps<"div">["onDragStart"];
  /** Passthrough to Motion's `onDragEnd` (its `PanInfo` signature, not the DOM's). */
  onDragEnd?: HTMLMotionProps<"div">["onDragEnd"];
  /** Spring override smoothing the velocity-driven scale toward its target. */
  spring?: SpringConfig;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_ELASTICITY = 0.4;
// Underdamped on purpose: release should visibly wobble back to 1, not just
// arrive there. Override via `spring` for a stiffer/calmer feel.
const DEFAULT_SPRING: SpringConfig = { stiffness: 300, damping: 12 };
// Drag velocity (px/s) at which the dominant axis reaches its clamped max
// stretch. Below this, stretch scales proportionally with speed.
const FULL_STRETCH_VELOCITY = 1500;

/**
 * Pure velocity → scale mapping. Total stretch grows with OVERALL speed
 * (clamped to `1 + elasticity · 0.25`), then splits continuously between
 * the axes by each axis's squared-velocity share (`wx = vx²/(vx²+vy²)`),
 * lerped in log space:
 *
 *   scaleX = stretch^(wx − wy),  scaleY = stretch^(wy − wx) = 1/scaleX
 *
 * so the "volume" (`scaleX · scaleY`) is exactly 1 at every angle. A pure
 * single-axis drag (`wy = 0`) degenerates to the classic stretch/compress
 * pair; an exactly-45° drag (`wx = wy`) yields the shear-free identity; and
 * rolling the drag angle between them is CONTINUOUS. A binary
 * dominant-axis pick is not acceptable here: it steps `scaleX` between
 * `stretch` and `1/stretch` (~19% cliff at full velocity) the instant
 * dominance flips, and a slow flip lands squarely in the underdamped
 * smoothing spring's passband as visible axis-swap wobble.
 *
 * `elasticity <= 0` (or both velocities at rest) short-circuits to the
 * identity scale.
 *
 * @internal Exported for unit tests only — not part of the public API
 * surface (`src/components/index.ts` re-exports only the component).
 */
export function velocityToStretch(
  vx: number,
  vy: number,
  elasticity: number
): { scaleX: number; scaleY: number } {
  if (elasticity <= 0) return { scaleX: 1, scaleY: 1 };

  const speedSq = vx * vx + vy * vy;
  if (speedSq === 0) return { scaleX: 1, scaleY: 1 };

  const maxStretch = 1 + elasticity * 0.25;
  const t = Math.min(Math.sqrt(speedSq) / FULL_STRETCH_VELOCITY, 1);
  const stretch = 1 + t * (maxStretch - 1);

  // wx − wy = 2·wx − 1 ∈ [−1, 1]: +1 pins the full stretch on X, −1 on Y,
  // 0 (the diagonal) is the identity.
  const wx = (vx * vx) / speedSq;
  const scaleX = Math.exp(Math.log(stretch) * (2 * wx - 1));

  return { scaleX, scaleY: 1 / scaleX };
}

/**
 * Motion's own drag gesture plus a velocity-driven, volume-preserving
 * stretch that wobbles back to rest on release. `elasticity={0}` and
 * reduced motion pin the scales at exactly 1 while dragging stays
 * functional. See the file doc for details.
 */
export function LiquidDrag({
  elasticity = DEFAULT_ELASTICITY,
  axis,
  dragConstraints,
  dragSnapToOrigin = false,
  onDragStart,
  onDragEnd,
  spring = DEFAULT_SPRING,
  children,
  className,
  style,
  ...rest
}: LiquidDragProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Whether the stretch pipeline drives the visible scale at all — false
  // means `scaleX`/`scaleY` are pinned to the literal `1`, not merely
  // targeted there, so a gate flip can never leave the shape mid-stretch.
  const deforming = !prefersReducedMotion && elasticity > 0;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const vx = useVelocity(x);
  const vy = useVelocity(y);

  const scaleXRaw = useTransform([vx, vy], ([vxv, vyv]: number[]) =>
    velocityToStretch(vxv, vyv, elasticity).scaleX
  );
  const scaleYRaw = useTransform([vx, vy], ([vxv, vyv]: number[]) =>
    velocityToStretch(vxv, vyv, elasticity).scaleY
  );
  const smoothScaleX = useSpring(scaleXRaw, spring);
  const smoothScaleY = useSpring(scaleYRaw, spring);

  return (
    <motion.div
      data-fluidkit="liquid-drag"
      data-animating={deforming}
      className={className}
      drag={axis ?? true}
      dragConstraints={dragConstraints}
      dragSnapToOrigin={dragSnapToOrigin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        ...style,
        x,
        y,
        scaleX: deforming ? smoothScaleX : 1,
        scaleY: deforming ? smoothScaleY : 1,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
