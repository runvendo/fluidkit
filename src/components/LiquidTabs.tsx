/**
 * Tab strip whose active-tab indicator is a liquid engine body.
 *
 * On tab change the indicator doesn't slide — it FLOWS: the old tab's pill
 * drains while the new tab's pill fills, and while both hold mass a tension
 * bridge (the engine's metaball neck) stretches between their facing edges.
 * As the old pill drains, the bridge's stretch (gap / combined radii) grows
 * past `SNAP_STRETCH` and the neck snaps free; the new pill settles on a
 * taut, slightly-overshooting spring. All of it is one `clip-path` scene
 * written imperatively per frame — no filters, no per-frame React commits.
 *
 * Layering: the indicator lives on its own absolutely-positioned,
 * `pointer-events:none` layer BEHIND the buttons; the `<button role="tab">`
 * labels render crisp on top, never inside a filtered or rasterized subtree.
 *
 * Because the two layers are siblings, the indicator can't ride along inside
 * the active button (the classic `layoutId` trick), so instead we MEASURE the
 * tab buttons' boxes (`offsetLeft`/`offsetWidth`) in a layout effect and
 * drive the engine geometry from those.
 *
 * Under `prefers-reduced-motion` the indicator snaps instantly to the active
 * tab: no springs, no bridge, a single static pill.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  bridgePath,
  circlePath,
  dist,
  neckWaist,
  resolveMaterial,
  roundRectPath,
} from "../liquid";
import type { LiquidSceneHandle } from "../liquid";
import { SNAP_STRETCH } from "../liquid/tension";
import { useMotionSprings } from "../liquid/useMotionSprings";
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

/** New pill fills on a taut spring with a touch of overshoot. */
const FILL_SPRING = { stiffness: 420, damping: 30 };
/** Old pill drains slightly slower, so the bridge visibly carries mass. */
const DRAIN_SPRING = { stiffness: 260, damping: 26 };
/** How long the rAF loop keeps recomputing after a change (springs settle). */
const SETTLE_MS = 1100;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Measured box of a tab, relative to the container. */
interface TabRect {
  left: number;
  width: number;
}

interface Transition {
  from: TabRect;
  to: TabRect;
  height: number;
  /** True until the bridge's stretch passes SNAP_STRETCH — then gone. */
  connected: boolean;
}

/**
 * One frame of the bridge-flow: draining pill + filling pill + (while
 * connected) a metaball neck between their facing edges. Returns the scene
 * path and whether the bridge survived this frame.
 */
function transitionScene(
  t: Transition,
  drain: number,
  fill: number
): { path: string; connected: boolean } {
  const h = t.height;
  const cy = h / 2;
  const fromCx = t.from.left + t.from.width / 2;
  const toCx = t.to.left + t.to.width / 2;
  const dir = Math.sign(toCx - fromCx) || 1;

  // Pills collapse height-first-last: width drains, then the last of the
  // mass shrinks away (and the filling pill sprouts as a droplet).
  const fromH = h * clamp01(drain * 2.5);
  const toH = h * clamp01(fill * 2.5);
  const fromW = Math.max(t.from.width * clamp01(drain), fromH);
  const toW = Math.max(t.to.width * clamp01(fill), toH);

  let path = "";
  if (fromH > 1) {
    path += roundRectPath({ x: fromCx, y: cy }, fromW, fromH, fromH / 2);
  }
  if (toH > 1) {
    path += roundRectPath({ x: toCx, y: cy }, toW, toH, toH / 2);
  }

  // Bridge anchors sit just inside each pill's facing edge.
  const rF = fromH / 2;
  const rT = toH / 2;
  let connected = t.connected;
  if (connected && rF > 0.5 && rT > 0.5) {
    const aF = { x: fromCx + dir * Math.max(fromW / 2 - rF, 0), y: cy };
    const aT = { x: toCx - dir * Math.max(toW / 2 - rT, 0), y: cy };
    const stretch = dist(aF, aT) / (rF + rT);
    if (stretch >= SNAP_STRETCH) {
      connected = false; // snapped — for good, this transition
    } else {
      path +=
        circlePath(aF, rF) +
        circlePath(aT, rT) +
        bridgePath(aF, rF, aT, rT, neckWaist(Math.max(stretch, 1)));
    }
  }
  return { path, connected };
}

/** Resting pill: the active tab's box as a fully-rounded engine body. */
function restingPath(rect: TabRect, height: number): string {
  return roundRectPath(
    { x: rect.left + rect.width / 2, y: height / 2 },
    rect.width,
    height,
    height / 2
  );
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedColor = resolveColor(color);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const renderer = useRef<LiquidSceneHandle>(null);
  const [rect, setRect] = useState<TabRect | null>(null);
  const [height, setHeight] = useState(0);

  // Springs for the two masses: slot 0 drains 1→0, slot 1 fills 0→1.
  const springs = useMotionSprings(
    2,
    (i) => (i === 0 ? 0 : 1),
    (i) => (i === 0 ? DRAIN_SPRING : FILL_SPRING)
  );

  const transition = useRef<Transition | null>(null);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure the active tab's box (and container height) so the resting pill
  // can render declaratively. Re-runs on value/items change and on resize.
  // In SSR/jsdom the offset* values are 0, which is fine — the pill is a
  // degenerate path until a real layout pass provides measurements.
  useLayoutEffect(() => {
    function measure() {
      const active = tabRefs.current.get(value);
      setHeight(containerRef.current?.offsetHeight ?? 0);
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

  // React to `value` flips: start a bridge-flow transition (animated) or do
  // nothing extra (reduced motion — the static pill has already snapped).
  const prevValue = useRef(value);
  useLayoutEffect(() => {
    const prev = prevValue.current;
    prevValue.current = value;
    if (prev === value || prefersReducedMotion) return;

    const fromEl = tabRefs.current.get(prev);
    const toEl = tabRefs.current.get(value);
    const h = containerRef.current?.offsetHeight ?? 0;
    if (!fromEl || !toEl || h <= 0) return;

    transition.current = {
      from: { left: fromEl.offsetLeft, width: fromEl.offsetWidth },
      to: { left: toEl.offsetLeft, width: toEl.offsetWidth },
      height: h,
      connected: true,
    };
    springs.snapTo([1, 0]);
    springs.setTargets([0, 1]);
    setSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const staticPath = rect ? restingPath(rect, height) : "";

  // The settle loop mutates the DOM behind React's back; when it isn't
  // running, resync the declarative resting pill so measurements win.
  useEffect(() => {
    if (!settling) renderer.current?.setScene({ path: staticPath });
  }, [settling, staticPath]);

  useAnimationFrame(() => {
    if (!settling || !transition.current) return;
    const t = transition.current;
    const scene = transitionScene(
      t,
      springs.values[0].get(),
      springs.values[1].get()
    );
    t.connected = scene.connected;
    renderer.current?.setScene({ path: scene.path });
  });

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
       * Indicator layer: non-interactive, behind the buttons. Holds ONLY the
       * liquid body — never any text.
       */}
      <div
        data-fluidkit="liquid-tab-indicator-layer"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        <div
          data-fluidkit="liquid-tab-indicator"
          style={{ position: "absolute", inset: 0 }}
        >
          <LiquidRenderer
            ref={renderer}
            path={staticPath}
            material={resolveMaterial("flat", { color: resolvedColor })}
          />
        </div>
      </div>

      {/*
       * Buttons layer: crisp labels, on top, fully interactive, NO filter.
       * A sibling of the indicator layer (never a descendant), so the text
       * can never be rasterized by the surface's rendering.
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
