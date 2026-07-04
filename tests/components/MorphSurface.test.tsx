import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Profiler } from "react";
import {
  expectIntensityScalesSpeculars,
  expectShadowToggles,
} from "./surfacePack";

async function loadMorphSurface(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/MorphSurface");
  return mod.MorphSurface;
}

describe("MorphSurface", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("shows closed content and hides open content when closed", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const closed = getByText("pill").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(closed.style.opacity).toBe("1");
    expect(opened.style.opacity).toBe("0");
    expect(opened.getAttribute("aria-hidden")).toBe("true");
  });

  it("cross-fades faces when open flips — content only fades, never scales", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText, rerender } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    rerender(
      <MorphSurface
        open
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(opened.style.opacity).toBe("1");
    // the face never scales — transform is reserved for centering only
    expect(opened.style.transform).not.toContain("scale");
  });

  it("renders the liquid clip stack and reports its state", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(
      container.querySelector('[data-fluidkit="liquid-clip"]')
    ).not.toBeNull();
  });

  it("under reduced motion the surface renders the target size immediately", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container, rerender } = render(<MorphSurface open={false} />);
    rerender(<MorphSurface open />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("open");
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  it("commits no React updates per animation frame while settling", async () => {
    const MorphSurface = await loadMorphSurface(false);
    const onRender = vi.fn();
    const { rerender } = render(
      <Profiler id="morph" onRender={onRender}>
        <MorphSurface open={false} />
      </Profiler>
    );
    rerender(
      <Profiler id="morph" onRender={onRender}>
        <MorphSurface open />
      </Profiler>
    );
    // Let the settle window state flip land (one commit), then several rAF
    // ticks: the morph keeps springing, but frames are imperative DOM
    // writes, never React commits.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const commitsAfterFlip = onRender.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(onRender.mock.calls.length).toBe(commitsAfterFlip);
  });

  it("sizes its container to fit the open state plus satellite margin", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(
      <MorphSurface open={false} openSize={{ width: 200, height: 160 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(parseInt(root.style.width, 10)).toBeGreaterThanOrEqual(200);
    expect(parseInt(root.style.height, 10)).toBeGreaterThanOrEqual(160);
  });

  // Pin: today's two hand-rolled specular sites, BEFORE `intensity` exists.
  // Satellites use `specularPlacement`'s own bare default (0.7, like
  // Droplets/Thinking); the body passes a hardcoded 0.28 (like JellyButton's
  // pre-pack glint). Both must keep rendering these exact numbers once
  // `intensity` lands (default "present" reproduces each pixel-identically).
  it("pins today's default specular opacities: satellites at 0.7 (bare default), body at 0.28 (hardcoded)", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} />);
    const opacities = Array.from(container.querySelectorAll("ellipse"))
      .map((el) => Number(el.getAttribute("opacity") ?? 0))
      .filter((opacity) => opacity > 0);
    // 2 parked satellites + 1 body sheen.
    expect(opacities).toHaveLength(3);
    expect(opacities[0]).toBeCloseTo(0.7, 12);
    expect(opacities[1]).toBeCloseTo(0.7, 12);
    expect(opacities[2]).toBeCloseTo(0.28, 12);
  });

  it("renders the shadow layer by default and drops it on `shadow={false}`", async () => {
    const MorphSurface = await loadMorphSurface(true);
    expectShadowToggles((props) => render(<MorphSurface open={false} {...props} />));
  });

  it("scales specular brightness with `intensity`", async () => {
    const MorphSurface = await loadMorphSurface(true);
    expectIntensityScalesSpeculars((props) =>
      render(<MorphSurface open={false} {...props} />)
    );
  });

  // Per-site mapping: the body's hardcoded 0.28 maps `0.4 × intensity` (like
  // JellyButton); satellites' bare `specularPlacement` default maps identity
  // (like Droplets/Thinking) — both because that's what reproduces each
  // site's pre-pack constant at the shared default "present" (0.7).
  it("intensity scales the body specular by 0.4x and satellites 1:1", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} intensity={0.5} />);
    const opacities = Array.from(container.querySelectorAll("ellipse"))
      .map((el) => Number(el.getAttribute("opacity") ?? 0))
      .filter((opacity) => opacity > 0);
    expect(opacities).toHaveLength(3);
    expect(opacities[0]).toBeCloseTo(0.5, 12);
    expect(opacities[1]).toBeCloseTo(0.5, 12);
    expect(opacities[2]).toBeCloseTo(0.2, 12);
  });
});
