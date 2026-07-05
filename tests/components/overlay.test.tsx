import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  OVERLAY_Z,
  overlayRoot,
  overlayZ,
} from "../../src/components/overlay";

async function loadLiquidDialog(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
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
  vi.resetModules();
});

describe("overlay layer", () => {
  it("stacks the layers dialog < menu < toast < tooltip by default", () => {
    expect(OVERLAY_Z.dialog).toBeLessThan(OVERLAY_Z.menu);
    expect(OVERLAY_Z.menu).toBeLessThan(OVERLAY_Z.toast);
    expect(OVERLAY_Z.toast).toBeLessThan(OVERLAY_Z.tooltip);
  });

  it("exposes each layer as an overridable --fluidkit-z-* custom property", () => {
    expect(overlayZ("dialog")).toBe(
      `var(--fluidkit-z-dialog, ${OVERLAY_Z.dialog})`
    );
    expect(overlayZ("menu")).toBe(`var(--fluidkit-z-menu, ${OVERLAY_Z.menu})`);
    expect(overlayZ("toast")).toBe(
      `var(--fluidkit-z-toast, ${OVERLAY_Z.toast})`
    );
    expect(overlayZ("tooltip")).toBe(
      `var(--fluidkit-z-tooltip, ${OVERLAY_Z.tooltip})`
    );
  });

  it("portals to document.body in the browser", () => {
    expect(overlayRoot()).toBe(document.body);
  });

  it("puts the dialog backdrop on the dialog layer", async () => {
    const LiquidDialog = await loadLiquidDialog(true);
    render(
      <LiquidDialog open aria-label="Test">
        <p>hi</p>
      </LiquidDialog>
    );
    const backdrop = document.querySelector(
      '[data-fluidkit="liquid-dialog-backdrop"]'
    ) as HTMLElement;
    expect(backdrop).not.toBeNull();
    expect(backdrop.style.zIndex).toBe(overlayZ("dialog"));
  });
});
