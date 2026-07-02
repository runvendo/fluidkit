import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * Same mocking pattern as the other component tests: `MeshGradient` reads
 * `usePrefersReducedMotion()`, which reads Motion's `useReducedMotion()`
 * under the hood.
 */
async function loadMeshGradient(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/MeshGradient");
  return mod.MeshGradient;
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

function blobs(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('[data-fluidkit="mesh-blob"]')
  ) as HTMLElement[];
}

describe("MeshGradient", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
    vi.unstubAllGlobals();
    document.getElementById("fluidkit-mesh-gradient-keyframes")?.remove();
  });

  it("renders one blob per color, each with a radial-gradient background", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const { container } = render(
      <MeshGradient colors={["#ff0000", "#00ff00", "#0000ff", "#ffff00"]} />
    );

    const els = blobs(container);
    expect(els).toHaveLength(4);
    els.forEach((el) => {
      expect(el.style.background).toContain("radial-gradient");
      expect(el.style.background).toContain("transparent");
    });
    expect(els[0].style.background).toContain("255, 0, 0");
    expect(els[1].style.background).toContain("0, 255, 0");
  });

  it("uses a default tasteful color set when colors is omitted", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const { container } = render(<MeshGradient />);

    const els = blobs(container);
    expect(els.length).toBeGreaterThanOrEqual(3);
    expect(els.length).toBeLessThanOrEqual(4);
  });

  it("marks the wrapper aria-hidden and pointer-events:none, with pointer-events:none on blobs too", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const { container } = render(<MeshGradient />);

    const wrapper = container.querySelector(
      '[data-fluidkit="mesh-gradient"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.style.pointerEvents).toBe("none");
  });

  it("produces identical blob styles across two independent renders (deterministic placement)", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const a = render(<MeshGradient colors={["#ff0000", "#00ff00", "#0000ff"]} />);
    const b = render(<MeshGradient colors={["#ff0000", "#00ff00", "#0000ff"]} />);

    const aBlobs = blobs(a.container);
    const bBlobs = blobs(b.container);
    expect(aBlobs).toHaveLength(bBlobs.length);
    aBlobs.forEach((el, i) => {
      expect(el.style.left).toBe(bBlobs[i].style.left);
      expect(el.style.top).toBe(bBlobs[i].style.top);
      expect(el.style.width).toBe(bBlobs[i].style.width);
      expect(el.style.height).toBe(bBlobs[i].style.height);
      expect(el.style.animationDelay).toBe(bBlobs[i].style.animationDelay);
      expect(el.style.animationDuration).toBe(bBlobs[i].style.animationDuration);
    });
  });

  it("is static under prefers-reduced-motion: animation none, blobs at home positions, data-animating=false", async () => {
    const MeshGradient = await loadMeshGradient(true);
    const { container } = render(<MeshGradient />);

    const wrapper = container.querySelector(
      '[data-fluidkit="mesh-gradient"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-animating")).toBe("false");

    blobs(container).forEach((el) => {
      expect(el.style.animationName).toBe("none");
      // Home position: centering transform only, no drift keyframe applied.
      expect(el.style.transform).toBe("translate(-50%, -50%)");
    });
  });

  it("pauses blob animation via animation-play-state when scrolled out of view", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const { container } = render(<MeshGradient />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    blobs(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("running");
    });

    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });
    const wrapper = container.querySelector(
      '[data-fluidkit="mesh-gradient"]'
    ) as HTMLElement;
    expect(wrapper.getAttribute("data-animating")).toBe("false");
    blobs(container).forEach((el) => {
      expect(el.style.animationPlayState).toBe("paused");
    });
  });

  it("merges consumer className/style onto the wrapper", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const { container } = render(
      <MeshGradient className="custom-class" style={{ zIndex: 3 }} />
    );

    const wrapper = container.querySelector(
      '[data-fluidkit="mesh-gradient"]'
    ) as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
    expect(wrapper.style.zIndex).toBe("3");
    // Positioning contract stays intact even with consumer overrides.
    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("applies a CSS blur filter to blobs, honoring the blur prop", async () => {
    const MeshGradient = await loadMeshGradient(false);
    const { container } = render(<MeshGradient blur={12} />);

    blobs(container).forEach((el) => {
      expect(el.style.filter).toBe("blur(12px)");
    });
  });

  it("does not touch document merely by importing the module (SSR-safe)", async () => {
    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });
    const createSpy = vi.spyOn(document, "createElement");
    await import("../../src/components/MeshGradient");
    expect(createSpy).not.toHaveBeenCalledWith("style");
    createSpy.mockRestore();
  });
});
