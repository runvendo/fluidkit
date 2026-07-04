/**
 * Graceful-degradation contract — MorphSurface.
 *
 * Already pinned in tests/components/MorphSurface.test.tsx (not
 * duplicated): under reduced motion an `open` flip renders the target size
 * immediately with data-animating="false", and faces cross-fade with
 * opacity only (never scale) — the allowed fade.
 *
 * Asserted here: content stays interactive under reduced motion, the
 * settled geometry is rAF-static, and the documented no-backdrop-filter
 * glass fallback.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  expectStaticGeometry,
  mockEnv,
  unmockEnv,
} from "./harness";

async function loadMorphSurface(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/MorphSurface");
  return mod.MorphSurface;
}

describe("MorphSurface degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: content still renders and stays interactive", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const onClick = vi.fn();
    const { getByText } = render(
      <MorphSurface
        open
        closedContent={<span>pill</span>}
        openContent={<button onClick={onClick}>act</button>}
      />
    );
    fireEvent.click(getByText("act"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reduced motion: no rAF-driven geometry after an open flip", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container, rerender } = render(<MorphSurface open={false} />);
    rerender(<MorphSurface open />);
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} material="glass" />);
    expectGlassFallbackFill(container);
  });
});
