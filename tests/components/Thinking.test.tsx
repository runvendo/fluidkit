import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

async function loadThinking(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Thinking");
  return mod.Thinking;
}

describe("Thinking", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("announces itself as a status indicator", async () => {
    const Thinking = await loadThinking(true);
    const { getByRole } = render(<Thinking />);
    const status = getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Thinking");
  });

  it("supports a custom label", async () => {
    const Thinking = await loadThinking(true);
    const { getByRole } = render(<Thinking label="Working" />);
    expect(getByRole("status").getAttribute("aria-label")).toBe("Working");
  });

  it("renders three static dots under reduced motion", async () => {
    const Thinking = await loadThinking(true);
    const { container } = render(<Thinking />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect((clip.style.clipPath.match(/Z/g) ?? []).length).toBe(3);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-animating")).toBe("false");
  });
});
