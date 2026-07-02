/**
 * Opt-in refraction for glass surfaces (the kube.io liquid-glass technique):
 * an SVG displacement filter referenced from `backdrop-filter`, so the
 * backdrop bends at the surface's rim like it would through thick glass.
 *
 * The displacement map is a static data-URI SVG: red encodes X displacement,
 * green encodes Y, and a radial overlay holds the CENTER at neutral gray so
 * only the rim lenses. `feDisplacementMap` inside `backdrop-filter` is
 * effectively Chromium-only today, so everything gates on
 * `supportsRefraction()` and silently degrades to plain glass blur.
 *
 * Constraints honored: the filter applies to the material FILL child (the
 * clip-path stays on its wrapper); the defs carrier svg has explicit 0x0
 * dimensions; no CSS blur() is involved anywhere.
 */

import type { ReactNode } from "react";
import { useId, useMemo } from "react";
import { supportsRefraction } from "../utils/featureDetect";

/** Displacement strength in px at the rim. */
const REFRACTION_SCALE = 24;
/** Fraction of the radius that stays optically flat (no displacement). */
const NEUTRAL_CORE = 0.68;

/** Neutral gray for a displacement map: R=G=128 → zero displacement. */
const NEUTRAL = "#808000";

/**
 * Pure: data-URI SVG displacement map for a `width`x`height` scene.
 * Red ramps across X, green across Y (screen-composited so the channels
 * stay independent); a radial neutral core limits lensing to the rim.
 */
export function displacementMapUri(width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs>` +
    `<linearGradient id="rx" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#ff0000"/>` +
    `<stop offset="1" stop-color="#000000"/>` +
    `</linearGradient>` +
    `<linearGradient id="gy" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#00ff00"/>` +
    `<stop offset="1" stop-color="#000000"/>` +
    `</linearGradient>` +
    `<radialGradient id="core" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${NEUTRAL}" stop-opacity="1"/>` +
    `<stop offset="${NEUTRAL_CORE}" stop-color="${NEUTRAL}" stop-opacity="1"/>` +
    `<stop offset="1" stop-color="${NEUTRAL}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#rx)"/>` +
    `<rect width="100%" height="100%" fill="url(#gy)" style="mix-blend-mode:screen"/>` +
    `<rect width="100%" height="100%" fill="url(#core)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export interface RefractionDef {
  /** `url(#id)` for the glass backdrop chain, or null (off / unsupported). */
  url: string | null;
  /** Hidden defs svg to render inside the component, or null. */
  defs: ReactNode;
}

/**
 * Per-instance refraction filter. Returns the `url(#id)` to hand to
 * `resolveMaterial({ refractionUrl })` and the hidden `<svg>` defs node the
 * component must render. Both are null when disabled or unsupported.
 */
export function useRefraction(
  enabled: boolean,
  width: number,
  height: number
): RefractionDef {
  // useId emits ":r0:"-style ids; colons don't survive url(#...) in CSS.
  const id = `fluidkit-refract-${useId().replace(/:/g, "")}`;
  // Detection is a guarded pure function (never throws, false in SSR), so
  // calling it during render is safe.
  const active = enabled && supportsRefraction();

  return useMemo<RefractionDef>(() => {
    if (!active) return { url: null, defs: null };
    return {
      url: `url(#${id})`,
      defs: (
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          focusable="false"
          style={{ position: "absolute" }}
        >
          <defs>
            <filter
              id={id}
              x="0"
              y="0"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={displacementMapUri(width, height)}
                x="0"
                y="0"
                width={width}
                height={height}
                preserveAspectRatio="none"
                result="map"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={REFRACTION_SCALE}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      ),
    };
  }, [active, id, width, height]);
}
