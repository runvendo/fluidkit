import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

async function loadSlider(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidSlider");
  return mod.LiquidSlider;
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

describe("LiquidSlider", () => {
  it("renders a real (hidden) range input with min/max/step", async () => {
    const LiquidSlider = await loadSlider(true);
    render(
      <LiquidSlider aria-label="Volume" min={0} max={11} step={0.5} defaultValue={7} />
    );
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.type).toBe("range");
    expect(input.min).toBe("0");
    expect(input.max).toBe("11");
    expect(input.step).toBe("0.5");
    expect(input.value).toBe("7");
  });

  it("uncontrolled: change updates the value and the visual state", async () => {
    const LiquidSlider = await loadSlider(true);
    render(<LiquidSlider aria-label="Volume" defaultValue={20} />);
    const input = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "60" } });
    expect(input.value).toBe("60");
    expect(
      document
        .querySelector('[data-fluidkit="liquid-slider"]')
        ?.getAttribute("data-value")
    ).toBe("60");
  });

  it("controlled: reports through onValueChange and follows the prop", async () => {
    const LiquidSlider = await loadSlider(true);
    const seen: number[] = [];
    function Harness() {
      const [v, setV] = useState(30);
      return (
        <LiquidSlider
          aria-label="Volume"
          value={v}
          onValueChange={(n) => {
            seen.push(n);
            setV(n);
          }}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.value).toBe("30");
    fireEvent.change(input, { target: { value: "45" } });
    expect(seen).toEqual([45]);
    expect(input.value).toBe("45");
  });

  it("participates in forms under its name", async () => {
    const LiquidSlider = await loadSlider(true);
    render(
      <form data-testid="f">
        <LiquidSlider aria-label="Volume" name="volume" defaultValue={42} />
      </form>
    );
    expect(
      new FormData(screen.getByTestId("f") as HTMLFormElement).get("volume")
    ).toBe("42");
  });

  it("label prop renders and associates natively", async () => {
    const LiquidSlider = await loadSlider(true);
    render(<LiquidSlider label="Volume" defaultValue={10} />);
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("shows the focus meniscus while keyboard-focused", async () => {
    const LiquidSlider = await loadSlider(true);
    render(<LiquidSlider aria-label="Volume" />);
    act(() => {
      screen.getByRole("slider").focus();
    });
    expect(
      document.querySelector('[data-fluidkit="liquid-slider-focus"]')
    ).not.toBeNull();
  });

  it("saturates the fill while the pointer is held (data-active)", async () => {
    const LiquidSlider = await loadSlider(true);
    render(<LiquidSlider aria-label="Volume" defaultValue={30} />);
    const root = document.querySelector('[data-fluidkit="liquid-slider"]')!;
    expect(root.getAttribute("data-active")).toBe("false");
    fireEvent.pointerDown(root);
    expect(root.getAttribute("data-active")).toBe("true");
    fireEvent.pointerUp(window);
    expect(root.getAttribute("data-active")).toBe("false");
  });

  it("reduced motion renders statically at the current value", async () => {
    const LiquidSlider = await loadSlider(true);
    render(<LiquidSlider aria-label="Volume" defaultValue={80} />);
    const root = document.querySelector('[data-fluidkit="liquid-slider"]');
    expect(root?.getAttribute("data-animating")).toBe("false");
    expect(root?.getAttribute("data-value")).toBe("80");
  });
});
