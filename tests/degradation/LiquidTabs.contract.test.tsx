/**
 * Graceful-degradation contract — LiquidTabs (incl. its `.Group`/`.Panel`
 * statics, whose behavior is pure state plumbing pinned in
 * tests/components/tabs/TabsGroup.test.tsx and TabPanel.test.tsx).
 *
 * Already pinned in tests/components/tabs/LiquidTabs.test.tsx (not
 * duplicated): reduced motion marks data-motion="instant" and keeps a
 * single snapped pill (no flow), glints stay on the resting pill, and a
 * CUSTOM tint reaches the fallback fill when backdrop-filter is missing.
 *
 * Asserted here: tabs stay interactive under reduced motion (selection
 * still moves on click), and the DEFAULT-tint documented fallback fill on
 * both the glass indicator and the glass container.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  GLASS_FALLBACK_FILL,
  mockEnv,
  unmockEnv,
} from "./harness";

async function loadTabs(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/tabs/index");
  return mod.LiquidTabs;
}

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
];

describe("LiquidTabs degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: tabs stay interactive — clicking still moves the selection", async () => {
    const LiquidTabs = await loadTabs(true);
    const onChange = vi.fn();
    const { getByText } = render(
      <LiquidTabs items={ITEMS} defaultValue="one" onChange={onChange} />
    );
    fireEvent.click(getByText("Two"));
    expect(onChange).toHaveBeenCalledWith("two");
    expect(getByText("Two").closest("button")?.getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("missing backdrop-filter: glass indicator and container degrade to the documented frosted fill", async () => {
    const LiquidTabs = await loadTabs(true);
    const { container } = render(
      <LiquidTabs items={ITEMS} defaultValue="one" material="glass" />
    );
    // Indicator: the engine fill degrades to the resolver's fallback.
    expectGlassFallbackFill(container);
    // Container chrome: same resolver, same documented fallback fill.
    const tablist = container.querySelector('[role="tablist"]') as HTMLElement;
    expect(tablist.style.background).toBe(GLASS_FALLBACK_FILL);
    expect(tablist.style.backdropFilter).toBe("");
  });
});
