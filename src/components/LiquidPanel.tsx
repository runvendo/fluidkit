/**
 * A large liquid surface for drawers, sidebars and sheets. On open the
 * surface POURS IN from one edge — engine geometry (an anchored rounded
 * rect) grows across the panel's box on a spring, and the spring's
 * natural overshoot supplies the liquid arrival; on close it drains back
 * out the same edge. Content lives on an unclipped layer above the
 * engine subtree and only ever fades/translates into place after the
 * surface arrives — text never scales (the library's core principle).
 *
 * Like LiquidCard the panel takes its size from layout: the consumer
 * sizes the box (fixed sidebar, sheet, dropdown), a ResizeObserver
 * measures it, and the pour geometry is rebuilt to match. Settle-timer
 * engine pattern (per `MorphSurface`): the rAF loop only runs while the
 * spring settles, a static-scene memo covers every other frame, and a
 * resync effect keeps the two in sync.
 *
 * The shared rim ring + inset glow (see `rim.ts`) light the border all
 * the way around once the surface is at rest — they're CSS over a static
 * rounded rect, so they fade in with the content rather than trying to
 * chase the pouring geometry.
 *
 * Reduced motion (or off-screen): the surface snaps between poured and
 * drained; the content cross-fade is the only motion left.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
  useRefraction,
} from "../liquid";
import type {
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useThemedSurface } from "../theme";
import { useInView, usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import { rimGlowStyle, rimStyle } from "./rim";
import type { SurfaceStyleProps } from "./surface";

export type LiquidPanelSide = "top" | "bottom" | "left" | "right";

export interface LiquidPanelProps
  extends SurfaceStyleProps,
    HTMLAttributes<HTMLDivElement> {
  /** Controlled state: true = poured in, false = drained out. */
  open: boolean;
  /** Edge the liquid pours from. Defaults to `"top"`. */
  side?: LiquidPanelSide;
  /** Corner radius in px. Defaults to `20`. */
  radius?: number;
  /** Content padding in px. Defaults to `20`. */
  padding?: number;
}

const POUR_SPRING = { stiffness: 160, damping: 24 };
/** How long the loop keeps recomputing after an open/close flip. */
const SETTLE_MS = 1100;

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

/** Anchored rounded rect covering fraction `f` of the box from `side`. */
function buildPourScene(
  f: number,
  w: number,
  h: number,
  radius: number,
  side: LiquidPanelSide,
  light: Vec | null,
  intensity: number
): Scene {
  // Never let the fill hit exactly zero: an empty path would leave the
  // clip-path invalid and the fill unclipped. The closed-at-rest sliver
  // is hidden by the surface wrapper instead.
  const fill = Math.max(f, 0.002);
  const vertical = side === "top" || side === "bottom";
  const fw = vertical ? w : w * fill;
  const fh = vertical ? h * fill : h;
  let cx = w / 2;
  let cy = h / 2;
  if (side === "top") cy = fh / 2;
  else if (side === "bottom") cy = h - fh / 2;
  else if (side === "left") cx = fw / 2;
  else cx = w - fw / 2;
  const rad = Math.min(radius, fw / 2, fh / 2);
  const path = roundRectPath({ x: cx, y: cy }, fw, fh, rad);
  const speculars: SpecularSpot[] = [];
  if (light && fw > 12 && fh > 12) {
    speculars.push(
      specularPlacement(
        { x: cx, y: cy, r: Math.min(fw, fh) * 0.48 },
        light,
        0.4 * intensity
      )
    );
  }
  return { path, speculars };
}

export function LiquidPanel(props: LiquidPanelProps) {
  const themed = useThemedSurface("LiquidPanel");
  const {
    open,
    side = "top",
    material = themed.material ?? "glass",
    tint,
    opacity,
    color,
    intensity = themed.intensity ?? "whisper",
    radius = themed.radius ?? 20,
    padding = 20,
    light,
    reflection = true,
    refraction = false,
    shadow = true,
    children,
    className,
    style,
    ...rest
  } = props;
  const prefersReducedMotion = usePrefersReducedMotion();
  const elRef = useRef<HTMLDivElement | null>(null);
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const setRef = (node: HTMLDivElement | null) => {
    elRef.current = node;
    inViewRef(node);
  };
  const animating = !prefersReducedMotion && inView;

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) => {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { url: refractionUrl, defs: refractionDefs } = useRefraction(
    refraction && material === "glass",
    size?.w ?? 0,
    size?.h ?? 0
  );
  const resolved = useMemo(
    () =>
      resolveMaterial(material, {
        tint: tint ?? themed.tint,
        color: color ?? themed.color,
        refractionUrl,
        opacity,
      }),
    [material, tint, color, themed, refractionUrl, opacity]
  );
  const volume = resolveIntensity(intensity);

  const sceneLight = useMemo(() => {
    if (!reflection || light === null || !size) return null;
    return light ?? defaultLight(size.w, size.h);
  }, [reflection, light, size]);

  // One spring slot: the pour fraction.
  const springs = useMotionSprings(1, () => (open ? 1 : 0), POUR_SPRING);
  const [settling, setSettling] = useState(false);
  // Mirrors `settling` synchronously (state lands a commit late) so the
  // resync effect can't flash the target scene on the flip commit.
  const settlingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current !== open) {
      if (animating) {
        springs.setTargets([open ? 1 : 0]);
        settlingRef.current = true;
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settlingRef.current = false;
          setSettling(false);
        }, SETTLE_MS);
      } else {
        settlingRef.current = false;
        springs.snapTo([open ? 1 : 0]);
      }
    }
    prevOpen.current = open;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animating]);

  // `animating` flipping off mid-settle would strand `settling` true.
  useEffect(() => {
    if (!animating) {
      settlingRef.current = false;
      setSettling(false);
    }
  }, [animating]);

  const staticScene = useMemo(
    () =>
      size
        ? buildPourScene(
            open ? 1 : 0,
            size.w,
            size.h,
            radius,
            side,
            resolved.specular ? sceneLight : null,
            volume
          )
        : null,
    [size, open, radius, side, resolved.specular, sceneLight, volume]
  );

  const renderer = useRef<LiquidSceneHandle>(null);

  // Resync the declarative scene whenever the settle loop isn't running.
  // Guarded by the ref, not the state: on the flip commit `settling` is
  // still false and the state guard alone would flash the target scene.
  useEffect(() => {
    if (!(animating && settlingRef.current) && staticScene)
      renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling || !size) return;
    renderer.current?.setScene(
      buildPourScene(
        springs.values[0].get(),
        size.w,
        size.h,
        radius,
        side,
        resolved.specular ? sceneLight : null,
        volume
      )
    );
  });

  // Declarative props for LiquidRenderer. Mid-pour (including the flip
  // commit itself, where `settling` hasn't landed yet) they must reflect
  // the CURRENT spring frame — if they jumped to the target scene, React
  // would paint the fully-poured panel for a frame before the loop takes
  // over (and blink the surface out on close).
  const midPour = animating && (settling || prevOpen.current !== open);
  const renderScene =
    midPour && size
      ? buildPourScene(
          springs.values[0].get(),
          size.w,
          size.h,
          radius,
          side,
          resolved.specular ? sceneLight : null,
          volume
        )
      : staticScene;

  // Content and rim wait a beat, then rise/fade in once the surface has
  // (mostly) arrived; on close they duck out fast ahead of the drain.
  // Translate only — content never scales.
  const arrivalStyle = (base: CSSProperties): CSSProperties => ({
    ...base,
    opacity: open ? 1 : 0,
    transform:
      open || prefersReducedMotion ? "translateY(0)" : "translateY(8px)",
    transition: open
      ? "opacity 0.3s ease 0.22s, transform 0.36s cubic-bezier(.22,1,.36,1) 0.22s"
      : "opacity 0.12s ease, transform 0.12s ease",
  });

  return (
    <div
      ref={setRef}
      className={className}
      style={{ position: "relative", padding, ...style }}
      data-fluidkit="liquid-panel"
      data-state={open ? "open" : "closed"}
      data-side={side}
      data-animating={animating && settling}
      {...rest}
    >
      <span
        aria-hidden="true"
        data-fluidkit="liquid-panel-surface"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          pointerEvents: "none",
          // Closed at rest the geometry is a sub-pixel sliver; hide it
          // (and its shadow) entirely. Mid-pour (incl. the flip commit,
          // where `settling` hasn't landed) it must stay visible.
          visibility: !open && !settling && !midPour ? "hidden" : undefined,
        }}
      >
        {refractionDefs}
        {renderScene && (
          <LiquidRenderer
            ref={renderer}
            path={renderScene.path}
            material={resolved}
            speculars={renderScene.speculars}
            specularSlots={resolved.specular && sceneLight ? 1 : 0}
            shadow={shadow}
          />
        )}
        {size && resolved.specular && sceneLight && volume > 0 && (
          <span
            style={arrivalStyle({
              position: "absolute",
              inset: 0,
              display: "block",
            })}
          >
            <span
              data-fluidkit="liquid-panel-glow"
              style={rimGlowStyle(size.w, size.h, radius, volume)}
            />
            <span
              data-fluidkit="liquid-panel-rim"
              style={rimStyle(size.w, size.h, radius, sceneLight, volume)}
            />
          </span>
        )}
      </span>
      <div
        data-fluidkit="liquid-panel-content"
        aria-hidden={open ? undefined : "true"}
        style={arrivalStyle({
          position: "relative",
          pointerEvents: open ? undefined : "none",
        })}
      >
        {children}
      </div>
    </div>
  );
}
