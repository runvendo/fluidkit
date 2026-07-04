/**
 * Graceful-degradation contract — Caustics.
 *
 * Already pinned elsewhere (not duplicated): the engine-level CausticsLayer
 * mounts no canvas without WebGL and releases contexts on every failure
 * path (tests/liquid/caustics.test.tsx); the component renders the plaster
 * base + light layer and stays an inert background
 * (tests/components/Caustics.test.tsx). The reduced-motion still-frame GL
 * behavior lives in CausticsLayer's draw effect (single `frame(STILL_TIME)`
 * call, no loop) and is exercised by the fake-context lifecycle tests.
 *
 * Asserted here, at the component level: the documented no-WebGL fallback
 * — the CSS wall IS the rendering (never a black box, no canvas) — and the
 * reduced-motion gate on the light layer.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { mockEnv, unmockEnv } from "./harness";

async function loadCaustics(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/Caustics");
  return mod.Caustics;
}

describe("Caustics degradation contract", () => {
  afterEach(unmockEnv);

  it("missing WebGL: the plaster wall renders and no canvas ever mounts", async () => {
    // jsdom creates no WebGL contexts — supportsWebGL() is naturally false.
    const Caustics = await loadCaustics(true);
    const { container } = render(<Caustics />);
    const base = container.querySelector(
      '[data-fluidkit="caustics-base"]'
    ) as HTMLElement;
    expect(base).not.toBeNull();
    // The documented fallback: the wall gradient, never a black box.
    expect(base.style.background).toContain("linear-gradient");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("reduced motion: the light layer reports itself as not animating", async () => {
    const Caustics = await loadCaustics(true);
    const { container } = render(<Caustics />);
    const layer = container.querySelector(
      '[data-fluidkit="caustics-layer"]'
    ) as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.getAttribute("data-animating")).toBe("false");
  });
});
