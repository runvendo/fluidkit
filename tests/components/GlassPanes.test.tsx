import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * Same mocking pattern as MeshGradient's tests: `GlassPanes` reads
 * `usePrefersReducedMotion()`, which reads Motion's `useReducedMotion()`
 * under the hood.
 *
 * jsdom reality check: `supportsBackdropFilter()` is false in jsdom, so
 * these tests exercise the DEGRADED path — layered frosted fills with
 * `data-fallback="true"` and no backdrop-filter — which is exactly the
 * honest fallback contract.
 */
async function loadGlassPanes(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/GlassPanes");
  return mod.GlassPanes;
}

/**
 * Minimal IntersectionObserver mock (same shape as
 * tests/utils/useInView.test.tsx) so off-screen pausing can be exercised by
 * hand-firing entries.
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

function panes(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('[data-fluidkit="glass-panes-pane"]')
  ) as HTMLElement[];
}

describe("GlassPanes", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
    vi.unstubAllGlobals();
    document.getElementById("fluidkit-glass-panes-keyframes")?.remove();
  });

  it("renders `count` rounded panes, defaulting to 3, clamped to 1-8", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const byDefault = render(<GlassPanes />);
    const one = render(<GlassPanes count={0} />);
    const many = render(<GlassPanes count={99} />);

    expect(panes(byDefault.container)).toHaveLength(3);
    expect(panes(one.container)).toHaveLength(1);
    expect(panes(many.container)).toHaveLength(8);
    panes(byDefault.container).forEach((el) => {
      expect(parseInt(el.style.borderRadius, 10)).toBeGreaterThan(0);
      expect(el.style.background).not.toBe("");
    });
  });

  it("marks the wrapper aria-hidden, data-fluidkit=glass-panes, and pointer-events:none, filling the parent", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const { container } = render(<GlassPanes />);

    const wrapper = container.querySelector(
      '[data-fluidkit="glass-panes"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.style.pointerEvents).toBe("none");
    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.style.inset).toBe("0px");
    panes(container).forEach((el) => {
      expect(el.style.pointerEvents).toBe("none");
    });
  });

  it("marks data-fallback=true and skips backdrop-filter when unsupported (jsdom)", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const { container } = render(<GlassPanes />);

    const wrapper = container.querySelector(
      '[data-fluidkit="glass-panes"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-fallback")).toBe("true");
    panes(container).forEach((el) => {
      expect(el.style.backdropFilter).toBe("");
    });
  });

  it("tiles the full surface — every point is behind at least one pane, at every count", async () => {
    const GlassPanes = await loadGlassPanes(false);
    for (const count of [1, 2, 3, 5, 8]) {
      const { container, unmount } = render(<GlassPanes count={count} />);
      const intervals = panes(container)
        .map((el) => {
          const left = parseFloat(el.style.left);
          const width = parseFloat(el.style.width);
          return [left, left + width] as const;
        })
        .sort((a, b) => a[0] - b[0]);

      // Outermost panes overhang both container edges...
      expect(intervals[0][0]).toBeLessThan(0);
      expect(intervals[intervals.length - 1][1]).toBeGreaterThan(100);
      // ...and every neighboring pair overlaps (no interior gap), with
      // enough margin (>4%) to survive drift + jitter at opposite extremes.
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i][0]).toBeLessThan(intervals[i - 1][1] - 4);
      }
      unmount();
    }
  });

  it("alternates slide direction between neighboring panes", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const { container } = render(<GlassPanes count={4} />);

    const drifts = panes(container).map((el) =>
      el.style.getPropertyValue("--fluidkit-panes-drift")
    );
    expect(drifts[0]).not.toBe(drifts[1]);
    expect(drifts[0]).toBe(drifts[2]);
    expect(drifts[1]).toBe(drifts[3]);
  });

  it("shares one rotation across all panes (one composition)", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const { container } = render(<GlassPanes count={3} />);

    panes(container).forEach((el) => {
      expect(el.style.transform).toContain("rotate(8deg)");
    });
  });

  it("speeds up sliding with speed (shorter animation-duration), clamped above 0", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const base = render(<GlassPanes speed={1} />);
    const fast = render(<GlassPanes speed={2} />);
    const clamped = render(<GlassPanes speed={0} />);

    const baseS = parseFloat(panes(base.container)[0].style.animationDuration);
    const fastS = parseFloat(panes(fast.container)[0].style.animationDuration);
    const clampedS = parseFloat(
      panes(clamped.container)[0].style.animationDuration
    );
    expect(fastS).toBeCloseTo(baseS / 2);
    expect(Number.isFinite(clampedS)).toBe(true);
    expect(clampedS).toBeGreaterThan(0);
  });

  it("lays out panes deterministically — two renders with the same props match exactly", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const a = render(<GlassPanes count={4} />);
    const b = render(<GlassPanes count={4} />);

    const stylesA = panes(a.container).map((el) => el.getAttribute("style"));
    const stylesB = panes(b.container).map((el) => el.getAttribute("style"));
    expect(stylesA).toEqual(stylesB);
  });

  it("drops the slide keyframes entirely under prefers-reduced-motion", async () => {
    const GlassPanes = await loadGlassPanes(true);
    const { container } = render(<GlassPanes />);

    const wrapper = container.querySelector(
      '[data-fluidkit="glass-panes"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-animating")).toBe("false");
    panes(container).forEach((el) => {
      expect(el.style.animationName).toBe("none");
    });
  });

  it("pauses (not tears down) sliding when scrolled out of view, resuming in view", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const { container } = render(<GlassPanes />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });
    panes(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("paused");
      expect(el.style.animationName).not.toBe("none");
    });

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    panes(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("running");
    });
  });

  it("injects its keyframes stylesheet once, shared across instances", async () => {
    const GlassPanes = await loadGlassPanes(false);
    render(
      <>
        <GlassPanes />
        <GlassPanes />
      </>
    );

    expect(
      document.querySelectorAll("#fluidkit-glass-panes-keyframes")
    ).toHaveLength(1);
  });

  it("merges consumer className/style onto the wrapper without breaking the fill contract", async () => {
    const GlassPanes = await loadGlassPanes(false);
    const { container } = render(
      <GlassPanes className="custom-class" style={{ zIndex: 3 }} />
    );

    const wrapper = container.querySelector(
      '[data-fluidkit="glass-panes"]'
    ) as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
    expect(wrapper.style.zIndex).toBe("3");
    expect(wrapper.style.position).toBe("absolute");
  });
});
