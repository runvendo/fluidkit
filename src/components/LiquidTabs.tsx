/**
 * Tab strip whose active-tab indicator is a liquid engine body.
 *
 * On tab change the indicator doesn't slide — it FLOWS: a drop of mass
 * leaves the old tab's pill (stretching a tension bridge that thins and
 * snaps past `SNAP_STRETCH` — the engine's real hysteresis), flies to the
 * target tab, and merges into the new pill on touch, while the old pill
 * drains and the new one fills and settles on a taut, slightly-overshooting
 * spring. All of it is one `clip-path` scene written imperatively per frame
 * — no filters, no per-frame React commits.
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
  TensionField,
  circlePath,
  resolveMaterial,
  roundRectPath,
} from "../liquid";
import type { LiquidBody, LiquidSceneHandle } from "../liquid";
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
const FILL_SPRING = { stiffness: 380, damping: 30 };
/** Old pill drains a beat behind, so the mass visibly leaves it. */
const DRAIN_SPRING = { stiffness: 300, damping: 27 };
/** The traveling drop of mass — quick, but slow enough to read. */
const FLY_SPRING = { stiffness: 230, damping: 24 };
/** Traveling drop radius, as a fraction of the indicator height. */
const FLY_R = 0.42;
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
}

/**
 * One frame of the bridge-flow: the old pill drains, the new pill fills,
 * and a drop of mass flies between them. Bridges come from the tension
 * field's real hysteresis: the drop starts touching the old pill's facing
 * edge (connected), stretches a neck as it departs until the neck snaps,
 * then reconnects on touch as it lands in the new pill.
 */
function transitionScene(
  t: Transition,
  tension: TensionField,
  drain: number,
  fill: number,
  flyX: number
): string {
  const h = t.height;
  const cy = h / 2;
  const fromCx = t.from.left + t.from.width / 2;
  const toCx = t.to.left + t.to.width / 2;
  const dir = Math.sign(toCx - fromCx) || 1;

  // Pills collapse width-first, height-last: the draining pill shrinks to a
  // droplet before vanishing, and the filling pill sprouts from one.
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

  // Tension bodies: anchors just inside each pill's facing edge + the
  // traveling drop. Anchors render inside their pills, so the only visible
  // extras are the drop and the necks.
  const rF = fromH / 2;
  const rT = toH / 2;
  const fly: LiquidBody = { id: "fly", x: flyX, y: cy, r: h * FLY_R };
  const bodies: LiquidBody[] = [fly];
  if (rF > 0.5) {
    bodies.push({
      id: "from",
      x: fromCx + dir * Math.max(fromW / 2 - rF, 0),
      y: cy,
      r: rF,
    });
  }
  if (rT > 0.5) {
    bodies.push({
      id: "to",
      x: toCx - dir * Math.max(toW / 2 - rT, 0),
      y: cy,
      r: rT,
    });
  }
  path += circlePath(fly, fly.r);
  path += tension.bridges(bodies);
  return path;
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

  // Springs: slot 0 drains 1→0, slot 1 fills 0→1, slot 2 is the traveling
  // drop's x.
  const springs = useMotionSprings(
    3,
    (i) => (i === 0 ? 0 : i === 1 ? 1 : -9999),
    (i) => (i === 0 ? DRAIN_SPRING : i === 1 ? FILL_SPRING : FLY_SPRING)
  );

  const transition = useRef<Transition | null>(null);
  const tension = useRef(new TensionField());
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

    const from: TabRect = { left: fromEl.offsetLeft, width: fromEl.offsetWidth };
    const to: TabRect = { left: toEl.offsetLeft, width: toEl.offsetWidth };
    transition.current = { from, to, height: h };
    tension.current.clear();
    // The drop starts tucked against the old pill's facing edge (touching
    // its tension anchor, so the bridge starts connected) and flies to the
    // new tab's center.
    const fromCx = from.left + from.width / 2;
    const toCx = to.left + to.width / 2;
    const dir = Math.sign(toCx - fromCx) || 1;
    const start = fromCx + dir * Math.max(from.width / 2 - h / 2, 0);
    springs.snapTo([1, 0, start]);
    springs.setTargets([0, 1, toCx]);
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
    const path = transitionScene(
      transition.current,
      tension.current,
      springs.values[0].get(),
      springs.values[1].get(),
      springs.values[2].get()
    );
    renderer.current?.setScene({ path });
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
