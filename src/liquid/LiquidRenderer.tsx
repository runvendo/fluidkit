/**
 * Internal presentational renderer for one liquid scene.
 *
 * Layer stack (bottom → top), sized by an absolutely-filled container the
 * parent positions:
 *   1. shadow  — light offset/shrunk fill, blurred via a WRAPPER filter so
 *                the clip applies before the blur (soft shadow, and glass
 *                never backdrop-samples a heavy black behind itself)
 *   2. clip    — wrapper holding the clip-path; the material fill (possibly
 *                backdrop-filtered) is its CHILD (Chromium artifact when
 *                clip-path + backdrop-filter share an element)
 *   3. spec    — svg with EXPLICIT 100% width/height, clipped to the shape,
 *                radial-gradient ellipses (no blur filters)
 *   4. content — unclipped overlay; only ever cross-fades, never scales
 */

import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import type { ResolvedMaterial } from "./materials";
import type { SpecularSpot } from "./specular";

export interface LiquidRendererProps {
  /** Concatenated SVG subpaths for `clip-path: path(...)`. */
  path: string;
  material: ResolvedMaterial;
  speculars?: SpecularSpot[];
  shadow?: boolean;
  children?: ReactNode;
}

const layer: CSSProperties = { position: "absolute", inset: 0 };
const fmtDeg = (n: number) => n.toFixed(1);

export function LiquidRenderer({
  path,
  material,
  speculars = [],
  shadow = false,
  children,
}: LiquidRendererProps) {
  const gradientId = useId();
  const clipPath = `path('${path}')`;
  const showSpec = material.specular && speculars.length > 0;

  return (
    <>
      {shadow && (
        <div
          style={{
            ...layer,
            filter: "blur(14px)",
            transform: "translateY(16px) scale(0.97)",
          }}
          aria-hidden
        >
          <div
            data-fluidkit="liquid-shadow"
            style={{ ...layer, background: "rgba(46,44,72,0.16)", clipPath }}
          />
        </div>
      )}
      <div data-fluidkit="liquid-clip" style={{ ...layer, clipPath }}>
        <div
          data-fluidkit="liquid-fill"
          style={{ ...layer, ...material.fillStyle }}
        />
      </div>
      {showSpec && (
        <svg
          data-fluidkit="liquid-spec"
          width="100%"
          height="100%"
          style={{ ...layer, clipPath, pointerEvents: "none" }}
          aria-hidden
        >
          <defs>
            <radialGradient id={gradientId}>
              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          {speculars.map((s, i) => (
            <ellipse
              key={i}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              transform={`rotate(${fmtDeg(s.rotate)} ${s.cx} ${s.cy})`}
              fill={`url(#${gradientId})`}
              opacity={s.opacity}
            />
          ))}
        </svg>
      )}
      {children != null && (
        <div data-fluidkit="liquid-content" style={{ ...layer }}>
          {children}
        </div>
      )}
    </>
  );
}
