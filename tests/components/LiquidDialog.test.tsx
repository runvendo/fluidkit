import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { expectTintReachesGlassFill } from "./surfacePack";

async function loadLiquidDialog(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidDialog");
  return mod.LiquidDialog;
}

/** Same as `loadLiquidDialog`, plus a mocked `featureDetect` so refraction
 * and real glass can be exercised (jsdom's real `CSS.supports` always says
 * no). */
async function loadLiquidDialogWithFeatures(
  reduced: boolean,
  {
    supportsBackdropFilter = false,
    supportsRefraction = false,
  }: { supportsBackdropFilter?: boolean; supportsRefraction?: boolean } = {}
) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  vi.doMock("../../src/utils/featureDetect", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../src/utils/featureDetect")>();
    return {
      ...actual,
      supportsBackdropFilter: () => supportsBackdropFilter,
      supportsRefraction: () => supportsRefraction,
    };
  });
  const mod = await import("../../src/components/LiquidDialog");
  return mod.LiquidDialog;
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("motion/react");
  vi.doUnmock("../../src/utils/featureDetect");
  vi.resetModules();
});

describe("LiquidDialog", () => {
  it("hints the compositor on the backdrop whose opacity and blur transition", async () => {
    // The backdrop mounts fresh every open and immediately transitions
    // opacity + backdrop-filter. Without will-change the layer is built
    // cold (worse after the page has sat idle) and the first frames can
    // paint unblurred.
    const LiquidDialog = await loadLiquidDialog(true);
    render(<LiquidDialog open>hello</LiquidDialog>);

    const backdrop = document.querySelector(
      '[data-fluidkit="liquid-dialog-backdrop"]'
    ) as HTMLElement;
    expect(backdrop).not.toBeNull();
    expect(backdrop.style.willChange).toContain("opacity");
    expect(backdrop.style.willChange).toContain("backdrop-filter");
  });

  // The dialog portals to `document.body`, not the RTL container, so these
  // query `document` directly (like the compositor-hint test above).

  it("mounts the refraction filter defs only when enabled on glass", async () => {
    const LiquidDialog = await loadLiquidDialogWithFeatures(true, {
      supportsRefraction: true,
    });
    const withDefault = render(<LiquidDialog open>hello</LiquidDialog>);
    expect(document.querySelector("filter")).toBeNull();
    withDefault.unmount();

    render(
      <LiquidDialog open refraction material="glass">
        hello
      </LiquidDialog>
    );
    expect(document.querySelector("filter")).not.toBeNull();
  });

  it("does not mount refraction defs on flat material even when refraction is enabled", async () => {
    const LiquidDialog = await loadLiquidDialogWithFeatures(true, {
      supportsRefraction: true,
    });
    render(
      <LiquidDialog open refraction material="flat">
        hello
      </LiquidDialog>
    );
    expect(document.querySelector("filter")).toBeNull();
  });

  it("does not mount refraction defs when unsupported, even if enabled on glass", async () => {
    const LiquidDialog = await loadLiquidDialogWithFeatures(true, {
      supportsRefraction: false,
    });
    render(
      <LiquidDialog open refraction material="glass">
        hello
      </LiquidDialog>
    );
    expect(document.querySelector("filter")).toBeNull();
  });

  // Surface style pack conformance smoke: `tint` reaches the glass fill.
  // The dialog portals out of the RTL container, so the helper's own
  // `container` scoping doesn't reach it — point it at `document.body`.
  it("applies `tint` to the glass fill", async () => {
    const LiquidDialog = await loadLiquidDialogWithFeatures(true, {
      supportsBackdropFilter: true,
    });
    expectTintReachesGlassFill((props) => {
      const result = render(
        <LiquidDialog open {...props}>
          hello
        </LiquidDialog>
      );
      return { ...result, container: document.body };
    });
  });
});
