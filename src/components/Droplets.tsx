/**
 * A cluster of liquid drops with surface tension: they drift together,
 * merge through real necks (touch-connect / snap-on-stretch), and split
 * again. Optionally an extra drop chases the pointer and merges with the
 * cluster (`followPointer`), and drops can be grabbed, dragged out until
 * the neck tears, and released to spring home (`interactive`). Rendered by
 * the liquid engine; the material (glass / flat) is a prop, not a
 * different component.
 *
 * Reduced motion / off-screen: renders the drops as separate static dots
 * (no bridges, no animation loop).
 */

import type { CSSProperties, HTMLAttributes, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  dist,
  resolveMaterial,
  specularPlacement,
  useRefraction,
} from "../liquid";
import { CONNECT_STRETCH, SNAP_STRETCH } from "../liquid/tension";
import type {
  LiquidBody,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import type { SurfaceStyleProps } from "./surface";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface DropletsProps
  extends SurfaceStyleProps,
    HTMLAttributes<HTMLDivElement> {
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"` (0.35) /
   * `"present"` (0.7). Defaults to `"present"` — a documented divergence
   * from the pack's usual `"whisper"`: 0.7 reproduces the drops' pre-pack
   * specular brightness exactly.
   */
  intensity?: LiquidIntensity;
  /** Number of drops in the cluster. */
  count?: number;
  /** Base drop diameter in px. */
  size?: number;
  /** Px extent the cluster spreads across. */
  spread?: number;
  /**
   * Extra canvas padding in px on every side of the cluster — room to drag
   * drops and chase the pointer beyond the cluster's own footprint.
   */
  bleed?: number;
  /** Merge/split cycle speed multiplier. */
  speed?: number;
  /** An extra drop chases the pointer and merges with the cluster. */
  followPointer?: boolean;
  /**
   * Drops can be grabbed with the pointer and dragged out: the neck
   * stretches, tears off past the snap distance, and the drop springs back
   * and re-merges on release. Inert under reduced motion.
   */
  interactive?: boolean;
  /** The pointer picked up a drop. */
  onGrab?: (index: number) => void;
  /** The dragged drop's last bridge snapped (it tore off the cluster). */
  onTear?: (index: number) => void;
  /** The pointer let go — the drop springs home and re-merges. */
  onRelease?: (index: number) => void;
  /** Deterministic per-instance layout offset. */
  seed?: number;
}

const DEFAULT_COUNT = 3;
const DEFAULT_SIZE = 36;
const DEFAULT_SPREAD = 100;
const CYCLE_MS = 1500;
const SQUEEZE = 0.36;
const DROP_SPRING = { stiffness: 170, damping: 15 };
/** Parting is reluctant — slow enough that the neck visibly thins first. */
const PART_SPRING = { stiffness: 55, damping: 17 };
const POINTER_SPRING = { stiffness: 120, damping: 13 };
/** Tight lag while a drop is held — liquid, but clearly in hand. */
const GRAB_SPRING = { stiffness: 550, damping: 38 };
/** Hit-test slack so drops are grabbable without pixel precision. */
const GRAB_SLOP = 1.25;
/** Satellite droplet left at a torn neck: size vs the smaller drop, and
 * lifetime (scaled by `speed` like the rest of the choreography). */
const SAT_R_FACTOR = 0.22;
const SAT_LIFE_MS = 420;
const MAX_SATELLITES = 8;
/** Radius variation so the cluster reads organic, not gridded. */
const R_SCALE = [0.95, 1.2, 0.8];

/** Deterministic per-drop angle (same scheme the old Metaballs used). */
function dropAngle(index: number, seed: number): number {
  return index * 2.399963 + seed * 0.618034;
}

interface Home {
  x: number;
  y: number;
  r: number;
}

function layoutHomes(
  count: number,
  size: number,
  spread: number,
  seed: number
): Home[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = dropAngle(i, seed);
    return {
      x: Math.cos(angle) * spread * 0.42,
      y: Math.sin(angle) * spread * 0.16,
      r: (size / 2) * R_SCALE[i % R_SCALE.length],
    };
  });
}

export function Droplets({
  count = DEFAULT_COUNT,
  size = DEFAULT_SIZE,
  spread = DEFAULT_SPREAD,
  bleed = 0,
  speed = 1,
  material = "glass",
  tint,
  opacity,
  color,
  light,
  reflection = true,
  refraction = false,
  // Droplets' pre-pack specular opacity was `specularPlacement`'s own
  // default (0.7) — nobody ever overrode it — which already equals the
  // "present" preset exactly, so intensity maps straight through (no 0.4x
  // scaling like JellyButton/MorphSurface): default "present" reproduces
  // today's 0.7 pixel-identically.
  intensity = "present",
  shadow = true,
  followPointer = false,
  interactive = false,
  onGrab,
  onTear,
  onRelease,
  seed = 0,
  className,
  style,
  ...rest
}: DropletsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  const side = size + spread + bleed * 2;
  const center = side / 2;
  const homes = useMemo(
    () => layoutHomes(count, size, spread, seed),
    [count, size, spread, seed]
  );
  const { url: refractionUrl, defs: refractionDefs } = useRefraction(
    refraction && material === "glass",
    side,
    side
  );
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color, refractionUrl, opacity }),
    [material, tint, color, refractionUrl, opacity]
  );
  const sceneLight =
    !reflection || light === null ? null : light ?? defaultLight(side, side);
  const specularOpacity = resolveIntensity(intensity);

  // x/y springs per drop, interleaved [x0, y0, x1, y1, ...]
  const springs = useMotionSprings(
    count * 2,
    (i) =>
      i % 2 === 0
        ? center + homes[(i / 2) | 0].x
        : center + homes[((i - 1) / 2) | 0].y,
    DROP_SPRING
  );
  const pointer = useMotionSprings(2, () => -9999, POINTER_SPRING);
  const pointerActive = useRef(false);
  const [grabbed, setGrabbed] = useState<number | null>(null);
  const grab = useRef<{ index: number; connected: boolean } | null>(null);

  const tension = useRef(new TensionField());
  const phase = useRef(0);
  const cycleT = useRef(0);
  const renderer = useRef<LiquidSceneHandle>(null);
  // Component-side mirror of the engine's pair hysteresis, so we can catch
  // the exact frame a neck tears and leave a satellite droplet behind.
  const bonds = useRef(new Set<string>());
  const satellites = useRef<
    { x: number; y: number; r0: number; age: number }[]
  >([]);

  const staticScene = useMemo(
    () =>
      buildScene(
        homes.map((h, i) => bodyAt(h, center, i)),
        null,
        resolved.specular,
        sceneLight,
        specularOpacity,
        false
      ),
    [homes, center, resolved.specular, sceneLight, specularOpacity]
  );

  // The loop mutates the DOM behind React's back; when it stops (reduced
  // motion, scrolled off-screen) or the declarative scene changes, resync so
  // the static rendering wins again.
  useEffect(() => {
    if (!animating) renderer.current?.setScene(staticScene);
  }, [animating, staticScene]);

  useAnimationFrame((_, delta) => {
    if (!animating) return;
    cycleT.current += delta * speed;
    if (cycleT.current > CYCLE_MS) {
      cycleT.current = 0;
      phase.current = 1 - phase.current;
      const squeeze = phase.current === 1 ? SQUEEZE : 1;
      // Coalescing is fast, parting is reluctant — the slow spring keeps the
      // stretching neck on screen instead of zipping past the snap point.
      const spring = phase.current === 1 ? DROP_SPRING : PART_SPRING;
      homes.forEach((h, i) => {
        if (grab.current?.index === i) return; // held drop stays on the pointer
        springs.setTarget(i * 2, center + h.x * squeeze, spring);
        springs.setTarget(i * 2 + 1, center + h.y * squeeze, spring);
      });
    }
    const bodies: LiquidBody[] = homes.map((h, i) => ({
      id: `d${i}`,
      x: springs.values[i * 2].get(),
      y: springs.values[i * 2 + 1].get(),
      r: h.r,
    }));
    if (followPointer && pointerActive.current) {
      bodies.push({
        id: "you",
        x: pointer.values[0].get(),
        y: pointer.values[1].get(),
        r: size * 0.38,
      });
    }
    // Mirror the engine's hysteresis pair-by-pair; a bond that breaks this
    // frame is a torn neck — leave a shrinking satellite droplet at the
    // pinch-off point so the split reads as liquid, not a pop.
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const key = `${a.id}|${b.id}`;
        const d = dist(a, b);
        const stretch = d / (a.r + b.r);
        const was = bonds.current.has(key);
        if (was ? stretch < SNAP_STRETCH : stretch < CONNECT_STRETCH) {
          bonds.current.add(key);
        } else {
          if (was && satellites.current.length < MAX_SATELLITES) {
            const t = (a.r + (d - a.r - b.r) / 2) / d;
            satellites.current.push({
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
              r0: Math.min(a.r, b.r) * SAT_R_FACTOR,
              age: 0,
            });
          }
          bonds.current.delete(key);
        }
      }
    }
    let satPath = "";
    satellites.current = satellites.current.filter((s) => {
      s.age += delta * speed;
      const life = 1 - s.age / SAT_LIFE_MS;
      if (life <= 0) return false;
      satPath += circlePath(s, s.r0 * life ** 1.4);
      return true;
    });
    renderer.current?.setScene(
      buildScene(
        bodies,
        tension.current,
        resolved.specular,
        sceneLight,
        specularOpacity,
        true,
        satPath
      )
    );
    // Tear detection: buildScene just updated the tension hysteresis, so a
    // held drop that lost its last bridge this frame has torn off.
    const g = grab.current;
    if (g) {
      const connectedNow = tension.current.connectedTo(`d${g.index}`);
      if (g.connected && !connectedNow) onTear?.(g.index);
      g.connected = connectedNow;
    }
  });

  const localPoint = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  /** Keep a dragged drop fully inside the canvas (the clip ends at the
   * container edge, so an escaped drop would just get sliced off). */
  const clampToCanvas = (v: number, r: number) =>
    Math.max(r, Math.min(side - r, v));

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || !animating) return;
    const p = localPoint(e);
    for (let i = 0; i < homes.length; i++) {
      const x = springs.values[i * 2].get();
      const y = springs.values[i * 2 + 1].get();
      if (Math.hypot(p.x - x, p.y - y) > homes[i].r * GRAB_SLOP) continue;
      grab.current = {
        index: i,
        connected: tension.current.connectedTo(`d${i}`),
      };
      setGrabbed(i);
      // Hide the chase drop while a drop is in hand.
      pointerActive.current = false;
      tension.current.clear((key) => key.includes("you"));
      forgetYouBonds(bonds.current);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // jsdom / detached nodes — capture is a nicety, not a requirement
      }
      springs.setTarget(i * 2, clampToCanvas(p.x, homes[i].r), GRAB_SPRING);
      springs.setTarget(i * 2 + 1, clampToCanvas(p.y, homes[i].r), GRAB_SPRING);
      onGrab?.(i);
      return;
    }
  };

  const handlePointerEnd = () => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    setGrabbed(null);
    const squeeze = phase.current === 1 ? SQUEEZE : 1;
    const home = homes[g.index];
    springs.setTarget(g.index * 2, center + home.x * squeeze, DROP_SPRING);
    springs.setTarget(g.index * 2 + 1, center + home.y * squeeze, DROP_SPRING);
    onRelease?.(g.index);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = localPoint(e);
    const g = grab.current;
    if (g) {
      const r = homes[g.index].r;
      springs.setTarget(g.index * 2, clampToCanvas(p.x, r), GRAB_SPRING);
      springs.setTarget(g.index * 2 + 1, clampToCanvas(p.y, r), GRAB_SPRING);
      return;
    }
    if (!followPointer) return;
    if (!pointerActive.current) {
      pointerActive.current = true;
      pointer.snapTo([p.x, p.y]);
    } else {
      pointer.setTargets([p.x, p.y]);
    }
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    width: side,
    height: side,
    ...(interactive && animating
      ? {
          touchAction: "none",
          cursor: grabbed != null ? "grabbing" : "grab",
        }
      : {}),
    ...style,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={containerStyle}
      data-fluidkit="droplets"
      data-animating={animating}
      data-grabbed={grabbed ?? undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={
        interactive || followPointer ? handlePointerMove : undefined
      }
      onPointerUp={interactive ? handlePointerEnd : undefined}
      onPointerCancel={interactive ? handlePointerEnd : undefined}
      onPointerLeave={
        followPointer
          ? () => {
              pointerActive.current = false;
              tension.current.clear((key) => key.includes("you"));
              forgetYouBonds(bonds.current);
            }
          : undefined
      }
      {...rest}
    >
      {refractionDefs}
      <LiquidRenderer
        ref={renderer}
        path={staticScene.path}
        material={resolved}
        speculars={staticScene.speculars}
        specularSlots={resolved.specular && sceneLight ? count + 1 : 0}
        shadow={shadow}
      />
    </div>
  );
}

/** Drop the chase-drop's mirrored bonds (matches `tension.clear` above —
 * a returning chase drop must not resume in the connected hysteresis state). */
function forgetYouBonds(bonds: Set<string>): void {
  for (const key of bonds) {
    if (key.includes("you")) bonds.delete(key);
  }
}

function bodyAt(home: Home, center: number, index: number): LiquidBody {
  return { id: `d${index}`, x: center + home.x, y: center + home.y, r: home.r };
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildScene(
  bodies: LiquidBody[],
  tension: TensionField | null,
  wantSpecular: boolean,
  light: Vec | null,
  opacity: number,
  bridged: boolean,
  extraPath = ""
): Scene {
  let path = bodies.map((b) => circlePath(b, b.r)).join("");
  if (bridged && tension) path += tension.bridges(bodies);
  path += extraPath;
  const speculars =
    wantSpecular && light
      ? bodies.map((b) => specularPlacement(b, light, opacity))
      : [];
  return { path, speculars };
}
