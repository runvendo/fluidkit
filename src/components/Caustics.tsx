/**
 * Ambient background: caustic "poolside light" — the webbed light patterns
 * sunlight makes through water, drifting slowly across a plaster-toned
 * wall. The light itself is the engine's `CausticsLayer` (WebGL); this
 * component supplies the backgrounds-family contract and the wall.
 *
 * The component IS the background layer, not a child overlay: it renders
 * `position:absolute; inset:0; overflow:hidden; pointer-events:none`, so a
 * consumer places it inside a `position:relative` (or similarly positioned)
 * parent alongside their real content:
 *
 *   <div style={{ position: "relative" }}>
 *     <Caustics />
 *     <YourContent />
 *   </div>
 *
 * Without WebGL (or during SSR) only the wall renders — a quiet plaster
 * gradient, never a black box. Under `prefers-reduced-motion` the light
 * renders a single still frame (handled inside `CausticsLayer`).
 *
 * Surfaces get the same light via the engine material instead:
 * `<LiquidCard material="caustics" />` (see `src/liquid/materials.ts`).
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { CausticsLayer, CAUSTICS_DEFAULT_LIGHT } from "../liquid/caustics";

export interface CausticsProps extends HTMLAttributes<HTMLDivElement> {
  /** Light color. Defaults to warm white. */
  color?: string;
  /** Wall color: one color or a [top, bottom] pair. Defaults to soft plaster. */
  background?: string | [string, string];
  /** Brightness of the light webs, 0-1. Defaults to 0.5. */
  intensity?: number;
  /** Size of the light pattern; higher = larger webs. Defaults to 1. */
  scale?: number;
  /** Drift rate; 1 is the quiet default rate. */
  speed?: number;
  /** Strength of the diagonal sunbeam the light lives in, 0-1 (0 = uniform light). Defaults to 0.55. */
  band?: number;
}

const DEFAULT_WALL: [string, string] = ["#f8f8f5", "#eceeef"];

const layerStyle: CSSProperties = { position: "absolute", inset: 0 };

export function Caustics({
  color = CAUSTICS_DEFAULT_LIGHT,
  background = DEFAULT_WALL,
  intensity = 0.5,
  scale = 1,
  speed = 1,
  band = 0.55,
  className,
  style,
  ...rest
}: CausticsProps) {
  const wall = Array.isArray(background)
    ? `linear-gradient(180deg, ${background[0]}, ${background[1]})`
    : background;

  return (
    <div
      data-fluidkit="caustics"
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        ...style,
      }}
      {...rest}
    >
      <div
        data-fluidkit="caustics-base"
        style={{ ...layerStyle, background: wall }}
      />
      <CausticsLayer
        light={color}
        intensity={intensity}
        scale={scale}
        speed={speed}
        band={band}
      />
    </div>
  );
}
