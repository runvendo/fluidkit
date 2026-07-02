/**
 * Specular highlight placement for glass bodies.
 *
 * All highlights in a scene come from ONE light source so reflections agree
 * on where the light is: each body's highlight sits on the side facing the
 * light, oriented tangent to the surface at that point. Soft falloff comes
 * from a radial-gradient fill (never a CSS blur filter — Chromium clips
 * blur's rectangular filter region into visible straight seams).
 */

import type { Vec } from "./geometry";

export interface SpecularSpot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Degrees. Major axis runs tangent to the surface. */
  rotate: number;
  opacity: number;
}

/** Default scene light: above the stage, 30% in from the left. */
export function defaultLight(width: number, _height: number): Vec {
  return { x: width * 0.3, y: -40 };
}

export function specularPlacement(
  body: Vec & { r: number },
  light: Vec,
  opacity = 0.7
): SpecularSpot {
  const angle = Math.atan2(light.y - body.y, light.x - body.x);
  return {
    cx: body.x + Math.cos(angle) * body.r * 0.52,
    cy: body.y + Math.sin(angle) * body.r * 0.52,
    rx: body.r * 0.42,
    ry: body.r * 0.2,
    rotate: (angle * 180) / Math.PI + 90,
    opacity,
  };
}
