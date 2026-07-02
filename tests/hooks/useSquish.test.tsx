import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * `useSquish` reads `usePrefersReducedMotion()`, which reads Motion's
 * `useReducedMotion()` under the hood. To drive both branches
 * deterministically, we mock `motion/react` per test, always keeping the
 * real `motion` factory (via `importOriginal`) — only `useReducedMotion` is
 * overridden. Each test resets the module registry so `useSquish` (and its
 * dependency chain) is re-imported fresh against the mock; matches the
 * pattern already proven in tests/hooks/useRipple.test.tsx.
 */
async function mockReducedMotion(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/hooks/useSquish");
  return mod.useSquish;
}

/** Waits long enough for the default spring to settle near its target. */
function waitForSpring() {
  return new Promise((resolve) => setTimeout(resolve, 1200));
}

function fakePointerEvent() {
  return {} as unknown as React.PointerEvent;
}

function fakeKeyEvent(key: string, repeat = false) {
  return { key, repeat } as unknown as React.KeyboardEvent;
}

describe("useSquish", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("starts unscaled and not pressed", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    expect(result.current.pressed).toBe(false);
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);
  });

  it("press retargets scales so X grows, Y shrinks, and X*Y stays ~1 (volume-preserving)", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish({ intensity: 0.2 }));

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(true);

    await act(async () => {
      await waitForSpring();
    });

    const scaleX = result.current.style.scaleX.get();
    const scaleY = result.current.style.scaleY.get();
    expect(scaleX).toBeCloseTo(1.2, 1);
    expect(scaleY).toBeCloseTo(1 / 1.2, 1);
    expect(scaleX * scaleY).toBeCloseTo(1, 1);
  });

  it("release (pointer up) springs both scales back to 1", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });
    act(() => {
      result.current.handlers.onPointerUp(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(false);

    await act(async () => {
      await waitForSpring();
    });

    expect(result.current.style.scaleX.get()).toBeCloseTo(1, 1);
    expect(result.current.style.scaleY.get()).toBeCloseTo(1, 1);
  });

  it("pointer cancel and pointer leave also release the press", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result: cancelResult } = renderHook(() => useSquish());
    act(() => {
      cancelResult.current.handlers.onPointerDown(fakePointerEvent());
    });
    act(() => {
      cancelResult.current.handlers.onPointerCancel(fakePointerEvent());
    });
    expect(cancelResult.current.pressed).toBe(false);

    const { result: leaveResult } = renderHook(() => useSquish());
    act(() => {
      leaveResult.current.handlers.onPointerDown(fakePointerEvent());
    });
    act(() => {
      leaveResult.current.handlers.onPointerLeave(fakePointerEvent());
    });
    expect(leaveResult.current.pressed).toBe(false);
  });

  it("keyboard press (Space/Enter) mirrors pointer press, and keyup releases", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish({ intensity: 0.2 }));

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent(" "));
    });
    expect(result.current.pressed).toBe(true);

    await act(async () => {
      await waitForSpring();
    });
    expect(result.current.style.scaleX.get()).toBeCloseTo(1.2, 1);

    act(() => {
      result.current.handlers.onKeyUp(fakeKeyEvent(" "));
    });
    expect(result.current.pressed).toBe(false);

    await act(async () => {
      await waitForSpring();
    });
    expect(result.current.style.scaleX.get()).toBeCloseTo(1, 1);
  });

  it("onKeyDown ignores keys other than Space/Enter", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent("a"));
    });
    expect(result.current.pressed).toBe(false);
  });

  it("onKeyDown ignores repeated key-down events (event.repeat)", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent("Enter", true));
    });
    expect(result.current.pressed).toBe(false);
  });

  it("Enter key also triggers press/release", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent("Enter"));
    });
    expect(result.current.pressed).toBe(true);

    act(() => {
      result.current.handlers.onKeyUp(fakeKeyEvent("Enter"));
    });
    expect(result.current.pressed).toBe(false);
  });

  it("defaults intensity to 0.12", async () => {
    const useSquish = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });

    await act(async () => {
      await waitForSpring();
    });

    expect(result.current.style.scaleX.get()).toBeCloseTo(1.12, 1);
    expect(result.current.style.scaleY.get()).toBeCloseTo(1 / 1.12, 1);
  });

  it("under prefers-reduced-motion, handlers are inert no-ops and scales stay 1", async () => {
    const useSquish = await mockReducedMotion(true);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(false);
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent(" "));
    });
    expect(result.current.pressed).toBe(false);
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);

    await act(async () => {
      await waitForSpring();
    });
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);
  });
});
