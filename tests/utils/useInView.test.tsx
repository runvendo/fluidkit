import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useInView } from "../../src/utils/useInView";

/**
 * Minimal IntersectionObserver mock. Records the callback passed to its
 * constructor and every instance created, so tests can fire entries by hand
 * (jsdom has no real IntersectionObserver) and assert on `disconnect`.
 */
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

/** Test-only component exposing the hook's state as text so assertions can read the DOM. */
function Probe(props: { options?: IntersectionObserverInit }) {
  const { ref, inView } = useInView(props.options);
  return (
    <div ref={ref} data-testid="target">
      {String(inView)}
    </div>
  );
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useInView (with IntersectionObserver available)", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("reports inView as false before any intersecting entry fires", () => {
    const { getByTestId } = render(<Probe />);

    expect(getByTestId("target").textContent).toBe("false");
  });

  it("flips inView to true when the observer fires an intersecting entry", () => {
    const { getByTestId } = render(<Probe />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });

    expect(getByTestId("target").textContent).toBe("true");
  });

  it("flips inView back to false when the observer fires a non-intersecting entry", () => {
    const { getByTestId } = render(<Probe />);
    const observer = MockIntersectionObserver.instances[0];

    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer
      );
    });
    expect(getByTestId("target").textContent).toBe("true");

    act(() => {
      observer.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        observer
      );
    });

    expect(getByTestId("target").textContent).toBe("false");
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<Probe />);
    const observer = MockIntersectionObserver.instances[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("useInView (without IntersectionObserver, e.g. SSR/old browsers)", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", undefined);
  });

  it("defaults inView to true and does not throw, so animations aren't frozen off", () => {
    expect(() => render(<Probe />)).not.toThrow();
  });

  it("keeps inView true (never observes anything)", () => {
    const { getByTestId } = render(<Probe />);

    expect(getByTestId("target").textContent).toBe("true");
  });
});
