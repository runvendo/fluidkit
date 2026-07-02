import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

/**
 * `@paper-design/shaders-react`'s `LiquidMetal` is a real WebGL shader —
 * jsdom has no WebGL, so it's mocked for the whole file. The mock records
 * every call so tests can assert on the exact props the wrapper maps onto
 * it. Declared once (not per-test) since, unlike `usePrefersReducedMotion`
 * and `supportsWebGL` below, its behavior doesn't need to vary between
 * tests — only the props passed to it do.
 */
const { shaderMock } = vi.hoisted(() => ({ shaderMock: vi.fn() }));

vi.mock("@paper-design/shaders-react", () => ({
  LiquidMetal: (props: Record<string, unknown>) => {
    shaderMock(props);
    return <div data-testid="shader-mock" />;
  },
}));

/**
 * Same per-test re-import pattern as Aurora's and refraction's tests:
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
  it("mounts the shader with mapped props when WebGL is supported and motion is allowed", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(
      <LiquidMetal
        color="#123456"
        backgroundColor="#abcdef"
        speed={2}
        intensity={0.5}
      />
    );

    expect(shaderMock).toHaveBeenCalled();
    const props = shaderMock.mock.calls[shaderMock.mock.calls.length - 1][0];
    expect(props.colorTint).toBe("#123456");
    expect(props.colorBack).toBe("#abcdef");
    expect(props.speed).toBe(2);
    expect(props.distortion).toBe(0.5);
  });

  it("defaults color/backgroundColor/intensity to the shader's own defaultPreset values", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.colorTint).toBe("#ffffff");
    expect(props.colorBack).toBe("#AAAAAC");
    expect(props.distortion).toBe(0.07);
    expect(props.speed).toBe(1);
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
      <LiquidMetal color="#123456" backgroundColor="#abcdef" />
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

  it("clamps speed to the shared MIN_SPEED floor instead of passing 0 through", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal speed={0} />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.speed).toBeGreaterThan(0);
    expect(props.speed).toBeCloseTo(0.01);
  });

  it("lets shaderProps override mapped props, applied after color/backgroundColor/speed/intensity", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(
      <LiquidMetal
        color="#123456"
        speed={2}
        shaderProps={{ colorTint: "#000000", speed: 9, shape: "circle" }}
      />
    );

    const props = shaderMock.mock.calls[0][0];
    expect(props.colorTint).toBe("#000000");
    expect(props.speed).toBe(9);
    expect(props.shape).toBe("circle");
  });

  it("preserves the fill-parent style default even when shaderProps sets other style keys", async () => {
    const LiquidMetal = await loadLiquidMetal(false, true);
    render(<LiquidMetal shaderProps={{ style: { opacity: 0.5 } }} />);

    const props = shaderMock.mock.calls[0][0];
    expect(props.style.opacity).toBe(0.5);
    expect(props.style.width).toBe("100%");
    expect(props.style.height).toBe("100%");
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
