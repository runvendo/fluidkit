import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * Same mocking pattern as MeshGradient's tests: `Silk` reads
 * `usePrefersReducedMotion()`, which reads Motion's `useReducedMotion()`
 * under the hood.
 */
async function loadSilk(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Silk");
  return mod.Silk;
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

function sheets(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('[data-fluidkit="silk-sheet"]')
  ) as HTMLElement[];
}

describe("Silk", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
    vi.unstubAllGlobals();
    document.getElementById("fluidkit-silk-keyframes")?.remove();
  });

  it("renders one full-height blurred gradient sheet per color, all on the shared diagonal", async () => {
    const Silk = await loadSilk(false);
    const { container } = render(
      <Silk colors={["#ff0000", "#00ff00", "#0000ff"]} />
    );

    const els = sheets(container);
    expect(els).toHaveLength(3);
    els.forEach((el) => {
      expect(el.style.background).toContain("linear-gradient");
      expect(el.style.background).toContain("transparent");
      expect(el.style.filter).toContain("blur");
      expect(el.style.transform).toContain("rotate(24deg)");
    });
    expect(els[0].style.background).toContain("255, 0, 0");
    expect(els[1].style.background).toContain("0, 255, 0");
  });

  it("uses a default soft fabric set when colors is omitted", async () => {
    const Silk = await loadSilk(false);
    const { container } = render(<Silk />);

    expect(sheets(container).length).toBeGreaterThanOrEqual(2);
  });

  it("hangs `count` sheets, cycling colors, clamped to 12", async () => {
    const Silk = await loadSilk(false);
    const six = render(<Silk colors={["#ff0000", "#00ff00"]} count={6} />);
    const clamped = render(<Silk colors={["#ff0000"]} count={40} />);

    const els = sheets(six.container);
    expect(els).toHaveLength(6);
    expect(els[0].style.background).toContain("255, 0, 0");
    expect(els[1].style.background).toContain("0, 255, 0");
    expect(els[2].style.background).toContain("255, 0, 0");
    expect(sheets(clamped.container)).toHaveLength(12);
  });

  it("marks the glass material on the wrapper and drops the self blur (frost replaces it)", async () => {
    const Silk = await loadSilk(false);
    const byDefault = render(<Silk />);
    const glass = render(<Silk material="glass" />);

    const defaultWrapper = byDefault.container.querySelector(
      '[data-fluidkit="silk"]'
    ) as HTMLElement;
    const glassWrapper = glass.container.querySelector(
      '[data-fluidkit="silk"]'
    ) as HTMLElement;
    expect(defaultWrapper.getAttribute("data-material")).toBe("color");
    expect(glassWrapper.getAttribute("data-material")).toBe("glass");

    sheets(byDefault.container).forEach((el) => {
      expect(el.style.filter).toContain("blur");
    });
    sheets(glass.container).forEach((el) => {
      expect(el.style.filter).not.toContain("blur");
    });
  });

  it("marks the wrapper aria-hidden, data-fluidkit=silk, and pointer-events:none, filling the parent", async () => {
    const Silk = await loadSilk(false);
    const { container } = render(<Silk />);

    const wrapper = container.querySelector(
      '[data-fluidkit="silk"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.style.pointerEvents).toBe("none");
    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.style.inset).toBe("0px");
    sheets(container).forEach((el) => {
      expect(el.style.pointerEvents).toBe("none");
    });
  });

  it("maps intensity onto sheet opacity, capped at 1", async () => {
    const Silk = await loadSilk(false);
    const dim = render(<Silk colors={["#ff0000"]} intensity={0.4} />);
    const maxed = render(<Silk colors={["#ff0000"]} intensity={1} />);

    const dimOpacity = parseFloat(sheets(dim.container)[0].style.opacity);
    const maxedOpacity = parseFloat(sheets(maxed.container)[0].style.opacity);
    expect(dimOpacity).toBeLessThan(maxedOpacity);
    expect(maxedOpacity).toBeLessThanOrEqual(1);
  });

  it("lays out sheets deterministically — two renders with the same colors match exactly", async () => {
    const Silk = await loadSilk(false);
    const a = render(<Silk colors={["#ff0000", "#00ff00"]} />);
    const b = render(<Silk colors={["#ff0000", "#00ff00"]} />);

    const stylesA = sheets(a.container).map((el) => el.getAttribute("style"));
    const stylesB = sheets(b.container).map((el) => el.getAttribute("style"));
    expect(stylesA).toEqual(stylesB);
  });

  it("speeds up flow with speed (shorter animation-duration), clamped above 0", async () => {
    const Silk = await loadSilk(false);
    const base = render(<Silk colors={["#ff0000"]} speed={1} />);
    const fast = render(<Silk colors={["#ff0000"]} speed={2} />);
    const clamped = render(<Silk colors={["#ff0000"]} speed={0} />);

    const baseS = parseFloat(sheets(base.container)[0].style.animationDuration);
    const fastS = parseFloat(sheets(fast.container)[0].style.animationDuration);
    const clampedS = parseFloat(
      sheets(clamped.container)[0].style.animationDuration
    );
    expect(fastS).toBeCloseTo(baseS / 2);
    expect(Number.isFinite(clampedS)).toBe(true);
    expect(clampedS).toBeGreaterThan(0);
  });

  it("drops the flow keyframes entirely under prefers-reduced-motion, keeping sheets at home", async () => {
    const Silk = await loadSilk(true);
    const { container } = render(<Silk />);

    const wrapper = container.querySelector(
      '[data-fluidkit="silk"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-animating")).toBe("false");
    sheets(container).forEach((el) => {
      expect(el.style.animationName).toBe("none");
      expect(el.style.transform).toContain("rotate(24deg)");
    });
  });

  it("pauses (not tears down) the flow when scrolled out of view, resuming in view", async () => {
    const Silk = await loadSilk(false);
    const { container } = render(<Silk />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });
    sheets(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("paused");
      expect(el.style.animationName).not.toBe("none");
    });

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    sheets(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("running");
    });
  });

  it("injects its keyframes stylesheet once, shared across instances", async () => {
    const Silk = await loadSilk(false);
    render(
      <>
        <Silk />
        <Silk />
      </>
    );

    expect(document.querySelectorAll("#fluidkit-silk-keyframes")).toHaveLength(1);
  });

  it("merges consumer className/style onto the wrapper without breaking the fill contract", async () => {
    const Silk = await loadSilk(false);
    const { container } = render(
      <Silk className="custom-class" style={{ zIndex: 3 }} />
    );

    const wrapper = container.querySelector(
      '[data-fluidkit="silk"]'
    ) as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
    expect(wrapper.style.zIndex).toBe("3");
    expect(wrapper.style.position).toBe("absolute");
  });
});
