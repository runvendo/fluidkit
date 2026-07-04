import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

async function loadMenu(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  return await import("../../src/components/LiquidMenu");
}

const ITEMS = (onSelect: (label: string) => void) => [
  { label: "Rename", onSelect: () => onSelect("Rename") },
  { label: "Duplicate", onSelect: () => onSelect("Duplicate") },
  { type: "separator" as const },
  { label: "Archive", onSelect: () => onSelect("Archive"), disabled: true },
  { label: "Delete", onSelect: () => onSelect("Delete") },
];

beforeEach(() => {
  vi.useFakeTimers();
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
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock("motion/react");
  vi.resetModules();
});

async function renderOpenMenu(onSelect = (_: string) => {}) {
  const { LiquidMenu } = await loadMenu(true);
  render(
    <LiquidMenu trigger={<button>Options</button>} items={ITEMS(onSelect)} />
  );
  const trigger = screen.getByText("Options");
  act(() => {
    fireEvent.click(trigger);
  });
  return trigger;
}

describe("LiquidMenu", () => {
  it("wires the ARIA menu-button pattern on the trigger", async () => {
    const { LiquidMenu } = await loadMenu(true);
    render(
      <LiquidMenu trigger={<button>Options</button>} items={ITEMS(() => {})} />
    );
    const trigger = screen.getByText("Options");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    act(() => {
      fireEvent.click(trigger);
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("renders items as menuitems, separators as separators, disabled as aria-disabled", async () => {
    await renderOpenMenu();
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Rename",
      "Duplicate",
      "Archive",
      "Delete",
    ]);
    expect(
      screen.getByRole("menu").querySelector('[role="separator"]')
    ).not.toBeNull();
    expect(
      items.find((i) => i.textContent === "Archive")?.getAttribute(
        "aria-disabled"
      )
    ).toBe("true");
  });

  it("focuses the first item on open and cycles with arrow keys, skipping disabled", async () => {
    await renderOpenMenu();
    act(() => {
      vi.runAllTimers();
    });
    const [rename, duplicate, , del] = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(rename);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(duplicate);
    // Archive is disabled — skipped.
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(del);
    // Wraps to the top.
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(rename);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    expect(document.activeElement).toBe(del);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Home" });
    expect(document.activeElement).toBe(rename);
  });

  it("Escape closes and returns focus to the trigger", async () => {
    const trigger = await renderOpenMenu();
    act(() => {
      vi.runAllTimers();
    });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("selecting an item fires onSelect, closes, and returns focus", async () => {
    const picked: string[] = [];
    const trigger = await renderOpenMenu((l) => picked.push(l));
    fireEvent.click(screen.getByText("Duplicate"));
    act(() => {
      vi.runAllTimers();
    });
    expect(picked).toEqual(["Duplicate"]);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("a disabled item does not select or close", async () => {
    const picked: string[] = [];
    await renderOpenMenu((l) => picked.push(l));
    fireEvent.click(screen.getByText("Archive"));
    expect(picked).toEqual([]);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("outside pointerdown closes the menu", async () => {
    await renderOpenMenu();
    act(() => {
      fireEvent.pointerDown(document.body);
      vi.runAllTimers();
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ArrowDown on the closed trigger opens and focuses the first item", async () => {
    const { LiquidMenu } = await loadMenu(true);
    render(
      <LiquidMenu trigger={<button>Options</button>} items={ITEMS(() => {})} />
    );
    act(() => {
      fireEvent.keyDown(screen.getByText("Options"), { key: "ArrowDown" });
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[0]);
  });

  it("reduced motion renders the static open state, no loop", async () => {
    await renderOpenMenu();
    const surface = document.querySelector('[data-fluidkit="liquid-menu"]');
    expect(surface?.getAttribute("data-animating")).toBe("false");
  });
});
