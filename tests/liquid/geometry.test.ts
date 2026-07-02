import { describe, expect, it } from "vitest";
import {
  bridgePath,
  circlePath,
  dist,
  roundRectPath,
} from "../../src/liquid/geometry";

describe("dist", () => {
  it("returns the euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("circlePath", () => {
  it("emits a closed two-arc subpath through the horizontal extremes", () => {
    const p = circlePath({ x: 10, y: 20 }, 5);
    expect(p.startsWith("M 15.0 20.0")).toBe(true); // cx + r
    expect(p).toContain("A 5.0 5.0");
    expect(p).toContain("5.0 20.0"); // cx - r
    expect(p.trimEnd().endsWith("Z")).toBe(true);
  });

  it("returns an empty string for a degenerate radius", () => {
    expect(circlePath({ x: 0, y: 0 }, 0.4)).toBe("");
  });
});

describe("roundRectPath", () => {
  it("emits a closed subpath and clamps the corner radius to half the size", () => {
    const p = roundRectPath({ x: 50, y: 50 }, 100, 40, 999);
    // radius clamps to h/2 = 20; the first corner arc reflects that
    expect(p).toContain("A 20.0 20.0");
    expect(p.trimEnd().endsWith("Z")).toBe(true);
  });

  it("winds the same direction as circlePath (nonzero-rule union, no holes)", () => {
    // clip-path: path(...) unions subpaths under the NONZERO fill rule,
    // which only works when overlapping subpaths wind the same way —
    // opposite windings cancel and punch a hole where a circle overlaps a
    // rect (the tabs indicator's traveling drop made this visible).
    const sweepFlags = (path: string) =>
      [...path.matchAll(/A [\d.]+ [\d.]+ \d+ (\d) (\d)/g)].map((m) => m[2]);
    const circleSweeps = new Set(sweepFlags(circlePath({ x: 0, y: 0 }, 10)));
    const rectSweeps = new Set(
      sweepFlags(roundRectPath({ x: 0, y: 0 }, 40, 20, 8))
    );
    expect(circleSweeps.size).toBe(1);
    expect(rectSweeps).toEqual(circleSweeps);
  });
});

describe("bridgePath", () => {
  const a = { x: 0, y: 0 };

  it("returns a closed bezier subpath when circles are near", () => {
    const p = bridgePath(a, 20, { x: 45, y: 0 }, 20, 0.5);
    expect(p.startsWith("M ")).toBe(true);
    expect(p).toContain("C ");
    expect(p.trimEnd().endsWith("Z")).toBe(true);
  });

  it("returns empty when the circles are beyond reach", () => {
    // reach default 1.6 → maxD = (20+20)*1.6 = 64
    expect(bridgePath(a, 20, { x: 100, y: 0 }, 20, 0.5)).toBe("");
  });

  it("returns empty when one circle contains the other", () => {
    expect(bridgePath(a, 30, { x: 2, y: 0 }, 5, 0.5)).toBe("");
  });

  it("returns empty for degenerate radii", () => {
    expect(bridgePath(a, 0.2, { x: 10, y: 0 }, 10, 0.5)).toBe("");
  });
});
