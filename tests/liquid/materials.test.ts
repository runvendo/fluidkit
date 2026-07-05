import { afterEach, describe, expect, it, vi } from "vitest";

async function loadWithBackdropSupport(
  supported: boolean,
  relativeColor = true
) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", () => ({
    supportsBackdropFilter: () => supported,
    supportsRelativeColor: () => relativeColor,
  }));
  return import("../../src/liquid/materials");
}

afterEach(() => {
  vi.doUnmock("../../src/utils/featureDetect");
  vi.resetModules();
});

describe("resolveMaterial", () => {
  it("glass: backdrop blur + saturation, tinted, with specular", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass");
    expect(m.kind).toBe("glass");
    expect(m.specular).toBe(true);
    expect(m.fillStyle.backdropFilter).toBe("blur(16px) saturate(1.8)");
    expect(m.fillStyle.background).toBe("rgba(255,255,255,0.3)");
  });

  it("glass: hints the compositor so idle surfaces keep their GPU layer", async () => {
    // Without will-change, Chromium evicts a still glass surface's
    // backdrop-filter layer after a couple of idle seconds; the next
    // enter then paints one unblurred frame while it re-rasterizes.
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass");
    expect(m.fillStyle.willChange).toBe("transform");
  });

  it("solid fills carry no compositor hint (nothing to keep warm)", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    expect(resolveMaterial("flat").fillStyle.willChange).toBeUndefined();
    // degraded glass is a flat fill too
    const { resolveMaterial: degraded } = await loadWithBackdropSupport(false);
    expect(degraded("glass").fillStyle.willChange).toBeUndefined();
  });

  it("glass: honors a custom tint", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass", { tint: "rgba(200,220,255,0.4)" });
    expect(m.fillStyle.background).toBe("rgba(200,220,255,0.4)");
  });

  it("glass: degrades to a frosted flat fill without backdrop-filter support", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(false);
    const m = resolveMaterial("glass");
    expect(m.kind).toBe("flat");
    expect(m.fillStyle.backdropFilter).toBeUndefined();
    expect(m.specular).toBe(true); // still lit — it is still "glass" to the user
  });

  it("glass: prepends the refraction filter to the backdrop chain when given", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass", { refractionUrl: "url(#rf)" });
    expect(m.fillStyle.backdropFilter).toBe("url(#rf) blur(8px) saturate(1.8)");
  });

  it("glass: blurPx overrides the blur radius, rest of the chain intact", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass", { blurPx: 10 });
    expect(m.fillStyle.backdropFilter).toBe("blur(10px) saturate(1.8)");
  });

  it("glass: blurPx also overrides the refracting chain's blur", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass", { refractionUrl: "url(#rf)", blurPx: 10 });
    expect(m.fillStyle.backdropFilter).toBe("url(#rf) blur(10px) saturate(1.8)");
  });

  it("glass: ignores the refraction url when backdrop-filter is unsupported", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(false);
    const m = resolveMaterial("glass", { refractionUrl: "url(#rf)" });
    expect(m.fillStyle.backdropFilter).toBeUndefined();
  });

  it("flat: plain color fill, no specular, defaults to currentColor", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    expect(resolveMaterial("flat").fillStyle.background).toBe("currentColor");
    expect(resolveMaterial("flat", { color: "#abc" }).fillStyle.background).toBe(
      "#abc"
    );
    expect(resolveMaterial("flat").specular).toBe(false);
  });

  it("caustics: plaster fill, no painted specular, carries the light color", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("caustics");
    expect(m.kind).toBe("caustics");
    expect(m.specular).toBe(false);
    expect(String(m.fillStyle.background)).toContain("linear-gradient");
    expect(m.caustics).toEqual({ light: "#fffdf7" });
  });

  it("caustics: tint recolors the light, color recolors the wall", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("caustics", { tint: "#dbeaff", color: "#10161a" });
    expect(m.fillStyle.background).toBe("#10161a");
    expect(m.caustics).toEqual({ light: "#dbeaff" });
  });

  it("opacity REPLACES the fill's alpha via relative color syntax", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const glass = resolveMaterial("glass", { opacity: 0.8 });
    expect(glass.fillStyle.background).toBe(
      "rgb(from rgba(255,255,255,0.3) r g b / 0.8)"
    );
    const tinted = resolveMaterial("glass", { tint: "#88bbee", opacity: 0.5 });
    expect(tinted.fillStyle.background).toBe("rgb(from #88bbee r g b / 0.5)");
    const flat = resolveMaterial("flat", { color: "tomato", opacity: 0.4 });
    expect(flat.fillStyle.background).toBe("rgb(from tomato r g b / 0.4)");
  });

  it("opacity is clamped to 0..1 and applies to the glass fallback fill", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(false);
    const m = resolveMaterial("glass", { opacity: 1.7 });
    expect(m.kind).toBe("flat");
    expect(m.fillStyle.background).toBe(
      "rgb(from rgba(255,255,255,0.65) r g b / 1)"
    );
  });

  it("opacity degrades to the default transparency where relative color is unsupported", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true, false);
    const m = resolveMaterial("glass", { tint: "#88bbee", opacity: 0.5 });
    expect(m.fillStyle.background).toBe("#88bbee");
  });

  it("unset opacity leaves every fill untouched", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    expect(resolveMaterial("glass").fillStyle.background).toBe(
      "rgba(255,255,255,0.3)"
    );
    expect(
      resolveMaterial("flat", { color: "tomato" }).fillStyle.background
    ).toBe("tomato");
  });
});
