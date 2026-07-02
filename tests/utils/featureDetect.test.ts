import { afterEach, describe, expect, it, vi } from "vitest";
import {
  supportsBackdropFilter,
  supportsRefraction,
} from "../../src/utils/featureDetect";

const originalCSS = globalThis.CSS;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();

  if (originalCSS === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).CSS;
  } else {
    globalThis.CSS = originalCSS;
  }
});

describe("supportsBackdropFilter", () => {
  it("returns false without throwing when CSS.supports is absent (SSR-like)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).CSS;

    expect(() => supportsBackdropFilter()).not.toThrow();
    expect(supportsBackdropFilter()).toBe(false);
  });

  it("returns false without throwing when CSS exists but supports() is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {};

    expect(() => supportsBackdropFilter()).not.toThrow();
    expect(supportsBackdropFilter()).toBe(false);
  });

  it("returns true when CSS.supports reports backdrop-filter support", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn((prop: string) => prop === "backdrop-filter"),
    };

    expect(supportsBackdropFilter()).toBe(true);
  });

  it("returns true when only the -webkit- prefixed form is supported", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn((prop: string) => prop === "-webkit-backdrop-filter"),
    };

    expect(supportsBackdropFilter()).toBe(true);
  });

  it("returns false without throwing when CSS.supports throws", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn(() => {
        throw new Error("boom");
      }),
    };

    expect(() => supportsBackdropFilter()).not.toThrow();
    expect(supportsBackdropFilter()).toBe(false);
  });
});

describe("supportsRefraction", () => {
  it("returns false without throwing when CSS.supports is absent (SSR-like)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).CSS;

    expect(() => supportsRefraction()).not.toThrow();
    expect(supportsRefraction()).toBe(false);
  });

  it("returns true when CSS.supports('backdrop-filter', 'url(#x)') is true", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn(
        (prop: string, value: string) =>
          prop === "backdrop-filter" && value === "url(#x)"
      ),
    };

    expect(supportsRefraction()).toBe(true);
  });

  it("returns true when only the -webkit- prefixed url() form is supported", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn(
        (prop: string, value: string) =>
          prop === "-webkit-backdrop-filter" && value === "url(#x)"
      ),
    };

    expect(supportsRefraction()).toBe(true);
  });

  it("returns false when backdrop-filter is supported but not the url() displacement form", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn(
        (prop: string, value: string) =>
          prop === "backdrop-filter" && value === "blur(1px)"
      ),
    };

    expect(supportsRefraction()).toBe(false);
  });

  it("returns false without throwing when CSS.supports throws", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).CSS = {
      supports: vi.fn(() => {
        throw new Error("boom");
      }),
    };

    expect(() => supportsRefraction()).not.toThrow();
    expect(supportsRefraction()).toBe(false);
  });
});

/**
 * `supportsWebGL` caches its probe result at module level (one probe per
 * page load — browsers cap live WebGL contexts), so every test gets a
 * fresh module instance via `vi.resetModules()` + dynamic import, or the
 * first test's cached result would leak into the rest.
 */
async function loadSupportsWebGL() {
  vi.resetModules();
  const mod = await import("../../src/utils/featureDetect");
  return mod.supportsWebGL;
}

describe("supportsWebGL", () => {
  it("returns false in jsdom (no real WebGL context)", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    expect(() => supportsWebGL()).not.toThrow();
    expect(supportsWebGL()).toBe(false);
  });

  it("returns false without throwing when document is undefined (SSR)", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    vi.stubGlobal("document", undefined);

    expect(() => supportsWebGL()).not.toThrow();
    expect(supportsWebGL()).toBe(false);
  });

  it("does not cache the SSR false — probes for real once document appears", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    const realDocument = document;
    vi.stubGlobal("document", undefined);
    expect(supportsWebGL()).toBe(false);
    vi.unstubAllGlobals();

    const fakeContext = {};
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (contextId: string) =>
        contextId === "webgl2" ? (fakeContext as unknown as RenderingContext) : null
    );
    expect(realDocument).toBeDefined();
    expect(supportsWebGL()).toBe(true);
  });

  it("does not touch document at module import time (lazy detection)", async () => {
    vi.resetModules();
    const createElementSpy = vi.spyOn(document, "createElement");

    await import("../../src/utils/featureDetect");

    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it("returns true when a webgl2 context is available", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    const fakeContext = {};
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (contextId: string) =>
        contextId === "webgl2" ? (fakeContext as unknown as RenderingContext) : null
    );

    expect(supportsWebGL()).toBe(true);
  });

  it("falls back to a webgl context when webgl2 is unavailable", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    const fakeContext = {};
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (contextId: string) =>
        contextId === "webgl" ? (fakeContext as unknown as RenderingContext) : null
    );

    expect(supportsWebGL()).toBe(true);
  });

  it("returns false without throwing when getContext throws", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => supportsWebGL()).not.toThrow();
    expect(supportsWebGL()).toBe(false);
  });

  it("returns false without throwing when document.createElement throws", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => supportsWebGL()).not.toThrow();
    expect(supportsWebGL()).toBe(false);
  });

  it("probes only once per page load — subsequent calls reuse the cached result", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    const fakeContext = {};
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(
        (contextId: string) =>
          contextId === "webgl2" ? (fakeContext as unknown as RenderingContext) : null
      );

    expect(supportsWebGL()).toBe(true);
    const callsAfterFirst = getContextSpy.mock.calls.length;
    expect(supportsWebGL()).toBe(true);
    expect(supportsWebGL()).toBe(true);
    expect(getContextSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("caches a negative probe too — no re-probing on later calls", async () => {
    const supportsWebGL = await loadSupportsWebGL();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => null);

    expect(supportsWebGL()).toBe(false);
    const callsAfterFirst = getContextSpy.mock.calls.length;
    expect(supportsWebGL()).toBe(false);
    expect(getContextSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});
