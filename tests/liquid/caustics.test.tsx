import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

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

async function loadLayer() {
  vi.resetModules();
  const mod = await import("../../src/liquid/caustics");
  return mod.CausticsLayer;
}

describe("CausticsLayer", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("renders an inert absolute layer", async () => {
    const CausticsLayer = await loadLayer();
    const { container } = render(<CausticsLayer />);
    const host = container.querySelector(
      '[data-fluidkit="caustics-layer"]'
    ) as HTMLElement;
    expect(host).toBeInTheDocument();
    expect(host.style.position).toBe("absolute");
    expect(host.style.pointerEvents).toBe("none");
    expect(host).toHaveAttribute("aria-hidden", "true");
  });

  it("without WebGL (jsdom) it mounts no canvas — the CSS base beneath is the fallback", async () => {
    const CausticsLayer = await loadLayer();
    const { container } = render(<CausticsLayer />);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("unmounts cleanly", async () => {
    const CausticsLayer = await loadLayer();
    const { unmount } = render(
      <CausticsLayer light="#dbeaff" intensity={0.8} />
    );
    expect(() => unmount()).not.toThrow();
  });
});

/**
 * GL lifecycle paths, exercised against a minimal fake WebGL context.
 * jsdom has no ResizeObserver, so these also prove the layer works (and
 * never throws) without one — the spec's degradation contract.
 */
describe("CausticsLayer GL lifecycle (fake context)", () => {
  const loseContext = vi.fn();

  function makeFakeGl(opts: { compiles: boolean }) {
    return {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      ARRAY_BUFFER: 5,
      STATIC_DRAW: 6,
      FLOAT: 7,
      TRIANGLES: 8,
      COLOR_BUFFER_BIT: 9,
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => opts.compiles),
      deleteShader: vi.fn(),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => opts.compiles),
      deleteProgram: vi.fn(),
      useProgram: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      getUniformLocation: vi.fn(() => ({})),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      uniform3f: vi.fn(),
      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      drawArrays: vi.fn(),
      getExtension: vi.fn(() => ({ loseContext })),
    };
  }

  async function loadWithGl(fakeGl: unknown) {
    vi.resetModules();
    vi.doMock("../../src/utils/supportsWebGL", () => ({
      supportsWebGL: () => true,
    }));
    const original = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
        if (kind === "webgl") return fakeGl as never;
        return original.call(this, kind as never, ...rest) as never;
      } as never
    );
    const mod = await import("../../src/liquid/caustics");
    return mod.CausticsLayer;
  }

  beforeEach(() => {
    loseContext.mockClear();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.doUnmock("../../src/utils/supportsWebGL");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("boots: mounts a canvas, draws, and releases the context on unmount", async () => {
    const gl = makeFakeGl({ compiles: true });
    const CausticsLayer = await loadWithGl(gl);
    const { container, unmount } = render(<CausticsLayer />);
    expect(container.querySelector("canvas")).toBeTruthy();
    // jsdom has no ResizeObserver — the sized-once path must not throw,
    // and the still-frame draw must have happened (reduced defaults true).
    expect(gl.drawArrays).toHaveBeenCalled();
    unmount();
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("shader compile failure: no canvas mounts and the context is released", async () => {
    const gl = makeFakeGl({ compiles: false });
    const CausticsLayer = await loadWithGl(gl);
    const { container } = render(<CausticsLayer />);
    expect(container.querySelector("canvas")).toBeNull();
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });
});
