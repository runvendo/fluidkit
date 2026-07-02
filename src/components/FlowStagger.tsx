/**
 * `<FlowStagger>` — a list of children rise + un-blur + settle in a
 * staggered sequence, matching the prototype's message-list entrance
 * (`@keyframes rise` in prototypes/05-integrated-flowlet.html). Because
 * every item wrapper carries Motion's `layout`, siblings glide (FLIP,
 * handled by Motion — never hand-rolled) to their new positions whenever the
 * list is added to, removed from, or reordered.
 *
 * Removals animate out via `AnimatePresence`; each wrapper keeps the child's
 * own key so React (and Motion's FLIP) can track identity across reorders.
 *
 * Under `prefers-reduced-motion` this collapses to a simple, simultaneous
 * fade — see `useFlow` for the variant-level detail.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Children } from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { useFlow } from "../hooks";

// Motion's `motion.div` redefines a handful of DOM event handlers (drag,
// animation, transition lifecycle) with its own gesture-aware signatures, so
// they conflict with the plain DOM `HTMLAttributes` versions of the same
// names. Omit them from the consumer-facing props the same way Motion's own
// `HTMLMotionProps` does, since `...rest` below is spread onto a
// `motion.div`.
type ConflictingDomHandlers =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

export interface FlowStaggerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, ConflictingDomHandlers> {
  /** Seconds between children, default 0.06. */
  stagger?: number;
  /** Motion transition override for each item's rise/settle tween. */
  transition?: Transition;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Staggered rise + un-blur + settle entrance for a list of children, with
 * Motion FLIP glides on add/remove/reorder. Reduced motion collapses to a
 * simultaneous fade. See the file doc for details.
 */
export function FlowStagger({
  stagger,
  transition,
  children,
  className,
  style,
  ...rest
}: FlowStaggerProps) {
  const { containerProps, itemProps, prefersReducedMotion } = useFlow({
    stagger,
    transition,
  });

  return (
    <motion.div
      data-fluidkit="flow-stagger"
      data-motion={prefersReducedMotion ? "fade" : "flow"}
      className={className}
      style={style}
      {...containerProps}
      {...rest}
    >
      <AnimatePresence initial={false}>
        {Children.toArray(children).map((child) => {
          // `Children.toArray` already assigns a key to every element (the
          // child's own key when present, otherwise a stable positional
          // one), so keying the wrapper on `child.key` preserves identity
          // across add/remove/reorder — the whole point of the FLIP glide.
          const key =
            typeof child === "object" && child !== null && "key" in child
              ? (child.key as string | null)
              : null;

          return (
            <motion.div
              key={key ?? undefined}
              data-fluidkit="flow-item"
              exit={{ opacity: 0 }}
              {...itemProps}
            >
              {child}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
