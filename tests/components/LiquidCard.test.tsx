import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import type { LiquidCardProps } from "../../src/components/LiquidCard";
import type { SurfaceRender } from "./surfacePack";
import {
  expectColorFillsFlat,
  expectIntensityScalesSpeculars,
  expectNullLightPaintsNoSpeculars,
  expectShadowToggles,
  expectTintReachesGlassFill,
} from "./surfacePack";

/**
 * LiquidCard is the reference implementation of the surface style pack:
 * it already carries every pack prop, so it runs the full conformance
 * helper. Backdrop-filter support is mocked on so `material="glass"`
 * renders real glass instead of jsdom's degraded flat fallback.
 */

async function loadLiquidCard() {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../src/utils/featureDetect")>();
    return { ...actual, supportsBackdropFilter: () => true };
  });
  const mod = await import("../../src/components/LiquidCard");
  return mod.LiquidCard;
}

const SIZE = { width: 300, height: 200 };

const surfaceRender =
  (LiquidCard: ComponentType<LiquidCardProps>): SurfaceRender =>
  (props) => render(<LiquidCard {...props}>content</LiquidCard>);

describe("LiquidCard surface style pack conformance", () => {
  let restoreSizes: () => void;

  beforeEach(() => {
    // The card measures its own box; jsdom has neither ResizeObserver nor
    // layout, so stub the observer and pin the measured size.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    const widthSpy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(SIZE.width);
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(SIZE.height);
    restoreSizes = () => {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    };
  });

  afterEach(() => {
    restoreSizes();
    vi.unstubAllGlobals();
    vi.doUnmock("../../src/utils/featureDetect");
    vi.resetModules();
  });

  it("applies `tint` to the glass fill", async () => {
    const LiquidCard = await loadLiquidCard();
    expectTintReachesGlassFill(surfaceRender(LiquidCard));
  });

  it("applies `color` to the flat fill", async () => {
    const LiquidCard = await loadLiquidCard();
    expectColorFillsFlat(surfaceRender(LiquidCard));
  });

  it("renders the shadow layer by default and drops it on `shadow={false}`", async () => {
    const LiquidCard = await loadLiquidCard();
    expectShadowToggles(surfaceRender(LiquidCard));
  });

  it("paints no speculars when `light={null}`", async () => {
    const LiquidCard = await loadLiquidCard();
    expectNullLightPaintsNoSpeculars(surfaceRender(LiquidCard));
  });

  it("scales specular brightness with `intensity`", async () => {
    const LiquidCard = await loadLiquidCard();
    expectIntensityScalesSpeculars(surfaceRender(LiquidCard));
  });
});
