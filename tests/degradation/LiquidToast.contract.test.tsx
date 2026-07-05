/**
 * Graceful-degradation contract — LiquidToast.
 *
 * Already pinned in tests/components/LiquidToast.test.tsx: dispatcher
 * queueing, dedupe, stack cap, hover pause, timers unchanged under
 * reduced motion.
 *
 * Asserted here: under reduced motion a toast renders its content
 * immediately (opacity-only presentation, no condense loop) and its
 * controls stay interactive; glass degrades to a flat fill with no
 * backdrop chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { frames, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement(260, 46);
  return await import("../../src/components/LiquidToast");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

describe("LiquidToast degradation contract", () => {
  it("reduced motion: content shows immediately, close stays interactive, geometry static", async () => {
    const { LiquidToastProvider, toast } = await load(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("Saved", { duration: 0 });
    });
    const item = document.querySelector('[data-fluidkit="liquid-toast"]')!;
    expect(item.getAttribute("data-animating")).toBe("false");
    expect(screen.getByText("Saved")).toBeVisible();

    const clip = item.querySelector('[data-fluidkit="liquid-clip"]') as HTMLElement;
    const before = clip.style.clipPath;
    await frames(150);
    expect(clip.style.clipPath).toBe(before);

    fireEvent.click(item.querySelector('[aria-label="Close"]')!);
    await frames(600);
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("missing backdrop-filter: no backdrop chain on the toast fill", async () => {
    const { LiquidToastProvider, toast } = await load(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("Saved", { duration: 0 });
    });
    const fills = document.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
    });
  });
});
