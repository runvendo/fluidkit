/**
 * Graceful-degradation contract — MeshGradient.
 *
 * Already pinned in tests/components/MeshGradient.test.tsx (not
 * duplicated): under reduced motion the drift keyframes are dropped
 * (`animation-name: none`), blobs sit at their home positions, and
 * data-animating="false".
 *
 * Missing capability: MeshGradient is pure CSS (radial gradients + plain
 * `filter: blur`) — it uses no WebGL, backdrop-filter, or refraction, so
 * there is nothing to degrade and no capability test.
 *
 * Asserted here: the "zero per-frame JS" promise — under reduced motion
 * mounting never touches requestAnimationFrame at all (this component has
 * no rAF loop even when animating; the drift is a CSS keyframes loop).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { frames, mockEnv, unmockEnv } from "./harness";

async function loadMeshGradient(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/MeshGradient");
  return mod.MeshGradient;
}

describe("MeshGradient degradation contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    unmockEnv();
    document.getElementById("fluidkit-mesh-gradient-keyframes")?.remove();
  });

  it("reduced motion: renders its blobs without ever requesting an animation frame", async () => {
    const MeshGradient = await loadMeshGradient(true);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { container } = render(<MeshGradient />);
    await frames(80);
    expect(
      container.querySelectorAll('[data-fluidkit="mesh-blob"]').length
    ).toBeGreaterThan(0);
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
