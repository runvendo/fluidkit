import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

async function loadModule(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const bar = await import("../../../src/components/tabs/LiquidTabs");
  const group = await import("../../../src/components/tabs/TabsGroup");
  const panel = await import("../../../src/components/tabs/TabPanel");
  return { LiquidTabs: bar.LiquidTabs, TabsGroup: group.TabsGroup, TabPanel: panel.TabPanel };
}

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
];

describe("TabPanel", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("shows only the active panel and hides the rest", async () => {
    const { LiquidTabs, TabsGroup, TabPanel } = await loadModule(false);
    const { getByText, queryByText } = render(
      <TabsGroup defaultValue="one">
        <LiquidTabs items={ITEMS} />
        <TabPanel id="one">Panel One</TabPanel>
        <TabPanel id="two">Panel Two</TabPanel>
      </TabsGroup>
    );
    expect(getByText("Panel One")).toBeTruthy();
    expect(queryByText("Panel Two")).toBeNull();
  });

  it("switches panels when a tab is clicked", async () => {
    const { LiquidTabs, TabsGroup, TabPanel } = await loadModule(false);
    const { container, getByText, queryByText } = render(
      <TabsGroup defaultValue="one">
        <LiquidTabs items={ITEMS} />
        <TabPanel id="one">Panel One</TabPanel>
        <TabPanel id="two">Panel Two</TabPanel>
      </TabsGroup>
    );
    fireEvent.click(container.querySelectorAll('[data-fluidkit="liquid-tab"]')[1]);
    expect(getByText("Panel Two")).toBeTruthy();
    expect(queryByText("Panel One")).toBeNull();
  });

  it("wires role, id and aria-labelledby to the matching tab", async () => {
    const { LiquidTabs, TabsGroup, TabPanel } = await loadModule(false);
    const { container } = render(
      <TabsGroup defaultValue="one">
        <LiquidTabs items={ITEMS} />
        <TabPanel id="one">Panel One</TabPanel>
      </TabsGroup>
    );
    const panel = container.querySelector('[role="tabpanel"]') as HTMLElement;
    const tab = container.querySelector('[data-fluidkit="liquid-tab"]') as HTMLElement;
    expect(panel.id).toBe(tab.getAttribute("aria-controls"));
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
  });

  it("renders nothing when used outside a Group", async () => {
    const { TabPanel } = await loadModule(false);
    const { container } = render(<TabPanel id="x">orphan</TabPanel>);
    expect(container.querySelector('[role="tabpanel"]')).toBeNull();
  });
});
