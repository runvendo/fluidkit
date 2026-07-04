import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiquidCard } from "../../src/components/LiquidCard";

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

describe('material="caustics" on a surface', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("LiquidCard renders its content on the caustics material without crashing", () => {
    render(
      <LiquidCard material="caustics">
        <p>hello</p>
      </LiquidCard>
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
