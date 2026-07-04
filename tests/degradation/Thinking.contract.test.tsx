/**
 * Graceful-degradation contract — Thinking.
 *
 * Already pinned in tests/components/Thinking.test.tsx (not duplicated):
 * reduced motion renders three static dots with data-animating="false",
 * the `role="status"` + aria-label announcement, and refraction defs never
 * mounting when `supportsRefraction()` is false.
 *
 * Asserted here: the static scene really is rAF-static across frames, and
 * the documented no-backdrop-filter glass fallback.
 */

import { afterEach, describe, it } from "vitest";
import { render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  expectStaticGeometry,
  mockEnv,
  unmockEnv,
} from "./harness";

async function loadThinking(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/Thinking");
  return mod.Thinking;
}

describe("Thinking degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: no rAF-driven geometry — the resting dots never move (all variants)", async () => {
    const Thinking = await loadThinking(true);
    for (const variant of ["gather", "orbit", "wave"] as const) {
      const { container, unmount } = render(<Thinking variant={variant} />);
      await expectStaticGeometry(container, 80);
      unmount();
    }
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const Thinking = await loadThinking(true);
    const { container } = render(<Thinking material="glass" />);
    expectGlassFallbackFill(container);
  });
});
