/**
 * Shared border lighting for the base surface family (LiquidCard,
 * MeniscusDivider, …), two layers over the same rounded-rect geometry:
 * - a crisp 1px rim ring (gradient fill masked to the border band),
 *   brightest on the side facing the scene light and fading as it wraps
 *   away — the CSS gradient angle points AWAY from the light so the
 *   bright first stop sits on the light-facing edge;
 * - a soft inset glow hugging the whole inside of the border, so the
 *   lighting reads all the way around, not just as a hairline. The blur
 *   scales down with the surface height so thin beads aren't flooded.
 *
 * Painted as CSS (mask-ring + inset shadow) rather than engine speculars
 * — the renderer's white radial ellipses can't hold a crisp 1px line.
 * Safe only on STATIC rounded-rect surfaces, where the ring and the
 * engine clip path can never disagree.
 */

import type { CSSProperties } from "react";
import type { Vec } from "../liquid";

export function rimGlowStyle(
  w: number,
  h: number,
  radius: number,
  intensity: number
): CSSProperties {
  const blur = Math.min(10, Math.max(2, h * 0.75));
  return {
    position: "absolute",
    inset: 0,
    borderRadius: Math.min(radius, h / 2, w / 2),
    boxShadow: `inset 0 0 ${blur}px rgba(255,255,255,${(0.45 * intensity).toFixed(3)})`,
    pointerEvents: "none",
  };
}

export function rimStyle(
  w: number,
  h: number,
  radius: number,
  light: Vec,
  intensity: number
): CSSProperties {
  const angle =
    (Math.atan2(w / 2 - light.x, light.y - h / 2) * 180) / Math.PI;
  const ring = "linear-gradient(#fff 0 0)";
  return {
    position: "absolute",
    inset: 0,
    borderRadius: Math.min(radius, h / 2, w / 2),
    padding: 1,
    background: `linear-gradient(${angle.toFixed(1)}deg, rgba(255,255,255,${(
      0.9 * intensity
    ).toFixed(3)}), rgba(255,255,255,${(0.25 * intensity).toFixed(3)}))`,
    WebkitMask: `${ring} content-box, ${ring}`,
    WebkitMaskComposite: "xor",
    mask: `${ring} content-box exclude, ${ring}`,
    pointerEvents: "none",
  };
}
