import { describe, expect, it } from "vitest";
import { tabCoverage, mixColor, smoothstep, type Interval } from "../../../src/components/tabs/tint";

describe("smoothstep", () => {
  it("clamps below a and above b", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
  it("is 0.5 at the midpoint", () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("tabCoverage", () => {
  const tab = { left: 100, width: 50 }; // spans [100,150]

  it("is 0 when no interval overlaps the tab", () => {
    const intervals: Interval[] = [[0, 40]];
    expect(tabCoverage(tab.left, tab.width, intervals)).toBe(0);
  });

  it("is 1 when an interval fully covers the tab (raw >= 0.7)", () => {
    const intervals: Interval[] = [[90, 160]];
    expect(tabCoverage(tab.left, tab.width, intervals)).toBe(1);
  });

  it("sums overlap across multiple intervals before smoothstepping", () => {
    // 10px + 10px = 20px of 50px = raw 0.4 → inside the smoothstep ramp (0.35..0.7)
    const intervals: Interval[] = [[100, 110], [140, 150]];
    const c = tabCoverage(tab.left, tab.width, intervals);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
  });

  it("returns 0 for a zero-width tab", () => {
    expect(tabCoverage(100, 0, [[0, 999]])).toBe(0);
  });
});

describe("mixColor", () => {
  it("returns the from color at weight 0", () => {
    expect(mixColor([75, 76, 86], [255, 255, 255], 0)).toBe("rgb(75, 76, 86)");
  });
  it("returns the to color at weight 1", () => {
    expect(mixColor([75, 76, 86], [255, 255, 255], 1)).toBe("rgb(255, 255, 255)");
  });
  it("rounds channel values at the midpoint", () => {
    expect(mixColor([0, 0, 0], [255, 255, 255], 0.5)).toBe("rgb(128, 128, 128)");
  });
});
