import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { MotionValue } from "motion/react";

/**
 * `useSquish` reads `usePrefersReducedMotion()`, which reads Motion's
 * `useReducedMotion()` under the hood. To drive both branches
 * deterministically, we mock `motion/react` per test, always keeping the
 * real `motion` factory (via `importOriginal`) — only `useReducedMotion` is
 * overridden. Each test resets the module registry so `useSquish` (and its
 * dependency chain) is re-imported fresh against the mock; matches the
 * pattern already proven in tests/hooks/useRipple.test.tsx.
 *
 * The mock reads from a mutable `state` object so tests can flip the
 * preference mid-test (e.g. reduced motion turning on mid-press) and have
 * the hook re-read it on a plain rerender.
 */
async function mockReducedMotion(initial: boolean) {
  vi.resetModules();
  const state = { reduced: initial };
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => state.reduced };
  });
  const mod = await import("../../src/hooks/useSquish");
  return { useSquish: mod.useSquish, state };
}

/** Awaits a Motion value reaching (within tolerance) its spring target by
 * polling — no fixed-length sleeps, so each wait only takes as long as the
 * spring actually needs. */
async function settlesAt(mv: MotionValue<number>, target: number) {
  await vi.waitFor(
    () => {
      expect(mv.get()).toBeCloseTo(target, 1);
    },
    { timeout: 3000, interval: 10 }
  );
}

function fakePointerEvent() {
  return {} as unknown as React.PointerEvent;
}

function fakeKeyEvent(key: string, repeat = false) {
  return { key, repeat } as unknown as React.KeyboardEvent;
}

function fakeFocusEvent() {
  return {} as unknown as React.FocusEvent;
}

describe("useSquish", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("starts unscaled and not pressed", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    expect(result.current.pressed).toBe(false);
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);
  });

  it("press retargets scales so X grows, Y shrinks, and X*Y stays ~1 (volume-preserving)", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish({ intensity: 0.2 }));

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(true);

    await settlesAt(result.current.style.scaleX, 1.2);
    await settlesAt(result.current.style.scaleY, 1 / 1.2);
    expect(
      result.current.style.scaleX.get() * result.current.style.scaleY.get()
    ).toBeCloseTo(1, 1);
  });

  it("release (pointer up) springs both scales back to 1", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });
    act(() => {
      result.current.handlers.onPointerUp(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(false);

    await settlesAt(result.current.style.scaleX, 1);
    await settlesAt(result.current.style.scaleY, 1);
  });

  it("pointer cancel and pointer leave also release the press", async () => {
    const { useSquish } = await mockReducedMotion(false);
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
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish({ intensity: 0.2 }));

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent(" "));
    });
    expect(result.current.pressed).toBe(true);
    await settlesAt(result.current.style.scaleX, 1.2);

    act(() => {
      result.current.handlers.onKeyUp(fakeKeyEvent(" "));
    });
    expect(result.current.pressed).toBe(false);
    await settlesAt(result.current.style.scaleX, 1);
  });

  it("blur releases a keyboard press (focus loss mid-hold)", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish({ intensity: 0.2 }));

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent(" "));
    });
    expect(result.current.pressed).toBe(true);

    act(() => {
      result.current.handlers.onBlur(fakeFocusEvent());
    });
    expect(result.current.pressed).toBe(false);

    await settlesAt(result.current.style.scaleX, 1);
    await settlesAt(result.current.style.scaleY, 1);
  });

  it("onKeyDown ignores keys other than Space/Enter", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent("a"));
    });
    expect(result.current.pressed).toBe(false);
  });

  it("onKeyDown ignores repeated key-down events (event.repeat)", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onKeyDown(fakeKeyEvent("Enter", true));
    });
    expect(result.current.pressed).toBe(false);
  });

  it("Enter key also triggers press/release", async () => {
    const { useSquish } = await mockReducedMotion(false);
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
    const { useSquish } = await mockReducedMotion(false);
    const { result } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });

    await settlesAt(result.current.style.scaleX, 1.12);
    await settlesAt(result.current.style.scaleY, 1 / 1.12);
  });

  it("applies the latest `spring` option per press (not a stale first-render capture)", async () => {
    const { useSquish } = await mockReducedMotion(false);
    const { result, rerender } = renderHook(
      ({ stiffness }: { stiffness: number }) =>
        useSquish({ intensity: 0.2, spring: { stiffness, damping: 90 } }),
      { initialProps: { stiffness: 1 } }
    );

    // Swap in a much stiffer spring after mount; the press must use it.
    // A stale stiffness-1 spring would still be near 1 when the fresh
    // stiffness-900 spring has already settled at the target.
    rerender({ stiffness: 900 });

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });

    await settlesAt(result.current.style.scaleX, 1.2);
  });

  it("under prefers-reduced-motion, pressing is inert and scales stay 1", async () => {
    const { useSquish } = await mockReducedMotion(true);
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

    // Give any (wrongly started) animation a beat to move the values.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);
  });

  it("release still returns scales to 1 when reduced motion flips on mid-press", async () => {
    const { useSquish, state } = await mockReducedMotion(false);
    const { result, rerender } = renderHook(() => useSquish());

    act(() => {
      result.current.handlers.onPointerDown(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(true);

    state.reduced = true;
    rerender();

    act(() => {
      result.current.handlers.onPointerUp(fakePointerEvent());
    });
    expect(result.current.pressed).toBe(false);
    // Reduced-motion release snaps instantly — no settle wait needed.
    expect(result.current.style.scaleX.get()).toBe(1);
    expect(result.current.style.scaleY.get()).toBe(1);
  });
});
