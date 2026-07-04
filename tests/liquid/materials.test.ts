import { afterEach, describe, expect, it, vi } from "vitest";

async function loadWithBackdropSupport(supported: boolean) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", () => ({
    supportsBackdropFilter: () => supported,
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
    expect(String(m.fillStyle.backdropFilter)).toContain("blur");
    expect(String(m.fillStyle.backdropFilter)).toContain("saturate");
    expect(m.fillStyle.background).toBe("rgba(255,255,255,0.3)");
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

  it("glass: ignores the refraction url when backdrop-filter is unsupported", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(false);
    const m = resolveMaterial("glass", { refractionUrl: "url(#rf)" });
    expect(m.fillStyle.backdropFilter).toBeUndefined();
  });

  it("mercury: SOLID fill (no gradient), NO specular, light silver default", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("mercury");
    expect(m.specular).toBe(false);
    expect(String(m.fillStyle.background)).not.toContain("gradient");
    expect(m.fillStyle.background).toBe("#cdd3dd");
  });

  it("mercury: honors a custom color", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("mercury", { color: "#8d94a1" });
    expect(m.fillStyle.background).toBe("#8d94a1");
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
});
