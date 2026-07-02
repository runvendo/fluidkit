import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `supportsWebGL` caches its probe result at module level (one probe per
 * page load — browsers cap live WebGL contexts), so every test gets a
 * fresh module instance via `vi.resetModules()` + dynamic import, or the
 * first test's cached result would leak into the rest.
 */
async function loadSupportsWebGL() {
  vi.resetModules();
  const mod = await import("../../src/utils/supportsWebGL");
  return mod.supportsWebGL;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

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

    await import("../../src/utils/supportsWebGL");

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
