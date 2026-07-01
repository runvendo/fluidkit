/**
 * Tab strip whose active-tab indicator glides between tabs and stretches
 * like mercury as it moves.
 *
 * Layering (critical): the tab LABELS must never live inside a goo-filtered
 * element — CSS `filter` rasterizes an element's entire subtree, so any text
 * inside the goo layer gets blurred and erased. LiquidTabs therefore renders
 * two overlaid layers inside an UNFILTERED container:
 *
 *   1. Indicator layer — absolutely positioned, `pointer-events:none`,
 *      carrying the goo filter from `useGoo()`. It contains ONLY the single
 *      moving indicator pill. No text ever lives here.
 *   2. Buttons layer — the `<button role="tab">` elements with their crisp
 *      labels, on top and fully interactive. No filter.
 *
 * Because the two layers are siblings, the indicator can't ride along inside
 * the active button (the classic `layoutId` trick), so instead we MEASURE the
 * active button's box (`offsetLeft`/`offsetWidth`) in a layout effect and
 * animate the single indicator to that position. Motion's springy transition
 * gives a slight overshoot and the goo filter softens/fuses the edges, so the
 * glide reads as liquid mercury.
 *
 * Under `prefers-reduced-motion` the goo filter is dropped (via `useGoo()`)
 * and the transition duration is zeroed, so the pill snaps to the active tab
 * instantly instead of gliding.
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
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

/** Springy transition so the indicator overshoots slightly on arrival,
 * reading as a liquid glide rather than a mechanical slide. */
const LIQUID_TRANSITION = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

/** Reduced-motion transition: zero-duration change repositions the indicator
 * instantly, with no glide/overshoot. */
const INSTANT_TRANSITION = { duration: 0 };

/** Measured box of the active tab, relative to the container. */
interface IndicatorRect {
  left: number;
  width: number;
}

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

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  // Measure the active tab's box relative to the container and store it, so
  // the single indicator can animate to it. Re-runs when the active `value`
  // or the `items` change, and on container resize (a ResizeObserver keeps
  // the pill aligned as the layout reflows). In SSR/jsdom the offset* values
  // are 0, which is fine — the pill just renders at the origin until a real
  // layout pass provides measurements.
  useLayoutEffect(() => {
    function measure() {
      const active = tabRefs.current.get(value);
      if (!active) {
        setRect(null);
        return;
      }
      setRect({ left: active.offsetLeft, width: active.offsetWidth });
    }

    measure();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [value, items]);

  const containerStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-fluidkit="liquid-tabs"
      data-motion={prefersReducedMotion ? "instant" : "liquid"}
      role="tablist"
      {...rest}
    >
      {/*
       * Indicator layer: goo-filtered, non-interactive, behind the buttons.
       * Holds ONLY the moving pill — never any text — so the filter can
       * never touch the labels.
       */}
      <div
        data-fluidkit="liquid-tab-indicator-layer"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          ...gooStyle,
        }}
      >
        {rect && (
          <motion.div
            data-fluidkit="liquid-tab-indicator"
            initial={false}
            animate={{ x: rect.left, width: rect.width }}
            transition={transition}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              borderRadius: 999,
              backgroundColor: resolvedColor,
            }}
          />
        )}
      </div>

      {/*
       * Buttons layer: crisp labels, on top, fully interactive, NO filter.
       * A sibling of the indicator layer (never a descendant), so the text is
       * always outside the goo rasterization region.
       */}
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            data-fluidkit="liquid-tab"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            style={{
              position: "relative",
              zIndex: 1,
              background: "transparent",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
