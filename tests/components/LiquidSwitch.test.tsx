import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

async function loadSwitch(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidSwitch");
  return mod.LiquidSwitch;
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

describe("LiquidSwitch", () => {
  it("renders a real (hidden) checkbox with the switch role", async () => {
    const LiquidSwitch = await loadSwitch(true);
    render(<LiquidSwitch label="Wi-Fi" />);
    const input = screen.getByRole("switch") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);
  });

  it("uncontrolled: clicking toggles, defaultChecked seeds the state", async () => {
    const LiquidSwitch = await loadSwitch(true);
    render(<LiquidSwitch label="Wi-Fi" defaultChecked />);
    const input = screen.getByRole("switch") as HTMLInputElement;
    expect(input.checked).toBe(true);
    fireEvent.click(input);
    expect(input.checked).toBe(false);
    expect(
      document
        .querySelector('[data-fluidkit="liquid-switch"]')
        ?.getAttribute("data-checked")
    ).toBe("false");
  });

  it("controlled: reports through onCheckedChange and follows the prop", async () => {
    const LiquidSwitch = await loadSwitch(true);
    const seen: boolean[] = [];
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <LiquidSwitch
          label="Wi-Fi"
          checked={on}
          onCheckedChange={(v) => {
            seen.push(v);
            setOn(v);
          }}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole("switch") as HTMLInputElement;
    fireEvent.click(input);
    expect(seen).toEqual([true]);
    expect(input.checked).toBe(true);
  });

  it("clicking the label text toggles (native association)", async () => {
    const LiquidSwitch = await loadSwitch(true);
    render(<LiquidSwitch label="Aeroplane mode" />);
    fireEvent.click(screen.getByText("Aeroplane mode"));
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(true);
  });

  it("participates in forms under its name", async () => {
    const LiquidSwitch = await loadSwitch(true);
    render(
      <form data-testid="f">
        <LiquidSwitch label="Wi-Fi" name="wifi" defaultChecked />
      </form>
    );
    const data = new FormData(screen.getByTestId("f") as HTMLFormElement);
    expect(data.get("wifi")).toBe("on");
  });

  it("disabled: input carries disabled and change handlers stay silent", async () => {
    // The no-toggle-on-click behavior itself is the browser's (jsdom fires
    // synthetic clicks even on disabled inputs); we assert the attribute
    // and that no change is reported.
    const LiquidSwitch = await loadSwitch(true);
    const onCheckedChange = vi.fn();
    render(
      <LiquidSwitch label="Wi-Fi" disabled onCheckedChange={onCheckedChange} />
    );
    const input = screen.getByRole("switch") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("shows the focus meniscus only while the input is focused", async () => {
    const LiquidSwitch = await loadSwitch(true);
    render(<LiquidSwitch label="Wi-Fi" />);
    const input = screen.getByRole("switch");
    expect(
      document.querySelector('[data-fluidkit="liquid-switch-focus"]')
    ).toBeNull();
    act(() => {
      input.focus();
    });
    expect(
      document.querySelector('[data-fluidkit="liquid-switch-focus"]')
    ).not.toBeNull();
    act(() => {
      input.blur();
    });
    expect(
      document.querySelector('[data-fluidkit="liquid-switch-focus"]')
    ).toBeNull();
  });

  it("reduced motion renders the static seated state, no loop", async () => {
    const LiquidSwitch = await loadSwitch(true);
    render(<LiquidSwitch label="Wi-Fi" defaultChecked />);
    const root = document.querySelector('[data-fluidkit="liquid-switch"]');
    expect(root?.getAttribute("data-animating")).toBe("false");
    expect(root?.getAttribute("data-checked")).toBe("true");
  });
});
