/**
 * Graceful-degradation contract — LiquidMetal (the `fluidkit/liquid-metal`
 * subpath export, the library's only WebGL-mounting component).
 *
 * Already pinned in tests/liquid-metal/LiquidMetal.test.tsx (not
 * duplicated): each gate individually — no WebGL → static
 * metallic-gradient fallback, shader never mounted; reduced motion → same
 * fallback even when WebGL exists; fallback colors resolved.
 *
 * Asserted here: the combined worst case — a reduced-motion user on a
 * no-WebGL device — using the REAL `supportsWebGL()` against bare jsdom
 * (which creates no WebGL contexts), rather than the existing tests'
 * mocked detector. The documented fallback gradient renders; no canvas, no
 * rAF loop.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { frames, mockEnv, unmockEnv } from "./harness";

async function loadLiquidMetal(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/liquid-metal/index");
  return mod.LiquidMetal;
}

describe("LiquidMetal degradation contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    unmockEnv();
  });

  it("reduced motion + missing WebGL: the static metallic-gradient fallback renders, no canvas, no rAF", async () => {
    const LiquidMetal = await loadLiquidMetal(true);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { container } = render(<LiquidMetal />);
    await frames(80);

    const wrapper = container.querySelector(
      '[data-fluidkit="liquid-metal"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-fallback")).toBe("true");
    const fallback = container.querySelector(
      '[data-fluidkit="liquid-metal-fallback"]'
    ) as HTMLElement;
    expect(fallback).not.toBeNull();
    // The documented stand-in: a metallic gradient from the same back/tint
    // colors the live shader would use — never a blank div.
    expect(fallback.style.background).toContain("linear-gradient");
    expect(container.querySelector("canvas")).toBeNull();
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
