/**
 * Graceful-degradation contract — GlassPanes.
 *
 * Already pinned in tests/components/GlassPanes.test.tsx (not duplicated):
 * data-fallback="true" with no backdrop-filter styles when unsupported
 * (jsdom), and the slide keyframes dropped entirely under
 * prefers-reduced-motion.
 *
 * Asserted here: the worst case — BOTH degradations at once. A reduced-
 * motion user in a no-backdrop-filter browser still gets the documented
 * rendering: the full set of layered panes with the engine's frosted
 * fallback white and their rim/lift shadow, statically parked.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { mockEnv, unmockEnv } from "./harness";

async function loadGlassPanes(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/GlassPanes");
  return mod.GlassPanes;
}

describe("GlassPanes degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion + missing backdrop-filter: static layered frosted fills still render", async () => {
    const GlassPanes = await loadGlassPanes(true);
    const { container } = render(<GlassPanes />);

    const wrapper = container.querySelector(
      '[data-fluidkit="glass-panes"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-fallback")).toBe("true");
    expect(wrapper.getAttribute("data-animating")).toBe("false");

    const panes = Array.from(
      container.querySelectorAll('[data-fluidkit="glass-panes-pane"]')
    ) as HTMLElement[];
    expect(panes).toHaveLength(3);
    for (const pane of panes) {
      expect(pane.style.animationName).toBe("none");
      expect(pane.style.backdropFilter).toBe("");
      // The engine's documented glass fallback white (materials.ts).
      expect(pane.style.background).toBe("rgba(255, 255, 255, 0.65)");
      // The rim + lift shadow still separates the layered panes.
      expect(pane.style.boxShadow).toContain("inset");
    }
  });
});
