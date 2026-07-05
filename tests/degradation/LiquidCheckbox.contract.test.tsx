/**
 * Graceful-degradation contract — LiquidCheckbox.
 *
 * Already pinned in tests/components/LiquidCheckbox.test.tsx: controlled/
 * uncontrolled, indeterminate, form participation, focus meniscus.
 *
 * Asserted here: reduced motion snaps the fill level (no pour, no wobble)
 * while the native input stays interactive; glass degrades to a flat fill
 * with no backdrop chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expectStaticGeometry, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement();
  const mod = await import("../../src/components/LiquidCheckbox");
  return mod.LiquidCheckbox;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

describe("LiquidCheckbox degradation contract", () => {
  it("reduced motion: checking snaps the fill — no loop, input interactive", async () => {
    const LiquidCheckbox = await load(true);
    const { container } = render(<LiquidCheckbox label="Remember me" defaultChecked />);
    const root = container.querySelector('[data-fluidkit="liquid-checkbox"]')!;
    const input = screen.getByRole("checkbox") as HTMLInputElement;

    expect(root.getAttribute("data-animating")).toBe("false");
    await expectStaticGeometry(container);
    fireEvent.click(input);
    expect(input.checked).toBe(false);
    expect(root.getAttribute("data-checked")).toBe("false");
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  it("missing backdrop-filter: no backdrop chain on any liquid fill", async () => {
    const LiquidCheckbox = await load(true);
    const { container } = render(<LiquidCheckbox label="c" defaultChecked />);
    const fills = container.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
    });
  });
});
