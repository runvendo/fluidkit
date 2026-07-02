/**
 * A pill-shaped engine button that squashes on press — via GEOMETRY, not a
 * CSS transform, so the label never scales (the library's core principle).
 * Renders a real `<button>` (focus, Enter/Space, disabled all work
 * natively); the liquid surface is the button's fill, and the label lives
 * on `LiquidRenderer`'s unclipped content overlay, layered on top of the
 * fill and never inside the clipped/filtered subtree.
 *
 * One `roundRectPath` body: width/height ride `useMotionSprings` slots.
 * Press retargets them wider/shorter (volume-preserving — width and height
 * scale by inverse factors, so `w · h` stays constant, mirroring
 * `useSquish`'s `scaleX`/`scaleY`); release springs back home, and the
 * spring's natural overshoot supplies the jiggle. Settle-timer engine
 * pattern (per `MorphSurface`): the rAF loop only runs while settling, a
 * static-scene `useMemo` covers every other frame, and a resync effect
 * keeps the two in sync.
 *
 * Press state (`data-pressed`) always tracks pointer/keyboard interaction,
 * even under reduced motion — but the GEOMETRY only deforms when animating
 * (not reduced motion, in view). Under reduced motion the button still
 * clicks normally; a pressed opacity dip is the only visual feedback.
 */

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
  useRefraction,
} from "../liquid";
import type { LiquidMaterial, LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { ACTIVATION_KEYS, DEFAULT_INTENSITY, DEFAULT_SPRING } from "../hooks/useSquish";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface JellyButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  material?: LiquidMaterial;
  tint?: string;
  color?: string;
  /** Scene light; null disables speculars. */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /**
   * Edge lensing on glass via an SVG displacement filter inside
   * `backdrop-filter` (Chromium-only; silently degrades to plain glass
   * blur elsewhere). Defaults to `false`.
   */
  refraction?: boolean;
  /** Fractional squash at full press (volume-preserving). Defaults to the
   * same `0.12` as `useSquish`. */
  intensity?: number;
  /** Resting pill width in px. Defaults to `160`. */
  width?: number;
  /** Resting pill height in px. Defaults to `48`. */
  height?: number;
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 48;
/** How long the loop keeps recomputing after a press/release (spring settles). */
const SETTLE_MS = 900;

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildJellyScene(
  w: number,
  h: number,
  cx: number,
  cy: number,
  light: Vec | null
): Scene {
  // A radius larger than either half-dimension always clamps to a full
  // pill inside `roundRectPath`, regardless of the current squash.
  const path = roundRectPath({ x: cx, y: cy }, w, h, Math.max(w, h));
  const speculars: SpecularSpot[] = [];
  if (light) {
    speculars.push(
      specularPlacement({ x: cx, y: cy, r: Math.min(w, h) * 0.48 }, light, 0.28)
    );
  }
  return { path, speculars };
}

export function JellyButton({
  material = "glass",
  tint,
  color,
  light,
  reflection = true,
  refraction = false,
  intensity = DEFAULT_INTENSITY,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  disabled = false,
  children,
  className,
  style,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...rest
}: JellyButtonProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLButtonElement>();
  const animating = !prefersReducedMotion && inView;

  const [pressed, setPressed] = useState(false);
  // Geometry only deforms while animating — under reduced motion (or
  // off-screen) `pressed` still tracks for `data-pressed`/opacity, but the
  // body never leaves its resting size.
  const geometryPressed = pressed && animating;

  const cx = width / 2;
  const cy = height / 2;

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

  const springs = useMotionSprings(
    2,
    (i) => (i === 0 ? width : height),
    DEFAULT_SPRING
  );

  const targetW = geometryPressed ? width * (1 + intensity) : width;
  const targetH = geometryPressed ? height / (1 + intensity) : height;

  const staticScene = useMemo(
    () =>
      buildJellyScene(targetW, targetH, cx, cy, resolved.specular ? sceneLight : null),
    [targetW, targetH, cx, cy, resolved.specular, sceneLight]
  );

  const renderer = useRef<LiquidSceneHandle>(null);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React to press/release flips: spring (animated) or snap (reduced
  // motion / off-screen — where `targetW`/`targetH` already equal the
  // resting size, so the snap is a no-op).
  const prevGeometryPressed = useRef(geometryPressed);
  useEffect(() => {
    if (prevGeometryPressed.current !== geometryPressed) {
      const targets = [targetW, targetH];
      if (animating) {
        springs.setTargets(targets, DEFAULT_SPRING);
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
      } else {
        springs.snapTo(targets);
      }
    }
    prevGeometryPressed.current = geometryPressed;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryPressed, animating]);

  // The settle loop mutates the DOM behind React's back; whenever it isn't
  // running (settled, reduced motion, off-screen) resync the declarative
  // static scene so prop/state changes always win.
  useEffect(() => {
    if (!(animating && settling)) renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    renderer.current?.setScene(
      buildJellyScene(
        springs.values[0].get(),
        springs.values[1].get(),
        cx,
        cy,
        resolved.specular ? sceneLight : null
      )
    );
  });

  function press() {
    if (disabled) return;
    setPressed(true);
  }
  function release() {
    if (disabled) return;
    setPressed(false);
  }

  const buttonStyle: CSSProperties = {
    position: "relative",
    width,
    height,
    border: "none",
    padding: 0,
    margin: 0,
    background: "transparent",
    font: "inherit",
    color: "inherit",
    cursor: disabled ? "default" : "pointer",
    opacity: prefersReducedMotion && pressed ? 0.85 : 1,
    ...style,
  };

  const labelStyle: CSSProperties = {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
  };

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={className}
      style={buttonStyle}
      data-fluidkit="jelly-button"
      data-animating={animating && settling}
      data-pressed={pressed}
      onPointerDown={(e) => {
        press();
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        release();
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        release();
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        release();
        onPointerLeave?.(e);
      }}
      onKeyDown={(e) => {
        if (!e.repeat && ACTIVATION_KEYS.has(e.key)) press();
        onKeyDown?.(e);
      }}
      onKeyUp={(e) => {
        if (ACTIVATION_KEYS.has(e.key)) release();
        onKeyUp?.(e);
      }}
      onBlur={(e) => {
        release();
        onBlur?.(e);
      }}
      {...rest}
    >
      {refractionDefs}
      <LiquidRenderer
        ref={renderer}
        path={staticScene.path}
        material={resolved}
        speculars={staticScene.speculars}
        specularSlots={resolved.specular && sceneLight ? 1 : 0}
        shadow
      >
        <span data-fluidkit="jelly-label" style={labelStyle}>
          {children}
        </span>
      </LiquidRenderer>
    </button>
  );
}
