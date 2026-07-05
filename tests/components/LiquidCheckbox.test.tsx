import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

async function loadCheckbox(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidCheckbox");
  return mod.LiquidCheckbox;
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

describe("LiquidCheckbox", () => {
  it("renders a real (hidden) checkbox", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    render(<LiquidCheckbox label="Remember me" />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);
  });

  it("uncontrolled toggling + label association", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    render(<LiquidCheckbox label="Remember me" defaultChecked />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.checked).toBe(true);
    fireEvent.click(screen.getByText("Remember me"));
    expect(input.checked).toBe(false);
    expect(
      document
        .querySelector('[data-fluidkit="liquid-checkbox"]')
        ?.getAttribute("data-checked")
    ).toBe("false");
  });

  it("controlled via checked + onCheckedChange", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    const seen: boolean[] = [];
    function Harness() {
      const [v, setV] = useState(false);
      return (
        <LiquidCheckbox
          label="c"
          checked={v}
          onCheckedChange={(n) => {
            seen.push(n);
            setV(n);
          }}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(seen).toEqual([true]);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      true
    );
  });

  it("supports indeterminate: native property + half-fill state", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    render(<LiquidCheckbox label="Some selected" indeterminate />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(
      document
        .querySelector('[data-fluidkit="liquid-checkbox"]')
        ?.getAttribute("data-indeterminate")
    ).toBe("true");
  });

  it("participates in forms under its name", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    render(
      <form data-testid="f">
        <LiquidCheckbox label="c" name="remember" defaultChecked />
      </form>
    );
    expect(
      new FormData(screen.getByTestId("f") as HTMLFormElement).get("remember")
    ).toBe("on");
  });

  it("shows the focus meniscus while keyboard-focused", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    render(<LiquidCheckbox label="c" />);
    act(() => {
      screen.getByRole("checkbox").focus();
    });
    expect(
      document.querySelector('[data-fluidkit="liquid-checkbox-focus"]')
    ).not.toBeNull();
  });

  it("reduced motion renders statically", async () => {
    const LiquidCheckbox = await loadCheckbox(true);
    render(<LiquidCheckbox label="c" defaultChecked />);
    const root = document.querySelector('[data-fluidkit="liquid-checkbox"]');
    expect(root?.getAttribute("data-animating")).toBe("false");
    expect(root?.getAttribute("data-checked")).toBe("true");
  });
});
