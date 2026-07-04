/**
 * Graceful-degradation contract — VoiceBall.
 *
 * Already pinned in tests/components/VoiceBall.test.tsx (not duplicated):
 * refraction defs never mount when `supportsRefraction()` is false, and
 * `tint` reaches the real glass fill.
 *
 * Asserted here (no existing reduced-motion coverage): reduced motion
 * renders a static single circle — no wobble harmonics, no satellites —
 * that never moves across frames, in every mode; and the documented
 * no-backdrop-filter glass fallback.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  clipPathOf,
  expectGlassFallbackFill,
  expectStaticGeometry,
  mockEnv,
  unmockEnv,
} from "./harness";

async function loadVoiceBall(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/VoiceBall");
  return mod.VoiceBall;
}

describe("VoiceBall degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: a static single circle (no satellites), in every mode", async () => {
    const VoiceBall = await loadVoiceBall(true);
    for (const mode of ["idle", "listening", "speaking"] as const) {
      // level above the satellite threshold: speaking would surface beads
      // when animating; the static scene must stay one plain circle.
      const { container, unmount } = render(
        <VoiceBall mode={mode} level={0.9} />
      );
      const closures = (clipPathOf(container).match(/Z/g) ?? []).length;
      expect(closures, `mode=${mode}`).toBe(1);
      unmount();
    }
  });

  it("reduced motion: no rAF-driven geometry — the circle never moves across frames", async () => {
    const VoiceBall = await loadVoiceBall(true);
    const { container } = render(<VoiceBall mode="speaking" level={0.9} />);
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const VoiceBall = await loadVoiceBall(true);
    const { container } = render(<VoiceBall material="glass" />);
    expectGlassFallbackFill(container);
  });
});
