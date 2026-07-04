/**
 * Graceful-degradation contract — LiquidButton.
 *
 * Already pinned in tests/components/LiquidButton.test.tsx (not
 * duplicated): under reduced motion data-animating stays false, the clip
 * path never deforms on press, clicks still fire, and press feedback still
 * applies through color (not motion) — the documented reduced-motion
 * presentation.
 *
 * Asserted here: the documented no-backdrop-filter glass fallback on the
 * button's fill, with the label still on top.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { expectGlassFallbackFill, mockEnv, unmockEnv } from "./harness";

async function loadLiquidButton(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/LiquidButton");
  return mod.LiquidButton;
}

describe("LiquidButton degradation contract", () => {
  afterEach(unmockEnv);

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill, label intact", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { container, getByRole } = render(
      <LiquidButton material="glass">Send</LiquidButton>
    );
    expectGlassFallbackFill(container);
    expect(getByRole("button")).toHaveTextContent("Send");
  });
});
