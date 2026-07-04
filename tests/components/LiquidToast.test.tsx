import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

/**
 * Loads a FRESH LiquidToast module per test (the dispatcher is module-level
 * state — dedupe counters and pending queues must not leak between tests),
 * with `useReducedMotion` mocked so lifecycle timing is deterministic under
 * fake timers.
 */
async function loadToast(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  return await import("../../src/components/LiquidToast");
}

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

describe("LiquidToast", () => {
  it("shows a toast fired after the provider mounts", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("Changes saved");
    });
    expect(screen.getByText("Changes saved")).toBeInTheDocument();
  });

  it("queues toasts fired before the provider mounts and flushes on mount", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    toast("Fired early");
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    expect(screen.getByText("Fired early")).toBeInTheDocument();
  });

  it("announces politely: the viewport is role=status", async () => {
    const { LiquidToastProvider } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    const viewport = document.querySelector(
      '[data-fluidkit="liquid-toast-viewport"]'
    ) as HTMLElement;
    expect(viewport).not.toBeNull();
    expect(viewport.getAttribute("role")).toBe("status");
    expect(viewport.getAttribute("aria-live")).toBe("polite");
  });

  it("dedupes by id: same id updates the toast instead of adding one", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("Uploading…", { id: "up" });
    });
    act(() => {
      toast("Upload complete", { id: "up" });
    });
    expect(screen.queryByText("Uploading…")).toBeNull();
    expect(screen.getByText("Upload complete")).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-fluidkit="liquid-toast"]')
    ).toHaveLength(1);
  });

  it("caps the stack: the oldest toast starts leaving beyond the cap", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("one", { duration: 0 });
      toast("two", { duration: 0 });
      toast("three", { duration: 0 });
      toast("four", { duration: 0 });
    });
    const items = document.querySelectorAll('[data-fluidkit="liquid-toast"]');
    expect(items).toHaveLength(4);
    const leaving = document.querySelectorAll(
      '[data-fluidkit="liquid-toast"][data-state="leaving"]'
    );
    expect(leaving).toHaveLength(1);
    expect(leaving[0].textContent).toContain("one");
  });

  it("auto-dismisses after `duration`, and 0 means sticky", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("goes away", { duration: 1000 });
      toast("stays", { duration: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("goes away")).toBeNull();
    expect(screen.getByText("stays")).toBeInTheDocument();
  });

  it("pauses the auto-dismiss clock while hovered", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("hover me", { duration: 1000 });
    });
    const item = document.querySelector(
      '[data-fluidkit="liquid-toast"]'
    ) as HTMLElement;
    fireEvent.pointerEnter(item);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("hover me")).toBeInTheDocument();
    fireEvent.pointerLeave(item);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("hover me")).toBeNull();
  });

  it("renders a close button by default; dismissible: false hides it", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("closable", { duration: 0 });
      toast("locked", { duration: 0, dismissible: false });
    });
    const items = [
      ...document.querySelectorAll('[data-fluidkit="liquid-toast"]'),
    ];
    const closable = items.find((el) => el.textContent?.includes("closable"))!;
    const locked = items.find((el) => el.textContent?.includes("locked"))!;
    expect(closable.querySelector('[aria-label="Close"]')).not.toBeNull();
    expect(locked.querySelector('[aria-label="Close"]')).toBeNull();
    fireEvent.click(closable.querySelector('[aria-label="Close"]')!);
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByText("closable")).toBeNull();
  });

  it("renders the action button and dismisses after it runs", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    const onClick = vi.fn();
    act(() => {
      toast("Message deleted", {
        duration: 0,
        action: { label: "Undo", onClick },
      });
    });
    fireEvent.click(screen.getByText("Undo"));
    expect(onClick).toHaveBeenCalledOnce();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByText("Message deleted")).toBeNull();
  });

  it("toast.dismiss(id) dismisses one; toast.dismiss() dismisses all", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    let a: string | number = "";
    act(() => {
      a = toast("aaa", { duration: 0 });
      toast("bbb", { duration: 0 });
    });
    act(() => {
      toast.dismiss(a);
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByText("aaa")).toBeNull();
    expect(screen.getByText("bbb")).toBeInTheDocument();
    act(() => {
      toast.dismiss();
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByText("bbb")).toBeNull();
  });

  it("reduced motion: content is visible immediately, no animation loop", async () => {
    const { LiquidToastProvider, toast } = await loadToast(true);
    render(<LiquidToastProvider>app</LiquidToastProvider>);
    act(() => {
      toast("static", { duration: 0 });
    });
    const item = document.querySelector(
      '[data-fluidkit="liquid-toast"]'
    ) as HTMLElement;
    expect(item.getAttribute("data-animating")).toBe("false");
    expect(screen.getByText("static")).toBeVisible();
  });
});
