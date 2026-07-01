import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

/**
 * `LiquidTabs` composes `useGoo()` (reduced-motion-aware goo filter) and
 * `usePrefersReducedMotion()`, both of which read Motion's
 * `useReducedMotion()` under the hood. Matching the pattern proven in
 * tests/components/ThinkingBlob.test.tsx, we mock `motion/react` per test,
 * always keeping the real `motion` factory (via `importOriginal`) so
 * `motion.div`'s `layoutId` FLIP machinery still renders — only
 * `useReducedMotion` is overridden. Each test resets the module registry so
 * `LiquidTabs` and its dependency chain are re-imported fresh against the
 * mock.
 */

async function mockReducedMotion(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidTabs");
  return mod.LiquidTabs;
}

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
];

describe("LiquidTabs", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders one tab per item with the right labels", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );

    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].textContent).toContain("One");
    expect(tabs[1].textContent).toContain("Two");
    expect(tabs[2].textContent).toContain("Three");
  });

  it("marks the tab matching `value` as selected and others as not", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="two" onChange={() => {}} />
    );

    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(tabs[2].getAttribute("aria-selected")).toBe("false");
  });

  it("calls onChange with the clicked tab's id", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const onChange = vi.fn();
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={onChange} />
    );

    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    fireEvent.click(tabs[2]);

    expect(onChange).toHaveBeenCalledWith("three");
  });

  it("renders exactly one indicator, and it lives outside every tab button", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="two" onChange={() => {}} />
    );

    const indicators = container.querySelectorAll(
      '[data-fluidkit="liquid-tab-indicator"]'
    );
    expect(indicators).toHaveLength(1);

    // The indicator now lives in its own goo-filtered layer, never nested
    // among the crisp tab labels — so no tab button contains it.
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    tabs.forEach((tab) => {
      expect(tab.contains(indicators[0])).toBe(false);
    });
  });

  it("applies the goo filter to the indicator layer and mounts defs when motion is allowed", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );

    const layer = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator-layer"]'
    ) as HTMLElement;

    // jsdom's CSSOM normalizes `url(...)` values by quoting them; the id
    // inside is what actually matters here (see useGoo.test.tsx). The goo
    // filter now lives on the indicator LAYER, not the container — so the
    // text (in the sibling buttons layer) is never inside the filter.
    expect(layer.style.filter).toBe('url("#fluidkit-goo")');
    expect(document.getElementById("fluidkit-defs")).not.toBeNull();

    const stage = container.querySelector(
      '[data-fluidkit="liquid-tabs"]'
    ) as HTMLElement;
    expect(stage.getAttribute("data-motion")).toBe("liquid");
  });

  it("keeps the goo filter off the container so text is never inside it", async () => {
    // Guard test encoding the library's non-negotiable principle: the tab
    // LABELS (text) must never be a descendant of a goo-filtered element,
    // or CSS `filter` rasterizes and erases them. Walk up from a tab button
    // to the container and assert no ancestor carries the goo filter. This
    // fails on the old (indicator-inside-active-button) structure and passes
    // only when the text lives outside the filtered layer.
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );

    const stage = container.querySelector(
      '[data-fluidkit="liquid-tabs"]'
    ) as HTMLElement;
    let node: HTMLElement | null = container.querySelector(
      '[data-fluidkit="liquid-tab"]'
    );

    expect(node).not.toBeNull();
    while (node) {
      expect(node.style.filter).not.toContain("fluidkit-goo");
      if (node === stage) break;
      node = node.parentElement;
    }
  });

  it("drops the goo filter and marks instant motion under prefers-reduced-motion", async () => {
    const LiquidTabs = await mockReducedMotion(true);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );

    const layer = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator-layer"]'
    ) as HTMLElement;
    expect(layer.style.filter).toBe("");

    const stage = container.querySelector(
      '[data-fluidkit="liquid-tabs"]'
    ) as HTMLElement;
    expect(stage.getAttribute("data-motion")).toBe("instant");
  });

  it("colors the indicator with the resolved `color` prop", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs
        items={ITEMS}
        value="one"
        onChange={() => {}}
        color="#abcdef"
      />
    );

    const indicator = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"]'
    ) as HTMLElement;

    // jsdom's CSSOM normalizes hex colors to rgb() for backgroundColor, so
    // the serialized inline style differs from the raw hex string passed in;
    // #abcdef === rgb(171, 205, 239) is what actually matters here.
    expect(indicator.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });

  it("gives the tab strip role=tablist and each tab role=tab", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );

    const stage = container.querySelector('[data-fluidkit="liquid-tabs"]');
    expect(stage?.getAttribute("role")).toBe("tablist");

    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    tabs.forEach((tab) => {
      expect(tab.getAttribute("role")).toBe("tab");
    });
  });

  it("merges consumer className onto the container", async () => {
    const LiquidTabs = await mockReducedMotion(false);
    const { container } = render(
      <LiquidTabs
        items={ITEMS}
        value="one"
        onChange={() => {}}
        className="custom-class"
      />
    );

    const stage = container.querySelector('[data-fluidkit="liquid-tabs"]');
    expect(stage?.className).toContain("custom-class");
  });
});
