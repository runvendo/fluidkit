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
}

export interface ResolvedMaterial {
  /** What actually renders (glass may degrade to flat). */
  kind: LiquidMaterial;
  fillStyle: CSSProperties;
  /** Whether specular highlights should be painted. */
  specular: boolean;
}

const GLASS_TINT = "rgba(255,255,255,0.3)";
const GLASS_BACKDROP = "blur(16px) saturate(1.8)";
/** Refracting glass frosts less, so the lensing stays legible. */
const GLASS_BACKDROP_REFRACT = "blur(8px) saturate(1.8)";
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
    const backdrop = options.refractionUrl
      ? `${options.refractionUrl} ${GLASS_BACKDROP_REFRACT}`
      : GLASS_BACKDROP;
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
