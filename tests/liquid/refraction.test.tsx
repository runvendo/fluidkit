import { afterEach, describe, expect, it, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";

/**
 * Same per-test mocking pattern as materials.test.ts: refraction gates on
 * `supportsRefraction()` (Chromium-only: SVG displacement filters inside
 * backdrop-filter), so we re-import the module against a mocked detector.
 */
async function loadWithRefractionSupport(supported: boolean) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", () => ({
    supportsBackdropFilter: () => true,
    supportsRefraction: () => supported,
  }));
  return import("../../src/liquid/refraction");
}

afterEach(() => {
  vi.doUnmock("../../src/utils/featureDetect");
  vi.resetModules();
});

describe("displacementMapUri", () => {
  it("is an SVG data URI with the explicit dimensions baked in", async () => {
    const { displacementMapUri } = await loadWithRefractionSupport(true);
    const uri = displacementMapUri(200, 100);
    expect(uri).toMatch(/^data:image\/svg\+xml,/);
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="100"');
    // Red drives X displacement, green drives Y; the center must stay
    // neutral so only the rim lenses.
    expect(svg).toContain("radialGradient");
  });
});

describe("Droplets refraction opt-in", () => {
  async function loadDropletsWithSupport() {
    vi.resetModules();
    vi.doMock("../../src/utils/featureDetect", () => ({
      supportsBackdropFilter: () => true,
      supportsRefraction: () => true,
      supportsViewTransition: () => false,
    }));
    const mod = await import("../../src/components/Droplets");
    return mod.Droplets;
  }

  it("renders the displacement filter defs when refraction is on", async () => {
    const Droplets = await loadDropletsWithSupport();
    const { container } = render(<Droplets refraction />);
    expect(container.querySelector("feDisplacementMap")).not.toBeNull();
  });

  it("is OFF by default — no filter defs in the tree", async () => {
    const Droplets = await loadDropletsWithSupport();
    const { container } = render(<Droplets />);
    expect(container.querySelector("feDisplacementMap")).toBeNull();
  });
});

describe("useRefraction", () => {
  it("returns no url and no defs when unsupported", async () => {
    const { useRefraction } = await loadWithRefractionSupport(false);
    const { result } = renderHook(() => useRefraction(true, 100, 100));
    expect(result.current.url).toBeNull();
    expect(result.current.defs).toBeNull();
  });

  it("returns no url when disabled, even with support", async () => {
    const { useRefraction } = await loadWithRefractionSupport(true);
    const { result } = renderHook(() => useRefraction(false, 100, 100));
    expect(result.current.url).toBeNull();
    expect(result.current.defs).toBeNull();
  });

  it("returns url(#id) plus a hidden defs svg with a displacement filter when supported", async () => {
    const { useRefraction } = await loadWithRefractionSupport(true);
    const { result } = renderHook(() => useRefraction(true, 120, 80));
    expect(result.current.url).toMatch(/^url\(#/);
    const { container } = render(<>{result.current.defs}</>);
    const svg = container.querySelector("svg") as SVGElement;
    // Inline svg needs explicit dimensions (0x0 for a defs-only carrier).
    expect(svg.getAttribute("width")).toBe("0");
    expect(svg.getAttribute("height")).toBe("0");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("filter")).not.toBeNull();
    expect(container.querySelector("feDisplacementMap")).not.toBeNull();
    const id = result.current.url!.slice(5, -1);
    expect(container.querySelector("filter")!.getAttribute("id")).toBe(id);
  });
});
