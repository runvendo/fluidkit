/**
 * A divider rule rendered as a bead of liquid: a thin full-width pill of
 * engine geometry resting on the page, lifted by the renderer's shadow.
 * On glass the bead is lit like LiquidCard — the shared rim ring + inset
 * glow wrap the whole border, brightest toward the scene light, plus one
 * glint on the stretch facing it (the same single light source as every
 * other surface). Flat stays unlit per the house material
 * rule — there the pill profile and shadow carry the read.
 *
 * Static like LiquidCard: the bead spans whatever width its container
 * gives it, a ResizeObserver rebuilds the geometry on layout changes, and
 * there is no animation loop — nothing here moves, so reduced motion
 * needs no branch. Exposed as `role="separator"` for assistive tech.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  useRefraction,
} from "../liquid";
import type { SpecularSpot, Vec } from "../liquid";
import { resolveIntensity } from "./intensity";
import { rimGlowStyle, rimStyle } from "./rim";
import type { SurfaceStyleProps } from "./surface";

export interface MeniscusDividerProps
  extends SurfaceStyleProps,
    HTMLAttributes<HTMLDivElement> {
  /** Bead height in px. Defaults to `4`. */
  thickness?: number;
}

function buildBeadScene(
  w: number,
  thickness: number,
  light: Vec | null,
  intensity: number
): { path: string; speculars: SpecularSpot[] } {
  const cy = thickness / 2;
  const path = roundRectPath({ x: w / 2, y: cy }, w, thickness, cy);
  const speculars: SpecularSpot[] = [];
  if (light && intensity > 0) {
    // The glint hugs the top of the bead on the stretch nearest the light,
    // clamped inside the rounded ends.
    const rx = w * (0.1 + 0.12 * intensity);
    const cx = Math.min(Math.max(light.x, cy + rx * 0.5), w - cy - rx * 0.5);
    speculars.push({
      cx,
      cy: cy * 0.7,
      rx,
      ry: thickness * 0.28,
      rotate: 0,
      opacity: 0.9 * intensity,
    });
  }
  return { path, speculars };
}

export function MeniscusDivider({
  material = "glass",
  tint,
  color,
  thickness = 4,
  intensity = "whisper",
  light,
  reflection = true,
  refraction = false,
  shadow = true,
  className,
  style,
  ...rest
}: MeniscusDividerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setWidth((prev) => {
        const w = Math.round(el.offsetWidth);
        return prev === w ? prev : w;
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { url: refractionUrl, defs: refractionDefs } = useRefraction(
    refraction && material === "glass",
    width ?? 0,
    thickness
  );
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color, refractionUrl }),
    [material, tint, color, refractionUrl]
  );
  const volume = resolveIntensity(intensity);

  const sceneLight = useMemo(() => {
    if (!reflection || light === null || !width) return null;
    return light ?? defaultLight(width, thickness);
  }, [reflection, light, width, thickness]);

  const scene = useMemo(
    () =>
      width
        ? buildBeadScene(
            width,
            thickness,
            resolved.specular ? sceneLight : null,
            volume
          )
        : null,
    [width, thickness, resolved.specular, sceneLight, volume]
  );

  const dividerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: thickness,
    ...style,
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="horizontal"
      className={className}
      style={dividerStyle}
      data-fluidkit="meniscus-divider"
      {...rest}
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
      {width && resolved.specular && sceneLight && volume > 0 && (
        <>
          <span
            data-fluidkit="meniscus-divider-glow"
            style={rimGlowStyle(width, thickness, thickness / 2, volume)}
          />
          <span
            data-fluidkit="meniscus-divider-rim"
            style={rimStyle(width, thickness, thickness / 2, sceneLight, volume)}
          />
        </>
      )}
    </div>
  );
}
