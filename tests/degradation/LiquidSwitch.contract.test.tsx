/**
 * Graceful-degradation contract — LiquidSwitch.
 *
 * Already pinned in tests/components/LiquidSwitch.test.tsx: controlled/
 * uncontrolled, form participation, label association, focus meniscus.
 *
 * Asserted here: reduced motion snaps the thumb (no bridge, no settle
 * loop) while the native input stays fully interactive, and glass
 * degrades to the documented flat fill with no backdrop chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expectStaticGeometry, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement();
  const mod = await import("../../src/components/LiquidSwitch");
  return mod.LiquidSwitch;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

describe("LiquidSwitch degradation contract", () => {
  it("reduced motion: toggling snaps — no settle loop, input stays interactive", async () => {
    const LiquidSwitch = await load(true);
    const { container } = render(<LiquidSwitch label="Wi-Fi" />);
    const root = container.querySelector('[data-fluidkit="liquid-switch"]')!;
    const input = screen.getByRole("switch") as HTMLInputElement;

    fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(root.getAttribute("data-checked")).toBe("true");
    // Snapped, not settling: the loop never runs under reduced motion.
    expect(root.getAttribute("data-animating")).toBe("false");
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: no backdrop chain on any liquid fill", async () => {
    const LiquidSwitch = await load(true);
    const { container } = render(<LiquidSwitch label="Wi-Fi" defaultChecked />);
    const fills = container.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
      expect((fill as HTMLElement).style.background).not.toBe("");
    });
  });
});
