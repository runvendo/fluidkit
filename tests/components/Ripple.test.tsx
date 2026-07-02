import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

/**
 * `Ripple` composes `useRipple()`, which reads `usePrefersReducedMotion()`,
 * which reads Motion's `useReducedMotion()` under the hood. Matching the
 * pattern proven in tests/components/LiquidTabs.test.tsx, we mock
 * `motion/react` per test, always keeping the real `motion`/`AnimatePresence`
 * factories (via `importOriginal`) — only `useReducedMotion` is overridden.
 * Each test resets the module registry so `Ripple` and its dependency chain
 * are re-imported fresh against the mock.
 */
async function mockReducedMotion(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Ripple");
  return mod.Ripple;
}

describe("Ripple", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders its children", async () => {
    const Ripple = await mockReducedMotion(false);
    const { getByText } = render(<Ripple>Click me</Ripple>);

    expect(getByText("Click me")).toBeInTheDocument();
  });

  it("gives the wrapper position:relative and overflow:hidden so ripples clip", async () => {
    const Ripple = await mockReducedMotion(false);
    const { container } = render(<Ripple>Click me</Ripple>);

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    expect(wrapper.style.position).toBe("relative");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  it("renders a ripple element on pointer down when motion is allowed", async () => {
    const Ripple = await mockReducedMotion(false);
    const { container } = render(<Ripple>Click me</Ripple>);

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });

    const ripples = container.querySelectorAll('[data-fluidkit="ripple"]');
    expect(ripples).toHaveLength(1);
  });

  it("renders a frosted lens (backdrop blur, no color wash) with material=glass", async () => {
    const Ripple = await mockReducedMotion(false);
    const { container } = render(
      <Ripple material="glass" color="#ff0000">Click me</Ripple>
    );

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });

    const ripple = container.querySelector(
      '[data-fluidkit="ripple"]'
    ) as HTMLElement;
    expect(ripple.style.backdropFilter).toContain("blur");
    // glass ignores the color wash — the lens is the material
    expect(ripple.style.background).not.toContain("255, 0, 0");
  });

  it("renders no ripple element on pointer down under prefers-reduced-motion", async () => {
    const Ripple = await mockReducedMotion(true);
    const { container } = render(<Ripple>Click me</Ripple>);

    const wrapper = container.querySelector(
      '[data-fluidkit="ripple-surface"]'
    ) as HTMLElement;
    fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });

    const ripples = container.querySelectorAll('[data-fluidkit="ripple"]');
    expect(ripples).toHaveLength(0);
  });

  it("keeps the ripple overlay pointer-events:none so children stay interactive", async () => {
    const Ripple = await mockReducedMotion(false);
    const { container } = render(<Ripple>Click me</Ripple>);

    const overlay = container.querySelector(
      '[data-fluidkit="ripple-overlay"]'
    ) as HTMLElement;
    expect(overlay.style.pointerEvents).toBe("none");
  });

  it("merges consumer className/style onto the wrapper and still fires onClick", async () => {
    const Ripple = await mockReducedMotion(false);
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
