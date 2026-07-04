import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentType } from "react";
import type { LiquidPanelProps } from "../../src/components/LiquidPanel";

/**
 * These tests assert what React PAINTS on the exact commit where `open`
 * flips — the frame users see before any post-paint effect runs. RTL's
 * `render`/`act` flush passive effects before returning, which hides that
 * frame, so they use a raw root + `flushSync` instead and read the DOM
 * before effects fire.
 */

async function loadLiquidPanel(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidPanel");
  return mod.LiquidPanel;
}

const SIZE = { width: 300, height: 200 };

function clipPathOf(container: HTMLElement): string {
  const clip = container.querySelector(
    '[data-fluidkit="liquid-clip"]'
  ) as HTMLElement;
  return clip.style.clipPath;
}

function surfaceOf(container: HTMLElement): HTMLElement {
  return container.querySelector(
    '[data-fluidkit="liquid-panel-surface"]'
  ) as HTMLElement;
}

describe("LiquidPanel flip-commit paint (flash guard)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreSizes: () => void;

  beforeEach(() => {
    // The flip-commit frames must render outside `act`, and React should
    // not warn about it: this is deliberate paint-level testing.
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = false;
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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    restoreSizes();
    vi.unstubAllGlobals();
    vi.doUnmock("motion/react");
    vi.resetModules();
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  });

  const renderPanel = (
    LiquidPanel: ComponentType<LiquidPanelProps>,
    open: boolean
  ) => {
    flushSync(() => {
      root.render(<LiquidPanel open={open}>content</LiquidPanel>);
    });
  };

  /** Let post-paint (passive) effects land, matching a real painted frame. */
  const settleEffects = () => new Promise((r) => setTimeout(r, 20));

  it("paints the drained geometry on the open-flip commit, not the full panel", async () => {
    const LiquidPanel = await loadLiquidPanel(false);

    // Reference: a panel that mounts already open paints the full pour.
    renderPanel(LiquidPanel, true);
    await settleEffects();
    const fullPath = clipPathOf(container);
    root.unmount();
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Closed at rest…
    renderPanel(LiquidPanel, false);
    await settleEffects();
    const drainedPath = clipPathOf(container);
    expect(drainedPath).not.toBe(fullPath);

    // …then flip open. The very first committed frame must still show the
    // spring's current (drained) geometry — the pour animates in later.
    renderPanel(LiquidPanel, true);
    expect(clipPathOf(container)).toBe(drainedPath);
    expect(clipPathOf(container)).not.toBe(fullPath);
  });

  it("keeps the surface visible on the close-flip commit (no one-frame blink-out)", async () => {
    const LiquidPanel = await loadLiquidPanel(false);

    renderPanel(LiquidPanel, true);
    await settleEffects();

    renderPanel(LiquidPanel, false);
    // The drain must be watchable: the surface only hides once the drain
    // settles, never on the flip frame itself.
    expect(surfaceOf(container).style.visibility).not.toBe("hidden");
  });

  it("still hides the closed-at-rest sliver", async () => {
    const LiquidPanel = await loadLiquidPanel(false);

    renderPanel(LiquidPanel, false);
    await settleEffects();

    expect(surfaceOf(container).style.visibility).toBe("hidden");
  });
});
