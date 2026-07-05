/**
 * Graceful-degradation contract — LiquidProgress.
 *
 * Already pinned in tests/components/LiquidProgress.test.tsx: progressbar
 * ARIA, value/max clamping.
 *
 * Asserted here: reduced motion tracks the value with no wobble and no
 * loop (the geometry is rAF-static), and glass degrades to a flat fill
 * with no backdrop chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { expectStaticGeometry, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement();
  const mod = await import("../../src/components/LiquidProgress");
  return mod.LiquidProgress;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

describe("LiquidProgress degradation contract", () => {
  it("reduced motion: the fill tracks the value with no wobble loop", async () => {
    const LiquidProgress = await load(true);
    const { container, rerender } = render(
      <LiquidProgress value={0.3} aria-label="p" />
    );
    const root = container.querySelector('[data-fluidkit="liquid-progress"]')!;
    rerender(<LiquidProgress value={0.7} aria-label="p" />);
    expect(root.getAttribute("aria-valuenow")).toBe("0.7");
    expect(root.getAttribute("data-animating")).toBe("false");
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: no backdrop chain on any liquid fill", async () => {
    const LiquidProgress = await load(true);
    const { container } = render(<LiquidProgress value={0.5} aria-label="p" />);
    const fills = container.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
    });
  });
});
