/**
 * Tab strip whose active-tab indicator glides between tabs and stretches
 * like mercury as it moves. The indicator is a single `motion.div` sharing
 * a `layoutId` across renders; Motion FLIP-animates it from the previously
 * active tab to the newly active one whenever `value` changes, and the goo
 * filter fuses its edges mid-flight so the glide reads as liquid rather than
 * a sliding rectangle.
 *
 * Under `prefers-reduced-motion` the goo filter is dropped (via `useGoo()`)
 * and the indicator's layout transition duration is zeroed, so it snaps to
 * the newly active tab instantly instead of gliding — a plain, non-animated
 * pill.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { motion } from "motion/react";
import { useGoo } from "../hooks";
import { resolveColor, usePrefersReducedMotion } from "../utils";

export interface LiquidTabsItem {
  id: string;
  label: ReactNode;
}

export interface LiquidTabsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: LiquidTabsItem[];
  /** Id of the currently active item. */
  value: string;
  onChange: (id: string) => void;
  /** Indicator color. Defaults to `currentColor`. */
  color?: string;
}

/** Shared `layoutId` the active indicator carries across renders, so Motion
 * recognizes it as the same element moving rather than separate mounts and
 * FLIP-animates the transition between tabs. */
const INDICATOR_LAYOUT_ID = "fluidkit-liquid-tab";

/** Springy transition so the indicator overshoots slightly on arrival,
 * reading as a liquid glide rather than a mechanical slide. */
const LIQUID_TRANSITION = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

/** Reduced-motion transition: zero-duration layout change repositions the
 * indicator instantly, with no glide/overshoot. */
const INSTANT_TRANSITION = { duration: 0 };

export function LiquidTabs({
  items,
  value,
  onChange,
  color,
  className,
  style,
  ...rest
}: LiquidTabsProps) {
  const { style: gooStyle } = useGoo();
  const prefersReducedMotion = usePrefersReducedMotion();

  const resolvedColor = resolveColor(color);
  const transition = prefersReducedMotion
    ? INSTANT_TRANSITION
    : LIQUID_TRANSITION;

  const containerStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    ...gooStyle,
    ...style,
  };

  return (
    <div
      className={className}
      style={containerStyle}
      data-fluidkit="liquid-tabs"
      data-motion={prefersReducedMotion ? "instant" : "liquid"}
      role="tablist"
      {...rest}
    >
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            data-fluidkit="liquid-tab"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            style={{ position: "relative" }}
          >
            {active && (
              <motion.div
                data-fluidkit="liquid-tab-indicator"
                layoutId={INDICATOR_LAYOUT_ID}
                transition={transition}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 999,
                  backgroundColor: resolvedColor,
                  zIndex: 0,
                }}
              />
            )}
            {/*
             * Per CSS painting order, a `position: absolute; z-index: 0`
             * descendant (the indicator above) paints *above*
             * non-positioned inline content, not below it — so the label
             * needs its own positioned stacking context with a higher
             * z-index to land on top and stay crisp. This span is never
             * inside the goo filter's own element, but it IS a descendant
             * of the filtered container; giving it a higher stack level
             * relative to the indicator is what keeps it visually
             * legible above the mercury pill as it glides underneath.
             */}
            <span style={{ position: "relative", zIndex: 1 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
