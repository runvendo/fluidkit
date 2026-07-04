import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { LiquidTextMaterial } from "../../src/components/LiquidText";

/**
 * Same module-mock pattern as tests/liquid/materials.test.ts
 * (`loadWithBackdropSupport`): glass is gated on `supportsBackdropFilter()`,
 * which jsdom can't answer, so the featureDetect module is mocked and the
 * component re-imported per support scenario. Motion's `useReducedMotion`
 * is pinned to false so the sheen sweep actually animates.
 */
async function loadLiquidText(backdropSupported: boolean) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", () => ({
    supportsBackdropFilter: () => backdropSupported,
    supportsRefraction: () => false,
    supportsViewTransition: () => false,
  }));
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => false };
  });
  const mod = await import("../../src/components/LiquidText");
  return mod.LiquidText;
}

function wrapperOf(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-fluidkit="liquid-text"]') as HTMLElement;
}

/** The aria-hidden glyph-masked layers (glass fill + glass sheen). */
function maskedLayers(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll('span[aria-hidden="true"]')
  ) as HTMLElement[];
}

function glassFillOf(container: HTMLElement): HTMLElement | undefined {
  return maskedLayers(container).find((el) => el.style.backdropFilter !== "");
}

function sheenLayerOf(container: HTMLElement): HTMLElement | undefined {
  return maskedLayers(container).find((el) =>
    el.style.backgroundImage.includes("linear-gradient")
  );
}

describe("LiquidText", () => {
  let restoreSizes: () => void;

  beforeEach(() => {
    // The glass mask measures the live element (offsetWidth/offsetHeight)
    // and watches it with a ResizeObserver — jsdom has neither, so stub
    // both (same pattern as tests/components/LiquidPanel.test.tsx).
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
      .mockReturnValue(320);
    const heightSpy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(48);
    restoreSizes = () => {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    };
  });

  afterEach(() => {
    restoreSizes();
    vi.unstubAllGlobals();
    vi.doUnmock("../../src/utils/featureDetect");
    vi.doUnmock("motion/react");
    vi.resetModules();
    document.getElementById("fluidkit-liquid-text-keyframes")?.remove();
  });

  it('rejects the old "ink" material name at the type level', () => {
    // @ts-expect-error — "ink" was renamed to "flat" and must be gone
    const rejected: LiquidTextMaterial = "ink";
    const accepted: LiquidTextMaterial = "flat";
    expect(rejected).not.toBe(accepted);
  });

  it('material="flat" renders solid-color glyphs (the old ink path)', async () => {
    const LiquidText = await loadLiquidText(true);
    // Force the no-background-clip branch so the flat path is literally
    // `color` on the element — deterministic regardless of jsdom's
    // CSS.supports answer.
    vi.stubGlobal("CSS", { supports: () => false });
    const { container } = render(
      <LiquidText material="flat" color="#123456">
        Solid words
      </LiquidText>
    );

    const wrapper = wrapperOf(container);
    expect(wrapper.getAttribute("data-material")).toBe("flat");
    expect(wrapper.style.color).toBe("rgb(18, 52, 86)");
    // No glyph-masked glass layers on the solid path.
    expect(maskedLayers(container)).toHaveLength(0);
  });

  it('falls back to "flat" for non-string children (no mask source)', async () => {
    const LiquidText = await loadLiquidText(true);
    const { container } = render(
      <LiquidText>
        <b>not a string</b>
      </LiquidText>
    );

    expect(wrapperOf(container).getAttribute("data-material")).toBe("flat");
    expect(maskedLayers(container)).toHaveLength(0);
  });

  it('falls back to "flat" when backdrop-filter is unsupported', async () => {
    const LiquidText = await loadLiquidText(false);
    const { container } = render(<LiquidText>No frost here</LiquidText>);

    expect(wrapperOf(container).getAttribute("data-material")).toBe("flat");
    expect(maskedLayers(container)).toHaveLength(0);
  });

  it("glass: routes the recipe through resolveMaterial — shared tint, blur in the backdrop chain", async () => {
    const LiquidText = await loadLiquidText(true);
    const { container } = render(<LiquidText>Glass words</LiquidText>);

    expect(wrapperOf(container).getAttribute("data-material")).toBe("glass");
    const fill = glassFillOf(container);
    expect(fill, "expected a glyph-masked glass fill layer").toBeDefined();
    // The shared resolver's default tint (alpha 0.3), not a private recipe.
    expect(fill!.style.background).toBe("rgba(255, 255, 255, 0.3)");
    // Glyph-masked glass keeps its deliberate 10px blur (not the shared
    // 16px) but the rest of the chain is the resolver's.
    expect(fill!.style.backdropFilter).toContain("blur(10px)");
    expect(fill!.style.backdropFilter).toContain("saturate(1.8)");
    // The resolver's compositor hint rides along.
    expect(fill!.style.willChange).toBe("transform");
    // Masked to the glyphs: an SVG-of-the-text data URI.
    expect(fill!.style.maskImage).toContain("data:image/svg+xml");
  });

  it("glass: a custom tint reaches the glass layer's background", async () => {
    const LiquidText = await loadLiquidText(true);
    const { container } = render(
      <LiquidText tint="rgba(200, 220, 255, 0.4)">Tinted</LiquidText>
    );

    const fill = glassFillOf(container);
    expect(fill, "expected a glyph-masked glass fill layer").toBeDefined();
    expect(fill!.style.background).toBe("rgba(200, 220, 255, 0.4)");
    expect(fill!.style.backdropFilter).toContain("blur");
  });

  it("sheen: still renders at defaults — keyframes injected, sweep running", async () => {
    const LiquidText = await loadLiquidText(true);
    const { container } = render(<LiquidText>Sheen check</LiquidText>);

    expect(document.getElementById("fluidkit-liquid-text-keyframes")).not.toBeNull();
    const sheen = sheenLayerOf(container);
    expect(sheen, "expected a glyph-masked sheen layer").toBeDefined();
    expect(sheen!.style.animationName).toBe("fluidkit-liquid-text-sweep");
    expect(sheen!.style.animationDuration).toBe("7s");
    // Default angle: the house light's 115deg.
    expect(sheen!.style.backgroundImage).toContain("115deg");
  });

  it("sheen: angle and speed props keep working", async () => {
    const LiquidText = await loadLiquidText(true);
    const { container } = render(
      <LiquidText angle={130} speed={2}>
        Angled sweep
      </LiquidText>
    );

    const sheen = sheenLayerOf(container);
    expect(sheen, "expected a glyph-masked sheen layer").toBeDefined();
    expect(sheen!.style.backgroundImage).toContain("130deg");
    expect(sheen!.style.animationDuration).toBe("3.5s");
  });
});
