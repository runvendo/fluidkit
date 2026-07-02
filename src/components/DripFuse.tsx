/**
 * A drop swells off a source body, tears free, springs to a target, and
 * fuses in. One-shot: generalizes `LiquidTabs`' drain -> fly -> fill
 * choreography into a single trigger-and-complete cycle instead of a
 * continuous tab-change flow.
 *
 * Owns a positioned canvas of explicit `width` x `height` (defaults 240x80)
 * holding two stable engine bodies, `src` (left end) and `tgt` (right end),
 * each radius `size`. `sourceContent`/`targetContent` render on the unclipped
 * content overlay, absolutely positioned and centered on each anchor —
 * never scaled, per the library's core principle.
 *
 * Trigger: `fire` — a number. ANY change (the `LiquidTabs` prevX pattern:
 * comparison against a prev ref, not a delta) starts one cycle:
 *
 *   swell - a third body, `drip`, grows from r=0 at the source's edge. It
 *     starts touching/overlapping the source, so no bridge is drawn (the two
 *     circles union directly) — the drop visibly bulges off the source.
 *   tear/fly - `drip`'s x springs toward the target at the same instant the
 *     radius spring starts, but on a much softer spring, so the growth reads
 *     first and the flight reads second even though both begin together
 *     (the same trick `LiquidTabs` uses for its drain/fill/fly springs). As
 *     `drip` pulls away from the source, the real tension hysteresis
 *     (`TensionField`) naturally stops bridging them once the stretch
 *     exceeds `SNAP_STRETCH` — no manual "tear" event needed.
 *   fuse - once `drip` gets within `FUSE_CONTACT` stretch of the target, its
 *     radius drains to 0 while the target briefly swells (a bump-then-settle
 *     spring pair) to visibly absorb the mass, then eases back to rest.
 *
 * All of this is one `clip-path` scene written imperatively per frame
 * through `LiquidRenderer`'s handle — no React commits inside the loop (the
 * Profiler zero-commit constraint). `data-phase` ("idle" | "swell" | "fly" |
 * "fuse") mirrors this: the JSX sets its value declaratively the instant a
 * cycle starts ("swell", the same commit that flips `settling` true), and
 * every frame after that overwrites it directly on the DOM node via a ref —
 * exactly the same "declarative first frame, imperative after" split as the
 * clip-path itself. `onComplete` fires exactly once per cycle, from a
 * `setTimeout` settle timer, never from the frame loop.
 *
 * Coalescing policy: firing again while a cycle is already running RESTARTS
 * it — springs snap back to the swell start, the tension field and fuse
 * flag reset, and the previous cycle's pending `onComplete` timer is
 * cancelled in favor of a new one. So N rapid-fire increments produce
 * exactly ONE completed cycle and ONE `onComplete` call (for the last fire),
 * never a queue of N. This mirrors the settle-timer restart pattern already
 * used by `LiquidTabs`/`JellyButton` for interrupted presses/transitions.
 *
 * Reduced motion: `fire` changes complete instantly — `onComplete` fires
 * from the change effect and the scene stays the static two-body rest
 * state. `data-animating` is always `false`. A fire under reduced motion
 * also CANCELS any cycle already in flight (same cleanup as a restart:
 * timers cleared, springs snapped home, tension/fuse state reset, settle
 * loop stopped), so the interrupted cycle's stale settle timer can never
 * double-fire `onComplete` alongside the instant one, and no stale frames
 * keep writing under the preference.
 *
 * Reduced motion can also flip ON mid-cycle with NO new `fire` (the OS
 * preference changing, or any unrelated parent re-render). The running
 * cycle gets the same instant-completion treatment: timers/tension/fuse
 * state reset, springs snapped to rest, the static two-body scene
 * resynced, and `onComplete` fires immediately. This is deliberately
 * DIFFERENT from a same-preference restart, where an interrupted cycle's
 * `onComplete` never runs — a restart hands the callback to the NEW
 * cycle's completion instead. A bare preference flip creates no new cycle,
 * so there's nothing to hand off to; letting the in-flight one finish is
 * what keeps it coherent with "reduced motion always completes instantly."
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
import { usePrefersReducedMotion } from "../utils";

export interface DripFuseProps extends HTMLAttributes<HTMLDivElement> {
  /** Canvas width in px. Defaults to `240`. */
  width?: number;
  /** Canvas height in px. Defaults to `80`. */
  height?: number;
  /** Source/target body radius in px. Defaults to `18`. Clamped to fit the
   * canvas height, so oversized values never spill geometry. */
  size?: number;
  /**
   * Trigger. Any change (up or down) runs one drip cycle. Repeated fires
   * while a cycle is running restart it (see the coalescing policy in the
   * file doc); increment a counter to fire trivially and avoid boolean
   * reset dances.
   */
  fire?: number;
  /**
   * Called once per completed cycle, from the settle timer. Under a
   * restart, only the LAST cycle's completion fires — an interrupted
   * cycle's `onComplete` never runs. Under reduced motion, fires
   * immediately (no animation).
   */
  onComplete?: () => void;
  /** Rendered on the unclipped overlay, centered on the source anchor. */
  sourceContent?: ReactNode;
  /** Rendered on the unclipped overlay, centered on the target anchor. */
  targetContent?: ReactNode;
  /** Rendered material. */
  material?: LiquidMaterial;
  /** Glass tint (translucent white by default). */
  tint?: string;
  /** Flat-material fill color. */
  color?: string;
  /**
   * Scene light position in px (canvas coordinates). `null` disables
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
}

type Phase = "idle" | "swell" | "fly" | "fuse";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 80;
const DEFAULT_SIZE = 18;

/** Fraction of `size` the traveling drop grows to. */
const DRIP_R_FACTOR = 0.6;
/** Fractional radius bump the target gets when the drop fuses in. */
const FUSE_BUMP_FACTOR = 1.18;
/** How close (stretch = center distance / combined radii) the drop must get
 * to the target before the fuse kicks off. */
const FUSE_CONTACT = 1.15;
/** How long the target holds its fuse bump before easing back to rest. */
const BUMP_MS = 140;
/** How long the rAF loop keeps recomputing after a fire (springs settle;
 * also gates when `onComplete` fires). */
const SETTLE_MS = 900;

/** The drop grows quickly off the source's edge... */
const SWELL_SPRING = { stiffness: 420, damping: 26 };
/** ...while it travels toward the target on a softer, slower spring, so the
 * swell reads before the flight even though both start at the same instant. */
const FLY_SPRING = { stiffness: 170, damping: 20 };
/** On contact the drop drains fast... */
const FUSE_DRAIN_SPRING = { stiffness: 320, damping: 24 };
/** ...and the target swells to visibly absorb it... */
const FUSE_BUMP_SPRING = { stiffness: 260, damping: 14 };
/** ...before easing back down to its resting radius. */
const SETTLE_BACK_SPRING = { stiffness: 220, damping: 22 };

interface Anchors {
  sourceX: number;
  targetX: number;
  cy: number;
  /** Source/target resting radius: the `size` prop, clamped to fit the
   * canvas height so degenerate props never spill geometry past the paint
   * box. Every body radius in the component derives from THIS, never the
   * raw prop. */
  size: number;
  /** Traveling drop's max radius, clamped to fit the canvas height. */
  dripR: number;
  /** Target's briefly-swelled radius: clamped to the canvas height but
   * never below the resting radius, so the fuse bump can flatten to a
   * no-op at degenerate props but never invert into a shrink-dip. */
  bumpR: number;
}

/**
 * Source/target sit `margin` px from their respective edges, where `margin`
 * is big enough to fit the target's fuse-bump radius (the largest either
 * body ever gets) without spilling past the canvas — the JellyButton
 * bleed-canvas lesson, applied by leaving room up front instead of bleeding
 * a paint box past it.
 */
function layout(width: number, height: number, rawSize: number): Anchors {
  const size = Math.min(rawSize, height / 2 - 2);
  const bumpR = Math.max(
    Math.min(rawSize * FUSE_BUMP_FACTOR, height / 2 - 2),
    size
  );
  const margin = Math.max(bumpR, size);
  return {
    sourceX: margin,
    targetX: width - margin,
    cy: height / 2,
    size,
    dripR: Math.min(size * DRIP_R_FACTOR, height / 2 - 2),
    bumpR,
  };
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildStaticScene(
  anchors: Anchors,
  wantSpecular: boolean,
  light: Vec | null
): Scene {
  const { size } = anchors;
  const src: LiquidBody = { id: "src", x: anchors.sourceX, y: anchors.cy, r: size };
  const tgt: LiquidBody = { id: "tgt", x: anchors.targetX, y: anchors.cy, r: size };
  const path = circlePath(src, size) + circlePath(tgt, size);
  const speculars =
    wantSpecular && light
      ? [specularPlacement(src, light), specularPlacement(tgt, light)]
      : [];
  return { path, speculars };
}

function anchorStyle(x: number, y: number): CSSProperties {
  return { position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" };
}

/**
 * One-shot liquid transfer: a drop swells off a source body, tears free,
 * springs to a target, and fuses in. Triggered by any change to the `fire`
 * counter; rapid fires coalesce into one cycle and one `onComplete`.
 * Reduced motion completes instantly. See the file doc for details.
 */
export function DripFuse({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  size = DEFAULT_SIZE,
  fire = 0,
  onComplete,
  sourceContent,
  targetContent,
  material = "glass",
  tint,
  color,
  light,
  reflection = true,
  refraction = false,
  className,
  style,
  ...rest
}: DripFuseProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const anchors = useMemo(() => layout(width, height, size), [width, height, size]);

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
    !reflection || light === null ? null : light ?? defaultLight(width, height);

  const staticScene = useMemo(
    () => buildStaticScene(anchors, resolved.specular, sceneLight),
    [anchors, resolved.specular, sceneLight]
  );

  // Spring slots: [0] drip x, [1] drip r, [2] target r. Per-slot default
  // config so a plain `setTargets` (no override) starts the swell-and-fly
  // pair with their own characters; fuse retargets [1]/[2] individually
  // with explicit overrides.
  const springs = useMotionSprings(
    3,
    (i) => (i === 0 ? anchors.sourceX + anchors.size : i === 1 ? 0 : anchors.size),
    (i) => (i === 0 ? FLY_SPRING : i === 1 ? SWELL_SPRING : SETTLE_BACK_SPRING)
  );

  const tension = useRef(new TensionField());
  const fused = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderer = useRef<LiquidSceneHandle>(null);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The settle timer outlives renders, so it reads `onComplete` through a
  // latest-ref — a consumer swapping the callback mid-cycle gets the fresh
  // one called, never the cycle-start capture.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // React to `fire` flips: start (or restart) a cycle, or complete
  // synchronously under reduced motion.
  const prevFire = useRef(fire);
  useEffect(() => {
    if (fire === prevFire.current) return;
    prevFire.current = fire;

    // Both branches begin with the same restart cleanup: a fire always
    // cancels whatever cycle is in flight (timers, fuse flag, tension
    // hysteresis) so a stale settle timer can never double-fire onComplete.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    settleTimer.current = null;
    bumpTimer.current = null;
    tension.current.clear();
    fused.current = false;

    if (prefersReducedMotion) {
      // Instant completion: springs snapped home, settle loop stopped (the
      // resync effect re-writes the static scene), onComplete immediate.
      springs.snapTo([anchors.sourceX + anchors.size, 0, anchors.size]);
      setSettling(false);
      onCompleteRef.current?.();
      return;
    }

    springs.snapTo([anchors.sourceX + anchors.size, 0, anchors.size]);
    springs.setTargets([anchors.targetX, anchors.dripR, anchors.size]);

    setSettling(true);
    settleTimer.current = setTimeout(() => {
      setSettling(false);
      fused.current = false;
      onCompleteRef.current?.();
    }, SETTLE_MS);
    // `anchors`/`springs` participate by current value, not as reactive
    // deps — a fresh cycle always reads the latest closure, same pattern as
    // LiquidTabs' value-change effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
    };
  }, []);

  // Reduced motion flipping on mid-cycle with no new `fire` (the effect
  // above only reacts to `fire` changing) would otherwise let the cycle run
  // to its natural end while `data-animating` already reads `false`. Give
  // it the same instant-completion treatment as a fire under reduced
  // motion — see the file doc's reduced-motion section for why this cycle's
  // `onComplete` fires here instead of never running.
  useEffect(() => {
    if (!prefersReducedMotion || !settling) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    settleTimer.current = null;
    bumpTimer.current = null;
    tension.current.clear();
    fused.current = false;
    springs.snapTo([anchors.sourceX + anchors.size, 0, anchors.size]);
    setSettling(false);
    onCompleteRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, settling]);

  // The loop mutates the DOM behind React's back; when it isn't running,
  // resync the declarative static scene so it wins again.
  useEffect(() => {
    if (!settling) renderer.current?.setScene(staticScene);
  }, [settling, staticScene]);

  useAnimationFrame(() => {
    if (!settling) return;

    const dripX = springs.values[0].get();
    const dripR = springs.values[1].get();
    const targetR = springs.values[2].get();

    const bodies: LiquidBody[] = [
      { id: "src", x: anchors.sourceX, y: anchors.cy, r: anchors.size },
      { id: "tgt", x: anchors.targetX, y: anchors.cy, r: targetR },
    ];
    if (dripR > 0.5) bodies.push({ id: "drip", x: dripX, y: anchors.cy, r: dripR });

    let path = bodies.map((b) => circlePath(b, b.r)).join("");
    path += tension.current.bridges(bodies);

    const wantSpecular = resolved.specular && !!sceneLight;
    const speculars = wantSpecular
      ? bodies.map((b) => specularPlacement(b, sceneLight as Vec))
      : [];

    renderer.current?.setScene({ path, speculars });

    // Fuse trigger: once the drop is close enough to the target, drain it
    // and bump the target — an emergent event detected from the physical
    // state, not scheduled on a timer.
    if (!fused.current && dripR > 0.5) {
      const stretch = Math.abs(dripX - anchors.targetX) / (dripR + anchors.size);
      if (stretch < FUSE_CONTACT) {
        fused.current = true;
        springs.setTarget(1, 0, FUSE_DRAIN_SPRING);
        springs.setTarget(2, anchors.bumpR, FUSE_BUMP_SPRING);
        if (bumpTimer.current) clearTimeout(bumpTimer.current);
        bumpTimer.current = setTimeout(() => {
          springs.setTarget(2, anchors.size, SETTLE_BACK_SPRING);
        }, BUMP_MS);
      }
    }

    const phase: Phase = fused.current
      ? "fuse"
      : dripR < anchors.dripR * 0.85
        ? "swell"
        : "fly";
    containerRef.current?.setAttribute("data-phase", phase);
  });

  const containerStyle: CSSProperties = {
    position: "relative",
    width,
    height,
    ...style,
  };

  const hasContent = sourceContent != null || targetContent != null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-fluidkit="drip-fuse"
      data-animating={!prefersReducedMotion && settling}
      data-phase={settling ? "swell" : "idle"}
      {...rest}
    >
      {refractionDefs}
      <LiquidRenderer
        ref={renderer}
        path={staticScene.path}
        material={resolved}
        speculars={staticScene.speculars}
        specularSlots={resolved.specular && sceneLight ? 3 : 0}
        shadow
      >
        {hasContent && (
          <>
            {sourceContent != null && (
              <span
                data-fluidkit="drip-fuse-source"
                style={anchorStyle(anchors.sourceX, anchors.cy)}
              >
                {sourceContent}
              </span>
            )}
            {targetContent != null && (
              <span
                data-fluidkit="drip-fuse-target"
                style={anchorStyle(anchors.targetX, anchors.cy)}
              >
                {targetContent}
              </span>
            )}
          </>
        )}
      </LiquidRenderer>
    </div>
  );
}
