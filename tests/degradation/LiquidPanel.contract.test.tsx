/**
 * Graceful-degradation contract — LiquidPanel.
 *
 * Already pinned in tests/components/LiquidPanel.test.tsx (not
 * duplicated): the flip-commit flash guards (mid-pour paints the CURRENT
 * spring frame) and the closed-at-rest sliver staying hidden.
 *
 * Asserted here: the documented reduced-motion behavior — "the surface
 * snaps between poured and drained; the content cross-fade is the only
 * motion left" — plus content interactivity while open, rAF-static
 * geometry, and the documented no-backdrop-filter glass fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  expectStaticGeometry,
  mockEnv,
  stubMeasurement,
  unmockEnv,
} from "./harness";

async function loadLiquidPanel(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/LiquidPanel");
  return mod.LiquidPanel;
}

describe("LiquidPanel degradation contract", () => {
  beforeEach(() => stubMeasurement(280, 160));

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    unmockEnv();
  });

  it("reduced motion: open/close snaps — no settle loop, content visible and interactive while open", async () => {
    const LiquidPanel = await loadLiquidPanel(true);
    const onClick = vi.fn();
    const { container, getByText, rerender } = render(
      <LiquidPanel open={false}>
        <button onClick={onClick}>go</button>
      </LiquidPanel>
    );
    const root = container.firstChild as HTMLElement;

    rerender(
      <LiquidPanel open>
        <button onClick={onClick}>go</button>
      </LiquidPanel>
    );
    expect(root.getAttribute("data-state")).toBe("open");
    // Snapped, not settling: the loop never runs under reduced motion.
    expect(root.getAttribute("data-animating")).toBe("false");
    const content = container.querySelector(
      '[data-fluidkit="liquid-panel-content"]'
    ) as HTMLElement;
    expect(content.getAttribute("aria-hidden")).toBeNull();
    fireEvent.click(getByText("go"));
    expect(onClick).toHaveBeenCalledTimes(1);

    // The poured geometry is rAF-static.
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const LiquidPanel = await loadLiquidPanel(true);
    const { container } = render(
      <LiquidPanel open material="glass">
        content
      </LiquidPanel>
    );
    expectGlassFallbackFill(container);
  });
});
