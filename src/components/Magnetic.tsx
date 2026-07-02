/**
 * `<Magnetic>` — a behavior wrapper, no liquid surface. It pulls its child
 * toward the pointer while the pointer is within `radius` px of the
 * element's center, and springs back to rest outside that radius. Think of
 * it as the attraction half of a fridge magnet: contact isn't required, the
 * pull grows as the pointer gets closer.
 *
 * The tracking listener has to live on `window`, not the wrapper itself —
 * a magnet has to feel the pointer approaching before it's ever touched,
 * and a hover/pointermove handler on the element only fires once the
 * pointer is already inside its box. The listener computes the pointer's
 * distance to the element's HOME center: `getBoundingClientRect()` on every
 * move (deliberately not cached across frames — correct under scroll,
 * simple, and cheap enough at pointermove frequency) measures the
 * TRANSLATED box, so the current spring offsets are subtracted back out.
 * Without that correction each retarget would compute from an
 * already-moved center — a feedback loop that weakens the pull and wobbles
 * at the radius edge. The pull is a pure function of pointer vs. home.
 * The two springs (`x`, `y`) ride directly on the wrapper's `motion.div`
 * style; Motion animates them on its own frame loop, so the component
 * itself never re-renders while the pointer moves — React commits happen
 * only when props change, never per pointermove (see the Profiler
 * constraint test).
 *
 * Only attached while `!prefersReducedMotion && inView` (an off-screen or
 * reduced-motion instance costs nothing and pulls nothing). The listeners
 * are created and torn down entirely inside an effect, so nothing touches
 * `window` at import or initial render — SSR-safe. Losing tracking context
 * (pointer leaves the window — `pointerout` with a null `relatedTarget` —
 * window blur, or a mid-gesture `pointercancel`) retargets back to rest,
 * same as being outside `radius`; and when the gate itself flips off
 * (reduced motion turning on, scrolling off-screen) the offsets snap home
 * so the element never freezes displaced.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useMotionSprings, type SpringConfig } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";

// Same gotcha as FlowStagger: Motion's `motion.div` redefines a handful of
// DOM event handlers (drag, animation lifecycle) with gesture-aware
// signatures that conflict with the plain DOM `HTMLAttributes` versions, so
// they're omitted from the consumer-facing props since `...rest` below is
// spread onto a `motion.div`.
type ConflictingDomHandlers =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

export interface MagneticProps
  extends Omit<HTMLAttributes<HTMLDivElement>, ConflictingDomHandlers> {
  /**
   * Fraction (0-1) of the pointer offset to travel toward at the element's
   * center (falls off linearly to 0 at `radius`). Defaults to `0.3`.
   */
  strength?: number;
  /** Attraction radius in px, measured from the element's center. Defaults to `120`. */
  radius?: number;
  /** Spring override for the x/y motion values. */
  spring?: SpringConfig;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_STRENGTH = 0.3;
const DEFAULT_RADIUS = 120;
const DEFAULT_SPRING: SpringConfig = { stiffness: 200, damping: 20 };

export function Magnetic({
  strength = DEFAULT_STRENGTH,
  radius = DEFAULT_RADIUS,
  spring = DEFAULT_SPRING,
  children,
  className,
  style,
  ...rest
}: MagneticProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  // `useInView`'s ref is a callback (no `.current` to read), so a plain ref
  // rides alongside it purely to give the pointermove listener a node to
  // call `getBoundingClientRect()` on.
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      inViewRef(node);
    },
    [inViewRef]
  );

  const offset = useMotionSprings(2, () => 0, spring);

  useEffect(() => {
    if (!animating) return;

    function retarget(x: number, y: number) {
      offset.setTargets([x, y], spring);
    }

    function reset() {
      retarget(0, 0);
    }

    function handlePointerMove(e: PointerEvent) {
      const node = nodeRef.current;
      if (!node) return;

      // The rect measures the TRANSLATED box (the transform moves it), so
      // subtract the current offsets to recover the untranslated home
      // center — the pull must be a pure function of pointer vs. home.
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2 - offset.values[0].get();
      const cy = rect.top + rect.height / 2 - offset.values[1].get();
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist >= radius) {
        reset();
        return;
      }

      // Linear falloff: 1 at the center, 0 at the radius edge.
      const falloff = 1 - dist / radius;
      let tx = dx * strength * falloff;
      let ty = dy * strength * falloff;

      // Hard safety cap: the element never travels more than radius/2,
      // regardless of how `strength` is configured.
      const maxTravel = radius / 2;
      const travel = Math.hypot(tx, ty);
      if (travel > maxTravel && travel > 0) {
        const scale = maxTravel / travel;
        tx *= scale;
        ty *= scale;
      }

      retarget(tx, ty);
    }

    // The pointer leaving the window entirely fires `pointerout` on the
    // last element with a null `relatedTarget`; an in-page element hop
    // always carries the element being entered, so those pass through.
    function handlePointerOut(e: PointerEvent) {
      if (e.relatedTarget === null) reset();
    }

    // Passive hint: the handler never calls preventDefault.
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerout", handlePointerOut);
    window.addEventListener("blur", reset);
    window.addEventListener("pointercancel", reset);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pointercancel", reset);
    };
    // `spring` participates by value (stiffness/damping), not identity, so
    // inline `spring={{ ... }}` literals don't churn the window listeners
    // every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animating, radius, strength, spring.stiffness, spring.damping, offset]);

  // When the gate flips off (reduced motion turning on, scrolling
  // off-screen) the element must never freeze displaced — snap straight
  // home, matching the reduced-motion "instant, no animation" posture.
  useEffect(() => {
    if (!animating) offset.snapTo([0, 0]);
  }, [animating, offset]);

  return (
    <motion.div
      ref={setRefs}
      data-fluidkit="magnetic"
      data-animating={animating}
      className={className}
      style={{ ...style, x: offset.values[0], y: offset.values[1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
