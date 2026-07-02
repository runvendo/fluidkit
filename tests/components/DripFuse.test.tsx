import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Profiler } from "react";

/** Same mocking pattern as the other component tests. */
async function loadDripFuse(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/DripFuse");
  return mod.DripFuse;
}

describe("DripFuse", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders a static scene with exactly two body closures at rest", async () => {
    const DripFuse = await loadDripFuse(false);
    const { container } = render(<DripFuse />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(clip).not.toBeNull();
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(2);
  });

  it("carries the drip-fuse data attributes, idle at rest", async () => {
    const DripFuse = await loadDripFuse(false);
    const { container } = render(<DripFuse />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-fluidkit")).toBe("drip-fuse");
    expect(root.getAttribute("data-phase")).toBe("idle");
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  it("incrementing fire while animating starts a cycle: phase leaves idle and a third body joins the scene", async () => {
    const DripFuse = await loadDripFuse(false);
    const { container, rerender } = render(<DripFuse fire={0} />);
    const root = container.firstChild as HTMLElement;
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;

    rerender(<DripFuse fire={1} />);

    expect(root.getAttribute("data-phase")).not.toBe("idle");
    expect(root.getAttribute("data-animating")).toBe("true");

    await vi.waitFor(() => {
      const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
      expect(closures).toBeGreaterThanOrEqual(3);
    });
  });

  it("fires onComplete exactly once per fire increment", async () => {
    const DripFuse = await loadDripFuse(false);
    const onComplete = vi.fn();
    const { rerender } = render(
      <DripFuse fire={0} onComplete={onComplete} />
    );
    rerender(<DripFuse fire={1} onComplete={onComplete} />);

    await vi.waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000, interval: 20 }
    );
  });

  it("two rapid fire increments coalesce: a restart cancels the pending completion, so onComplete fires once for the pair", async () => {
    const DripFuse = await loadDripFuse(false);
    const onComplete = vi.fn();
    const { rerender } = render(
      <DripFuse fire={0} onComplete={onComplete} />
    );
    rerender(<DripFuse fire={1} onComplete={onComplete} />);
    // Restart almost immediately, well before the first cycle's settle timer
    // would fire — this cancels cycle 1's completion and starts a fresh one.
    await new Promise((resolve) => setTimeout(resolve, 30));
    rerender(<DripFuse fire={2} onComplete={onComplete} />);

    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reduced motion: fire increment completes immediately with a static clip and data-animating false", async () => {
    const DripFuse = await loadDripFuse(true);
    const onComplete = vi.fn();
    const { container, rerender } = render(
      <DripFuse fire={0} onComplete={onComplete} />
    );
    const root = container.firstChild as HTMLElement;
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const initialClip = clip.style.clipPath;

    rerender(<DripFuse fire={1} onComplete={onComplete} />);

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(clip.style.clipPath).toBe(initialClip);
    expect(root.getAttribute("data-animating")).toBe("false");
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(2);
  });

  it("commits no React updates during the flight portion of a cycle", async () => {
    const DripFuse = await loadDripFuse(false);
    const onRender = vi.fn();
    const { rerender } = render(
      <Profiler id="drip-fuse" onRender={onRender}>
        <DripFuse fire={0} />
      </Profiler>
    );
    rerender(
      <Profiler id="drip-fuse" onRender={onRender}>
        <DripFuse fire={1} />
      </Profiler>
    );
    // Let the fire-triggered commit (settling -> true) land, then watch a
    // stretch mid-flight: every frame after that must be an imperative DOM
    // write, never a React commit.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const commitsAfterStart = onRender.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onRender.mock.calls.length).toBe(commitsAfterStart);
  });

  it("renders sourceContent/targetContent on the unclipped overlay, anchored at each end", async () => {
    const DripFuse = await loadDripFuse(true);
    const { getByText, container } = render(
      <DripFuse
        sourceContent={<span>From</span>}
        targetContent={<span>To</span>}
      />
    );
    const from = getByText("From");
    const to = getByText("To");
    const overlay = container.querySelector('[data-fluidkit="liquid-content"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.contains(from)).toBe(true);
    expect(overlay?.contains(to)).toBe(true);

    const fill = container.querySelector('[data-fluidkit="liquid-fill"]');
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(fill?.textContent).toBe("");
    expect(clip.textContent).toBe("");
    expect((overlay as HTMLElement).style.clipPath).toBe("");
  });

  it("paints a specular highlight for glass but not for mercury", async () => {
    const DripFuse = await loadDripFuse(true);
    const glass = render(<DripFuse material="glass" />);
    expect(
      glass.container.querySelectorAll("ellipse").length
    ).toBeGreaterThan(0);
    const mercury = render(<DripFuse material="mercury" />);
    expect(mercury.container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("sizes the canvas from width/height props and merges consumer style/className", async () => {
    const DripFuse = await loadDripFuse(true);
    const { container } = render(
      <DripFuse width={300} height={100} className="c" style={{ marginTop: 4 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("c");
    expect(root.style.marginTop).toBe("4px");
    expect(root.style.width).toBe("300px");
    expect(root.style.height).toBe("100px");
  });
});
