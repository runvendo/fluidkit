/**
 * Graceful-degradation contract — MeniscusDivider.
 *
 * Already pinned in tests/components/MeniscusDivider.test.tsx (not
 * duplicated): refraction defs never mount when `supportsRefraction()` is
 * false, and `tint` reaches the real glass fill.
 *
 * The divider is documented static — "nothing here moves, so reduced
 * motion needs no branch" — so its reduced-motion contract is "there is no
 * motion to remove": the separator renders and nothing ever requests an
 * animation frame. Asserted here alongside the documented
 * no-backdrop-filter glass fallback (bare jsdom, no featureDetect mock).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  frames,
  mockEnv,
  stubMeasurement,
  unmockEnv,
} from "./harness";

async function loadMeniscusDivider() {
  mockEnv({ reduced: true });
  const mod = await import("../../src/components/MeniscusDivider");
  return mod.MeniscusDivider;
}

describe("MeniscusDivider degradation contract", () => {
  beforeEach(() => stubMeasurement(300, 4));

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    unmockEnv();
  });

  it("static by design: the separator renders and no animation frame is ever requested", async () => {
    const MeniscusDivider = await loadMeniscusDivider();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { getByRole } = render(<MeniscusDivider />);
    await frames(80);
    expect(getByRole("separator")).toBeInTheDocument();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const MeniscusDivider = await loadMeniscusDivider();
    const { container } = render(<MeniscusDivider material="glass" />);
    expectGlassFallbackFill(container);
  });
});
