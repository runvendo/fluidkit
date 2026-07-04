/**
 * The surface style pack: the one styling contract every fluidkit surface
 * speaks. A consumer who learns `tint` on one component can use it on all
 * of them — same names, same types, same scales, same meanings. Components
 * extend this interface and `Omit<>` only the props that physically can't
 * apply to them (e.g. a component whose lighting is a sheen sweep, not the
 * scene light). Defaults live in each component so today's rendering is
 * preserved exactly.
 */

import type { LiquidMaterial, Vec } from "../liquid";
import type { LiquidIntensity } from "./intensity";

export interface SurfaceStyleProps {
  /** Rendered material: clear glass or a flat fill. Defaults to `"glass"`. */
  material?: LiquidMaterial;
  /** Glass tint (any CSS color, normally translucent). */
  tint?: string;
  /** Fill for the `flat` material (any CSS color). */
  color?: string;
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"`
   * (0.35) / `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidIntensity;
  /** Scene light in component coordinates; null disables speculars. */
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
