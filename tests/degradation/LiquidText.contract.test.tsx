/**
 * Graceful-degradation contract — LiquidText.
 *
 * Already pinned in tests/components/LiquidText.test.tsx (not duplicated):
 * glass falls back to "flat" when backdrop-filter is unsupported or the
 * children aren't a plain string, and the sheen sweep runs at defaults.
 *
 * Asserted here:
 * - Reduced motion: the sweep keyframes are dropped (`animation-name:
 *   none`) and the sheen parks — the glyphs stay real, selectable text.
 *   (Needs `CSS.supports` stubbed for background-clip, since bare jsdom
 *   takes the no-clip path below instead.)
 * - Missing capability, worst case (bare jsdom: no backdrop-filter AND no
 *   background-clip): plain solid-color glyphs — readable text, no
 *   transparent-ink trick that could vanish.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { mockEnv, unmockEnv } from "./harness";

async function loadLiquidText(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/LiquidText");
  return mod.LiquidText;
}

describe("LiquidText degradation contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    unmockEnv();
    document.getElementById("fluidkit-liquid-text-keyframes")?.remove();
  });

  it("reduced motion: the sheen sweep parks (animation-name: none), text still renders", async () => {
    // Capability-PRESENT side needs a light stub: give jsdom a CSS.supports
    // that answers yes for background-clip:text only (backdrop-filter stays
    // unsupported, matching a Firefox-ish profile).
    vi.stubGlobal("CSS", {
      supports: (property: string) => property.includes("background-clip"),
    });
    const LiquidText = await loadLiquidText(true);
    const { container, getByText } = render(
      <LiquidText material="flat">Liquid type</LiquidText>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-text"]'
    ) as HTMLElement;
    expect(getByText("Liquid type")).toBeInTheDocument();
    expect(root.style.animationName).toBe("none");
  });

  it("missing background-clip AND backdrop-filter: plain solid-color glyphs render", async () => {
    // Bare jsdom: no CSS.supports at all — both capabilities absent.
    const LiquidText = await loadLiquidText(true);
    const { container, getByText } = render(
      <LiquidText color="#123456">Liquid type</LiquidText>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-text"]'
    ) as HTMLElement;
    expect(getByText("Liquid type")).toBeInTheDocument();
    expect(root.getAttribute("data-material")).toBe("flat");
    // Solid ink, not the transparent background-clip trick.
    expect(root.style.color).toBe("rgb(18, 52, 86)");
    expect(root.style.backgroundClip).toBe("");
  });
});
