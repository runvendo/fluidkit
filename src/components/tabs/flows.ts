/**
 * Flow scene geometry for LiquidTabs.
 *
 * A Flow is a pure spec: how many springs it needs, their configs, the spring
 * values for a pill resting on / traveling to a tab box, and a `scene()` that
 * turns live spring values (+ velocities) into a clip-path string and the ink
 * x-intervals used for label tinting. No DOM, no React — unit-testable.
 *
 * `slide` — one droplet with inertia: squashes with speed, a lagging tail blob
 *   trails and re-merges through the tension field, lands flat.
 * `stretch` — a taffy pill spanning two edge springs; leading edge eager,
 *   trailing edge lazy, height squashed to conserve volume.
 */

import { circlePath, roundRectPath, TensionField } from "../../liquid";
import type { SpringConfig } from "../../liquid/useMotionSprings";
import type { Interval } from "./tint";

export interface TabRect {
  left: number;
  width: number;
}

export interface FlowContext {
  /** Indicator height in px (the measured container height). */
  height: number;
  /** Resting width of the destination tab, for volume conservation. */
  restWidth: number;
}

export interface FlowScene {
  /** Concatenated clip-path subpaths. */
  path: string;
  /** X-intervals the ink covers, for `tabCoverage`. */
  inkIntervals: Interval[];
}

export interface Flow {
  readonly springCount: number;
  readonly configs: readonly SpringConfig[];
  /** Spring values for a pill at rest on `rect`. */
  rest(rect: TabRect, height: number): number[];
  /** Spring targets to animate toward when the active tab becomes `rect`. */
  target(rect: TabRect, height: number): number[];
  scene(
    values: readonly number[],
    velocities: readonly number[],
    tension: TensionField,
    ctx: FlowContext
  ): FlowScene;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** values = [centerX, width, tailX] */
export const slideFlow: Flow = {
  springCount: 3,
  configs: [
    { stiffness: 320, damping: 33 }, // centerX
    { stiffness: 340, damping: 35 }, // width
    { stiffness: 190, damping: 24 }, // tailX (lags behind the body)
  ],
  rest(rect) {
    const cx = rect.left + rect.width / 2;
    return [cx, rect.width, cx];
  },
  target(rect) {
    const cx = rect.left + rect.width / 2;
    return [cx, rect.width, cx];
  },
  scene(values, velocities, tension, ctx) {
    const cx = values[0];
    const w = values[1];
    const tailX = values[2];
    const vx = velocities[0] ?? 0;
    const h = ctx.height;
    const cy = h / 2;

    // Squash with speed: wider + shorter while moving, capped and volume-ish.
    const stretch = 1 + Math.min(Math.abs(vx) / 1400, 0.22);
    const bw = w * stretch;
    const bh = h / Math.sqrt(stretch);

    let path = roundRectPath({ x: cx, y: cy }, bw, bh, bh / 2);

    const gap = Math.abs(cx - tailX);
    const tailR = gap < 1 ? 0 : Math.min(gap * 0.3 + 5, h * 0.36);
    if (tailR > 0.5) {
      path += circlePath({ x: tailX, y: cy }, tailR);
      path += tension.bridges([
        { id: "body", x: cx, y: cy, r: bh / 2 },
        { id: "tail", x: tailX, y: cy, r: tailR },
      ]);
    }

    return { path, inkIntervals: [[cx - bw / 2, cx + bw / 2]] };
  },
};

/** values = [leftEdge, rightEdge] */
export const stretchFlow: Flow = {
  springCount: 2,
  configs: [
    { stiffness: 420, damping: 34 }, // leftEdge
    { stiffness: 420, damping: 34 }, // rightEdge
  ],
  rest(rect) {
    return [rect.left, rect.left + rect.width];
  },
  target(rect) {
    return [rect.left, rect.left + rect.width];
  },
  scene(values, _velocities, _tension, ctx) {
    const L = values[0];
    const R = values[1];
    const w = Math.max(R - L, 8);
    const h = ctx.height * clamp(ctx.restWidth / w, 0.72, 1.04);
    const cx = (L + R) / 2;
    const cy = ctx.height / 2;
    const path = roundRectPath({ x: cx, y: cy }, w, h, h / 2);
    return { path, inkIntervals: [[L, R]] };
  },
};

/**
 * Per-edge spring configs for `stretch`: the leading edge is eager (stiff,
 * lightly damped) and the trailing edge lazy, so the pill stretches across the
 * gap before the tail catches up. `[leftConfig, rightConfig]`.
 */
export function stretchEdgeConfigs(
  movingRight: boolean
): [SpringConfig, SpringConfig] {
  const eager: SpringConfig = { stiffness: 520, damping: 30 };
  const lazy: SpringConfig = { stiffness: 260, damping: 27 };
  return movingRight ? [lazy, eager] : [eager, lazy];
}

export type FlowName = "slide" | "stretch";

export const FLOWS: Record<FlowName, Flow> = {
  slide: slideFlow,
  stretch: stretchFlow,
};
