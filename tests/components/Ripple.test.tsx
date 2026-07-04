import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

/**
 * `Ripple` composes `useRipple()`, which reads `usePrefersReducedMotion()`,
 * which reads Motion's `useReducedMotion()` under the hood. Matching the
 * pattern proven in tests/components/tabs/LiquidTabs.test.tsx, we mock
 * `motion/react` per test, always keeping the real `motion`/`AnimatePresence`
 * factories (via `importOriginal`) — only `useReducedMotion` is overridden.
 *
 * Glass is gated on `supportsBackdropFilter()`, which jsdom can't answer, so
 * the featureDetect module is mocked too (same module-mock pattern as
 * tests/liquid/materials.test.ts). Each test resets the module registry so
 * `Ripple` and its dependency chain are re-imported fresh against the mocks.
 */
async function loadRipple({
  reduced = false,
  backdrop = true,
}: { reduced?: boolean; backdrop?: boolean } = {}) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  vi.doMock("../../src/utils/featureDetect", () => ({
    supportsBackdropFilter: () => backdrop,
    supportsRefraction: () => false,
    supportsViewTransition: () => false,
  }));
  const mod = await import("../../src/components/Ripple");
  return mod.Ripple;
}

/** Pointer-taps the wrapper and returns the spawned ripple element. */
function spawnRipple(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector(
    '[data-fluidkit="ripple-surface"]'
  ) as HTMLElement;
  fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });
  return container.querySelector('[data-fluidkit="ripple"]') as HTMLElement;
}

describe("Ripple", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.doUnmock("../../src/utils/featureDetect");
    vi.resetModules();
  });

  it("renders its children", async () => {
    const Ripple = await loadRipple();
    const { getByText } = render(<Ripple>Click me</Ripple>);

    expect(getByText("Click me")).toBeInTheDocument();
  });

  it("gives the wrapper position:relative and overflow:hidden so ripples clip", async () => {
    const Ripple = await loadRipple();
    const { container } = render(<Ripple>Click me</Ripple>);

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("renders a ripple element on pointer down when motion is allowed", async () => {
    const Ripple = await loadRipple();
    const { container } = render(<Ripple>Click me</Ripple>);

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });

    const ripples = container.querySelectorAll('[data-fluidkit="ripple"]');
    expect(ripples).toHaveLength(1);
  });

  it("renders a frosted lens (backdrop blur, no color wash) with material=glass", async () => {
    const Ripple = await loadRipple();
    const { container } = render(
      <Ripple material="glass" color="#ff0000">Click me</Ripple>
    );

    const ripple = spawnRipple(container);
    expect(ripple.style.backdropFilter).toContain("blur");
    // glass ignores the color wash — the lens is the material
    expect(ripple.style.background).not.toContain("255, 0, 0");
  });

  it("glass: the recipe comes from resolveMaterial — shared tint, Ripple's 5px blur", async () => {
    const Ripple = await loadRipple();
    const { container } = render(<Ripple material="glass">Click me</Ripple>);

    const ripple = spawnRipple(container);
    // The shared resolver's default tint (alpha 0.3), not a private recipe.
    expect(ripple.style.background).toBe("rgba(255, 255, 255, 0.3)");
    // Ripple keeps its deliberate light 5px frost (a momentary lens, not a
    // panel) but the rest of the chain is the resolver's — exactly.
    expect(ripple.style.backdropFilter).toBe("blur(5px) saturate(1.8)");
    // The thin rim stays Ripple's own, on top of the resolved fill.
    expect(ripple.style.boxShadow).toContain("inset");
  });

  it("glass: a custom tint reaches the ripple's background", async () => {
    const Ripple = await loadRipple();
    const { container } = render(
      <Ripple material="glass" tint="rgba(200, 220, 255, 0.4)">Click me</Ripple>
    );

    const ripple = spawnRipple(container);
    expect(ripple.style.background).toBe("rgba(200, 220, 255, 0.4)");
    expect(ripple.style.backdropFilter).toContain("blur");
  });

  it("intensity scales the ripple's peak opacity; the default stays pinned at 0.4", async () => {
    const Ripple = await loadRipple();

    // Default ("whisper" = 0.35) keeps today's 0.4 peak exactly.
    const byDefault = render(<Ripple>Click me</Ripple>);
    expect(spawnRipple(byDefault.container).style.opacity).toBe("0.4");

    // "present" (0.7) doubles the volume: 0.4 × (0.7 / 0.35) = 0.8.
    const present = render(<Ripple intensity="present">Click me</Ripple>);
    expect(spawnRipple(present.container).style.opacity).toBe("0.8");
  });

  it("flat: `color` still fills the wash, unchanged", async () => {
    const Ripple = await loadRipple();
    const { container } = render(<Ripple color="#ff0000">Click me</Ripple>);

    const ripple = spawnRipple(container);
    expect(ripple.style.background).toBe("rgb(255, 0, 0)");
    expect(ripple.style.backdropFilter).toBe("");
  });

  it("renders no ripple element on pointer down under prefers-reduced-motion", async () => {
    const Ripple = await loadRipple({ reduced: true });
    const { container } = render(<Ripple>Click me</Ripple>);

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });

    const ripples = container.querySelectorAll('[data-fluidkit="ripple"]');
    expect(ripples).toHaveLength(0);
  });

  it("keeps the ripple overlay pointer-events:none so children stay interactive", async () => {
    const Ripple = await loadRipple();
    const { container } = render(<Ripple>Click me</Ripple>);

    const overlay = container.querySelector(
      '[data-fluidkit="ripple-overlay"]'
    ) as HTMLElement;
    expect(overlay.style.pointerEvents).toBe("none");
  });

  it("merges consumer className/style onto the wrapper and still fires onClick", async () => {
    const Ripple = await loadRipple();
    const onClick = vi.fn();
    const { container, getByText } = render(
      <Ripple
        className="custom-class"
        style={{ borderRadius: 12 }}
        onClick={onClick}
      >
        Click me
      </Ripple>
    );

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
    expect(wrapper.style.borderRadius).toBe("12px");

    fireEvent.click(getByText("Click me"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
