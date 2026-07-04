/**
 * Determinate progress as a VESSEL FILLING: the track is a shallow channel
 * and the fill's leading edge is a live meniscus bead that wobbles subtly
 * while the value is moving and settles flat when it stops. The wobble
 * envelope is driven by the fill spring's velocity, so idle progress never
 * animates — motion means "still moving", stillness means "waiting".
 *
 * Determinate only, by design: `Thinking` owns indeterminate/working.
 * `value`/`max` follow the native `<progress>` convention; the surface
 * carries `role="progressbar"` with the ARIA value set.
 *
 * Reduced motion: fill width tracks the value with no wobble.
 */

import type { HTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  circlePath,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import type { SurfaceStyleProps } from "./surface";

export interface LiquidProgressProps
  extends SurfaceStyleProps,
    Omit<HTMLAttributes<HTMLDivElement>, "color" | "role"> {
  /** Current progress, `0..max` (native `<progress>` convention). */
  value: number;
  /** The value that means "done". Defaults to `1`. */
  max?: number;
  /** Track length in px. Defaults to `240`. */
  width?: number;
  /** Channel thickness in px. Defaults to `12`. */
  height?: number;
  /** Fill tint (the liquid in the vessel). Defaults to a quiet blue. */
  fillTint?: string;
  /**
   * How loudly the material reads. Defaults to `"present"` — the meniscus
   * bead is a droplet visual and carries Droplets' specular brightness
   * (documented divergence from the pack's `"whisper"`).
   */
  intensity?: LiquidIntensity;
}

/* Approved prototype values (plan: 2026-07-04 review gate). */
const FILL_SPRING = { stiffness: 90, damping: 14 };
const WOBBLE_AMP = 0.08;
const WOBBLE_HZ = 1.6;
/** Fraction/sec of fill movement that drives the wobble to full. */
const WOBBLE_DRIVE = 0.6;
const ENVELOPE_TAU_MS = 260;
const BEAD_SCALE = 1.15;
/** How long the loop keeps running after the last value change. */
const SETTLE_MS = 1400;
const DEFAULT_FILL_TINT = "rgba(96, 156, 220, 0.45)";

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

export function LiquidProgress({
  value,
  max = 1,
  width = 240,
  height = 12,
  fillTint = DEFAULT_FILL_TINT,
  material = "glass",
  tint,
  opacity,
  color,
  intensity = "present",
  light,
  reflection = true,
  refraction: _refraction, // reserved: edge lensing is not wired on progress yet
  shadow = true,
  className,
  style,
  ...rest
}: LiquidProgressProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  const clamped = Math.max(0, Math.min(max, value));
  const fraction = max > 0 ? clamped / max : 0;

  /* ------------------------------ geometry ------------------------------ */

  const beadMax = (height / 2) * BEAD_SCALE * (1 + WOBBLE_AMP);
  const bleed = Math.ceil(Math.max(12, beadMax - height / 2 + 8));
  const W = width + bleed * 2;
  const H = Math.ceil(Math.max(height, beadMax * 2)) + bleed * 2;
  const cy = H / 2;

  const sceneLight = useMemo<Vec | null>(() => {
    if (!reflection || light === null) return null;
    return light
      ? { x: light.x + bleed, y: light.y + bleed }
      : defaultLight(W, H);
  }, [reflection, light, bleed, W, H]);
  const volume = resolveIntensity(intensity);
  const fillMaterial = useMemo(
    () => resolveMaterial(material, { tint: fillTint, color, opacity }),
    [material, fillTint, color, opacity]
  );
  const trackMaterial = useMemo(
    () =>
      resolveMaterial(material, {
        tint: tint ?? "rgba(120, 128, 150, 0.14)",
        color,
      }),
    [material, tint, color]
  );

  /* ------------------------------- motion -------------------------------- */

  const fill = useMotionSprings(1, () => fraction, FILL_SPRING);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevFraction = useRef(fraction);
  useEffect(() => {
    if (prevFraction.current !== fraction) {
      if (animating) {
        fill.setTargets([fraction]);
        settlingRef.current = true;
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settlingRef.current = false;
          setSettling(false);
        }, SETTLE_MS);
      } else {
        fill.snapTo([fraction]);
      }
    }
    prevFraction.current = fraction;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fraction, animating]);

  useEffect(() => {
    if (!animating) {
      settlingRef.current = false;
      setSettling(false);
    }
  }, [animating]);

  const buildScene = (f: number, wobble: number): Scene => {
    if (f <= 0.005) return { path: "", speculars: [] };
    const fillW = Math.max(f * width, height);
    const edgeX = bleed + f * width;
    const beadR = (height / 2) * BEAD_SCALE * wobble;
    const path =
      roundRectPath({ x: bleed + fillW / 2, y: cy }, fillW, height, height / 2) +
      circlePath({ x: edgeX, y: cy }, beadR);
    const speculars =
      // The one glint rides the meniscus bead (glass only — flat is unlit).
      fillMaterial.specular && sceneLight
        ? [specularPlacement({ x: edgeX, y: cy, r: beadR }, sceneLight, volume)]
        : [];
    return { path, speculars };
  };

  const staticScene = useMemo(
    () => buildScene(fraction, 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fraction, width, height, bleed, sceneLight, volume, fillMaterial.specular]
  );

  const renderer = useRef<LiquidSceneHandle>(null);
  const clock = useRef(0);
  const env = useRef(0);

  useEffect(() => {
    if (!(animating && settlingRef.current))
      renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame((_, delta) => {
    if (!animating || !settling) return;
    clock.current += delta;
    const f = Math.max(0, Math.min(1, fill.values[0].get()));
    const drive = Math.min(1, Math.abs(fill.values[0].getVelocity()) / WOBBLE_DRIVE);
    env.current = Math.max(env.current * Math.exp(-delta / ENVELOPE_TAU_MS), drive);
    const wobble =
      1 +
      WOBBLE_AMP *
        env.current *
        Math.sin((clock.current / 1000) * WOBBLE_HZ * Math.PI * 2);
    renderer.current?.setScene(buildScene(f, wobble));
  });

  /* ------------------------------- render -------------------------------- */

  const trackPath = roundRectPath(
    { x: bleed + width / 2, y: cy },
    width,
    height,
    height / 2
  );

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      data-fluidkit="liquid-progress"
      data-animating={animating && settling}
      className={className}
      style={{
        position: "relative",
        width,
        height: Math.max(height, Math.ceil(beadMax * 2)),
        ...style,
      }}
      {...rest}
    >
      <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
        <LiquidRenderer path={trackPath} material={trackMaterial} shadow={shadow} />
      </span>
      <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
        <LiquidRenderer
          ref={renderer}
          path={staticScene.path}
          material={fillMaterial}
          speculars={staticScene.speculars}
          specularSlots={fillMaterial.specular && sceneLight ? 1 : 0}
        />
      </span>
    </div>
  );
}
