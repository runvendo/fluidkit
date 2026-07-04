/**
 * Graceful-degradation contract — LiquidCard.
 *
 * Already pinned in tests/components/LiquidCard.test.tsx (not duplicated):
 * the full surface style pack conformance (tint/color/shadow/light/
 * intensity) with backdrop-filter mocked ON.
 *
 * The card is documented static — no animation loop, no reduced-motion
 * branch needed — so its reduced-motion contract is "there is no motion to
 * remove": content renders and nothing ever requests an animation frame.
 * Asserted here alongside the documented no-backdrop-filter glass
 * fallback (bare jsdom, no featureDetect mock).
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

async function loadLiquidCard() {
  // LiquidCard reads no motion hooks — mockEnv is used only for the module
  // reset + consistency with the other contract files.
  mockEnv({ reduced: true });
  const mod = await import("../../src/components/LiquidCard");
  return mod.LiquidCard;
}

describe("LiquidCard degradation contract", () => {
  beforeEach(() => stubMeasurement(300, 200));

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    unmockEnv();
  });

  it("static by design: content renders and no animation frame is ever requested", async () => {
    const LiquidCard = await loadLiquidCard();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { getByText } = render(<LiquidCard>hello card</LiquidCard>);
    await frames(80);
    expect(getByText("hello card")).toBeInTheDocument();
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill, content on top", async () => {
    const LiquidCard = await loadLiquidCard();
    const { container, getByText } = render(
      <LiquidCard material="glass">hello card</LiquidCard>
    );
    expectGlassFallbackFill(container);
    expect(getByText("hello card")).toBeInTheDocument();
  });
});
