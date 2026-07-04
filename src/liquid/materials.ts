/**
 * Liquid materials. A material is a PROP, not a component family: the same
 * engine shape renders as clear glass or a flat fill.
 *
 * - glass: white tint + backdrop blur/saturation, lit by the scene light.
 *   Degrades to a frosted flat fill when backdrop-filter is unsupported.
 * - flat: plain color, unlit — the shape and motion carry the liquid read;
 *   also the reduced/fallback rendering.
 */

import type { CSSProperties } from "react";
import { supportsBackdropFilter } from "../utils/featureDetect";

export type LiquidMaterial = "glass" | "flat";

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
}

const GLASS_TINT = "rgba(255,255,255,0.3)";
const GLASS_BLUR_PX = 16;
/** Refracting glass frosts less, so the lensing stays legible. */
const GLASS_BLUR_PX_REFRACT = 8;
const GLASS_SATURATE = "saturate(1.8)";
const GLASS_FALLBACK_FILL = "rgba(255,255,255,0.65)";

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
  return {
    kind: "flat",
    fillStyle: { background: options.color ?? "currentColor" },
    specular: false,
  };
}
