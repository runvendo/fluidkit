/**
 * Graceful-degradation contract — LiquidMenu.
 *
 * Already pinned in tests/components/LiquidMenu.test.tsx: the full ARIA
 * menu-button keyboard pattern, focus return, outside-click close.
 *
 * Asserted here: under reduced motion the menu opens as a static poured
 * surface (opacity fade only, no loop) with items immediately
 * interactive; glass degrades to a flat fill with no backdrop chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { frames, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement(200, 150);
  return await import("../../src/components/LiquidMenu");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

const ITEMS = (onSelect: () => void) => [
  { label: "Rename", onSelect },
  { label: "Delete", onSelect: () => {} },
];

describe("LiquidMenu degradation contract", () => {
  it("reduced motion: opens static (no loop), items immediately interactive", async () => {
    const { LiquidMenu } = await load(true);
    const onSelect = vi.fn();
    render(
      <LiquidMenu trigger={<button>Options</button>} items={ITEMS(onSelect)} />
    );
    act(() => {
      fireEvent.click(screen.getByText("Options"));
    });
    const surface = document.querySelector('[data-fluidkit="liquid-menu"]')!;
    expect(surface.getAttribute("data-animating")).toBe("false");

    const clip = surface.querySelector('[data-fluidkit="liquid-clip"]') as HTMLElement;
    const before = clip.style.clipPath;
    await frames(150);
    expect(clip.style.clipPath).toBe(before);

    fireEvent.click(screen.getByText("Rename"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("missing backdrop-filter: no backdrop chain on the menu fill", async () => {
    const { LiquidMenu } = await load(true);
    render(
      <LiquidMenu trigger={<button>Options</button>} items={ITEMS(() => {})} />
    );
    act(() => {
      fireEvent.click(screen.getByText("Options"));
    });
    const fills = document.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
    });
  });
});
