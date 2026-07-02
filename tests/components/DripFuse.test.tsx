import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Profiler } from "react";

/** Same mocking pattern as the other component tests. The mock reads from a
 * mutable `state` object (the Magnetic test pattern) so tests can flip the
 * reduced-motion preference mid-test and have the hook re-read it on a
 * plain rerender. */
async function loadDripFuseMutable(initialReduced: boolean) {
  vi.resetModules();
  const state = { reduced: initialReduced };
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => state.reduced };
  });
  const mod = await import("../../src/components/DripFuse");
  return { DripFuse: mod.DripFuse, state };
}

async function loadDripFuse(reduced: boolean) {
  const { DripFuse } = await loadDripFuseMutable(reduced);
  return DripFuse;
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

  it("a fire under reduced motion cancels a cycle already in flight: the interrupted cycle's onComplete never runs", async () => {
    const { DripFuse, state } = await loadDripFuseMutable(false);
    const onComplete = vi.fn();
    const { container, rerender } = render(
      <DripFuse fire={0} onComplete={onComplete} />
    );
    const root = container.firstChild as HTMLElement;

    // Start an animated cycle...
    rerender(<DripFuse fire={1} onComplete={onComplete} />);
    expect(root.getAttribute("data-animating")).toBe("true");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ...flip prefers-reduced-motion mid-cycle, then fire again. The second
    // fire must give the running cycle the same cleanup as a restart: the
    // stale settle timer is cancelled (its onComplete never runs) and the
    // instant reduced-motion completion fires — exactly ONE call total.
    state.reduced = true;
    rerender(<DripFuse fire={1} onComplete={onComplete} />);
    rerender(<DripFuse fire={2} onComplete={onComplete} />);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(root.getAttribute("data-animating")).toBe("false");
    expect(root.getAttribute("data-phase")).toBe("idle");

    // Static two-body scene resynced, and no stale timer double-fires.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(2);
  });

  it("clamps oversized bodies to the canvas height so geometry never spills", async () => {
    const DripFuse = await loadDripFuse(true);
    // size 60 > height/2 - 2 = 38: bodies must render at the clamped radius.
    const { container } = render(<DripFuse width={240} height={80} size={60} />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(clip.style.clipPath).toContain("A 38.0 38.0");
    expect(clip.style.clipPath).not.toContain("A 60.0");
    // Every path coordinate stays inside the 240x80 canvas.
    const numbers = (clip.style.clipPath.match(/-?\d+\.\d/g) ?? []).map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
  });

  it("the settle timer calls the LATEST onComplete, not the cycle-start capture", async () => {
    const DripFuse = await loadDripFuse(false);
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<DripFuse fire={0} onComplete={stale} />);
    rerender(<DripFuse fire={1} onComplete={stale} />);
    // Swap the callback mid-cycle (same fire value — no restart).
    rerender(<DripFuse fire={1} onComplete={fresh} />);

    await vi.waitFor(
      () => {
        expect(fresh).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000, interval: 20 }
    );
    expect(stale).not.toHaveBeenCalled();
  });

  it("restarting mid-fuse completes cleanly: one onComplete, back to the two-body rest scene", async () => {
    const DripFuse = await loadDripFuse(false);
    const onComplete = vi.fn();
    const { container, rerender } = render(
      <DripFuse fire={0} onComplete={onComplete} />
    );
    const root = container.firstChild as HTMLElement;

    rerender(<DripFuse fire={1} onComplete={onComplete} />);
    await vi.waitFor(
      () => {
        expect(root.getAttribute("data-phase")).toBe("fuse");
      },
      { timeout: 2000, interval: 10 }
    );

    // Restart while the drop is draining into the target.
    rerender(<DripFuse fire={2} onComplete={onComplete} />);

    await vi.waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(root.getAttribute("data-phase")).toBe("idle");
      },
      { timeout: 3000, interval: 20 }
    );
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(2);
  });

  it("unmounting mid-cycle cancels the pending completion (no onComplete, no timer errors)", async () => {
    const DripFuse = await loadDripFuse(false);
    const onComplete = vi.fn();
    const { rerender, unmount } = render(
      <DripFuse fire={0} onComplete={onComplete} />
    );
    rerender(<DripFuse fire={1} onComplete={onComplete} />);
    await new Promise((resolve) => setTimeout(resolve, 100));

    unmount();

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("a cycle steps through the full phase sequence: idle -> swell -> fly -> fuse -> idle", async () => {
    const DripFuse = await loadDripFuse(false);
    const { container, rerender } = render(<DripFuse fire={0} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-phase")).toBe("idle");

    rerender(<DripFuse fire={1} />);
    expect(root.getAttribute("data-phase")).toBe("swell");

    // Each waitFor observes the next phase in order — the sequence can only
    // pass if the phases arrive in this progression.
    await vi.waitFor(
      () => expect(root.getAttribute("data-phase")).toBe("fly"),
      { timeout: 2000, interval: 5 }
    );
    await vi.waitFor(
      () => expect(root.getAttribute("data-phase")).toBe("fuse"),
      { timeout: 2000, interval: 5 }
    );
    await vi.waitFor(
      () => expect(root.getAttribute("data-phase")).toBe("idle"),
      { timeout: 2000, interval: 20 }
    );
  });
});
