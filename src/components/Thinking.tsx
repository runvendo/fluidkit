/**
 * Organic "working" indicator rendered by the liquid engine, in three
 * choreographies selected by `variant`:
 *
 *   - `gather` — three drops snap together fast and drift apart lazily,
 *     slightly out of phase, while the whole formation turns a full 360°
 *     (the ambient "thinking" default)
 *   - `orbit`  — two drops circle a center drop, alternately merging with
 *     it and pulling free (a liquid spinner)
 *   - `wave`   — a touching row of drops bobs in sequence; the traveling
 *     wave tears the necks and re-forms them (liquid typing indicator)
 *
 * Motion is a pure function of time — explicit easing curves, no spring
 * state — so drops land exactly where the curve says with no settle wobble.
 * `gather` and `wave` are deterministic clean loops; `orbit` alone layers
 * seeded incommensurate sine wobbles so its revolutions never visibly
 * repeat (same seed, same motion — rendering stays deterministic).
 *
 * Announced as `role="status"` for assistive tech. Reduced motion /
 * off-screen: renders the variant's resting bodies as separate static
 * shapes (no bridges, no animation loop).
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  specularPlacement,
} from "../liquid";
import type {
  LiquidBody,
  LiquidMaterial,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useInView, usePrefersReducedMotion } from "../utils";

export type ThinkingVariant = "gather" | "orbit" | "wave";

export interface ThinkingProps extends HTMLAttributes<HTMLDivElement> {
  /** Choreography. */
  variant?: ThinkingVariant;
  /** Accessible label announced to screen readers. */
  label?: string;
  /** Base drop diameter in px; the canvas scales with it. */
  size?: number;
  /** Cycle speed multiplier. */
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
  /** Varies `orbit`'s wobble between instances (same seed, same motion). */
  seed?: number;
}

/** Square canvas side as a multiple of `size`. */
const CANVAS_SCALE = 3.5;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Normalized progress through the window starting at `start` for `dur` ms. */
const seg = (t: number, start: number, dur: number): number =>
  clamp01((t - start) / dur);
const easeOutCubic = (p: number): number => 1 - (1 - p) ** 3;
const easeInOutSine = (p: number): number => 0.5 - 0.5 * Math.cos(Math.PI * p);
const TAU = 2 * Math.PI;

interface VariantDef {
  /** Specular slot pool = the most bodies a frame can hold. */
  bodyCount: number;
  /** Scene bodies at time `t` (ms, monotonic — variants wrap internally). */
  bodies(t: number, size: number, side: number, seed: number): LiquidBody[];
  /** Resting bodies for the static (reduced-motion / off-screen) scene. */
  rest(size: number, side: number, seed: number): LiquidBody[];
}

/* ---------------------------------- gather ---------------------------------
 * Three drops around the center. Each snaps to the hub on a fast ease-out
 * (staggered starts), holds merged, then drifts home on a slow ease-in-out,
 * while the whole formation turns continuously — a full 360° every two
 * cycles. Deterministic clean loop.
 */

const GATHER_PERIOD = 2600;
/** One full formation turn every two gather cycles. */
const GATHER_TURN_MS = GATHER_PERIOD * 2;
const GATHER_SNAP_MS = 380;
const GATHER_PART_MS = 900;
const GATHER_PART_AT = 1450;
/** Per-drop stagger so the cluster never moves in lockstep. */
const GATHER_STAGGER = [0, 110, 220];
/** Radius variation so the cluster reads organic, not gridded. */
const GATHER_R = [0.95, 1.08, 0.85];
/** Fraction of the home offset kept when merged — the blob stays lumpy. */
const GATHER_HUB = 0.16;

/** Resting offset for drop `i` (before the formation's rotation). */
function gatherHome(i: number, size: number): Vec {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
  const rho = size * 1.05;
  return { x: Math.cos(angle) * rho, y: Math.sin(angle) * rho * 0.72 };
}

const gather: VariantDef = {
  bodyCount: 3,
  bodies(t, size, side) {
    const c = side / 2;
    const tc = t % GATHER_PERIOD;
    const theta = (TAU * t) / GATHER_TURN_MS;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return GATHER_R.map((scale, i) => {
      const home = gatherHome(i, size);
      const snap = easeOutCubic(seg(tc, GATHER_STAGGER[i], GATHER_SNAP_MS));
      const part = easeInOutSine(
        seg(tc, GATHER_PART_AT + GATHER_STAGGER[i], GATHER_PART_MS)
      );
      const pull = 1 - snap * (1 - part) * (1 - GATHER_HUB);
      const x = home.x * pull;
      const y = home.y * pull;
      return {
        id: `d${i}`,
        x: c + x * cos - y * sin,
        y: c + x * sin + y * cos,
        r: (size / 2) * scale,
      };
    });
  },
  rest(size, side) {
    const c = side / 2;
    return GATHER_R.map((scale, i) => {
      const home = gatherHome(i, size);
      return { id: `d${i}`, x: c + home.x, y: c + home.y, r: (size / 2) * scale };
    });
  },
};

/* ---------------------------------- orbit ----------------------------------
 * A center drop anchors the scene; two satellites circle it while breathing
 * radially in opposite phase, so one merges with the center as the other
 * pulls free. Extra sines at incommensurate periods wobble the angle and
 * radius so no two revolutions look alike.
 */

const ORBIT_SPIN_MS = 2400;
const ORBIT_BREATHE_MS = 1600;
const ORBIT_CENTER_R = 0.46;
const ORBIT_SAT_R = 0.34;
const ORBIT_MID = 0.95;
const ORBIT_AMP = 0.28;

const orbit: VariantDef = {
  bodyCount: 3,
  bodies(t, size, side, seed) {
    const c = side / 2;
    const sp = seed * 2.39996;
    const bodies: LiquidBody[] = [
      { id: "hub", x: c, y: c, r: size * ORBIT_CENTER_R },
    ];
    for (let i = 0; i < 2; i++) {
      const angle =
        (TAU * t) / ORBIT_SPIN_MS +
        i * Math.PI +
        0.16 * Math.sin((TAU * t) / 1487 + i * 1.7 + sp);
      const radius =
        size *
        (ORBIT_MID +
          ORBIT_AMP * Math.sin((TAU * t) / ORBIT_BREATHE_MS + i * Math.PI) +
          0.07 * Math.sin((TAU * t) / 1129 + i * 2.6 + sp));
      bodies.push({
        id: `s${i}`,
        x: c + Math.cos(angle) * radius,
        y: c + Math.sin(angle) * radius,
        r: size * ORBIT_SAT_R,
      });
    }
    return bodies;
  },
  rest(size, side) {
    const c = side / 2;
    return [
      { id: "hub", x: c, y: c, r: size * ORBIT_CENTER_R },
      { id: "s0", x: c + size * ORBIT_MID, y: c, r: size * ORBIT_SAT_R },
      { id: "s1", x: c - size * ORBIT_MID, y: c, r: size * ORBIT_SAT_R },
    ];
  },
};

/* ----------------------------------- wave ----------------------------------
 * A row of drops close enough to neck at rest. Each bobs on a phase-lagged
 * sine, so the traveling wave stretches neighboring necks past the snap
 * point and lets them re-form as the phases realign. Deterministic clean
 * loop.
 */

const WAVE_PERIOD = 1400;
const WAVE_R = [0.94, 1.06, 0.94];
const WAVE_AMP = 0.55;
const WAVE_LAG = 1.9; // radians of phase per drop

const wave: VariantDef = {
  bodyCount: 3,
  bodies(t, size, side) {
    const c = side / 2;
    return WAVE_R.map((scale, i) => ({
      id: `d${i}`,
      x: c + (i - 1) * size,
      y:
        c +
        size *
          WAVE_AMP *
          Math.sin((TAU * t) / WAVE_PERIOD - i * WAVE_LAG),
      r: (size / 2) * scale,
    }));
  },
  rest(size, side) {
    const c = side / 2;
    return WAVE_R.map((scale, i) => ({
      id: `d${i}`,
      x: c + (i - 1) * size,
      y: c,
      r: (size / 2) * scale,
    }));
  },
};

const VARIANTS: Record<ThinkingVariant, VariantDef> = { gather, orbit, wave };

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildScene(
  bodies: LiquidBody[],
  tension: TensionField | null,
  wantSpecular: boolean,
  light: Vec | null
): Scene {
  let path = bodies.map((b) => circlePath(b, b.r)).join("");
  if (tension) path += tension.bridges(bodies);
  const speculars =
    wantSpecular && light
      ? bodies.filter((b) => b.r > 0.5).map((b) => specularPlacement(b, light))
      : [];
  return { path, speculars };
}

export function Thinking({
  variant = "gather",
  label = "Thinking",
  size = 18,
  speed = 1,
  material = "glass",
  tint,
  color,
  light,
  reflection = true,
  seed = 0,
  className,
  style,
  ...rest
}: ThinkingProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  const def = VARIANTS[variant];
  const side = Math.round(size * CANVAS_SCALE);
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const sceneLight =
    !reflection || light === null ? null : light ?? defaultLight(side, side);

  const tension = useRef(new TensionField());
  const clock = useRef(0);
  const renderer = useRef<LiquidSceneHandle>(null);

  const staticScene = useMemo(
    () =>
      buildScene(def.rest(size, side, seed), null, resolved.specular, sceneLight),
    [def, size, side, seed, resolved.specular, sceneLight]
  );

  // Start each variant's choreography from the top of its cycle with no
  // stale bridges carried over.
  useEffect(() => {
    clock.current = 0;
    tension.current.clear();
  }, [variant]);

  // The loop mutates the DOM behind React's back; when it stops (reduced
  // motion, scrolled off-screen) or the declarative scene changes, resync so
  // the static rendering wins again.
  useEffect(() => {
    if (!animating) {
      tension.current.clear();
      renderer.current?.setScene(staticScene);
    }
  }, [animating, staticScene]);

  useAnimationFrame((_, delta) => {
    if (!animating) return;
    clock.current += delta * speed;
    renderer.current?.setScene(
      buildScene(
        def.bodies(clock.current, size, side, seed),
        tension.current,
        resolved.specular,
        sceneLight
      )
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
      role="status"
      aria-label={label}
      className={className}
      style={containerStyle}
      data-fluidkit="thinking"
      data-variant={variant}
      data-animating={animating}
      {...rest}
    >
      <LiquidRenderer
        ref={renderer}
        path={staticScene.path}
        material={resolved}
        speculars={staticScene.speculars}
        specularSlots={resolved.specular && sceneLight ? def.bodyCount : 0}
        shadow
      />
    </div>
  );
}
