import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Profiler } from "react";

async function loadMorphSurface(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/MorphSurface");
  return mod.MorphSurface;
}

/**
 * Minimal IntersectionObserver mock (same shape as
 * tests/components/Aurora.test.tsx) so off-screen pausing can be exercised
 * by hand-firing entries — needed to flip `animating` off mid-settle via the
 * inView route (PRM already flips it statically per-test via
 * `loadMorphSurface`, which can't change mid-test).
 */
class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  callback: IntersectionObserverCallback;
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }
}

describe("MorphSurface", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("shows closed content and hides open content when closed", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const closed = getByText("pill").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(closed.style.opacity).toBe("1");
    expect(opened.style.opacity).toBe("0");
    expect(opened.getAttribute("aria-hidden")).toBe("true");
  });

  it("cross-fades faces when open flips — content only fades, never scales", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText, rerender } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    rerender(
      <MorphSurface
        open
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(opened.style.opacity).toBe("1");
    // the face never scales — transform is reserved for centering only
    expect(opened.style.transform).not.toContain("scale");
  });

  it("renders the liquid clip stack and reports its state", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(
      container.querySelector('[data-fluidkit="liquid-clip"]')
    ).not.toBeNull();
  });

  it("under reduced motion the surface renders the target size immediately", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container, rerender } = render(<MorphSurface open={false} />);
    rerender(<MorphSurface open />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("open");
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  it("commits no React updates per animation frame while settling", async () => {
    const MorphSurface = await loadMorphSurface(false);
    const onRender = vi.fn();
    const { rerender } = render(
      <Profiler id="morph" onRender={onRender}>
        <MorphSurface open={false} />
      </Profiler>
    );
    rerender(
      <Profiler id="morph" onRender={onRender}>
        <MorphSurface open />
      </Profiler>
    );
    // Let the settle window state flip land (one commit), then several rAF
    // ticks: the morph keeps springing, but frames are imperative DOM
    // writes, never React commits.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const commitsAfterFlip = onRender.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(onRender.mock.calls.length).toBe(commitsAfterFlip);
  });

  it("sizes its container to fit the open state plus satellite margin", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(
      <MorphSurface open={false} openSize={{ width: 200, height: 160 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(parseInt(root.style.width, 10)).toBeGreaterThanOrEqual(200);
    expect(parseInt(root.style.height, 10)).toBeGreaterThanOrEqual(160);
  });

  describe("off-screen mid-settle (settle-timer hygiene)", () => {
    beforeEach(() => {
      MockIntersectionObserver.instances = [];
      vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("clears `settling` when scrolled off-screen mid-settle, so re-entering view without a new `open` transition does not resume the loop", async () => {
      const MorphSurface = await loadMorphSurface(false);
      const { container, rerender } = render(<MorphSurface open={false} />);
      const root = container.firstChild as HTMLElement;
      const observer = MockIntersectionObserver.instances[0];

      // Come into view, then flip `open` — starts a real settle window.
      act(() => {
        observer.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          observer
        );
      });
      rerender(<MorphSurface open />);
      expect(root.getAttribute("data-animating")).toBe("true");

      // Scroll off-screen mid-settle: `animating` flips false. The wart:
      // the settle effect's cleanup (keyed to `animating`) cancels the
      // pending `setSettling(false)` timeout with no replacement, so
      // `settling` sticks true even though nothing else clears it.
      act(() => {
        observer.callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          observer
        );
      });
      expect(root.getAttribute("data-animating")).toBe("false");

      // Scroll back into view — `open` never changed, so no new transition
      // starts. If `settling` stuck true, this alone would make
      // `data-animating` read true again (the loop "recomputing a settled
      // scene every frame" the wart describes) even though nothing is
      // actually transitioning.
      act(() => {
        observer.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          observer
        );
      });
      expect(root.getAttribute("data-animating")).toBe("false");
    });
  });
});
