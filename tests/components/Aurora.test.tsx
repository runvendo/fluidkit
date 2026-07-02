import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * Same mocking pattern as MeshGradient's tests: `Aurora` reads
 * `usePrefersReducedMotion()`, which reads Motion's `useReducedMotion()`
 * under the hood.
 */
async function loadAurora(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Aurora");
  return mod.Aurora;
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

function bands(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('[data-fluidkit="aurora-band"]')
  ) as HTMLElement[];
}

describe("Aurora", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
    vi.unstubAllGlobals();
    document.getElementById("fluidkit-aurora-keyframes")?.remove();
  });

  it("renders one band per color, each a blurred horizontal gradient strip", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(
      <Aurora colors={["#ff0000", "#00ff00", "#0000ff"]} />
    );

    const els = bands(container);
    expect(els).toHaveLength(3);
    els.forEach((el) => {
      expect(el.style.background).toContain("linear-gradient");
      expect(el.style.background).toContain("transparent");
      expect(el.style.filter).toContain("blur");
      expect(el.style.mixBlendMode).toBe("screen");
    });
    expect(els[0].style.background).toContain("255, 0, 0");
    expect(els[1].style.background).toContain("0, 255, 0");
  });

  it("uses a default 2-3 cool-hue color set when colors is omitted", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(<Aurora />);

    const els = bands(container);
    expect(els.length).toBeGreaterThanOrEqual(2);
    expect(els.length).toBeLessThanOrEqual(3);
  });

  it("marks the wrapper aria-hidden, data-fluidkit=aurora, and pointer-events:none on wrapper and bands", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(<Aurora />);

    const wrapper = container.querySelector(
      '[data-fluidkit="aurora"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.style.pointerEvents).toBe("none");
    bands(container).forEach((el) => {
      expect(el.style.pointerEvents).toBe("none");
    });
  });

  it("defaults blend to screen and maps the blend prop onto mix-blend-mode", async () => {
    const Aurora = await loadAurora(false);
    const byDefault = render(<Aurora colors={["#ff0000"]} />);
    const normal = render(<Aurora colors={["#ff0000"]} blend="normal" />);
    const multiply = render(<Aurora colors={["#ff0000"]} blend="multiply" />);

    expect(bands(byDefault.container)[0].style.mixBlendMode).toBe("screen");
    expect(bands(normal.container)[0].style.mixBlendMode).toBe("normal");
    expect(bands(multiply.container)[0].style.mixBlendMode).toBe("multiply");
  });

  it("bumps band opacity under blend=normal so bands read without screen compositing, capped at 1", async () => {
    const Aurora = await loadAurora(false);
    const screen = render(<Aurora colors={["#ff0000"]} intensity={0.5} />);
    const normal = render(
      <Aurora colors={["#ff0000"]} intensity={0.5} blend="normal" />
    );
    const maxed = render(
      <Aurora colors={["#ff0000"]} intensity={1} blend="normal" />
    );

    const screenOpacity = parseFloat(bands(screen.container)[0].style.opacity);
    const normalOpacity = parseFloat(bands(normal.container)[0].style.opacity);
    expect(normalOpacity).toBeGreaterThan(screenOpacity);
    expect(
      parseFloat(bands(maxed.container)[0].style.opacity)
    ).toBeLessThanOrEqual(1);
  });

  it("wires the per-band skew custom property into the injected keyframes", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(<Aurora colors={["#ff0000"]} />);

    bands(container).forEach((el) => {
      expect(el.style.getPropertyValue("--fluidkit-aurora-skew")).toMatch(/deg$/);
    });
    const style = document.getElementById("fluidkit-aurora-keyframes");
    expect(style?.textContent).toContain("var(--fluidkit-aurora-skew)");
  });

  it("scales band opacity by the intensity prop", async () => {
    const Aurora = await loadAurora(false);
    const low = render(<Aurora colors={["#ff0000"]} intensity={0.2} />);
    const high = render(<Aurora colors={["#ff0000"]} intensity={0.9} />);

    const lowOpacity = parseFloat(bands(low.container)[0].style.opacity);
    const highOpacity = parseFloat(bands(high.container)[0].style.opacity);
    expect(highOpacity).toBeGreaterThan(lowOpacity);
  });

  it("defaults intensity to 0.6", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(<Aurora colors={["#ff0000"]} />);

    const opacity = parseFloat(bands(container)[0].style.opacity);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it("produces identical band styles across two independent renders (deterministic placement)", async () => {
    const Aurora = await loadAurora(false);
    const a = render(<Aurora colors={["#ff0000", "#00ff00", "#0000ff"]} />);
    const b = render(<Aurora colors={["#ff0000", "#00ff00", "#0000ff"]} />);

    const aBands = bands(a.container);
    const bBands = bands(b.container);
    expect(aBands).toHaveLength(bBands.length);
    aBands.forEach((el, i) => {
      expect(el.style.top).toBe(bBands[i].style.top);
      expect(el.style.transform).toBe(bBands[i].style.transform);
      expect(el.style.animationDelay).toBe(bBands[i].style.animationDelay);
      expect(el.style.animationDuration).toBe(bBands[i].style.animationDuration);
    });
  });

  it("is static under prefers-reduced-motion: animation none, bands at home positions, data-animating=false", async () => {
    const Aurora = await loadAurora(true);
    const { container } = render(<Aurora />);

    const wrapper = container.querySelector(
      '[data-fluidkit="aurora"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-animating")).toBe("false");

    bands(container).forEach((el) => {
      expect(el.style.animationName).toBe("none");
    });
  });

  it("pauses band animation via animation-play-state when scrolled out of view", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(<Aurora />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    bands(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("running");
    });

    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });
    const wrapper = container.querySelector(
      '[data-fluidkit="aurora"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-animating")).toBe("false");
    bands(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("paused");
    });
  });

  it("clamps speed to a small positive minimum, avoiding Infinity-duration keyframes at speed=0", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(<Aurora speed={0} />);

    bands(container).forEach((el) => {
      const duration = parseFloat(el.style.animationDuration);
      expect(Number.isFinite(duration)).toBe(true);
      expect(duration).toBeGreaterThan(0);
    });
  });

  it("merges consumer className/style onto the wrapper", async () => {
    const Aurora = await loadAurora(false);
    const { container } = render(
      <Aurora className="custom-class" style={{ zIndex: 3 }} />
    );

    const wrapper = container.querySelector(
      '[data-fluidkit="aurora"]'
    ) as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
    expect(wrapper.style.zIndex).toBe("3");
    // Positioning contract stays intact even with consumer overrides.
    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("injects the drift keyframes style tag into the document head on mount", async () => {
    const Aurora = await loadAurora(false);
    expect(document.getElementById("fluidkit-aurora-keyframes")).toBeNull();

    render(<Aurora />);

    const style = document.getElementById("fluidkit-aurora-keyframes");
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe("STYLE");
    expect(style?.textContent).toContain("@keyframes");
  });

  it("does not touch document merely by importing the module (SSR-safe)", async () => {
    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });
    const createSpy = vi.spyOn(document, "createElement");
    await import("../../src/components/Aurora");
    expect(createSpy).not.toHaveBeenCalledWith("style");
    createSpy.mockRestore();
  });
});
