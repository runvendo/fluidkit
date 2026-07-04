/**
 * A content-bearing liquid surface — the base card of the family. Unlike
 * the fixed-size engine components, the card SIZES TO ITS CONTENT: children
 * live in normal flow (with padding) and a ResizeObserver rebuilds the
 * liquid geometry to match, so the surface is a painted backdrop layer
 * BEHIND the content, never a clipped parent of it. Text sits above the
 * engine subtree by construction — it can never scale or distort.
 *
 * The material volume is a continuous `intensity` (0–1), with "whisper"
 * and "present" as named presets. It drives two lights fed by the same
 * scene light source:
 * - a body sheen (engine specular ellipse) on the light-facing side, and
 * - a RIM LIGHT: a 1px gradient ring around the whole border, brightest
 *   where the border faces the light and fading as it wraps away — the
 *   meniscus line where liquid meets its container. Painted as a CSS
 *   mask-ring (the engine's white radial speculars can't hold a crisp
 *   1px line), which is safe here because the card is a static rounded
 *   rect — the ring and the clip path can never disagree.
 *
 * `variant` tints the surface for callout use (info/success/warning): the
 * accent arrives through the glass tint (or a solid pastel on flat), never
 * a fake gradient. The card is static — no animation loop, no reduced-
 * motion branch needed — so it costs one measure effect and a memo.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
  useRefraction,
} from "../liquid";
import type { LiquidMaterial, SpecularSpot, Vec } from "../liquid";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { rimGlowStyle, rimStyle } from "./rim";

/** Material volume: 0–1, or a named preset. */
export type LiquidCardIntensity = LiquidIntensity;
export type LiquidCardVariant = "default" | "info" | "success" | "warning";

export interface LiquidCardProps extends HTMLAttributes<HTMLDivElement> {
  material?: LiquidMaterial;
  /** Glass tint override; `variant` supplies one when omitted. */
  tint?: string;
  /** Flat fill override; `variant` supplies one when omitted. */
  color?: string;
  /** Accent preset for callout cards. Defaults to `"default"` (no accent). */
  variant?: LiquidCardVariant;
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"`
   * (0.35) / `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidCardIntensity;
  /** Corner radius in px. Defaults to `20`. */
  radius?: number;
  /** Content padding in px. Defaults to `20`. */
  padding?: number;
  /** Scene light in card coordinates; null disables speculars. */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /**
   * Edge lensing on glass via an SVG displacement filter inside
   * `backdrop-filter` (Chromium-only; silently degrades to plain glass
   * blur elsewhere). Defaults to `false`.
   */
  refraction?: boolean;
  /** Drop shadow under the surface. Defaults to `true`. */
  shadow?: boolean;
}

/** Accent tints: translucent for glass, solid pastel for flat. */
const VARIANT_FILLS: Record<
  Exclude<LiquidCardVariant, "default">,
  { tint: string; color: string }
> = {
  info: { tint: "rgba(96, 149, 255, 0.20)", color: "#dfe9fb" },
  success: { tint: "rgba(60, 190, 120, 0.18)", color: "#dff3e7" },
  warning: { tint: "rgba(255, 176, 66, 0.20)", color: "#fbeedb" },
};

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildCardScene(
  w: number,
  h: number,
  radius: number,
  light: Vec | null,
  intensity: number
): Scene {
  const rad = Math.min(radius, h / 2, w / 2);
  const path = roundRectPath({ x: w / 2, y: h / 2 }, w, h, rad);
  const speculars: SpecularSpot[] = [];
  if (light) {
    speculars.push(
      specularPlacement(
        { x: w / 2, y: h / 2, r: Math.min(w, h) * 0.48 },
        light,
        0.4 * intensity
      )
    );
  }
  return { path, speculars };
}

export function LiquidCard({
  material = "glass",
  tint,
  color,
  variant = "default",
  intensity = "whisper",
  radius = 20,
  padding = 20,
  light,
  reflection = true,
  refraction = false,
  shadow = true,
  children,
  className,
  style,
  ...rest
}: LiquidCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // The surface follows content: measure the border box and rebuild the
  // geometry whenever layout changes. Rounded to whole px so text reflow
  // sub-pixel jitter doesn't churn the clip path.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) => {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const accent = variant !== "default" ? VARIANT_FILLS[variant] : undefined;
  const { url: refractionUrl, defs: refractionDefs } = useRefraction(
    refraction && material === "glass",
    size?.w ?? 0,
    size?.h ?? 0
  );
  const resolved = useMemo(
    () =>
      resolveMaterial(material, {
        tint: tint ?? accent?.tint,
        color: color ?? accent?.color,
        refractionUrl,
      }),
    [material, tint, color, accent, refractionUrl]
  );

  const sceneLight = useMemo(() => {
    if (!reflection || light === null || !size) return null;
    return light ?? defaultLight(size.w, size.h);
  }, [reflection, light, size]);

  const volume = resolveIntensity(intensity);
  const scene = useMemo(
    () =>
      size
        ? buildCardScene(
            size.w,
            size.h,
            radius,
            resolved.specular ? sceneLight : null,
            volume
          )
        : null,
    [size, radius, resolved.specular, sceneLight, volume]
  );

  const cardStyle: CSSProperties = {
    position: "relative",
    padding,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={cardStyle}
      data-fluidkit="liquid-card"
      data-variant={variant}
      data-intensity={intensity}
      {...rest}
    >
      {/* Surface backdrop: fills the card box behind the content. */}
      <span
        aria-hidden="true"
        data-fluidkit="liquid-card-surface"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          pointerEvents: "none",
        }}
      >
        {refractionDefs}
        {scene && (
          <LiquidRenderer
            path={scene.path}
            material={resolved}
            speculars={scene.speculars}
            shadow={shadow}
          />
        )}
        {size && resolved.specular && sceneLight && volume > 0 && (
          <>
            <span
              data-fluidkit="liquid-card-glow"
              style={rimGlowStyle(size.w, size.h, radius, volume)}
            />
            <span
              data-fluidkit="liquid-card-rim"
              style={rimStyle(size.w, size.h, radius, sceneLight, volume)}
            />
          </>
        )}
      </span>
      <div data-fluidkit="liquid-card-content" style={{ position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
