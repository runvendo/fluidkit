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
  useRefraction,
} from "../liquid";
import type {
  LiquidBody,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import type { SpringConfig } from "../liquid/useMotionSprings";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import type { SurfaceStyleProps } from "./surface";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface MorphSize {
  width: number;
  height: number;
}

export interface MorphSurfaceProps
  extends SurfaceStyleProps,
    Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"` (0.35) /
   * `"present"` (0.7). Defaults to `"present"` — a documented divergence
   * from the pack's usual `"whisper"`: 0.7 reproduces the surface's
   * pre-pack specular brightness exactly.
   */
  intensity?: LiquidIntensity;
  /** Controlled state: false = pill, true = panel. */
  open: boolean;
  closedSize?: MorphSize;
  openSize?: MorphSize;
  /** Corner radius of the open panel (the pill is always fully rounded). */
  radius?: number;
  /** Satellite droplets absorbed into the surface on open. */
  satellites?: boolean;
  /**
   * Where the panel grows from. `"center"` inflates in place; `"top"` pins
   * the top edge so the panel pours downward out of the pill.
   */
  anchor?: "center" | "top";
  /**
   * How satellites merge on open. `"shrink"` collapses each drop in place;
   * `"pull"` draws it across at full size until the body swallows it
   * (radius follows travel, so the drop re-emerges on close).
   */
  absorption?: "shrink" | "pull";
  /** Override the body's morph spring. */
  bodySpring?: SpringConfig;
  /** Override the satellites' spring. */
  satelliteSpring?: SpringConfig;
  /** Content shown on the closed pill. */
  closedContent?: ReactNode;
  /** Content shown on the open panel. */
  openContent?: ReactNode;
}

const DEFAULT_CLOSED: MorphSize = { width: 150, height: 46 };
const DEFAULT_OPEN: MorphSize = { width: 250, height: 200 };
const BODY_SPRING = { stiffness: 240, damping: 24 };
/** Satellites are lighter drops — a softer spring than the body's, so they
 * lag the panel slightly and settle with a wobblier, more liquid arrival. */
const SAT_SPRING = { stiffness: 150, damping: 14 };
/** Horizontal margin reserved for parked satellites. */
const SAT_MARGIN = 56;
/** How long the loop keeps recomputing after a state flip (springs settle). */
const SETTLE_MS = 1600;

interface Sat {
  side: -1 | 1;
  y: number;
  r: number;
  park: number;
  /** Absorbed position: just inside the open panel's side edge. */
  target: number;
}

type Absorption = "shrink" | "pull";

interface MorphGeom {
  cx: number;
  cy: number;
  radius: number;
  /** Fixed top edge of the open panel (the pour origin when anchored). */
  openTop: number;
  anchorTop: boolean;
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
  refraction = false,
  // Material volume defaults "present" (0.7), because the two hand-rolled
  // specular sites below were tuned at different pre-pack constants:
  // 0.4 · 0.7 reproduces the body's hardcoded 0.28 exactly (JellyButton's
  // mapping), and 0.7 reproduces the satellites' bare `specularPlacement`
  // default identically (Droplets/Thinking's mapping) — see buildMorphScene.
  intensity = "present",
  shadow = true,
  satellites = true,
  anchor = "center",
  absorption = "shrink",
  bodySpring,
  satelliteSpring,
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
      {
        side: -1,
        y: -4,
        r: 13,
        park: -(closedSize.width / 2 + 34),
        target: -(openSize.width / 2 - 20),
      },
      {
        side: 1,
        y: 10,
        r: 11,
        park: closedSize.width / 2 + 38,
        target: openSize.width / 2 - 20,
      },
    ],
    [closedSize.width, openSize.width]
  );

  const geom = useMemo<MorphGeom>(
    () => ({
      cx,
      cy,
      radius,
      openTop: cy - openSize.height / 2,
      anchorTop: anchor === "top",
    }),
    [cx, cy, radius, openSize.height, anchor]
  );

  const { url: refractionUrl, defs: refractionDefs } = useRefraction(
    refraction && material === "glass",
    width,
    height
  );
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color, refractionUrl }),
    [material, tint, color, refractionUrl]
  );
  const sceneLight =
    !reflection || light === null
      ? null
      : light ?? defaultLight(width, height);
  const volume = resolveIntensity(intensity);

  // Spring configs live in refs so the resolver (captured once by
  // useMotionSprings) always reads the latest prop on each retarget.
  const bodyCfg = useRef(bodySpring ?? BODY_SPRING);
  bodyCfg.current = bodySpring ?? BODY_SPRING;
  const satCfg = useRef(satelliteSpring ?? SAT_SPRING);
  satCfg.current = satelliteSpring ?? SAT_SPRING;

  // [w, h, sat0pos, sat0r, sat1pos, sat1r] — body slots on the taut spring,
  // satellite slots on their own softer one.
  const springs = useMotionSprings(
    2 + sats.length * 2,
    (i) => targetSpringValues(open, closedSize, openSize, sats, absorption)[i],
    (i) => (i < 2 ? bodyCfg.current : satCfg.current)
  );

  const tension = useRef(new TensionField());
  const [settling, setSettling] = useState(false);
  // Mirrors `settling` synchronously so effects in the SAME commit as an
  // `open` flip (before the state lands) don't paint the target scene.
  const settlingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animating = !prefersReducedMotion && inView;

  // React to `open` flips: spring (animated) or snap (reduced motion).
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current !== open) {
      const targets = targetSpringValues(
        open,
        closedSize,
        openSize,
        sats,
        absorption
      );
      if (animating) {
        springs.setTargets(targets);
        settlingRef.current = true;
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settlingRef.current = false;
          setSettling(false);
        }, SETTLE_MS);
      } else {
        settlingRef.current = false;
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
        targetSpringValues(open, closedSize, openSize, sats, absorption),
        geom,
        sats,
        satellites,
        absorption,
        null,
        resolved.specular ? sceneLight : null,
        volume
      ),
    [
      open,
      closedSize,
      openSize,
      sats,
      geom,
      satellites,
      absorption,
      resolved.specular,
      sceneLight,
      volume,
    ]
  );
  const renderer = useRef<LiquidSceneHandle>(null);

  // The settle loop mutates the DOM behind React's back; whenever it isn't
  // running (settled, reduced motion, off-screen) resync the declarative
  // static scene so prop changes always win. Guarded by the ref, not the
  // state: on the flip commit `settling` is still false and the state guard
  // alone would flash the target scene for a frame.
  useEffect(() => {
    if (!(animating && settlingRef.current)) {
      renderer.current?.setScene(staticScene);
    }
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    renderer.current?.setScene(
      buildMorphScene(
        springs.values.map((v) => v.get()),
        geom,
        sats,
        satellites,
        absorption,
        tension.current,
        resolved.specular ? sceneLight : null,
        volume
      )
    );
  });

  // Declarative props for LiquidRenderer. Mid-morph (including the flip
  // commit itself, where `settling` hasn't landed yet) they must reflect the
  // CURRENT spring frame — if they jumped to the target scene, React would
  // paint the final shape for a frame before the loop takes over.
  const midMorph = animating && (settling || prevOpen.current !== open);
  const renderScene = midMorph
    ? buildMorphScene(
        springs.values.map((v) => v.get()),
        geom,
        sats,
        satellites,
        absorption,
        tension.current,
        resolved.specular ? sceneLight : null,
        volume
      )
    : staticScene;

  // Faces are revealed FROM WITHIN the surface: the content overlay is
  // clipped to the liquid shape, and the entering face waits a beat, then
  // rises a few px into place while it fades in. Translate only — a face
  // never scales.
  const faceStyle = (visible: boolean, size: MorphSize): CSSProperties => ({
    position: "absolute",
    left: "50%",
    // Anchored surfaces keep their top edge fixed, so each face centers on
    // where its body state actually sits rather than on the container.
    top: geom.anchorTop ? geom.openTop + size.height / 2 : height / 2,
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
      {refractionDefs}
      <LiquidRenderer
        ref={renderer}
        path={renderScene.path}
        material={resolved}
        speculars={renderScene.speculars}
        specularSlots={
          resolved.specular && sceneLight ? sats.length + 1 : 0
        }
        shadow={shadow}
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
  sats: Sat[],
  absorption: Absorption
): number[] {
  const size = open ? openSize : closedSize;
  const values = [size.width, size.height];
  for (const sat of sats) {
    values.push(open ? sat.target : sat.park);
    // In pull mode radius is derived from travel, not its own spring.
    values.push(absorption === "pull" ? sat.r : open ? 0 : sat.r);
  }
  return values;
}

/** 0 at the parked position, 1 fully absorbed. */
function travelProgress(pos: number, sat: Sat): number {
  return (pos - sat.park) / (sat.target - sat.park);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildMorphScene(
  springValues: number[],
  geom: MorphGeom,
  sats: Sat[],
  satellites: boolean,
  absorption: Absorption,
  tension: TensionField | null,
  light: Vec | null,
  volume: number
): Scene {
  const [w, h, ...satValues] = springValues;
  const { cx } = geom;
  // Anchored: the top edge stays pinned and the body pours downward.
  const by = geom.anchorTop ? geom.openTop + h / 2 : geom.cy;
  const rad = Math.min(geom.radius, h / 2);
  let path = roundRectPath({ x: cx, y: by }, w, h, rad);
  const speculars: SpecularSpot[] = [];

  if (satellites) {
    sats.forEach((sat, i) => {
      const pos = satValues[i * 2];
      // Pull mode: the drop keeps its size while it travels and only gets
      // swallowed over the last stretch, so absorption reads as suction
      // (and the drop re-emerges from the edge on close).
      const r =
        absorption === "pull"
          ? sat.r * (1 - smoothstep(0.55, 1, travelProgress(pos, sat)))
          : Math.max(satValues[i * 2 + 1], 0);
      if (r <= 0.5) return;
      const drop: LiquidBody = {
        id: `sat${sat.side}`,
        x: cx + pos,
        y: by + sat.y,
        r,
      };
      path += circlePath(drop, drop.r);
      if (tension) {
        const phantom: LiquidBody = {
          id: `edge${sat.side}`,
          x: cx + sat.side * (w / 2 - 16),
          y: by + sat.y * 0.4,
          r: 15,
        };
        path += tension.bridges([drop, phantom]);
      }
      // Satellites' pre-pack opacity was `specularPlacement`'s own bare
      // default (0.7) — nobody ever overrode it — so `volume` maps straight
      // through, identity, like Droplets/Thinking (not the 0.4x below).
      if (light) speculars.push(specularPlacement(drop, light, volume));
    });
  }

  if (light) {
    // One quiet sheen on the body itself, lit by the same source. Pre-pack
    // this was a hardcoded 0.28; `0.4 · volume` reproduces it exactly at
    // the shared default "present" (0.7), like JellyButton's glint.
    speculars.push(
      specularPlacement(
        { x: cx, y: by, r: Math.min(w, h) * 0.48 },
        light,
        0.4 * volume
      )
    );
  }
  return { path, speculars };
}
