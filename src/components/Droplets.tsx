/**
 * A cluster of liquid drops with surface tension: they drift together,
 * merge through real necks (touch-connect / snap-on-stretch), and split
 * again. Optionally an extra drop chases the pointer and merges with the
 * cluster. Rendered by the liquid engine; the material (glass / mercury /
 * flat) is a prop, not a different component.
 *
 * Reduced motion / off-screen: renders the drops as separate static dots
 * (no bridges, no animation loop).
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  specularPlacement,
} from "../liquid";
import type { LiquidBody, LiquidMaterial, SpecularSpot, Vec } from "../liquid";
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
  /** An extra drop chases the pointer and merges with the cluster. */
  followPointer?: boolean;
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
  followPointer = false,
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
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const sceneLight = light === undefined ? defaultLight(side, side) : light;

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

  const tension = useRef(new TensionField());
  const phase = useRef(0);
  const cycleT = useRef(0);

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
  const [scene, setScene] = useState(staticScene);

  useAnimationFrame((_, delta) => {
    if (!animating) return;
    cycleT.current += delta * speed;
    if (cycleT.current > CYCLE_MS) {
      cycleT.current = 0;
      phase.current = 1 - phase.current;
      const squeeze = phase.current === 1 ? SQUEEZE : 1;
      springs.setTargets(
        homes.flatMap((h) => [center + h.x * squeeze, center + h.y * squeeze])
      );
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
    setScene(
      buildScene(bodies, tension.current, resolved.specular, sceneLight, true)
    );
  });

  const containerStyle: CSSProperties = {
    position: "relative",
    width: side,
    height: side,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={containerStyle}
      data-fluidkit="droplets"
      data-animating={animating}
      onPointerMove={
        followPointer
          ? (e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - box.left;
              const y = e.clientY - box.top;
              if (!pointerActive.current) {
                pointerActive.current = true;
                pointer.snapTo([x, y]);
              } else {
                pointer.setTargets([x, y]);
              }
            }
          : undefined
      }
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
      <LiquidRenderer
        path={animating ? scene.path : staticScene.path}
        material={resolved}
        speculars={animating ? scene.speculars : staticScene.speculars}
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
