/**
 * Graceful-degradation contract — Droplets.
 *
 * Already pinned in tests/components/Droplets.test.tsx (not duplicated):
 * reduced motion renders separate static dots with data-animating="false",
 * and pointer interactions are inert (grab callbacks never fire).
 *
 * Asserted here: the static dots really are rAF-static (no frame rewrites
 * the geometry), and the documented no-backdrop-filter glass fallback.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  expectStaticGeometry,
  mockEnv,
  unmockEnv,
} from "./harness";

async function loadDroplets(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/Droplets");
  return mod.Droplets;
}

describe("Droplets degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: no rAF-driven geometry — the clip path never changes across frames", async () => {
    // Motion's `useAnimationFrame` stays registered, but its callback
    // early-returns while `animating` is false; the observable promise is
    // that the static-dots geometry never moves.
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets followPointer interactive />);
    expect(
      (container.firstChild as HTMLElement).getAttribute("data-animating")
    ).toBe("false");
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    // Bare jsdom (no CSS.supports) IS the no-backdrop-filter browser.
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets material="glass" />);
    expectGlassFallbackFill(container);
  });
});
