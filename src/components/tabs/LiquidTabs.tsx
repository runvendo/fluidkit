/**
 * The flagship liquid tab strip.
 *
 * The active-tab indicator is a liquid engine body on its own
 * `pointer-events:none` layer BEHIND the buttons; crisp `<button role="tab">`
 * labels render on top, never inside a filtered/rasterized subtree. On tab
 * change the indicator FLOWS between boxes via one of two spring-driven flows
 * (`slide` droplet / `stretch` taffy), written to the engine imperatively per
 * frame. Label color is driven by how much ink covers each tab (see tint.ts),
 * so labels and liquid always move together.
 *
 * Value resolution precedence: an enclosing `<LiquidTabs.Group>` (context) >
 * a controlled `value`/`onChange` > uncontrolled internal state seeded from
 * `defaultValue` (or the first enabled item).
 *
 * Under `prefers-reduced-motion` the indicator snaps and labels switch
 * instantly — no springs, no flow.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
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
  defaultLight,
  resolveMaterial,
  specularPlacement,
} from "../../liquid";
import type { LiquidSceneHandle, SpecularSpot, Vec } from "../../liquid";
import { useMotionSprings } from "../../liquid/useMotionSprings";
import { resolveColor, usePrefersReducedMotion } from "../../utils";
import { resolveIntensity } from "../intensity";
import type { LiquidIntensity } from "../intensity";
import type { SurfaceStyleProps } from "../surface";
import { useThemedSurface } from "../../theme";
import { FLOWS, stretchEdgeConfigs, type FlowName, type TabRect } from "./flows";
import { mixColor, parseColor, tabCoverage, type RGB } from "./tint";
import { useTabList } from "./useTabList";
import { useTabsContext } from "./TabsGroup";

export type LiquidTabsMaterial = "flat" | "glass";
export type LiquidTabsSize = "sm" | "md" | "lg";

export interface LiquidTabsItem {
  id: string;
  /** Text label. Optional for icon-only tabs (then set `ariaLabel`). */
  label?: ReactNode;
  /** Leading icon. */
  icon?: ReactNode;
  /** Accessible name for icon-only tabs. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface LiquidTabsProps
  extends Omit<SurfaceStyleProps, "refraction">,
    Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  items: LiquidTabsItem[];
  /** Controlled active id. */
  value?: string;
  /** Uncontrolled initial active id. */
  defaultValue?: string;
  onChange?: (id: string) => void;
  flow?: FlowName;
  material?: LiquidTabsMaterial;
  size?: LiquidTabsSize;
  /** Flat fill color (ignored by the glass material). Defaults to `currentColor`. */
  color?: string;
  /**
   * Glass tint (ignored by the flat material) — any CSS color, normally a
   * translucent white. Tints both the container and the indicator; also the
   * fallback fill where `backdrop-filter` is unsupported. Defaults to the
   * engine's glass tint.
   */
  tint?: string;
  /**
   * How loudly the indicator's glint reads: 0–1, or the presets
   * `"whisper"` (0.35) / `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidIntensity;
  /** Scene light in tabs coordinates; null disables the glint. */
  light?: Vec | null;
  /**
   * Paint a specular glint on the glass indicator. Defaults to `false` —
   * a documented divergence from the pack's usual `true`, because the
   * shipped indicator pill is unlit.
   */
  reflection?: boolean;
  /**
   * Drop shadow under the indicator pill. Defaults to `false` (the shipped
   * pill sits flush in its tray, unlifted).
   */
  shadow?: boolean;
  /**
   * Inactive label color. Hex or `rgb()` (label colors are mixed
   * numerically per frame); defaults per material.
   */
  labelColor?: string;
  /** Label color while the ink covers the tab. Hex or `rgb()`; defaults per material. */
  activeLabelColor?: string;
}

interface SizeSpec {
  padding: string;
  fontSize: number;
  gap: number;
  containerPad: number;
}

const SIZES: Record<LiquidTabsSize, SizeSpec> = {
  sm: { padding: "7px 12px", fontSize: 12, gap: 3, containerPad: 4 },
  md: { padding: "10px 16px", fontSize: 13.5, gap: 4, containerPad: 5 },
  lg: { padding: "13px 22px", fontSize: 15, gap: 5, containerPad: 6 },
};

/** base (inactive) and active label colors per material. */
const LABEL_COLORS: Record<LiquidTabsMaterial, { base: RGB; active: RGB }> = {
  flat: { base: [75, 76, 86], active: [255, 255, 255] },
  glass: { base: [75, 76, 86], active: [23, 24, 28] },
};

/** How long the rAF loop keeps recomputing after a change (springs settle). */
const SETTLE_MS = 1000;

const firstEnabledId = (items: LiquidTabsItem[]): string => {
  const item = items.find((it) => !it.disabled);
  return item?.id ?? items[0]?.id ?? "";
};

/** True when both maps hold the same ids and identical rects. */
const sameRects = (
  a: Map<string, TabRect>,
  b: Map<string, TabRect>
): boolean => {
  if (a.size !== b.size) return false;
  for (const [id, r] of b) {
    const p = a.get(id);
    if (!p || p.left !== r.left || p.width !== r.width) return false;
  }
  return true;
};

/**
 * One glint per liquid body, derived from the scene's ink x-intervals
 * (body + optional tail on `slide`, one pill on `stretch`). Placement and
 * the shared `0.4 × volume` opacity rule match the rest of the surface
 * family, so the tabs glint agrees with every other surface on where the
 * light is and how loud it reads.
 */
function indicatorSpeculars(
  intervals: readonly [number, number][],
  height: number,
  light: Vec | null,
  volume: number
): SpecularSpot[] {
  if (!light || volume <= 0 || height <= 0) return [];
  return intervals.map(([left, right]) =>
    specularPlacement(
      {
        x: (left + right) / 2,
        y: height / 2,
        r: Math.min(right - left, height) * 0.48,
      },
      light,
      0.4 * volume
    )
  );
}

/** Specular ellipse pool: `slide` lights at most a body + its tail. */
const SPECULAR_SLOTS = 2;

export function LiquidTabs(props: LiquidTabsProps) {
  // Theme overlay: folds in below explicit props (destructure defaults),
  // above the built-in defaults. Empty (all-undefined) with no provider.
  const themed = useThemedSurface("LiquidTabs");
  const {
    items,
    value,
    defaultValue,
    onChange,
    flow = "slide",
    // A theme can only set "glass" | "flat" (ThemeMaterial), never "caustics".
    material = (themed.material as LiquidTabsMaterial | undefined) ?? "flat",
    size = "md",
    color = themed.color,
    tint = themed.tint,
    opacity,
    intensity = themed.intensity ?? "whisper",
    light,
    reflection = false,
    shadow = false,
    labelColor,
    activeLabelColor,
    className,
    style,
    ...rest
  } = props;
  const prefersReducedMotion = usePrefersReducedMotion();
  const ctx = useTabsContext();
  const flowSpec = FLOWS[flow];
  const sizeSpec = SIZES[size];
  const fallbackNamespace = useId();
  const namespace = ctx?.namespace ?? fallbackNamespace;

  // ---- value resolution: group context > controlled prop > uncontrolled ----
  const [internal, setInternal] = useState(
    () => defaultValue ?? firstEnabledId(items)
  );
  const isControlled = value !== undefined;
  const selected = ctx ? ctx.value : isControlled ? value : internal;
  const setSelected = useCallback(
    (id: string) => {
      if (ctx) ctx.setValue(id);
      else if (!isControlled) setInternal(id);
      onChange?.(id);
    },
    [ctx, isControlled, onChange]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const renderer = useRef<LiquidSceneHandle>(null);
  const tension = useRef(new TensionField());

  // Keyboard nav moves selection AND DOM focus (WAI-ARIA automatic
  // activation). The hook is ref-free, so it reports keyboard moves via
  // `onNavigate` and the bar — which owns the button refs — moves focus.
  const tabList = useTabList({
    items,
    value: selected,
    onChange: setSelected,
    onNavigate: (id) => tabRefs.current.get(id)?.focus(),
  });

  const [rects, setRects] = useState<Map<string, TabRect>>(new Map());
  const [height, setHeight] = useState(0);
  const [layerWidth, setLayerWidth] = useState(0);

  const springs = useMotionSprings(
    flowSpec.springCount,
    (i) => flowSpec.rest({ left: 0, width: 0 }, 0)[i] ?? 0,
    (i) => flowSpec.configs[i]
  );

  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSelected = useRef(selected);
  const prevFlow = useRef(flow);

  // Measure tab boxes + container height. Re-runs on items/size/value change
  // and on resize. jsdom reports 0s (degenerate path until real layout).
  // All geometry lives in indicator-layer space (the container minus its
  // padding), so the pill rests exactly on the button box and never touches
  // the container's own rounded edge.
  useLayoutEffect(() => {
    const pad = sizeSpec.containerPad;
    function measure() {
      const h = Math.max((containerRef.current?.offsetHeight ?? 0) - pad * 2, 0);
      const w = Math.max((containerRef.current?.offsetWidth ?? 0) - pad * 2, 0);
      const next = new Map<string, TabRect>();
      for (const item of items) {
        const el = tabRefs.current.get(item.id);
        if (el) next.set(item.id, { left: el.offsetLeft - pad, width: el.offsetWidth });
      }
      // Only touch state when a value actually changed — an identity-only
      // `items` change (inline `items={[...]}` re-renders) must not cascade
      // into a new `rects` reference that would interrupt an in-flight flow.
      setHeight((prevH) => (prevH === h ? prevH : h));
      setLayerWidth((prevW) => (prevW === w ? prevW : w));
      setRects((prevR) => (sameRects(prevR, next) ? prevR : next));
    }
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [items, size, selected]);

  // React to selection changes: retarget springs (or snap under reduced motion).
  useLayoutEffect(() => {
    const prev = prevSelected.current;
    prevSelected.current = selected;

    const toRect = rects.get(selected);
    if (!toRect || height <= 0) return;

    // Reduced motion: always snap, no flow.
    if (prefersReducedMotion) {
      springs.snapTo(flowSpec.rest(toRect, height));
      return;
    }

    // Flow changed: useMotionSprings recreated the spring array (different
    // springCount) at degenerate values. Snap the new springs onto the
    // current resting pill and abandon any in-flight settle — the previous
    // flow's transition is meaningless now.
    const flowChanged = prevFlow.current !== flow;
    prevFlow.current = flow;
    if (flowChanged) {
      springs.snapTo(flowSpec.rest(toRect, height));
      if (settleTimer.current) clearTimeout(settleTimer.current);
      setSettling(false);
      return;
    }

    // Same selection: place the pill on mount / after an idle resize, but
    // NEVER interrupt an in-flight transition — a stray parent re-render or a
    // resize during the settle window must not snap the running flow.
    if (prev === selected) {
      if (!settling) springs.snapTo(flowSpec.rest(toRect, height));
      return;
    }

    const fromRect = rects.get(prev);
    const targets = flowSpec.target(toRect, height);

    if (flow === "stretch" && fromRect) {
      const movingRight =
        toRect.left + toRect.width / 2 > fromRect.left + fromRect.width / 2;
      const [lCfg, rCfg] = stretchEdgeConfigs(movingRight);
      springs.setTarget(0, targets[0], lCfg);
      springs.setTarget(1, targets[1], rCfg);
    } else {
      springs.setTargets(targets);
    }

    tension.current.clear();
    setSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rects, height, prefersReducedMotion, flow, settling]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const restingRect = rects.get(selected) ?? null;
  const restingScene = useMemo(() => {
    // Guard only on a missing rect — a zero `height` still yields one valid
    // (degenerate) pill subpath, which the jsdom/SSR path relies on. Bailing
    // to an empty path here would drop the resting pill before first layout.
    if (!restingRect) return { path: "", inkIntervals: [] as [number, number][] };
    return flowSpec.scene(
      flowSpec.rest(restingRect, height),
      flowSpec.configs.map(() => 0),
      new TensionField(),
      { height, width: layerWidth, restWidth: restingRect.width }
    );
  }, [restingRect, height, layerWidth, flowSpec]);

  const resolvedColor = resolveColor(color);
  const resolvedMaterial = resolveMaterial(material, {
    tint,
    opacity,
    color: resolvedColor,
  });

  // Scene light for the indicator glint — glass only; flat stays unlit per
  // the house material rule. A consumer light arrives in tabs coordinates
  // and is shifted into indicator-layer space (the container minus its
  // padding), where all flow geometry lives.
  const volume = resolveIntensity(intensity);
  const pad = sizeSpec.containerPad;
  const sceneLight = useMemo<Vec | null>(() => {
    if (!reflection || light === null) return null;
    if (light) return { x: light.x - pad, y: light.y - pad };
    return defaultLight(layerWidth, height);
  }, [reflection, light, pad, layerWidth, height]);
  const specLight = resolvedMaterial.specular ? sceneLight : null;

  const restingSpeculars = useMemo(
    () =>
      indicatorSpeculars(restingScene.inkIntervals, height, specLight, volume),
    [restingScene, height, specLight, volume]
  );

  const labelColors = useMemo(() => {
    const defaults = LABEL_COLORS[material];
    return {
      base: parseColor(labelColor) ?? defaults.base,
      active: parseColor(activeLabelColor) ?? defaults.active,
    };
  }, [material, labelColor, activeLabelColor]);

  const paintLabels = useCallback(
    (intervals: [number, number][]) => {
      for (const item of items) {
        const el = tabRefs.current.get(item.id);
        const r = rects.get(item.id);
        if (!el) continue;
        const cov = r ? tabCoverage(r.left, r.width, intervals) : 0;
        el.style.color = mixColor(labelColors.base, labelColors.active, cov);
      }
    },
    [items, rects, labelColors]
  );

  // When idle, sync the declarative resting scene + labels so measurements win.
  useEffect(() => {
    if (settling) return;
    renderer.current?.setScene({
      path: restingScene.path,
      speculars: restingSpeculars,
    });
    paintLabels(restingScene.inkIntervals);
  }, [settling, restingScene, restingSpeculars, paintLabels]);

  // Animation loop: recompute the flow scene from live spring values + tint.
  // Speculars ride the same imperative write, so the glint follows the
  // flowing pill per frame without a React commit.
  useAnimationFrame(() => {
    if (!settling || !restingRect || height <= 0) return;
    const values = springs.values.map((v) => v.get());
    const velocities = springs.values.map((v) => v.getVelocity());
    const scene = flowSpec.scene(values, velocities, tension.current, {
      height,
      width: layerWidth,
      restWidth: restingRect.width,
    });
    renderer.current?.setScene({
      path: scene.path,
      speculars: indicatorSpeculars(
        scene.inkIntervals,
        height,
        specLight,
        volume
      ),
    });
    paintLabels(scene.inkIntervals);
  });

  const containerStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    gap: sizeSpec.gap,
    padding: sizeSpec.containerPad,
    borderRadius: 999,
    // Shipped default chrome (overridable via style / className). Flat gets
    // a frosted solid pill; glass gets the shared glass recipe — kept at the
    // container's softer 10px blur — under a barely-there ring.
    ...(material === "glass"
      ? {
          ...resolveMaterial("glass", { tint, blurPx: 10, opacity }).fillStyle,
          // The container never appears/re-rasterizes; only the indicator
          // fill needs the pinned layer.
          willChange: undefined,
        }
      : {
          background: "rgba(255,255,255,0.62)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }),
    boxShadow:
      material === "glass"
        ? "inset 0 0 0 1px rgba(255,255,255,0.45)"
        : "inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 28px rgba(46,44,72,0.14)",
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-fluidkit="liquid-tabs"
      data-motion={prefersReducedMotion ? "instant" : "liquid"}
      data-size={size}
      data-material={material}
      role="tablist"
      {...rest}
    >
      <div
        data-fluidkit="liquid-tab-indicator-layer"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: sizeSpec.containerPad,
          pointerEvents: "none",
        }}
      >
        <div
          data-fluidkit="liquid-tab-indicator"
          style={{ position: "absolute", inset: 0 }}
        >
          <LiquidRenderer
            ref={renderer}
            path={restingScene.path}
            material={resolvedMaterial}
            speculars={restingSpeculars}
            specularSlots={specLight ? SPECULAR_SLOTS : 0}
            shadow={shadow}
          />
        </div>
      </div>

      {items.map((item, index) => {
        const props = tabList.getTabProps(item, index);
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            data-fluidkit="liquid-tab"
            id={ctx ? `${namespace}-tab-${item.id}` : undefined}
            aria-controls={ctx ? `${namespace}-panel-${item.id}` : undefined}
            aria-label={item.label == null ? item.ariaLabel : undefined}
            {...props}
            style={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: 0,
              background: "transparent",
              font: `500 ${sizeSpec.fontSize}px/1 system-ui, sans-serif`,
              padding: sizeSpec.padding,
              borderRadius: 999,
              // Label color is written per-frame from ink coverage; any CSS
              // transition on it would smear those writes into lag.
              transition: "none",
              cursor: item.disabled ? "default" : "pointer",
              opacity: item.disabled ? 0.4 : 1,
            }}
          >
            {item.icon != null && (
              <span data-fluidkit="liquid-tab-icon" aria-hidden="true" style={{ display: "inline-flex" }}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
