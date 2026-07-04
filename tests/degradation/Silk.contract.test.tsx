/**
 * Graceful-degradation contract — Silk.
 *
 * Already pinned in tests/components/Silk.test.tsx (not duplicated): under
 * reduced motion the flow keyframes are dropped (`animation-name: none`),
 * sheets sit at their home transform, and data-animating="false"; the flat
 * (default) material is pure CSS with nothing to degrade.
 *
 * Asserted here: the documented `material="glass"` degradation — without
 * backdrop-filter, `resolveMaterial` drops the backdrop chain and each
 * sheet falls back to its plain tinted gradient (still layered sheets,
 * no longer live frost).
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { mockEnv, unmockEnv } from "./harness";

async function loadSilk(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/Silk");
  return mod.Silk;
}

describe("Silk degradation contract", () => {
  afterEach(unmockEnv);

  it("missing backdrop-filter: glass sheets degrade to plain tinted gradients (no backdrop chain)", async () => {
    // Bare jsdom (no CSS.supports) IS the no-backdrop-filter browser.
    const Silk = await loadSilk(true);
    const { container } = render(<Silk material="glass" />);
    const sheets = Array.from(
      container.querySelectorAll('[data-fluidkit="silk-sheet"]')
    ) as HTMLElement[];
    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      expect(sheet.style.backdropFilter).toBe("");
      // The degraded fill is the resolver's fallback carrying the sheet's
      // tint gradient — still a visible sheet, never a blank layer.
      expect(sheet.getAttribute("style")).toContain("linear-gradient");
      // Glass never stacks the flat material's self blur.
      expect(sheet.style.filter).toBe("");
    }
  });
});
