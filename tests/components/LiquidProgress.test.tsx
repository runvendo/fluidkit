import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

async function loadProgress(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidProgress");
  return mod.LiquidProgress;
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

describe("LiquidProgress", () => {
  it("carries the progressbar role and ARIA values", async () => {
    const LiquidProgress = await loadProgress(true);
    render(<LiquidProgress value={0.6} aria-label="Upload" />);
    const bar = document.querySelector('[data-fluidkit="liquid-progress"]')!;
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0.6");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("1");
    expect(bar.getAttribute("aria-label")).toBe("Upload");
  });

  it("follows the native progress convention: value against max", async () => {
    const LiquidProgress = await loadProgress(true);
    render(<LiquidProgress value={60} max={100} aria-label="p" />);
    const bar = document.querySelector('[data-fluidkit="liquid-progress"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("60");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("clamps out-of-range values", async () => {
    const LiquidProgress = await loadProgress(true);
    render(<LiquidProgress value={140} max={100} aria-label="p" />);
    expect(
      document
        .querySelector('[data-fluidkit="liquid-progress"]')
        ?.getAttribute("aria-valuenow")
    ).toBe("100");
  });

  it("reduced motion renders the static fill, no loop", async () => {
    const LiquidProgress = await loadProgress(true);
    render(<LiquidProgress value={0.4} aria-label="p" />);
    expect(
      document
        .querySelector('[data-fluidkit="liquid-progress"]')
        ?.getAttribute("data-animating")
    ).toBe("false");
  });
});
