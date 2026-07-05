/**
 * Graceful-degradation contract — LiquidSlider.
 *
 * Already pinned in tests/components/LiquidSlider.test.tsx: native range
 * semantics, controlled/uncontrolled, active saturation, focus meniscus.
 *
 * Asserted here: reduced motion tracks the value with no spring lag and
 * no loop while the native range input stays interactive; glass degrades
 * to a flat fill with no backdrop chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expectStaticGeometry, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement();
  const mod = await import("../../src/components/LiquidSlider");
  return mod.LiquidSlider;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

describe("LiquidSlider degradation contract", () => {
  it("reduced motion: value changes snap — no loop, input interactive", async () => {
    const LiquidSlider = await load(true);
    const { container } = render(<LiquidSlider aria-label="Volume" defaultValue={30} />);
    const root = container.querySelector('[data-fluidkit="liquid-slider"]')!;
    const input = screen.getByRole("slider") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "70" } });
    expect(input.value).toBe("70");
    expect(root.getAttribute("data-value")).toBe("70");
    expect(root.getAttribute("data-animating")).toBe("false");
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: no backdrop chain on any liquid fill", async () => {
    const LiquidSlider = await load(true);
    const { container } = render(<LiquidSlider aria-label="v" defaultValue={50} />);
    const fills = container.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
    });
  });
});
