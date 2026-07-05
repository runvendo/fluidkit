import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

async function loadField(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidField");
  return mod.LiquidField;
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

describe("LiquidField", () => {
  it("renders a real, visible text input with native props forwarded", async () => {
    const LiquidField = await loadField(true);
    render(
      <LiquidField label="Email" placeholder="you@example.com" name="email" required />
    );
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.placeholder).toBe("you@example.com");
    expect(input.name).toBe("email");
    expect(input.required).toBe(true);
  });

  it("multiline renders a textarea instead", async () => {
    const LiquidField = await loadField(true);
    render(<LiquidField label="Notes" multiline />);
    expect((screen.getByLabelText("Notes") as HTMLElement).tagName).toBe(
      "TEXTAREA"
    );
  });

  it("typing works natively and participates in forms", async () => {
    const LiquidField = await loadField(true);
    render(
      <form data-testid="f">
        <LiquidField label="Email" name="email" />
      </form>
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "yousef@vendo.run" },
    });
    expect(
      new FormData(screen.getByTestId("f") as HTMLFormElement).get("email")
    ).toBe("yousef@vendo.run");
  });

  it("focus shows the meniscus and marks the surface focused", async () => {
    const LiquidField = await loadField(true);
    render(<LiquidField label="Email" />);
    const root = document.querySelector('[data-fluidkit="liquid-field"]')!;
    expect(root.getAttribute("data-focused")).toBe("false");
    act(() => {
      screen.getByLabelText("Email").focus();
    });
    expect(root.getAttribute("data-focused")).toBe("true");
    expect(
      document.querySelector('[data-fluidkit="liquid-field-focus"]')
    ).not.toBeNull();
    act(() => {
      screen.getByLabelText("Email").blur();
    });
    expect(root.getAttribute("data-focused")).toBe("false");
  });

  it("reduced motion keeps focus visibility (focus is not motion)", async () => {
    const LiquidField = await loadField(true);
    render(<LiquidField label="Email" />);
    act(() => {
      screen.getByLabelText("Email").focus();
    });
    expect(
      document.querySelector('[data-fluidkit="liquid-field-focus"]')
    ).not.toBeNull();
  });
});
