import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";

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

  it("paints speculars for glass but not for flat", async () => {
    const Droplets = await loadDroplets(true);
    const glass = render(<Droplets material="glass" />);
    expect(glass.container.querySelectorAll("ellipse").length).toBeGreaterThan(0);
    const flat = render(<Droplets material="flat" />);
    expect(flat.container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("disables speculars when light is null", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets material="glass" light={null} />);
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("disables speculars when reflection is false", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(
      <Droplets material="glass" reflection={false} />
    );
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("commits no React updates during the animation loop (scenes go through the imperative handle)", async () => {
    const Droplets = await loadDroplets(false);
    const onRender = vi.fn();
    render(
      <Profiler id="droplets" onRender={onRender}>
        <Droplets />
      </Profiler>
    );
    const commitsAfterMount = onRender.mock.calls.length;
    // Several rAF ticks: the merge/split loop keeps animating, but every
    // frame must be an imperative DOM write, never a React commit.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(onRender.mock.calls.length).toBe(commitsAfterMount);
  });

  // Drop 0's home for default props: angle 0 → offset (spread*0.42, 0) from
  // the container center (size + spread) / 2 = 68 → the drop sits at (110, 68)
  // with r = (36/2) * 0.95 ≈ 17. jsdom rects are 0-based, so clientX/Y are
  // container coordinates directly.
  const DROP0 = { x: 68 + 100 * 0.42, y: 68 };

  it("grabs a drop on pointerdown, marks the root, and releases on pointerup", async () => {
    const Droplets = await loadDroplets(false);
    const onGrab = vi.fn();
    const onRelease = vi.fn();
    const { container } = render(
      <Droplets interactive onGrab={onGrab} onRelease={onRelease} />
    );
    const root = container.firstChild as HTMLElement;
    fireEvent.pointerDown(root, { clientX: DROP0.x, clientY: DROP0.y });
    expect(onGrab).toHaveBeenCalledWith(0);
    expect(root.getAttribute("data-grabbed")).toBe("0");
    fireEvent.pointerUp(root);
    expect(onRelease).toHaveBeenCalledWith(0);
    expect(root.getAttribute("data-grabbed")).toBeNull();
  });

  it("ignores pointerdown that misses every drop", async () => {
    const Droplets = await loadDroplets(false);
    const onGrab = vi.fn();
    const { container } = render(<Droplets interactive onGrab={onGrab} />);
    const root = container.firstChild as HTMLElement;
    fireEvent.pointerDown(root, { clientX: 2, clientY: 2 });
    expect(onGrab).not.toHaveBeenCalled();
    expect(root.getAttribute("data-grabbed")).toBeNull();
  });

  it("does nothing on pointerdown when not interactive", async () => {
    const Droplets = await loadDroplets(false);
    const onGrab = vi.fn();
    const { container } = render(<Droplets onGrab={onGrab} />);
    fireEvent.pointerDown(container.firstChild as HTMLElement, {
      clientX: DROP0.x,
      clientY: DROP0.y,
    });
    expect(onGrab).not.toHaveBeenCalled();
  });

  it("is inert under reduced motion (static dots stay static)", async () => {
    const Droplets = await loadDroplets(true);
    const onGrab = vi.fn();
    const { container } = render(<Droplets interactive onGrab={onGrab} />);
    fireEvent.pointerDown(container.firstChild as HTMLElement, {
      clientX: DROP0.x,
      clientY: DROP0.y,
    });
    expect(onGrab).not.toHaveBeenCalled();
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
