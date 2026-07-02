/**
 * A cluster of liquid drops with surface tension: they drift together,
 * merge through real necks (touch-connect / snap-on-stretch), and split
 * again. Optionally an extra drop chases the pointer and merges with the
 * cluster (`followPointer`), and drops can be grabbed, dragged out until
 * the neck tears, and released to spring home (`interactive`). Rendered by
 * the liquid engine; the material (glass / mercury / flat) is a prop, not a
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
  resolveMaterial,
  specularPlacement,
  useRefraction,
} from "../liquid";
import type {
  LiquidBody,
  LiquidMaterial,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface DropletsProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of drops in the cluster. */
  count?: number;
  /** Base drop diameter in px. */
  size?: number;
  /** Px extent the cluster spreads across. */
  spread?: number;
  /** Merge/split cycle speed multiplier. */
  speed?: number;
  /** Rendered material. */
  material?: LiquidMaterial;
  /** Glass tint (translucent white by default). */
  tint?: string;
  /** Flat-material fill color. */
  color?: string;
  /**
   * Scene light position in px (container coordinates). `null` disables
   * specular highlights. Defaults to above the stage, 30% from the left.
   */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /**
   * Edge lensing on glass via an SVG displacement filter inside
   * `backdrop-filter` (Chromium-only; silently degrades to plain glass
   * blur elsewhere). Defaults to `false`.
   */
  refraction?: boolean;
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
const POINTER_SPRING = { stiffness: 120, damping: 13 };
/** Tight lag while a drop is held — liquid, but clearly in hand. */
const GRAB_SPRING = { stiffness: 550, damping: 38 };
/** Hit-test slack so drops are grabbable without pixel precision. */
const GRAB_SLOP = 1.25;
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
  speed = 1,
  material = "glass",
  tint,
  color,
  light,
  reflection = true,
  refraction = false,
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

  const side = size + spread;
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
    () => resolveMaterial(material, { tint, color, refractionUrl }),
    [material, tint, color, refractionUrl]
  );
  const sceneLight =
    !reflection || light === null ? null : light ?? defaultLight(side, side);

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

  const staticScene = useMemo(
    () =>
      buildScene(
        homes.map((h, i) => bodyAt(h, center, i)),
        null,
        resolved.specular,
        sceneLight,
        false
      ),
    [homes, center, resolved.specular, sceneLight]
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
      homes.forEach((h, i) => {
        if (grab.current?.index === i) return; // held drop stays on the pointer
        springs.setTarget(i * 2, center + h.x * squeeze);
        springs.setTarget(i * 2 + 1, center + h.y * squeeze);
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
    renderer.current?.setScene(
      buildScene(bodies, tension.current, resolved.specular, sceneLight, true)
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
        shadow
      />
    </div>
  );
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
  bridged: boolean
): Scene {
  let path = bodies.map((b) => circlePath(b, b.r)).join("");
  if (bridged && tension) path += tension.bridges(bodies);
  const speculars =
    wantSpecular && light ? bodies.map((b) => specularPlacement(b, light)) : [];
  return { path, speculars };
}
