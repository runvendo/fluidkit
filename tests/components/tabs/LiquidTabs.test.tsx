import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

/**
 * Mock `motion/react` per test so only `useReducedMotion` is overridden, then
 * re-import LiquidTabs fresh against the mock (same pattern as other component
 * tests). jsdom reports 0 for offset* so geometry is degenerate — assert
 * structure, roles, colors, and callbacks, not pixel geometry.
 */
async function loadTabs(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../../src/components/tabs/LiquidTabs");
  return mod.LiquidTabs;
}

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
];

describe("LiquidTabs (bar)", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders one tab per item with role=tab and a role=tablist container", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs).toHaveLength(3);
    expect(tabs[1].textContent).toContain("Two");
  });

  it("marks the active tab via aria-selected", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="two" onChange={() => {}} />
    );
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("calls onChange with the clicked id (controlled)", async () => {
    const LiquidTabs = await loadTabs(false);
    const onChange = vi.fn();
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={onChange} />
    );
    fireEvent.click(container.querySelectorAll('[data-fluidkit="liquid-tab"]')[2]);
    expect(onChange).toHaveBeenCalledWith("three");
  });

  it("works uncontrolled: defaultValue selects, clicking moves selection", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(<LiquidTabs items={ITEMS} defaultValue="two" />);
    let tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.click(tabs[2]);
    tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
  });

  it("defaults selection to the first enabled item when none is given", async () => {
    const LiquidTabs = await loadTabs(false);
    const items = [
      { id: "one", label: "One", disabled: true },
      { id: "two", label: "Two" },
    ];
    const { container } = render(<LiquidTabs items={items} />);
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("ink material fills the indicator with the resolved color", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} material="ink" color="#abcdef" />
    );
    const fill = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"] [data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    expect(fill.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });

  it("draws the indicator as engine geometry (clip-path)", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    const clip = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"] [data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(clip.style.clipPath).toContain("path(");
  });

  it("renders an icon slot when provided", async () => {
    const LiquidTabs = await loadTabs(false);
    const items = [
      { id: "one", label: "One", icon: <svg data-testid="ic" /> },
      { id: "two", label: "Two" },
    ];
    const { getByTestId } = render(<LiquidTabs items={items} value="one" onChange={() => {}} />);
    expect(getByTestId("ic")).toBeTruthy();
  });

  it("does not call onChange when a disabled tab is clicked", async () => {
    const LiquidTabs = await loadTabs(false);
    const onChange = vi.fn();
    const items = [
      { id: "one", label: "One" },
      { id: "two", label: "Two", disabled: true },
    ];
    const { container } = render(
      <LiquidTabs items={items} value="one" onChange={onChange} />
    );
    fireEvent.click(container.querySelectorAll('[data-fluidkit="liquid-tab"]')[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reflects size via data-size", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} size="lg" />
    );
    expect(
      container.querySelector('[data-fluidkit="liquid-tabs"]')?.getAttribute("data-size")
    ).toBe("lg");
  });

  it("marks instant motion and keeps a single-pill clip under reduced motion", async () => {
    const LiquidTabs = await loadTabs(true);
    const { container, rerender } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    rerender(<LiquidTabs items={ITEMS} value="three" onChange={() => {}} />);
    const stage = container.querySelector('[data-fluidkit="liquid-tabs"]');
    expect(stage?.getAttribute("data-motion")).toBe("instant");
    const clip = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"] [data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect((clip.style.clipPath.match(/Z/g) ?? []).length).toBe(1);
  });

  it("keeps filters off the label ancestry (text never rasterized)", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    const stage = container.querySelector('[data-fluidkit="liquid-tabs"]') as HTMLElement;
    let node: HTMLElement | null = container.querySelector('[data-fluidkit="liquid-tab"]');
    while (node) {
      expect(node.style.filter).toBe("");
      if (node === stage) break;
      node = node.parentElement;
    }
  });

  it("moves DOM focus to the newly selected tab on arrow-key navigation", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(<LiquidTabs items={ITEMS} defaultValue="one" />);
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    (tabs[0] as HTMLElement).focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    // selection advanced to "two" and browser focus followed it
    const active = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(active[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(active[1]);
  });

  it("merges consumer className", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} className="mine" />
    );
    expect(
      container.querySelector('[data-fluidkit="liquid-tabs"]')?.className
    ).toContain("mine");
  });

  it("omits aria-controls when standalone (no Group panel to point at)", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    const tab = container.querySelector('[data-fluidkit="liquid-tab"]') as HTMLElement;
    expect(tab.getAttribute("aria-controls")).toBeNull();
    expect(tab.getAttribute("id")).toBeNull();
  });
});

describe("LiquidTabs (bar) — mid-transition re-measure", () => {
  const OFFSETS = ["offsetHeight", "offsetWidth", "offsetLeft"] as const;
  const OFFSET_VALUES: Record<(typeof OFFSETS)[number], number> = {
    offsetHeight: 40,
    offsetWidth: 80,
    offsetLeft: 10,
  };

  afterEach(() => {
    // Restore jsdom's zero-offset behavior so the other suite is unaffected.
    for (const prop of OFFSETS) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        value: 0,
      });
    }
    vi.doUnmock("motion/react");
    vi.doUnmock("../../../src/liquid/useMotionSprings");
    vi.resetModules();
  });

  it("does not snap the indicator when re-measured with a fresh items array (same selection)", async () => {
    for (const prop of OFFSETS) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        value: OFFSET_VALUES[prop],
      });
    }

    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });

    const snapTo = vi.fn();
    const setTargets = vi.fn();
    const setTarget = vi.fn();
    vi.doMock("../../../src/liquid/useMotionSprings", () => ({
      useMotionSprings: (count: number) => ({
        values: Array.from({ length: count }, () => ({
          get: () => 0,
          getVelocity: () => 0,
        })),
        snapTo,
        setTargets,
        setTarget,
      }),
    }));

    const { LiquidTabs } = await import(
      "../../../src/components/tabs/LiquidTabs"
    );

    const items1 = [
      { id: "one", label: "One" },
      { id: "two", label: "Two" },
      { id: "three", label: "Three" },
    ];
    const { rerender } = render(
      <LiquidTabs items={items1} value="two" onChange={() => {}} />
    );

    // Ignore the mount-time placement snap; watch only the incidental re-render.
    snapTo.mockClear();
    setTargets.mockClear();
    setTarget.mockClear();

    // Simulate a stray parent re-render: same selection, brand-new items array.
    const items2 = [
      { id: "one", label: "One" },
      { id: "two", label: "Two" },
      { id: "three", label: "Three" },
    ];
    rerender(<LiquidTabs items={items2} value="two" onChange={() => {}} />);

    expect(snapTo).not.toHaveBeenCalled();
  });

  it("re-snaps the recreated springs when the flow prop changes (same selection)", async () => {
    for (const prop of OFFSETS) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        value: OFFSET_VALUES[prop],
      });
    }

    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });

    const snapTo = vi.fn();
    const setTargets = vi.fn();
    const setTarget = vi.fn();
    vi.doMock("../../../src/liquid/useMotionSprings", () => ({
      // Return 3 stub values (slide's count); stretch uses 2 — extras are
      // harmless. Recreated per render regardless of springCount change.
      useMotionSprings: () => ({
        values: Array.from({ length: 3 }, () => ({
          get: () => 0,
          getVelocity: () => 0,
        })),
        snapTo,
        setTargets,
        setTarget,
      }),
    }));

    const { LiquidTabs } = await import(
      "../../../src/components/tabs/LiquidTabs"
    );

    const { rerender } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} flow="slide" />
    );

    // Kick off a genuine transition so the bar is mid-flow (`settling` true) —
    // this is the window in which the flow-change bug freezes the indicator,
    // because the `prev === selected` guard skips the re-snap while settling.
    rerender(
      <LiquidTabs items={ITEMS} value="two" onChange={() => {}} flow="slide" />
    );

    // Ignore snaps up to now; watch only the flow switch.
    snapTo.mockClear();

    // Same selection, flow changed mid-transition: the recreated springs must
    // be snapped onto the resting pill, not left frozen at the degenerate
    // origin until the settle timer fires.
    rerender(
      <LiquidTabs items={ITEMS} value="two" onChange={() => {}} flow="stretch" />
    );

    expect(snapTo).toHaveBeenCalled();
  });
});
