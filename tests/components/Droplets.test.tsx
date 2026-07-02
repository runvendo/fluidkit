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

  it("marks the wrapper aria-hidden when purely decorative (non-interactive, no consumer role)", async () => {
    const Droplets = await loadDroplets(false);
    const { container } = render(<Droplets />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not mark aria-hidden in interactive mode (a real pointer target, not pure decoration)", async () => {
    const Droplets = await loadDroplets(false);
    const { container } = render(<Droplets interactive />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBeNull();
  });

  it("does not mark aria-hidden when a consumer supplies its own role (e.g. Thinking's role=status)", async () => {
    const Droplets = await loadDroplets(false);
    const { container } = render(<Droplets role="status" aria-label="Working" />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBeNull();
    expect(root.getAttribute("role")).toBe("status");
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

  it("clamps speed with the MIN_SPEED floor — speed={0} still advances the merge/split cycle", async () => {
    // Capture the frame callback instead of letting rAF drive it, so the
    // test can hand the loop a controlled delta: at the MIN_SPEED floor
    // (0.01) one 200 000 ms frame crosses the 1500 ms cycle, flips the
    // squeeze phase, and retargets the drop springs. Unclamped (the
    // regression), delta * 0 advances nothing and the scene stays
    // byte-identical forever.
    vi.resetModules();
    const frames: Array<(time: number, delta: number) => void> = [];
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return {
        ...actual,
        useReducedMotion: () => false,
        useAnimationFrame: (cb: (time: number, delta: number) => void) => {
          frames.push(cb);
        },
      };
    });
    const { Droplets } = await import("../../src/components/Droplets");

    const { container } = render(<Droplets speed={0} />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const initialPath = clip.style.clipPath;
    expect(initialPath).toContain("path(");
    expect(frames.length).toBeGreaterThan(0);
    const frame = frames[frames.length - 1];

    // One huge frame crosses the cycle at the clamped floor (phase flip →
    // spring retarget)…
    frame(0, 200_000);
    // …give Motion's own loop a beat to move the retargeted springs…
    await new Promise((resolve) => setTimeout(resolve, 150));
    // …then let the loop write a scene from the moved values.
    frame(0, 16);

    expect(clip.style.clipPath).not.toBe(initialPath);
  });
});
