import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  expectIntensityScalesSpeculars,
  expectNullLightPaintsNoSpeculars,
  expectShadowToggles,
} from "./surfacePack";

async function loadThinking(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Thinking");
  return mod.Thinking;
}

/** Same as `loadThinking`, plus a mocked `featureDetect` so refraction can be
 * exercised as "supported" (jsdom's real `CSS.supports` always says no). */
async function loadThinkingWithRefraction(reduced: boolean, supported: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  vi.doMock("../../src/utils/featureDetect", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../src/utils/featureDetect")>();
    return { ...actual, supportsRefraction: () => supported };
  });
  const mod = await import("../../src/components/Thinking");
  return mod.Thinking;
}

describe("Thinking", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.doUnmock("../../src/utils/featureDetect");
    vi.resetModules();
  });

  it("announces itself as a status indicator", async () => {
    const Thinking = await loadThinking(true);
    const { getByRole } = render(<Thinking />);
    const status = getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Thinking");
  });

  it("supports a custom label", async () => {
    const Thinking = await loadThinking(true);
    const { getByRole } = render(<Thinking label="Working" />);
    expect(getByRole("status").getAttribute("aria-label")).toBe("Working");
  });

  it("renders three static dots under reduced motion", async () => {
    const Thinking = await loadThinking(true);
    const { container } = render(<Thinking />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect((clip.style.clipPath.match(/Z/g) ?? []).length).toBe(3);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  // Pin: `specularPlacement`'s own default opacity (0.7) is what Thinking has
  // always rendered — it never passed a third argument. This must keep
  // holding once `intensity` exists (default "present" reproduces it).
  it("pins today's default specular opacity at 0.7 (specularPlacement's own default, never overridden)", async () => {
    const Thinking = await loadThinking(true);
    expectNullLightPaintsNoSpeculars((props) => render(<Thinking {...props} />));
    const { container } = render(<Thinking material="glass" />);
    const opacities = Array.from(container.querySelectorAll("ellipse"))
      .map((el) => Number(el.getAttribute("opacity") ?? 0))
      .filter((opacity) => opacity > 0);
    // One lit spot per drop (default variant "gather", 3 bodies).
    expect(opacities).toHaveLength(3);
    for (const opacity of opacities) {
      expect(opacity).toBeCloseTo(0.7, 12);
    }
  });

  it("scales specular brightness with `intensity`", async () => {
    const Thinking = await loadThinking(true);
    expectIntensityScalesSpeculars((props) => render(<Thinking {...props} />));
  });

  it("renders the shadow layer by default and drops it on `shadow={false}`", async () => {
    const Thinking = await loadThinking(true);
    expectShadowToggles((props) => render(<Thinking {...props} />));
  });

  it("mounts the refraction filter defs only when enabled on glass", async () => {
    const Thinking = await loadThinkingWithRefraction(true, true);
    const withDefault = render(<Thinking />);
    expect(withDefault.container.querySelector("filter")).toBeNull();
    const withRefraction = render(<Thinking refraction material="glass" />);
    expect(withRefraction.container.querySelector("filter")).not.toBeNull();
  });

  it("does not mount refraction defs on flat material even when refraction is enabled", async () => {
    const Thinking = await loadThinkingWithRefraction(true, true);
    const { container } = render(<Thinking refraction material="flat" />);
    expect(container.querySelector("filter")).toBeNull();
  });

  it("does not mount refraction defs when unsupported, even if enabled on glass", async () => {
    const Thinking = await loadThinkingWithRefraction(true, false);
    const { container } = render(<Thinking refraction material="glass" />);
    expect(container.querySelector("filter")).toBeNull();
  });
});
