/**
 * `<FlowStagger>` — a list of children rise + un-blur + settle in a
 * staggered viscous cascade (evolved from the original flowlet rise
 * timing). Because every item wrapper carries
 * Motion's `layout`, siblings glide (FLIP, handled by Motion — never
 * hand-rolled) to their new positions whenever the list is added to, removed
 * from, or reordered — and the glides ripple outward from the change point:
 * this component diffs the child keys against the previously committed list
 * to find the disturbance index, then hands each item its distance so
 * `useFlow` can delay farther glides slightly.
 *
 * Removals animate out via `AnimatePresence` using the submerge `exit`
 * variant (sink + blur-out + slight shrink); each wrapper keeps the child's
 * own key so React (and Motion's FLIP) can track identity across reorders.
 *
 * Under `prefers-reduced-motion` this collapses to a simple, simultaneous
 * fade — see `useFlow` for the variant-level detail.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Children, useEffect, useRef } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Transition,
} from "motion/react";
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
  /** Base seconds between children on entrance, default 0.02. */
  stagger?: number;
  /** Motion transition override for each item's rise/settle tween. */
  transition?: Transition;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function FlowStagger({
  stagger,
  transition,
  children,
  className,
  style,
  ...rest
}: FlowStaggerProps) {
  const { containerProps, getItemProps, prefersReducedMotion } = useFlow({
    stagger,
    transition,
  });

  // `Children.toArray` already assigns a key to every element (the child's
  // own key when present, otherwise a stable positional one), so keying the
  // wrapper on it preserves identity across add/remove/reorder — the whole
  // point of the FLIP glide.
  const childArray = Children.toArray(children);
  const keys = childArray.map((child, i) =>
    typeof child === "object" && child !== null && "key" in child && child.key != null
      ? String(child.key)
      : String(i)
  );

  // Keys as of the last commit. Updated in an effect (not during render) so
  // StrictMode double-renders diff against the same committed snapshot.
  const prevKeysRef = useRef<string[] | null>(null);
  useEffect(() => {
    prevKeysRef.current = keys;
  });

  const prevKeys = prevKeysRef.current;
  const prevSet = prevKeys ? new Set(prevKeys) : null;

  // Disturbance = first index where the key sequence diverges from the
  // committed one. Sibling glide delays grow with distance from it, so an
  // add/remove/reorder ripples outward instead of moving everything at once.
  let disturbance = -1;
  if (prevKeys) {
    const len = Math.max(prevKeys.length, keys.length);
    for (let i = 0; i < len; i++) {
      if (prevKeys[i] !== keys[i]) {
        disturbance = i;
        break;
      }
    }
  }

  let enterRank = 0;

  return (
    // LayoutGroup ties the container's layout animation to re-renders inside
    // AnimatePresence (exit unmounts), which the container can't otherwise
    // see — without it, any background the container carries snaps at the
    // end of an exit instead of gliding.
    <LayoutGroup>
      <motion.div
        data-fluidkit="flow-stagger"
        data-motion={prefersReducedMotion ? "fade" : "flow"}
        className={className}
        style={style}
        {...containerProps}
        {...rest}
      >
        <AnimatePresence initial={false}>
          {childArray.map((child, i) => {
            // Items absent from the committed list are entering: they cascade
            // among themselves (rank order). Persisting items ripple — their
            // glide waits in proportion to distance from the disturbance.
            const entering = !prevSet || !prevSet.has(keys[i]);
            const itemProps = getItemProps({
              entranceRank: entering ? enterRank++ : 0,
              glideDistance:
                !entering && disturbance >= 0 ? Math.abs(i - disturbance) : 0,
            });

            return (
              <motion.div
                key={keys[i]}
                data-fluidkit="flow-item"
                {...itemProps}
              >
                {child}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}
