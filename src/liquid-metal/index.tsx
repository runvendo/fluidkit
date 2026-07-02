/**
 * `LiquidMetal` wraps `@paper-design/shaders-react`'s `LiquidMetal` WebGL
 * shader (pinned exact `0.0.76` — the package ships breaking changes across
 * 0.0.x releases) with the fluidkit wrapper contract: capability + motion
 * gating, off-screen pausing, and fluidkit-consistent prop names.
 *
 * Prop mapping (fluidkit prop -> shader prop, verified against the
 * installed `@paper-design/shaders-react@0.0.76` API):
 * - `color` -> `colorTint` (the metal highlight/overlay color)
 * - `backgroundColor` -> `colorBack` (the base color behind the metal)
 * - `speed` -> `speed` (1:1, clamped with the shared `MIN_SPEED` floor)
 * - `intensity` -> `distortion` (0-1 noise distortion over the stripe
 *   pattern — the closest analog the shader exposes to an overall "how
 *   pronounced is the effect" knob; the upstream API has no prop literally
 *   named `intensity`)
 *
 * Defaults for `color`/`backgroundColor`/`intensity` mirror the shader's
 * own `defaultPreset` (`colorTint: "#ffffff"`, `colorBack: "#AAAAAC"`,
 * `distortion: 0.07`), so fluidkit's defaults render identically to the
 * upstream default look.
 *
 * `shaderProps` is an escape hatch: raw props forwarded directly to the
 * underlying `@paper-design/shaders-react` `LiquidMetal` shader (its own
 * `LiquidMetalProps`), applied AFTER the mapped props above, so any key set
 * there wins (e.g. `shaderProps={{ shape: "circle", repetition: 4 }}`).
 * Two exceptions:
 * - `style` is merged (not replaced) with the fill-parent default so the
 *   shader keeps sizing to its wrapper even if `shaderProps.style` only
 *   sets unrelated properties.
 * - `speed` wins over the mapped `speed` prop only while the component is
 *   in view — the off-screen pause gate (speed forced to `0`) always takes
 *   precedence, so `shaderProps.speed` can never keep the shader animating
 *   while scrolled out of view.
 *
 * Gating: renders a static metallic-gradient fallback (`data-fallback`,
 * shader never mounted) when `supportsWebGL()` is false or the user
 * prefers reduced motion — a WebGL sim never boots in either case.
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
  type LiquidMetalProps as LiquidMetalShaderProps,
} from "@paper-design/shaders-react";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import { MIN_SPEED } from "../utils/constants";
import { supportsWebGL } from "../utils/featureDetect";

export interface LiquidMetalProps extends HTMLAttributes<HTMLDivElement> {
  /** Metal highlight/overlay color. Maps to the shader's `colorTint`. Defaults to `"#ffffff"` (the shader's own default). */
  color?: string;
  /** Base color behind the metal. Maps to the shader's `colorBack`. Defaults to `"#AAAAAC"` (the shader's own default). */
  backgroundColor?: string;
  /** Animation speed multiplier, forwarded 1:1 to the shader's `speed`. Defaults to `1`, clamped with the shared `MIN_SPEED` floor. */
  speed?: number;
  /** Effect strength, maps to the shader's `distortion` (0-1). Defaults to `0.07` (the shader's own default). */
  intensity?: number;
  /**
   * Escape hatch: raw props forwarded directly to the underlying
   * `@paper-design/shaders-react` `LiquidMetal` shader, applied AFTER the
   * mapped props above (so any key here wins over `color`/`backgroundColor`/
   * `speed`/`intensity` — except that the off-screen pause gate always wins
   * over `speed`: while out of view the shader runs at speed `0` regardless).
   * Advanced/unstable — the upstream shader is pinned to `0.0.76` and its
   * param set may change between versions.
   */
  shaderProps?: Partial<LiquidMetalShaderProps>;
}

/** Mirrors the shader's own `defaultPreset.params.colorTint`. */
const DEFAULT_TINT = "#ffffff";
/** Mirrors the shader's own `defaultPreset.params.colorBack`. */
const DEFAULT_BACK = "#AAAAAC";
/** Mirrors the shader's own `defaultPreset.params.distortion`. */
const DEFAULT_INTENSITY = 0.07;

/**
 * Optional GPU tier (`fluidkit/liquid-metal`): a real WebGL liquid-metal
 * shader with fluidkit's capability + motion gating and off-screen pausing.
 * No WebGL or reduced motion renders a static metallic-gradient fallback;
 * the shader never mounts. See the file doc for details.
 */
export function LiquidMetal({
  color,
  backgroundColor,
  speed = 1,
  intensity = DEFAULT_INTENSITY,
  shaderProps,
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

  const resolvedTint = resolveColor(color, DEFAULT_TINT);
  const resolvedBack = resolveColor(backgroundColor, DEFAULT_BACK);

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
            // Restrained metallic sheen using the same tint/back colors the
            // live shader would use — silvers/greys consistent with the
            // library's mercury material aesthetic.
            background: `linear-gradient(135deg, ${resolvedBack}, ${resolvedTint}, ${resolvedBack})`,
          }}
        />
      ) : (
        <LiquidMetalShader
          colorTint={resolvedTint}
          colorBack={resolvedBack}
          distortion={intensity}
          {...shaderProps}
          // After the spread on purpose: the off-screen pause gate must
          // always win, or a consumer-supplied shaderProps.speed would
          // silently keep the shader's rAF loop running while scrolled out
          // of view. While in view, shaderProps.speed still wins over the
          // mapped speed prop.
          speed={inView ? (shaderProps?.speed ?? clampedSpeed) : 0}
          style={{ ...fillStyle, ...shaderProps?.style }}
        />
      )}
    </div>
  );
}
