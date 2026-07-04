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
 *                clip-path + backdrop-filter share an element). For the
 *                caustics material a `CausticsLayer` (WebGL light) mounts
 *                after the fill, clipped by the same wrapper.
 *   3. spec    — svg with EXPLICIT 100% width/height, clipped to the shape,
 *                radial-gradient ellipses (no blur filters)
 *   4. content — unclipped overlay; only ever cross-fades, never scales
 *
 * Animation loops drive the scene through the imperative `LiquidSceneHandle`
 * (via `ref`): per-frame clip-path strings and specular ellipse attributes
 * are written straight to the DOM nodes, so a 60fps loop never re-renders
 * React. The declarative `path`/`speculars` props remain the SSR/static
 * rendering; `specularSlots` sizes the ellipse pool the handle may write to
 * (scenes can light fewer bodies on some frames — unused slots are hidden).
 */

import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useId, useImperativeHandle, useRef } from "react";
import { CausticsLayer } from "./caustics";
import type { ResolvedMaterial } from "./materials";
import type { SpecularSpot } from "./specular";

export interface LiquidScene {
  /** Concatenated SVG subpaths for `clip-path: path(...)`. */
  path: string;
  speculars?: SpecularSpot[];
}

export interface LiquidSceneHandle {
  /** Write the scene straight to the DOM (no React render). */
  setScene(scene: LiquidScene): void;
}

export interface LiquidRendererProps {
  /** Concatenated SVG subpaths for `clip-path: path(...)`. */
  path: string;
  material: ResolvedMaterial;
  speculars?: SpecularSpot[];
  /**
   * Size of the specular ellipse pool available to `setScene` (defaults to
   * `speculars.length`). Slots beyond the current scene are hidden.
   */
  specularSlots?: number;
  shadow?: boolean;
  /**
   * Clips the content overlay to the liquid shape so content is revealed
   * from within the surface as it grows (never scaled — only clipped).
   */
  clipContent?: boolean;
  children?: ReactNode;
}

const layer: CSSProperties = { position: "absolute", inset: 0 };
const fmtDeg = (n: number) => n.toFixed(1);
const HIDDEN_SPOT: SpecularSpot = {
  cx: 0,
  cy: 0,
  rx: 0,
  ry: 0,
  rotate: 0,
  opacity: 0,
};

function writeSpot(node: SVGEllipseElement, s: SpecularSpot): void {
  node.setAttribute("cx", String(s.cx));
  node.setAttribute("cy", String(s.cy));
  node.setAttribute("rx", String(s.rx));
  node.setAttribute("ry", String(s.ry));
  node.setAttribute("transform", `rotate(${fmtDeg(s.rotate)} ${s.cx} ${s.cy})`);
  node.setAttribute("opacity", String(s.opacity));
}

export const LiquidRenderer = forwardRef<
  LiquidSceneHandle,
  LiquidRendererProps
>(function LiquidRenderer(
  {
    path,
    material,
    speculars = [],
    specularSlots,
    shadow = false,
    clipContent = false,
    children,
  },
  ref
) {
  const gradientId = useId();
  const clipPath = `path('${path}')`;
  const slots = Math.max(specularSlots ?? speculars.length, speculars.length);
  const showSpec = material.specular && slots > 0;

  const shadowRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ellipseRefs = useRef<(SVGEllipseElement | null)[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      setScene(scene: LiquidScene) {
        const nextClip = `path('${scene.path}')`;
        if (shadowRef.current) shadowRef.current.style.clipPath = nextClip;
        if (clipRef.current) clipRef.current.style.clipPath = nextClip;
        if (specRef.current) specRef.current.style.clipPath = nextClip;
        if (clipContent && contentRef.current) {
          contentRef.current.style.clipPath = nextClip;
        }
        const spots = scene.speculars ?? [];
        ellipseRefs.current.forEach((node, i) => {
          if (node) writeSpot(node, spots[i] ?? HIDDEN_SPOT);
        });
      },
    }),
    [clipContent]
  );

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
            ref={shadowRef}
            data-fluidkit="liquid-shadow"
            style={{ ...layer, background: "rgba(46,44,72,0.16)", clipPath }}
          />
        </div>
      )}
      <div
        ref={clipRef}
        data-fluidkit="liquid-clip"
        style={{ ...layer, clipPath }}
      >
        <div
          data-fluidkit="liquid-fill"
          style={{ ...layer, ...material.fillStyle }}
        />
        {material.kind === "caustics" && material.caustics && (
          <CausticsLayer light={material.caustics.light} />
        )}
      </div>
      {showSpec && (
        <svg
          ref={specRef}
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
          {Array.from({ length: slots }, (_, i) => {
            const s = speculars[i] ?? HIDDEN_SPOT;
            return (
              <ellipse
                key={i}
                ref={(node) => {
                  ellipseRefs.current[i] = node;
                }}
                cx={s.cx}
                cy={s.cy}
                rx={s.rx}
                ry={s.ry}
                transform={`rotate(${fmtDeg(s.rotate)} ${s.cx} ${s.cy})`}
                fill={`url(#${gradientId})`}
                opacity={s.opacity}
              />
            );
          })}
        </svg>
      )}
      {children != null && (
        <div
          ref={contentRef}
          data-fluidkit="liquid-content"
          style={clipContent ? { ...layer, clipPath } : { ...layer }}
        >
          {children}
        </div>
      )}
    </>
  );
});
