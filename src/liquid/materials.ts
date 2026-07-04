/**
 * Liquid materials. A material is a PROP, not a component family: the same
 * engine shape renders as clear glass, a flat fill, or a caustic-lit wall.
 *
 * - glass: white tint + backdrop blur/saturation, lit by the scene light.
 *   Degrades to a frosted flat fill when backdrop-filter is unsupported.
 * - flat: plain color, unlit — the shape and motion carry the liquid read;
 *   also the reduced/fallback rendering.
 * - caustics: plaster wall lit by drifting caustic light ("poolside
 *   light"). The CSS fill here is the wall AND the no-WebGL fallback; the
 *   moving light itself is the renderer-mounted `CausticsLayer`.
 */

import type { CSSProperties } from "react";
import { supportsBackdropFilter } from "../utils/featureDetect";

export type LiquidMaterial = "glass" | "flat" | "caustics";

export interface ResolveMaterialOptions {
  /** Glass tint (any CSS color, normally translucent white). */
  tint?: string;
  /** Fill for the `flat` material. */
  color?: string;
  /**
   * `url(#id)` of a refraction displacement filter (from `useRefraction`,
   * already gated on `supportsRefraction()`) prepended to the glass
   * backdrop chain. Null/undefined renders plain glass blur.
   */
  refractionUrl?: string | null;
  /**
   * Blur radius override (px) for the glass backdrop chain, replacing the
   * shared radius (16, or 8 when refracting). For surfaces where the shared
   * frost is too heavy — e.g. glyph-masked text — while keeping the rest of
   * the recipe (tint, saturation, compositor hint) shared.
   */
  blurPx?: number;
}

export interface ResolvedMaterial {
  /** What actually renders (glass may degrade to flat). */
  kind: LiquidMaterial;
  fillStyle: CSSProperties;
  /** Whether specular highlights should be painted. */
  specular: boolean;
  /** Present when kind === "caustics": parameters for the engine's light layer. */
  caustics?: { light: string };
}

const GLASS_TINT = "rgba(255,255,255,0.3)";
const GLASS_BLUR_PX = 16;
/** Refracting glass frosts less, so the lensing stays legible. */
const GLASS_BLUR_PX_REFRACT = 8;
const GLASS_SATURATE = "saturate(1.8)";
const GLASS_FALLBACK_FILL = "rgba(255,255,255,0.65)";
/** Warm white — the caustic light's default color. */
const CAUSTICS_LIGHT = "#fffdf7";
/** Soft plaster wall — also the SSR / no-WebGL rendering. */
const CAUSTICS_WALL = "linear-gradient(180deg, #f8f8f5, #eceeef)";

export function resolveMaterial(
  material: LiquidMaterial,
  options: ResolveMaterialOptions = {}
): ResolvedMaterial {
  if (material === "glass") {
    if (!supportsBackdropFilter()) {
      return {
        kind: "flat",
        fillStyle: { background: options.tint ?? GLASS_FALLBACK_FILL },
        specular: true,
      };
    }
    const blur = `blur(${
      options.blurPx ??
      (options.refractionUrl ? GLASS_BLUR_PX_REFRACT : GLASS_BLUR_PX)
    }px)`;
    const backdrop = options.refractionUrl
      ? `${options.refractionUrl} ${blur} ${GLASS_SATURATE}`
      : `${blur} ${GLASS_SATURATE}`;
    return {
      kind: "glass",
      fillStyle: {
        background: options.tint ?? GLASS_TINT,
        backdropFilter: backdrop,
        WebkitBackdropFilter: backdrop,
        // Keep the fill on its own GPU layer even while still: without a
        // hint Chromium evicts the backdrop-filter layer after a couple
        // of idle seconds, and the next appear/geometry change paints an
        // unblurred frame while it re-rasterizes.
        willChange: "transform",
      },
      specular: true,
    };
  }
  if (material === "caustics") {
    return {
      kind: "caustics",
      // The CSS base IS the fallback: without WebGL the surface is simply
      // a plaster wall with no moving light. Never a black box.
      fillStyle: { background: options.color ?? CAUSTICS_WALL },
      // The caustic light is the highlight; painting glass speculars on
      // top would double the light sources (house rule: one light).
      specular: false,
      caustics: { light: options.tint ?? CAUSTICS_LIGHT },
    };
  }
  return {
    kind: "flat",
    fillStyle: { background: options.color ?? "currentColor" },
    specular: false,
  };
}
