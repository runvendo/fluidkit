import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/** Same mocking pattern as the other component tests. */
async function loadDroplets(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Droplets");
  return mod.Droplets;
}

describe("Droplets", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders the liquid layer stack with a computed clip path", async () => {
    const Droplets = await loadDroplets(false);
    const { container } = render(<Droplets />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(clip).not.toBeNull();
    expect(clip.style.clipPath).toContain("path(");
  });

  it("is static (no animation loop) under reduced motion, drops rendered as plain dots", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-animating")).toBe("false");
    // Static fallback = separate circles, no bridges: path has exactly
    // `count` subpath closures.
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(3);
  });

  it("paints speculars for glass but not for mercury", async () => {
    const Droplets = await loadDroplets(true);
    const glass = render(<Droplets material="glass" />);
    expect(glass.container.querySelectorAll("ellipse").length).toBeGreaterThan(0);
    const mercury = render(<Droplets material="mercury" />);
    expect(mercury.container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("disables speculars when light is null", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets material="glass" light={null} />);
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("sizes the container from size + spread and merges consumer style/className", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(
      <Droplets size={40} spread={80} className="c" style={{ marginTop: 4 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("c");
    expect(root.style.marginTop).toBe("4px");
    expect(root.style.width).toBe("120px"); // size + spread
    expect(root.style.height).toBe("120px");
  });
});
