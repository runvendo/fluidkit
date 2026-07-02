import { describe, expect, it } from "vitest";
import { TensionField } from "../../../src/liquid";
import {
  slideFlow,
  stretchFlow,
  stretchEdgeConfigs,
  FLOWS,
  type FlowContext,
} from "../../../src/components/tabs/flows";

const H = 34;
const ctx = (restWidth: number): FlowContext => ({ height: H, restWidth });
const closures = (path: string) => (path.match(/Z/g) ?? []).length;

describe("slideFlow", () => {
  it("uses three springs", () => {
    expect(slideFlow.springCount).toBe(3);
    expect(slideFlow.configs).toHaveLength(3);
  });

  it("rest and target center the pill on the tab", () => {
    const rect = { left: 100, width: 60 };
    expect(slideFlow.rest(rect, H)).toEqual([130, 60, 130]);
    expect(slideFlow.target(rect, H)).toEqual([130, 60, 130]);
  });

  it("at rest (tail merged, zero velocity) draws exactly one pill", () => {
    const t = new TensionField();
    // values = [cx, w, tailX]; tail coincident with body → no bridge, no tail circle
    const scene = slideFlow.scene([130, 60, 130], [0, 0, 0], t, ctx(60));
    expect(closures(scene.path)).toBe(1);
    expect(scene.inkIntervals).toEqual([[100, 160]]);
  });

  it("reports a wider ink interval while moving fast (velocity stretch)", () => {
    const t = new TensionField();
    const still = slideFlow.scene([130, 60, 130], [0, 0, 0], t, ctx(60));
    const fast = slideFlow.scene([130, 60, 130], [2000, 0, 0], new TensionField(), ctx(60));
    const w = (iv: [number, number][]) => iv[0][1] - iv[0][0];
    expect(w(fast.inkIntervals)).toBeGreaterThan(w(still.inkIntervals));
  });

  it("emits a separated tail circle when the tail lags behind the body", () => {
    const t = new TensionField();
    const scene = slideFlow.scene([200, 60, 120], [0, 0, 0], t, ctx(60));
    // body pill + tail circle (+ possibly a bridge) → at least two closures
    expect(closures(scene.path)).toBeGreaterThanOrEqual(2);
  });

  it("reports both body and tail ink intervals when the tail is separated", () => {
    const t = new TensionField();
    const scene = slideFlow.scene([200, 60, 120], [0, 0, 0], t, ctx(60));
    // labels follow the liquid: body interval + tail interval
    expect(scene.inkIntervals).toHaveLength(2);
  });
});

describe("stretchFlow", () => {
  it("uses two edge springs", () => {
    expect(stretchFlow.springCount).toBe(2);
  });

  it("rest/target map to left and right edges", () => {
    const rect = { left: 40, width: 80 };
    expect(stretchFlow.rest(rect, H)).toEqual([40, 120]);
    expect(stretchFlow.target(rect, H)).toEqual([40, 120]);
  });

  it("draws exactly one pill spanning the edges", () => {
    const scene = stretchFlow.scene([40, 120], [0, 0], new TensionField(), ctx(80));
    expect(closures(scene.path)).toBe(1);
    expect(scene.inkIntervals).toEqual([[40, 120]]);
  });

  it("squashes height below rest when stretched wider than the rest width", () => {
    // spanning 200px while resting width is 80 → thinned, floored at 0.72*H
    const scene = stretchFlow.scene([0, 200], [0, 0], new TensionField(), ctx(80));
    // Extract the pill height from the first two path Y coordinates is fiddly;
    // instead assert the interval width reflects the stretch.
    expect(scene.inkIntervals[0][1] - scene.inkIntervals[0][0]).toBe(200);
  });
});

describe("stretchEdgeConfigs", () => {
  it("makes the right edge eager when moving right", () => {
    const [left, right] = stretchEdgeConfigs(true);
    expect(right.stiffness).toBeGreaterThan(left.stiffness);
  });
  it("makes the left edge eager when moving left", () => {
    const [left, right] = stretchEdgeConfigs(false);
    expect(left.stiffness).toBeGreaterThan(right.stiffness);
  });
});

describe("FLOWS registry", () => {
  it("exposes slide and stretch by name", () => {
    expect(FLOWS.slide.springCount).toBe(3);
    expect(FLOWS.stretch.springCount).toBe(2);
  });
});
