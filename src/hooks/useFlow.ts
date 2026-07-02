/**
 * Headless stagger primitive behind `<FlowStagger>` — a list of children
 * rise + un-blur + settle in a staggered sequence, matching the prototype's
 * `@keyframes rise` (`from{opacity:0; translateY(13px); blur(1.5px)}
 * to{opacity:1; none; blur(0)}`). Because every item also carries Motion's
 * `layout`, siblings glide (FLIP, handled by Motion) to their new positions
 * when the list is added to, removed from, or reordered — the consumer never
 * hand-rolls that math.
 *
 * `useFlow` returns two prop bags:
 *  - `containerProps`: spread onto a `motion.[tag]` wrapping the list. Its
 *    `visible` variant carries `transition.staggerChildren`, which Motion
 *    uses to delay each descendant variant-driven child in turn.
 *  - `itemProps`: spread onto each child's `motion.div` wrapper. Drives the
 *    rise/un-blur/settle via `hidden`/`visible` variants and enables
 *    `layout` so reordering glides instead of jumping.
 *
 * Under `prefers-reduced-motion`, item variants collapse to opacity-only (no
 * `y`, no `filter`), the stagger delay drops to 0, and `layout` tweening is
 * disabled — the whole thing reads as a simple, simultaneous fade.
 */

import type { TargetAndTransition, Transition } from "motion/react";
import { usePrefersReducedMotion } from "../utils";

export interface UseFlowOptions {
  /** Seconds between each child's animation start. Defaults to `0.06`. */
  stagger?: number;
  /** Motion transition override for each item's hidden -> visible tween.
   * Defaults to a gentle ease-out matching the prototype's rise keyframes. */
  transition?: Transition;
}

export interface UseFlowContainerProps {
  initial: "hidden";
  animate: "visible";
  variants: { hidden: TargetAndTransition; visible: TargetAndTransition };
}

export interface UseFlowItemProps {
  /** Enables Motion's real layout-box tweening so siblings glide (FLIP) on
   * add/remove/reorder. Disabled under `prefers-reduced-motion`. */
  layout: boolean;
  variants: { hidden: TargetAndTransition; visible: TargetAndTransition };
}

export interface UseFlowResult {
  /** Spread onto the container `motion.[tag]` wrapping the list. */
  containerProps: UseFlowContainerProps;
  /** Spread onto each child's wrapper `motion.div`. */
  itemProps: UseFlowItemProps;
  /** Exposed for consumers who want to branch on it themselves. */
  prefersReducedMotion: boolean;
}

const DEFAULT_STAGGER_S = 0.06;

/** Ease-out matching the prototype's `.6s cubic-bezier(.22,1,.36,1)` rise. */
const DEFAULT_ITEM_TRANSITION: Transition = {
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1],
};

/** Rise distance and blur amount, matching `@keyframes rise` in
 * prototypes/05-integrated-flowlet.html. */
const RISE_Y_PX = 12;
const HIDDEN_BLUR = "blur(2px)";
const VISIBLE_BLUR = "blur(0px)";

/**
 * Headless stagger primitive behind `<FlowStagger>`: returns `containerProps`
 * and `itemProps` prop bags to spread onto Motion elements for the staggered
 * rise/un-blur entrance with FLIP glides. See the file doc for details.
 */
export function useFlow({
  stagger = DEFAULT_STAGGER_S,
  transition,
}: UseFlowOptions): UseFlowResult {
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedTransition = transition ?? DEFAULT_ITEM_TRANSITION;

  const containerProps: UseFlowContainerProps = {
    initial: "hidden",
    animate: "visible",
    variants: {
      hidden: {},
      visible: {
        transition: { staggerChildren: prefersReducedMotion ? 0 : stagger },
      },
    },
  };

  const itemVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: resolvedTransition },
      }
    : {
        hidden: { opacity: 0, y: RISE_Y_PX, filter: HIDDEN_BLUR },
        visible: {
          opacity: 1,
          y: 0,
          filter: VISIBLE_BLUR,
          transition: resolvedTransition,
        },
      };

  const itemProps: UseFlowItemProps = {
    layout: !prefersReducedMotion,
    variants: itemVariants,
  };

  return { containerProps, itemProps, prefersReducedMotion };
}
