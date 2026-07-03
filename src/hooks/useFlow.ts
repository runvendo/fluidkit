/**
 * Headless stagger primitive behind `<FlowStagger>` — a list of children
 * rise + un-blur + settle in a staggered sequence, evolved from the
 * prototype's `@keyframes rise` (`from{opacity:0; translateY(13px);
 * blur(1.5px)} to{opacity:1; none; blur(0)}`) with liquid timing:
 *
 *  - Viscous cascade: the entrance stagger is non-linear — each successive
 *    gap grows slightly, like a wave losing energy in a viscous medium.
 *  - Droplet settle: `y` arrives on a soft spring with a whisper of
 *    overshoot instead of a pure ease-out, so items land rather than stop.
 *  - Ripple glide: sibling FLIP glides accept a per-item distance from the
 *    disturbance (the index where the list changed), so reorders propagate
 *    outward instead of every sibling moving at once.
 *  - Submerge exit: an `exit` variant mirrors the entrance — sink + blur-out
 *    + slight scale-down — instead of a bare opacity fade.
 *
 * `useFlow` returns `containerProps` (spread onto a `motion.[tag]` wrapping
 * the list) and `getItemProps(options)` (called per child with its entrance
 * rank and glide distance, spread onto each child's `motion.div` wrapper).
 * Every item carries Motion's `layout`, so siblings glide (FLIP, handled by
 * Motion) on add/remove/reorder — the consumer never hand-rolls that math.
 *
 * Under `prefers-reduced-motion`, item variants collapse to opacity-only (no
 * `y`, no `filter`, no `scale`), every delay drops to 0, and `layout`
 * tweening is disabled — the whole thing reads as a simple, simultaneous
 * fade.
 */

import type { TargetAndTransition, Transition } from "motion/react";
import { usePrefersReducedMotion } from "../utils";

export interface UseFlowOptions {
  /** Base seconds between each entering child's animation start. Defaults
   * to `0.02`. Successive gaps grow slightly (viscous cascade). */
  stagger?: number;
  /** Motion transition override for each item's hidden -> visible tween.
   * Defaults to a soft spring on `y` (droplet settle) with an ease-out
   * fade/un-blur. */
  transition?: Transition;
}

/** Per-item inputs — computed by the consumer from how the list changed. */
export interface UseFlowItemOptions {
  /** Rank among the items entering in the same commit (0 = first). Drives
   * the viscous entrance cascade; items entering alone pass 0. */
  entranceRank?: number;
  /** Whole-number distance (in list positions) from the index where the
   * list changed. Drives the ripple: farther siblings start their FLIP
   * glide slightly later. Pass 0 for "no disturbance". */
  glideDistance?: number;
}

export interface UseFlowContainerProps {
  initial: "hidden";
  animate: "visible";
  variants: { hidden: TargetAndTransition; visible: TargetAndTransition };
  /** The container animates its own bounds on the glide spring, so any
   * background/border it carries grows and shrinks with the list instead of
   * snapping. Disabled under `prefers-reduced-motion`. */
  layout: boolean;
  transition: Transition;
}

export interface UseFlowItemProps {
  /** Enables Motion's real layout-box tweening so siblings glide (FLIP) on
   * add/remove/reorder. Disabled under `prefers-reduced-motion`. */
  layout: boolean;
  variants: {
    hidden: TargetAndTransition;
    visible: TargetAndTransition;
    exit: TargetAndTransition;
  };
  /** Variant label consumed by `AnimatePresence` on removal. */
  exit: "exit";
  /** Carries the layout-glide spring (+ ripple delay); variant-level
   * transitions override it for the entrance/exit animations. */
  transition: Transition;
}

export interface UseFlowResult {
  /** Spread onto the container `motion.[tag]` wrapping the list. */
  containerProps: UseFlowContainerProps;
  /** Call per child with its entrance rank / glide distance; spread the
   * result onto that child's wrapper `motion.div`. */
  getItemProps: (options?: UseFlowItemOptions) => UseFlowItemProps;
  /** Exposed for consumers who want to branch on it themselves. */
  prefersReducedMotion: boolean;
}

const DEFAULT_STAGGER_S = 0.02;

/** Viscous cascade: each successive entrance gap grows by this fraction of
 * the base stagger, capped so long lists don't drag forever. */
const VISCOSITY = 0.05;
const VISCOSITY_MAX_GAP = 1.3;

/** Ripple: seconds of glide delay per list-position of distance from the
 * disturbance, capped so far items don't lag noticeably. */
const RIPPLE_STEP_S = 0.024;
const RIPPLE_MAX_S = 0.15;

/** Rise distance and blur amount, matching `@keyframes rise` in
 * prototypes/05-integrated-flowlet.html. */
const RISE_Y_PX = 12;
const HIDDEN_BLUR = "blur(1.5px)";
const VISIBLE_BLUR = "blur(0px)";

/** Submerge exit: sink a little past resting, blur back out, shrink a hair. */
const SINK_Y_PX = 8;
const EXIT_SCALE = 0.97;

/** Droplet settle: `y` lands on a soft spring with a whisper of overshoot. */
const RISE_SPRING: Transition = {
  type: "spring",
  stiffness: 560,
  damping: 28,
  mass: 0.7,
};

/** Fade/un-blur tween matching the prototype's ease-out feel. */
const FADE_TWEEN: Transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

/** Ease-out matching the prototype's `.6s cubic-bezier(.22,1,.36,1)` rise —
 * kept as the reduced-motion fade timing. */
const REDUCED_FADE: Transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] };

/** Submerge accelerates downward — gravity, not a polite ease-out. The
 * row's SPACE, though, closes on an ease-out: the surface settles gently
 * instead of stopping dead at full speed. */
const EXIT_TRANSITION: Transition = {
  duration: 0.3,
  ease: [0.55, 0, 1, 0.45],
  height: { duration: 0.35, ease: [0.32, 0.72, 0, 1] },
};

/** Sibling FLIP glide — soft spring so displacement reads as liquid. */
const GLIDE_SPRING: Transition = { type: "spring", stiffness: 420, damping: 34 };

function viscousDelay(rank: number, stagger: number): number {
  let delay = 0;
  for (let k = 0; k < rank; k++) {
    delay += stagger * Math.min(1 + k * VISCOSITY, VISCOSITY_MAX_GAP);
  }
  return delay;
}

export function useFlow({
  stagger = DEFAULT_STAGGER_S,
  transition,
}: UseFlowOptions): UseFlowResult {
  const prefersReducedMotion = usePrefersReducedMotion();

  const containerProps: UseFlowContainerProps = {
    initial: "hidden",
    animate: "visible",
    // Empty targets: the container itself doesn't move, but its variant
    // labels propagate so each item's own (per-rank-delayed) variants fire.
    variants: { hidden: {}, visible: {} },
    layout: !prefersReducedMotion,
    transition: prefersReducedMotion ? {} : { layout: GLIDE_SPRING },
  };

  const getItemProps = ({
    entranceRank = 0,
    glideDistance = 0,
  }: UseFlowItemOptions = {}): UseFlowItemProps => {
    if (prefersReducedMotion) {
      return {
        layout: false,
        exit: "exit",
        variants: {
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: transition ?? REDUCED_FADE },
          exit: { opacity: 0, transition: { duration: 0.2 } },
        },
        transition: {},
      };
    }

    const delay = viscousDelay(entranceRank, stagger);
    const visibleTransition: Transition = transition
      ? { ...transition, delay }
      : {
          opacity: { ...FADE_TWEEN, delay },
          filter: { ...FADE_TWEEN, delay },
          y: { ...RISE_SPRING, delay },
        };

    return {
      layout: true,
      exit: "exit",
      variants: {
        hidden: { opacity: 0, y: RISE_Y_PX, filter: HIDDEN_BLUR },
        visible: {
          opacity: 1,
          y: 0,
          filter: VISIBLE_BLUR,
          transition: visibleTransition,
        },
        exit: {
          opacity: 0,
          y: SINK_Y_PX,
          scale: EXIT_SCALE,
          filter: HIDDEN_BLUR,
          // The row's space closes over it as it sinks — the mirror of the
          // entrance, where the container grows as the row rises in.
          // `overflow` is non-animatable, so Motion sets it instantly.
          height: 0,
          overflow: "hidden",
          transition: EXIT_TRANSITION,
        },
      },
      transition: {
        layout: {
          ...GLIDE_SPRING,
          delay: Math.min(glideDistance * RIPPLE_STEP_S, RIPPLE_MAX_S),
        },
      },
    };
  };

  return { containerProps, getItemProps, prefersReducedMotion };
}
