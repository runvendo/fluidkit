/**
 * One liquid body that morphs between a closed (pill) and open (panel)
 * shape. Optional satellite droplets park beside the closed pill and are
 * absorbed through real liquid bridges on open. The surface is engine
 * geometry (rounded-rect + drops + tension bridges as one clip path);
 * content faces live on an unclipped overlay and ONLY cross-fade — text
 * never scales. Reduced motion: the surface snaps to the target state.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { LiquidBody, LiquidMaterial, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface MorphSize {
  width: number;
  height: number;
}

export interface MorphSurfaceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Controlled state: false = pill, true = panel. */
  open: boolean;
  closedSize?: MorphSize;
  openSize?: MorphSize;
  /** Corner radius of the open panel (the pill is always fully rounded). */
  radius?: number;
  material?: LiquidMaterial;
  tint?: string;
  color?: string;
  /** Scene light; null disables speculars. */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /** Satellite droplets absorbed into the surface on open. */
  satellites?: boolean;
  /** Content shown on the closed pill. */
  closedContent?: ReactNode;
  /** Content shown on the open panel. */
  openContent?: ReactNode;
}

const DEFAULT_CLOSED: MorphSize = { width: 150, height: 46 };
const DEFAULT_OPEN: MorphSize = { width: 250, height: 200 };
const BODY_SPRING = { stiffness: 240, damping: 24 };
/** Horizontal margin reserved for parked satellites. */
const SAT_MARGIN = 56;
/** How long the loop keeps recomputing after a state flip (springs settle). */
const SETTLE_MS = 1600;

interface Sat {
  side: -1 | 1;
  y: number;
  r: number;
  park: number;
}

export function MorphSurface({
  open,
  closedSize = DEFAULT_CLOSED,
  openSize = DEFAULT_OPEN,
  radius = 24,
  material = "glass",
  tint,
  color,
  light,
  reflection = true,
  satellites = true,
  closedContent,
  openContent,
  className,
  style,
  ...rest
}: MorphSurfaceProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  const width = openSize.width + SAT_MARGIN * 2;
  const height = openSize.height + 40;
  const cx = width / 2;
  const cy = height / 2;

  const sats = useMemo<Sat[]>(
    () => [
      { side: -1, y: -4, r: 13, park: -(closedSize.width / 2 + 34) },
      { side: 1, y: 10, r: 11, park: closedSize.width / 2 + 38 },
    ],
    [closedSize.width]
  );

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const sceneLight =
    !reflection || light === null
      ? null
      : light ?? defaultLight(width, height);

  // [w, h, sat0pos, sat0r, sat1pos, sat1r]
  const springs = useMotionSprings(
    2 + sats.length * 2,
    (i) => targetSpringValues(open, closedSize, openSize, sats)[i],
    BODY_SPRING
  );

  const tension = useRef(new TensionField());
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animating = !prefersReducedMotion && inView;

  // React to `open` flips: spring (animated) or snap (reduced motion).
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current !== open) {
      const targets = targetSpringValues(open, closedSize, openSize, sats);
      if (animating) {
        springs.setTargets(targets, BODY_SPRING);
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
      } else {
        springs.snapTo(targets);
      }
    }
    prevOpen.current = open;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animating]);

  const staticScene = useMemo(
    () =>
      buildMorphScene(
        targetSpringValues(open, closedSize, openSize, sats),
        cx,
        cy,
        radius,
        sats,
        satellites,
        null,
        resolved.specular ? sceneLight : null
      ),
    [
      open,
      closedSize,
      openSize,
      sats,
      cx,
      cy,
      radius,
      satellites,
      resolved.specular,
      sceneLight,
    ]
  );
  const [scene, setScene] = useState(staticScene);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    setScene(
      buildMorphScene(
        springs.values.map((v) => v.get()),
        cx,
        cy,
        radius,
        sats,
        satellites,
        tension.current,
        resolved.specular ? sceneLight : null
      )
    );
  });

  const activeScene = animating && settling ? scene : staticScene;

  // Faces are revealed FROM WITHIN the surface: the content overlay is
  // clipped to the liquid shape, and the entering face waits a beat, then
  // rises a few px into place while it fades in. Translate only — a face
  // never scales.
  const faceStyle = (visible: boolean, size: MorphSize): CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    width: size.width,
    height: size.height,
    display: "grid",
    placeItems: "center",
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translate(-50%, -50%)"
      : "translate(-50%, calc(-50% + 10px))",
    transition: visible
      ? "opacity 0.28s ease 0.12s, transform 0.34s cubic-bezier(.22,1,.36,1) 0.12s"
      : "opacity 0.12s ease, transform 0.12s ease",
    pointerEvents: visible ? undefined : "none",
  });

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width, height, ...style }}
      data-fluidkit="morph-surface"
      data-state={open ? "open" : "closed"}
      data-animating={animating && settling}
      {...rest}
    >
      <LiquidRenderer
        path={activeScene.path}
        material={resolved}
        speculars={activeScene.speculars}
        shadow
        clipContent
      >
        <div
          data-fluidkit="morph-face"
          aria-hidden={open ? "true" : undefined}
          style={faceStyle(!open, closedSize)}
        >
          {closedContent}
        </div>
        <div
          data-fluidkit="morph-face"
          aria-hidden={open ? undefined : "true"}
          style={faceStyle(open, openSize)}
        >
          {openContent}
        </div>
      </LiquidRenderer>
    </div>
  );
}

/** Spring targets: [w, h, sat0pos, sat0r, sat1pos, sat1r]. */
function targetSpringValues(
  open: boolean,
  closedSize: MorphSize,
  openSize: MorphSize,
  sats: Sat[]
): number[] {
  const size = open ? openSize : closedSize;
  const values = [size.width, size.height];
  for (const sat of sats) {
    values.push(open ? sat.side * (openSize.width / 2 - 20) : sat.park);
    values.push(open ? 0 : sat.r);
  }
  return values;
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildMorphScene(
  springValues: number[],
  cx: number,
  cy: number,
  radius: number,
  sats: Sat[],
  satellites: boolean,
  tension: TensionField | null,
  light: Vec | null
): Scene {
  const [w, h, ...satValues] = springValues;
  const rad = Math.min(radius, h / 2);
  let path = roundRectPath({ x: cx, y: cy }, w, h, rad);
  const speculars: SpecularSpot[] = [];

  if (satellites) {
    sats.forEach((sat, i) => {
      const pos = satValues[i * 2];
      const r = Math.max(satValues[i * 2 + 1], 0);
      if (r <= 0.5) return;
      const drop: LiquidBody = {
        id: `sat${sat.side}`,
        x: cx + pos,
        y: cy + sat.y,
        r,
      };
      path += circlePath(drop, drop.r);
      if (tension) {
        const phantom: LiquidBody = {
          id: `edge${sat.side}`,
          x: cx + sat.side * (w / 2 - 16),
          y: cy + sat.y * 0.4,
          r: 15,
        };
        path += tension.bridges([drop, phantom]);
      }
      if (light) speculars.push(specularPlacement(drop, light));
    });
  }

  if (light) {
    // one quiet sheen on the body itself, lit by the same source
    speculars.push(
      specularPlacement({ x: cx, y: cy, r: Math.min(w, h) * 0.48 }, light, 0.28)
    );
  }
  return { path, speculars };
}
