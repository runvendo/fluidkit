/**
 * `LiquidMetal` wraps `@paper-design/shaders-react`'s `LiquidMetal` WebGL
 * shader (pinned exact `0.0.76` — the package ships breaking changes across
 * 0.0.x releases) with the fluidkit wrapper contract: capability + motion
 * gating, off-screen pausing, and a fill-parent wrapper div.
 *
 * API: a direct passthrough. `LiquidMetalProps` extends the shader's own
 * param surface (`LiquidMetalParams` from `@paper-design/shaders`, re-exported
 * by the react package: colors, stripe pattern, dispersion, shape/image mask,
 * sizing, speed), so every knob the shader exposes is a top-level prop here —
 * no renamed aliases, no escape hatch object. Two fluidkit touches on top:
 * - `colorBack`/`colorTint` run through `resolveColor`, so CSS custom
 *   properties (`"var(--brand)"`) work like they do everywhere else in
 *   fluidkit.
 * - `speed` is clamped with the shared `MIN_SPEED` floor and forced to `0`
 *   while the component is out of view (see below) — the pause gate always
 *   wins, so no prop combination can keep the shader animating off-screen.
 *
 * Defaults: the shader's own `defaultPreset` renders a small floating
 * diamond — an object, not a backdrop. fluidkit instead defaults to the
 * upstream `fullScreenPreset` ("Backdrop") params, verified against the
 * installed `0.0.76` bundle: `shape: "none"` with `scale: 1` fills the whole
 * canvas with the flowing metal pattern. Consumers get a wall of liquid
 * metal by default and can pass `shape`/`image` to mask it back down to an
 * object when they want one. Undefined props never override these defaults —
 * params are pruned of `undefined` before spreading, because the shader
 * component treats an explicitly-passed `undefined` the same as a set value
 * when merging against its own preset.
 *
 * Gating: renders a static metallic-gradient fallback (`data-fallback`,
 * shader never mounted) when `supportsWebGL()` is false or the user
 * prefers reduced motion — a WebGL context is never created in either case.
 * `supportsWebGL()` is read once per mount (lazy `useState` initializer),
 * never at module import time or on every render.
 *
 * Off-screen pausing: the shader stays mounted while merely out of view —
 * tearing down and recreating a WebGL context/resize-observer on every
 * scroll is more expensive than leaving it parked — but its `speed` prop is
 * forced to `0`. Per `ShaderMount`'s own implementation, `speed=0` stops
 * its internal rAF loop entirely, so this is a true pause (no recurring
 * per-frame cost), not just a frozen-looking animation.
 *
 * SSR: verified against the installed `0.0.76` package that
 * `@paper-design/shaders-react`'s `shader-mount.js` (a `"use client"`
 * module) only touches `window`/`document` inside `useEffect` bodies and
 * event handlers — no top-level module access. A plain static import is
 * therefore SSR-safe; no lazy/dynamic import is needed here.
 *
 * Known limitations (upstream, out of our hands at 0.0.76): `ShaderMount`
 * registers no `webglcontextlost`/`webglcontextrestored` handlers, so if
 * the browser evicts the WebGL context at runtime (GPU pressure, tab
 * backgrounding on some platforms) the canvas goes blank until the
 * component remounts. `supportsWebGL()` gates boot-time capability only —
 * it cannot protect against a context lost after mount.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useState } from "react";
import {
  LiquidMetal as LiquidMetalShader,
  type LiquidMetalParams,
} from "@paper-design/shaders-react";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import { MIN_SPEED } from "../utils/constants";
import { supportsWebGL } from "../utils/supportsWebGL";

export interface LiquidMetalProps
  extends HTMLAttributes<HTMLDivElement>,
    LiquidMetalParams {}

/**
 * Mirrors the shader's own `fullScreenPreset` ("Backdrop") params, minus the
 * sizing keys whose upstream defaults already match. `shape: "none"` +
 * `scale: 1` is what makes the pattern fill the canvas instead of rendering
 * the default preset's small floating diamond.
 */
const BACKDROP_DEFAULTS = {
  colorBack: "#AAAAAC",
  colorTint: "#ffffff",
  softness: 0.05,
  repetition: 1.5,
  shiftRed: 0.3,
  shiftBlue: 0.3,
  distortion: 0.1,
  contour: 0.4,
  angle: 90,
  shape: "none",
  scale: 1,
  worldWidth: 0,
  worldHeight: 0,
} satisfies LiquidMetalParams;

/** Shallow copy of `params` with `undefined` entries removed, so an unset prop falls through to `BACKDROP_DEFAULTS` instead of overriding it. */
function definedParams(params: LiquidMetalParams): LiquidMetalParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  ) as LiquidMetalParams;
}

export function LiquidMetal({
  colorBack,
  colorTint,
  image,
  repetition,
  shiftRed,
  shiftBlue,
  contour,
  softness,
  distortion,
  angle,
  shape,
  fit,
  scale,
  rotation,
  originX,
  originY,
  offsetX,
  offsetY,
  worldWidth,
  worldHeight,
  speed = 1,
  frame,
  className,
  style,
  ...rest
}: LiquidMetalProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Read once per mount, not at module import time (SSR-safe) and not on
  // every render (avoids repeated canvas-probe work) — capability doesn't
  // change over a mounted component's lifetime.
  const [webglSupported] = useState(() => supportsWebGL());
  const { ref, inView } = useInView<HTMLDivElement>();

  const degraded = !webglSupported || prefersReducedMotion;
  const animating = !degraded && inView;
  const clampedSpeed = Math.max(speed, MIN_SPEED);

  const resolvedBack = resolveColor(colorBack, BACKDROP_DEFAULTS.colorBack);
  const resolvedTint = resolveColor(colorTint, BACKDROP_DEFAULTS.colorTint);

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    ...style,
  };

  const fillStyle: CSSProperties = { width: "100%", height: "100%" };

  return (
    <div
      ref={ref}
      data-fluidkit="liquid-metal"
      data-animating={animating}
      data-fallback={degraded}
      aria-hidden="true"
      className={className}
      style={wrapperStyle}
      {...rest}
    >
      {degraded ? (
        <div
          data-fluidkit="liquid-metal-fallback"
          style={{
            ...fillStyle,
            // Restrained metallic sheen using the same back/tint colors the
            // live shader would use — a static stand-in, not a blank div.
            background: `linear-gradient(135deg, ${resolvedBack}, ${resolvedTint}, ${resolvedBack})`,
          }}
        />
      ) : (
        <LiquidMetalShader
          {...BACKDROP_DEFAULTS}
          {...definedParams({
            colorBack: resolvedBack,
            colorTint: resolvedTint,
            image,
            repetition,
            shiftRed,
            shiftBlue,
            contour,
            softness,
            distortion,
            angle,
            shape,
            fit,
            scale,
            rotation,
            originX,
            originY,
            offsetX,
            offsetY,
            worldWidth,
            worldHeight,
            frame,
          })}
          // After the spreads on purpose: the off-screen pause gate must
          // always win — no prop can keep the shader's rAF loop running
          // while scrolled out of view.
          speed={inView ? clampedSpeed : 0}
          style={fillStyle}
        />
      )}
    </div>
  );
}
