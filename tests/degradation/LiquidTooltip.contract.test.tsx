/**
 * Graceful-degradation contract — LiquidTooltip.
 *
 * Already pinned in tests/components/LiquidTooltip.test.tsx (not
 * duplicated): refraction defs never mount when `supportsRefraction()` is
 * false, and `tint` reaches the real glass fill once visible.
 *
 * Asserted here: the documented reduced-motion behavior — "no geometry
 * spring — the droplet appears at full size and simply fades" — including
 * the interactive legs (focus shows without delay, Escape dismisses), and
 * the documented no-backdrop-filter glass fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  mockEnv,
  stubMeasurement,
  unmockEnv,
} from "./harness";

async function loadLiquidTooltip(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/LiquidTooltip");
  return mod.LiquidTooltip;
}

describe("LiquidTooltip degradation contract", () => {
  beforeEach(() => stubMeasurement(120, 28));

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    unmockEnv();
  });

  it("reduced motion: focus shows the droplet immediately at full size; Escape dismisses", async () => {
    const LiquidTooltip = await loadLiquidTooltip(true);
    const { container, getByRole } = render(
      <LiquidTooltip content="Save your work">
        <button>save</button>
      </LiquidTooltip>
    );
    const wrapper = container.querySelector(
      '[data-fluidkit="liquid-tooltip"]'
    ) as HTMLElement;

    fireEvent.focus(wrapper);
    expect(wrapper.getAttribute("data-state")).toBe("open");
    // Snapped to full size — the condense spring never runs.
    expect(wrapper.getAttribute("data-animating")).toBe("false");
    expect(getByRole("tooltip")).toHaveTextContent("Save your work");
    expect(wrapper.getAttribute("aria-describedby")).not.toBeNull();

    fireEvent.keyDown(wrapper, { key: "Escape" });
    expect(wrapper.getAttribute("data-state")).toBe("closed");
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const LiquidTooltip = await loadLiquidTooltip(true);
    const { container } = render(
      <LiquidTooltip content="tip" material="glass">
        <button>save</button>
      </LiquidTooltip>
    );
    fireEvent.focus(
      container.querySelector('[data-fluidkit="liquid-tooltip"]') as HTMLElement
    );
    expectGlassFallbackFill(container);
  });
});
