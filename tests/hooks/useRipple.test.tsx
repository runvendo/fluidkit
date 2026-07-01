import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * `useRipple` reads `usePrefersReducedMotion()`, which reads Motion's
 * `useReducedMotion()` under the hood. To drive both branches
 * deterministically, we mock `motion/react` per test, always keeping the
 * real `motion` factory (via `importOriginal`) — only `useReducedMotion` is
 * overridden. Each test resets the module registry so `useRipple` (and its
 * dependency chain) is re-imported fresh against the mock; matches the
 * pattern already proven in tests/hooks/useFlow.test.tsx.
 */
async function mockReducedMotion(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/hooks/useRipple");
  return mod.useRipple;
}

/** Minimal fake of the bits of React.PointerEvent that onPointerDown reads:
 * `currentTarget.getBoundingClientRect()` and `clientX`/`clientY`. jsdom's
 * real getBoundingClientRect is all zeros, so tests that only need "some
 * event" reuse this shape rather than mounting real DOM. */
function fakePointerEvent(
  clientX: number,
  clientY: number,
  rect: Partial<DOMRect> = {}
) {
  return {
    clientX,
    clientY,
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        ...rect,
      }),
    },
  } as unknown as React.PointerEvent;
}

describe("useRipple", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("adds one ripple to `ripples` on pointer down", async () => {
    const useRipple = await mockReducedMotion(false);
    const { result } = renderHook(() => useRipple({}));

    expect(result.current.ripples).toHaveLength(0);

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent(10, 20));
    });

    expect(result.current.ripples).toHaveLength(1);
    expect(typeof result.current.ripples[0].id).toBe("number");
    expect(typeof result.current.ripples[0].size).toBe("number");
  });

  it("adds a second ripple with a distinct id on a second pointer down", async () => {
    const useRipple = await mockReducedMotion(false);
    const { result } = renderHook(() => useRipple({}));

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent(10, 20));
    });
    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent(30, 40));
    });

    expect(result.current.ripples).toHaveLength(2);
    expect(result.current.ripples[0].id).not.toBe(result.current.ripples[1].id);
  });

  it("removes a ripple by id via remove()", async () => {
    const useRipple = await mockReducedMotion(false);
    const { result } = renderHook(() => useRipple({}));

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent(10, 20));
    });
    const id = result.current.ripples[0].id;

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.ripples).toHaveLength(0);
  });

  it("does not spawn a ripple on pointer down under prefers-reduced-motion", async () => {
    const useRipple = await mockReducedMotion(true);
    const { result } = renderHook(() => useRipple({}));

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent(10, 20));
    });

    expect(result.current.ripples).toHaveLength(0);
  });

  it("resolves color to currentColor by default and honors a custom color", async () => {
    const useRipple = await mockReducedMotion(false);
    const { result: defaultResult } = renderHook(() => useRipple({}));
    expect(defaultResult.current.color).toBe("currentColor");

    const { result: customResult } = renderHook(() =>
      useRipple({ color: "#f00" })
    );
    expect(customResult.current.color).toBe("#f00");
  });

  it("defaults duration to ~600ms and honors a custom duration", async () => {
    const useRipple = await mockReducedMotion(false);
    const { result: defaultResult } = renderHook(() => useRipple({}));
    expect(defaultResult.current.duration).toBe(600);

    const { result: customResult } = renderHook(() =>
      useRipple({ duration: 1000 })
    );
    expect(customResult.current.duration).toBe(1000);
  });
});
