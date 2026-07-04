import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Caustics } from "../../src/components/Caustics";

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

function root(container: HTMLElement) {
  return container.querySelector('[data-fluidkit="caustics"]') as HTMLElement;
}

describe("Caustics", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is an inert background layer (backgrounds contract)", () => {
    const { container } = render(<Caustics />);
    const el = root(container);
    expect(el).toBeInTheDocument();
    expect(el.style.position).toBe("absolute");
    expect(el.style.pointerEvents).toBe("none");
    expect(el.style.overflow).toBe("hidden");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the plaster base by default and the light layer inside", () => {
    const { container } = render(<Caustics />);
    const base = container.querySelector(
      '[data-fluidkit="caustics-base"]'
    ) as HTMLElement;
    expect(base.style.background).toContain("linear-gradient");
    expect(
      container.querySelector('[data-fluidkit="caustics-layer"]')
    ).toBeInTheDocument();
  });

  it("background accepts a single color or a [top, bottom] pair", () => {
    const single = render(<Caustics background="#10161a" />);
    expect(
      (
        single.container.querySelector(
          '[data-fluidkit="caustics-base"]'
        ) as HTMLElement
      ).style.background
    ).toBe("rgb(16, 22, 26)");
    const pair = render(<Caustics background={["#ffffff", "#000000"]} />);
    const bg = (
      pair.container.querySelector(
        '[data-fluidkit="caustics-base"]'
      ) as HTMLElement
    ).style.background;
    expect(bg).toContain("linear-gradient");
    expect(bg).toContain("rgb(255, 255, 255)");
  });

  it("passes className, style, and rest props to the root", () => {
    const { container } = render(
      <Caustics className="hero" style={{ zIndex: 1 }} data-testid="x" />
    );
    const el = root(container);
    expect(el.className).toBe("hero");
    expect(el.style.zIndex).toBe("1");
    expect(el).toHaveAttribute("data-testid", "x");
  });
});
