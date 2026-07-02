import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

/**
 * `webgl-fluid-enhanced` is a real imperative WebGL sim (a class that
 * touches canvas/WebGL synchronously in its constructor) — jsdom has no
 * WebGL, so it's mocked for the whole file. The mock class faithfully
 * reproduces one load-bearing side effect of the real 0.8.0 constructor
 * (verified against `node_modules/webgl-fluid-enhanced/dist/index.es.js`):
 * it synchronously overwrites `container.style.{outline,position,display,
 * justifyContent,alignItems}` to center a canvas it may create itself. The
 * wrapper must counteract this to keep its `position: absolute` overlay
 * contract — reproducing the mutation here is what proves that fixup
 * actually runs, not just that we "meant to" write it.
 *
 * `togglePause` mirrors the real (toggle, not set-paused) semantics: it
 * flips and returns the new paused boolean, so tests can catch a caller
 * that fails to track state and double-toggles.
 */
const { instances, WebGLFluidEnhancedMock } = vi.hoisted(() => {
  class MockSimulation {
    container: HTMLElement;
    paused = false;
    start = vi.fn();
    stop = vi.fn();
    setConfig = vi.fn();
    togglePause = vi.fn((_drawWhilePaused?: boolean) => {
      this.paused = !this.paused;
      return this.paused;
    });

    constructor(container: HTMLElement) {
      this.container = container;
      container.style.outline = "none";
      container.style.position = "relative";
      container.style.display = "flex";
      container.style.justifyContent = "center";
      container.style.alignItems = "center";
    }
  }
  const instances: MockSimulation[] = [];
  const WebGLFluidEnhancedMock = vi.fn(function (this: unknown, container: HTMLElement) {
    const instance = new MockSimulation(container);
    instances.push(instance);
    return instance;
  });
  return { instances, WebGLFluidEnhancedMock };
});

vi.mock("webgl-fluid-enhanced", () => ({ default: WebGLFluidEnhancedMock }));

/** Same per-test re-import pattern as LiquidMetal's tests. */
async function loadWaterField(reducedMotion: boolean, webglSupported: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reducedMotion };
  });
  vi.doMock("../../src/utils/supportsWebGL", () => ({
    supportsWebGL: () => webglSupported,
  }));
  const mod = await import("../../src/water-field/index");
  return mod.WaterField;
}

/**
 * Like `loadWaterField`, but reduced motion is read from a mutable box on
 * every render, so a test can flip the preference mid-lifecycle (paired
 * with a `rerender()` to pick the new value up — the mock has no real
 * media-query subscription). Needed for the pause-reconciliation
 * regression test, which reboots the sim by toggling PRM while the
 * component stays mounted.
 */
async function loadWaterFieldWithMutableMotion(webglSupported: boolean) {
  vi.resetModules();
  const motionBox = { reducedMotion: false };
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => motionBox.reducedMotion };
  });
  vi.doMock("../../src/utils/supportsWebGL", () => ({
    supportsWebGL: () => webglSupported,
  }));
  const mod = await import("../../src/water-field/index");
  return { WaterField: mod.WaterField, motionBox };
}

/** Same jsdom-has-no-IntersectionObserver mock as LiquidMetal's tests. */
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
  return container.querySelector('[data-fluidkit="water-field"]') as HTMLElement;
}

function fallback(container: HTMLElement) {
  return container.querySelector(
    '[data-fluidkit="water-field-fallback"]'
  ) as HTMLElement | null;
}

function canvas(container: HTMLElement) {
  return container.querySelector(
    '[data-fluidkit="water-field-canvas"]'
  ) as HTMLCanvasElement | null;
}

beforeEach(() => {
  instances.length = 0;
  WebGLFluidEnhancedMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.doUnmock("motion/react");
  vi.doUnmock("../../src/utils/supportsWebGL");
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("WaterField", () => {
  it("boots the sim with mapped config when WebGL is supported and motion is allowed", async () => {
    const WaterField = await loadWaterField(false, true);
    const { container } = render(
      <WaterField colors={["#123456", "#abcdef"]} intensity={0.9} interactive={false} />
    );

    expect(WebGLFluidEnhancedMock).toHaveBeenCalledTimes(1);
    expect(WebGLFluidEnhancedMock.mock.calls[0][0]).toBe(wrapper(container));

    const instance = instances[0];
    expect(instance.start).toHaveBeenCalledTimes(1);
    expect(instance.setConfig).toHaveBeenCalled();
    const config = instance.setConfig.mock.calls[instance.setConfig.mock.calls.length - 1][0];
    expect(config.colorPalette).toEqual(["#123456", "#abcdef"]);
    expect(config.hover).toBe(false);
    // intensity 0.9 vs the 0.6 anchor: splatRadius/splatForce scale linearly.
    expect(config.splatRadius).toBeCloseTo(0.25 * (0.9 / 0.6));
    expect(config.splatForce).toBeCloseTo(6000 * (0.9 / 0.6));
  });

  it("defaults intensity to 0.6 and interactive to true, matching the library's own defaults", async () => {
    const WaterField = await loadWaterField(false, true);
    render(<WaterField />);

    const instance = instances[0];
    const config = instance.setConfig.mock.calls[instance.setConfig.mock.calls.length - 1][0];
    expect(config.splatRadius).toBeCloseTo(0.25);
    expect(config.splatForce).toBeCloseTo(6000);
    expect(config.hover).toBe(true);
    expect(config.colorPalette).toBeUndefined();
  });

  it("never boots and renders the fallback when WebGL is unsupported", async () => {
    const WaterField = await loadWaterField(false, false);
    const { container } = render(<WaterField />);

    expect(WebGLFluidEnhancedMock).not.toHaveBeenCalled();
    expect(wrapper(container).getAttribute("data-fallback")).toBe("true");
    expect(fallback(container)).not.toBeNull();
    expect(canvas(container)).toBeNull();
    expect(fallback(container)!.style.background).toContain("linear-gradient");
  });

  it("never boots and renders the fallback under prefers-reduced-motion, even when WebGL is supported", async () => {
    const WaterField = await loadWaterField(true, true);
    const { container } = render(<WaterField />);

    expect(WebGLFluidEnhancedMock).not.toHaveBeenCalled();
    expect(wrapper(container).getAttribute("data-fallback")).toBe("true");
    expect(wrapper(container).getAttribute("data-animating")).toBe("false");
  });

  it("gating wins over the config escape hatch: no WebGL still never boots even with a config prop set", async () => {
    const WaterField = await loadWaterField(false, false);
    render(<WaterField config={{ splatForce: 99999 }} />);

    expect(WebGLFluidEnhancedMock).not.toHaveBeenCalled();
  });

  it("lets the config escape hatch override mapped keys, applied after colors/intensity/interactive", async () => {
    const WaterField = await loadWaterField(false, true);
    render(
      <WaterField
        colors={["#111111"]}
        intensity={0.6}
        config={{ colorPalette: ["#ffffff"], splatRadius: 0.99 }}
      />
    );

    const instance = instances[0];
    const config = instance.setConfig.mock.calls[instance.setConfig.mock.calls.length - 1][0];
    expect(config.colorPalette).toEqual(["#ffffff"]);
    expect(config.splatRadius).toBe(0.99);
    // Unset by config, so the mapped value survives.
    expect(config.splatForce).toBeCloseTo(6000);
  });

  it("restores the position: absolute overlay contract after the library mutates the container's inline style", async () => {
    const WaterField = await loadWaterField(false, true);
    const { container } = render(<WaterField />);

    const el = wrapper(container);
    expect(el.style.position).toBe("absolute");
    expect(el.style.inset).toBe("0px");
  });

  it("marks the wrapper aria-hidden and data-fluidkit=water-field, owning a canvas filling it", async () => {
    const WaterField = await loadWaterField(false, true);
    const { container } = render(<WaterField />);

    const el = wrapper(container);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    const c = canvas(container)!;
    expect(c).not.toBeNull();
    expect(c.style.width).toBe("100%");
    expect(c.style.height).toBe("100%");
  });

  it("interactive=true (default) sets pointer-events auto on the canvas and hover true in config", async () => {
    const WaterField = await loadWaterField(false, true);
    const { container } = render(<WaterField />);

    expect(canvas(container)!.style.pointerEvents).toBe("auto");
    const instance = instances[0];
    const config = instance.setConfig.mock.calls[instance.setConfig.mock.calls.length - 1][0];
    expect(config.hover).toBe(true);
  });

  it("interactive=false sets pointer-events none on the canvas and hover false in config", async () => {
    const WaterField = await loadWaterField(false, true);
    const { container } = render(<WaterField interactive={false} />);

    expect(canvas(container)!.style.pointerEvents).toBe("none");
    const instance = instances[0];
    const config = instance.setConfig.mock.calls[instance.setConfig.mock.calls.length - 1][0];
    expect(config.hover).toBe(false);
  });

  it("pauses via togglePause on scroll-out and resumes on scroll-in, without unmounting", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    MockIntersectionObserver.instances = [];
    const WaterField = await loadWaterField(false, true);
    const { container } = render(<WaterField />);
    const observer = MockIntersectionObserver.instances[0];
    const instance = instances[0];

    // useInView (shared hook) starts pessimistic once a real/mocked
    // IntersectionObserver exists: it flips to `inView: false` right after
    // mount, before the observer's first real callback confirms
    // visibility (see tests/utils/useInView's own suite). That transition
    // already fired one togglePause() by the time this render settles.
    expect(instance.togglePause).toHaveBeenCalledTimes(1);
    expect(instance.paused).toBe(true);
    expect(wrapper(container).getAttribute("data-animating")).toBe("false");

    // The observer's first real callback confirms the element is in view.
    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    expect(instance.togglePause).toHaveBeenCalledTimes(2);
    expect(instance.paused).toBe(false);
    expect(wrapper(container).getAttribute("data-animating")).toBe("true");

    // Scroll out of view.
    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });
    expect(instance.togglePause).toHaveBeenCalledTimes(3);
    expect(instance.paused).toBe(true);
    expect(wrapper(container).getAttribute("data-animating")).toBe("false");
    // The sim stays mounted while merely paused — no teardown.
    expect(instance.stop).not.toHaveBeenCalled();

    // Scroll back in.
    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    expect(instance.togglePause).toHaveBeenCalledTimes(4);
    expect(instance.paused).toBe(false);
    expect(wrapper(container).getAttribute("data-animating")).toBe("true");
  });

  it("does not double-toggle pause when re-rendered without an inView change", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    MockIntersectionObserver.instances = [];
    const WaterField = await loadWaterField(false, true);
    const { container, rerender } = render(<WaterField intensity={0.6} />);
    const observer = MockIntersectionObserver.instances[0];
    const instance = instances[0];

    // Settle into a confirmed "in view, not paused" state first (see the
    // note above about useInView's initial pessimistic flip).
    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    expect(instance.togglePause).toHaveBeenCalledTimes(2);

    rerender(<WaterField intensity={0.7} />);
    rerender(<WaterField intensity={0.8} />);

    // No further toggles: inView never changed across these re-renders.
    expect(instance.togglePause).toHaveBeenCalledTimes(2);
    expect(wrapper(container).getAttribute("data-animating")).toBe("true");
  });

  it("reconciles pause state when the sim reboots while off-screen (PRM on then off)", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    MockIntersectionObserver.instances = [];
    const { WaterField, motionBox } = await loadWaterFieldWithMutableMotion(true);
    const { rerender } = render(<WaterField />);

    // useInView's initial pessimistic flip leaves us off-screen and paused
    // (see the note in the togglePause test above) — the exact state the
    // regression starts from.
    const first = instances[0];
    expect(first.togglePause).toHaveBeenCalledTimes(1);
    expect(first.paused).toBe(true);

    // Reduced motion turns ON while still off-screen: the sim tears down.
    motionBox.reducedMotion = true;
    rerender(<WaterField />);
    expect(first.stop).toHaveBeenCalledTimes(1);

    // Reduced motion turns OFF, still off-screen: a fresh instance boots.
    // Regression under test: the boot effect resets its paused tracking,
    // but nothing re-applied the pause for the still-out-of-view element —
    // leaving the new sim running physics off-screen forever.
    motionBox.reducedMotion = false;
    rerender(<WaterField />);

    expect(instances).toHaveLength(2);
    const second = instances[1];
    expect(second.togglePause).toHaveBeenCalledTimes(1);
    expect(second.paused).toBe(true);
  });

  it("updates the canvas's pointer-events when interactive flips live", async () => {
    const WaterField = await loadWaterField(false, true);
    const { container, rerender } = render(<WaterField interactive={true} />);
    expect(canvas(container)!.style.pointerEvents).toBe("auto");

    rerender(<WaterField interactive={false} />);
    expect(canvas(container)!.style.pointerEvents).toBe("none");

    rerender(<WaterField interactive={true} />);
    expect(canvas(container)!.style.pointerEvents).toBe("auto");
  });

  it("tears down via stop() on unmount", async () => {
    const WaterField = await loadWaterField(false, true);
    const { unmount } = render(<WaterField />);
    const instance = instances[0];

    unmount();

    expect(instance.stop).toHaveBeenCalledTimes(1);
  });

  it("does not touch document merely by importing the module (SSR-safe)", async () => {
    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });
    const createSpy = vi.spyOn(document, "createElement");
    await import("../../src/water-field/index");
    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it("keeps the mapped defaults in sync with the real package's defaultConfig (pin-bump canary)", async () => {
    // Bypass the file-wide mock to read the REAL 0.8.0 runtime defaults —
    // safe in jsdom: the package touches no DOM at module import time (its
    // constructor only touches window/document when actually invoked).
    const actual = await vi.importActual<typeof import("webgl-fluid-enhanced")>(
      "webgl-fluid-enhanced"
    );
    expect(actual.defaultConfig.splatRadius).toBe(0.25);
    expect(actual.defaultConfig.splatForce).toBe(6000);
    expect(actual.defaultConfig.hover).toBe(true);
  });
});
