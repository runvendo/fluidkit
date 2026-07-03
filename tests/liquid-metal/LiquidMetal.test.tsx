import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * `@paper-design/shaders-react`'s `LiquidMetal` is a real WebGL shader —
 * jsdom has no WebGL, so it's mocked for the whole file. The mock records
 * every call so tests can assert on the exact props the wrapper passes
 * through to it. Declared once (not per-test) since, unlike
 * `usePrefersReducedMotion` and `supportsWebGL` below, its behavior doesn't
 * need to vary between tests — only the props passed to it do.
 */
const { shaderMock } = vi.hoisted(() => ({ shaderMock: vi.fn() }));

vi.mock("@paper-design/shaders-react", () => ({
  LiquidMetal: (props: Record<string, unknown>) => {
    shaderMock(props);
    return <div data-testid="shader-mock" />;
  },
}));

/**
 * Same per-test re-import pattern as MeshGradient's and refraction's tests:
 * `LiquidMetal` reads `usePrefersReducedMotion()` (Motion's
 * `useReducedMotion()`) and `supportsWebGL()`, both of which need to vary
 * per test, so each variant is mocked fresh against a freshly re-imported
 * module.
 */
async function loadLiquidMetal(reducedMotion: boolean, webglSupported: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reducedMotion };
  });
  vi.doMock("../../src/utils/supportsWebGL", () => ({
    supportsWebGL: () => webglSupported,
  }));
  const mod = await import("../../src/liquid-metal/index");
  return mod.LiquidMetal;
}

/**
 * jsdom has no real IntersectionObserver (see tests/utils/useInView.test.tsx),
 * so `useInView` takes its "unavailable" branch and defaults permanently to
 * `inView: true` unless this mock is stubbed in. Left unstubbed for tests
 * that don't care about off-screen pausing, so `inView` doesn't
 * transiently flip to `false` right after mount and pollute assertions.
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

function wrapper(container: HTMLElement) {
  return container.querySelector('[data-fluidkit="liquid-metal"]') as HTMLElement;
}

function fallback(container: HTMLElement) {
  return container.querySelector(
    '[data-fluidkit="liquid-metal-fallback"]'
  ) as HTMLElement | null;
}

beforeEach(() => {
  shaderMock.mockClear();
});

afterEach(() => {
  vi.doUnmock("motion/react");
  vi.doUnmock("../../src/utils/supportsWebGL");
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("LiquidMetal", () => {
  it("passes shader params straight through when WebGL is supported and motion is allowed", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(
      <LiquidMetal
        colorTint="#123456"
        colorBack="#abcdef"
        speed={2}
        distortion={0.5}
        repetition={4}
        shape="circle"
      />
    );

    expect(shaderMock).toHaveBeenCalled();
    const props = shaderMock.mock.calls[shaderMock.mock.calls.length - 1][0];
    expect(props.colorTint).toBe("#123456");
    expect(props.colorBack).toBe("#abcdef");
    expect(props.speed).toBe(2);
    expect(props.distortion).toBe(0.5);
    expect(props.repetition).toBe(4);
    expect(props.shape).toBe("circle");
  });

  it("defaults to the full-canvas Backdrop look, not the floating-diamond defaultPreset", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.shape).toBe("none");
    expect(props.scale).toBe(1);
    expect(props.colorTint).toBe("#ffffff");
    expect(props.colorBack).toBe("#AAAAAC");
    expect(props.distortion).toBe(0.1);
    expect(props.repetition).toBe(1.5);
    expect(props.softness).toBe(0.05);
    expect(props.speed).toBe(1);
  });

  it("does not let an explicitly-undefined prop override a backdrop default", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal shape={undefined} repetition={undefined} />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.shape).toBe("none");
    expect(props.repetition).toBe(1.5);
  });

  it("renders the fallback with data-fallback=true and never mounts the shader when WebGL is unsupported", async () => {
    const LiquidMetal = await loadLiquidMetal(false, false);
    const { container } = render(<LiquidMetal />);

    expect(shaderMock).not.toHaveBeenCalled();
    expect(wrapper(container).getAttribute("data-fallback")).toBe("true");
    expect(fallback(container)).not.toBeNull();
    expect(fallback(container)!.style.background).toContain("linear-gradient");
  });

  it("renders the fallback and never mounts the shader under prefers-reduced-motion, even when WebGL is supported", async () => {
    const LiquidMetal = await loadLiquidMetal(true, true);
    const { container } = render(<LiquidMetal />);

    expect(shaderMock).not.toHaveBeenCalled();
    expect(wrapper(container).getAttribute("data-fallback")).toBe("true");
    expect(fallback(container)).not.toBeNull();
    expect(wrapper(container).getAttribute("data-animating")).toBe("false");
  });

  it("uses the resolved colors in the fallback gradient", async () => {
    const LiquidMetal = await loadLiquidMetal(false, false);
    const { container } = render(
      <LiquidMetal colorTint="#123456" colorBack="#abcdef" />
    );

    // jsdom's CSSOM normalizes hex colors to rgb() on read.
    const bg = fallback(container)!.style.background;
    expect(bg).toContain("rgb(18, 52, 86)");
    expect(bg).toContain("rgb(171, 205, 239)");
  });

  it("marks the wrapper aria-hidden, data-fluidkit=liquid-metal, and pointer-events:none, filling the parent", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    const { container } = render(<LiquidMetal />);

    const el = wrapper(container);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.style.pointerEvents).toBe("none");
    expect(el.style.position).toBe("absolute");
    expect(el.style.inset).toBe("0px");
  });

  it("merges consumer className/style onto the wrapper without breaking the fill contract", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    const { container } = render(
      <LiquidMetal className="custom-class" style={{ zIndex: 3 }} />
    );

    const el = wrapper(container);
    expect(el.className).toContain("custom-class");
    expect(el.style.zIndex).toBe("3");
    expect(el.style.position).toBe("absolute");
  });

  it("keeps the shader itself on the fill-parent style", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.style.width).toBe("100%");
    expect(props.style.height).toBe("100%");
  });

  it("clamps speed to the shared MIN_SPEED floor instead of passing 0 through", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal speed={0} />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.speed).toBeGreaterThan(0);
    expect(props.speed).toBeCloseTo(0.01);
  });

  it("pauses the shader (speed forced to 0) while scrolled out of view, without unmounting it", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    MockIntersectionObserver.instances = [];
    const LiquidMetal = await loadLiquidMetal(false, true);
    const { container } = render(<LiquidMetal speed={2} />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });

    expect(shaderMock).toHaveBeenCalled();
    const pausedProps = shaderMock.mock.calls[shaderMock.mock.calls.length - 1][0];
    expect(pausedProps.speed).toBe(0);
    expect(wrapper(container).getAttribute("data-animating")).toBe("false");

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });

    const resumedProps = shaderMock.mock.calls[shaderMock.mock.calls.length - 1][0];
    expect(resumedProps.speed).toBe(2);
    expect(wrapper(container).getAttribute("data-animating")).toBe("true");
  });

  it("keeps the backdrop defaults in sync with the real package's fullScreenPreset (pin-bump canary)", async () => {
    // Bypass the file-wide mock to read the REAL 0.0.76 runtime presets —
    // safe in jsdom: the package touches no DOM at module import time. If a
    // future pin bump changes upstream preset params, this fails loudly.
    const actual = await vi.importActual<
      typeof import("@paper-design/shaders-react")
    >("@paper-design/shaders-react");
    const backdropPreset = actual.liquidMetalPresets.find(
      (preset) => preset.name === "Backdrop"
    );
    expect(backdropPreset).toBeDefined();

    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.colorTint).toBe(backdropPreset!.params.colorTint);
    expect(props.colorBack).toBe(backdropPreset!.params.colorBack);
    expect(props.distortion).toBe(backdropPreset!.params.distortion);
    expect(props.repetition).toBe(backdropPreset!.params.repetition);
    expect(props.softness).toBe(backdropPreset!.params.softness);
    expect(props.shape).toBe(backdropPreset!.params.shape);
    expect(props.scale).toBe(backdropPreset!.params.scale);
    expect(props.speed).toBe(backdropPreset!.params.speed);
  });

  it("does not touch document merely by importing the module (SSR-safe)", async () => {
    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });
    const createSpy = vi.spyOn(document, "createElement");
    await import("../../src/liquid-metal/index");
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });
});
