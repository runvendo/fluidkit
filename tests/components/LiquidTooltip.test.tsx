import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { expectTintReachesGlassFill } from "./surfacePack";

/**
 * Loads LiquidTooltip fresh with `featureDetect` mocked so refraction and
 * real glass can be exercised (jsdom's real `CSS.supports` always says no).
 */
async function loadLiquidTooltip({
  supportsBackdropFilter = false,
  supportsRefraction = false,
}: {
  supportsBackdropFilter?: boolean;
  supportsRefraction?: boolean;
} = {}) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../src/utils/featureDetect")>();
    return {
      ...actual,
      supportsBackdropFilter: () => supportsBackdropFilter,
      supportsRefraction: () => supportsRefraction,
    };
  });
  const mod = await import("../../src/components/LiquidTooltip");
  return mod.LiquidTooltip;
}

const LABEL_SIZE = { width: 80, height: 24 };

/** The droplet's engine subtree mounts once the label is measured, not only
 * while visible (visibility is CSS-only) — focus shows it without delay, so
 * tests use focus rather than hover+timers. */
function showTooltip(getByText: (text: string) => HTMLElement) {
  fireEvent.focus(getByText("trigger"));
}

describe("LiquidTooltip refraction", () => {
  beforeEach(() => {
    // The droplet sizes itself off the measured label; jsdom has neither
    // ResizeObserver nor layout, so stub the observer and pin the size.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
      LABEL_SIZE.width
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
      LABEL_SIZE.height
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("../../src/utils/featureDetect");
    vi.resetModules();
  });

  it("mounts the refraction filter defs only when enabled on glass, and only once visible", async () => {
    const LiquidTooltip = await loadLiquidTooltip({ supportsRefraction: true });
    const { container, getByText } = render(
      <LiquidTooltip content="hi" refraction material="glass">
        <span tabIndex={0}>trigger</span>
      </LiquidTooltip>
    );
    // The defs mount as soon as refraction+glass are configured — they
    // don't depend on visibility, only the droplet's LiquidRenderer does.
    expect(container.querySelector("filter")).not.toBeNull();
    showTooltip(getByText);
    expect(container.querySelector("filter")).not.toBeNull();
  });

  it("does not mount the refraction filter with the default props", async () => {
    const LiquidTooltip = await loadLiquidTooltip({ supportsRefraction: true });
    const { container, getByText } = render(
      <LiquidTooltip content="hi">
        <span tabIndex={0}>trigger</span>
      </LiquidTooltip>
    );
    showTooltip(getByText);
    expect(container.querySelector("filter")).toBeNull();
  });

  it("does not mount refraction defs on flat material even when refraction is enabled", async () => {
    const LiquidTooltip = await loadLiquidTooltip({ supportsRefraction: true });
    const { container, getByText } = render(
      <LiquidTooltip content="hi" refraction material="flat">
        <span tabIndex={0}>trigger</span>
      </LiquidTooltip>
    );
    showTooltip(getByText);
    expect(container.querySelector("filter")).toBeNull();
  });

  it("does not mount refraction defs when unsupported, even if enabled on glass", async () => {
    const LiquidTooltip = await loadLiquidTooltip({
      supportsRefraction: false,
    });
    const { container, getByText } = render(
      <LiquidTooltip content="hi" refraction material="glass">
        <span tabIndex={0}>trigger</span>
      </LiquidTooltip>
    );
    showTooltip(getByText);
    expect(container.querySelector("filter")).toBeNull();
  });

  // Surface style pack conformance smoke: `tint` reaches the glass fill.
  // The fill mounts once the label is measured (visibility is CSS-only);
  // focus the trigger anyway so the droplet is in its shown state.
  it("applies `tint` to the glass fill once visible", async () => {
    const LiquidTooltip = await loadLiquidTooltip({
      supportsBackdropFilter: true,
    });
    const tint = "rgba(200, 220, 255, 0.4)";
    const { container, getByText } = render(
      <LiquidTooltip content="hi" material="glass" tint={tint}>
        <span tabIndex={0}>trigger</span>
      </LiquidTooltip>
    );
    showTooltip(getByText);
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    expect(fill).not.toBeNull();
    expect(fill.style.background).toBe(tint);
    expect(fill.style.backdropFilter).toContain("blur");
  });
});
