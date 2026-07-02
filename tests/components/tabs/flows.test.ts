import { describe, expect, it } from "vitest";
import { TensionField } from "../../../src/liquid";
import { slideFlow, type FlowContext } from "../../../src/components/tabs/flows";

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
});
