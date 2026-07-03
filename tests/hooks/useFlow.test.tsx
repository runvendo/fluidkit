import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Transition } from "motion/react";

/**
 * `useFlow` reads `usePrefersReducedMotion()`, which reads Motion's
 * `useReducedMotion()` under the hood. To drive both branches
 * deterministically, we mock `motion/react` per test, always keeping the
 * real `motion` factory (via `importOriginal`) — only `useReducedMotion` is
 * overridden. Each test resets the module registry so `useFlow` (and its
 * dependency chain) is re-imported fresh against the mock; matches the
 * pattern already proven in tests/hooks/useMorph.test.tsx.
 */
async function mockReducedMotion(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/hooks/useFlow");
  return mod.useFlow;
}

/** Per-value transitions aren't indexable through Motion's `Transition`
 * type, so tests reach into them through a loose record. */
const perValue = (t: Transition | undefined) =>
  (t ?? {}) as Record<string, { delay?: number } | undefined>;

describe("useFlow", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("sets initial/animate to the hidden/visible variant names", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    expect(result.current.containerProps.initial).toBe("hidden");
    expect(result.current.containerProps.animate).toBe("visible");
  });

  it("cascades entrance delays viscously: rank 0 starts immediately, gaps grow", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    const delayOf = (rank: number) =>
      perValue(
        result.current.getItemProps({ entranceRank: rank }).variants.visible
          .transition
      ).y?.delay ?? 0;

    expect(delayOf(0)).toBe(0);
    expect(delayOf(1)).toBeCloseTo(0.02, 5);
    // Viscosity: the second gap is slightly longer than the first.
    const gap1 = delayOf(1) - delayOf(0);
    const gap2 = delayOf(2) - delayOf(1);
    expect(gap2).toBeGreaterThan(gap1);
  });

  it("honors a custom base stagger in the entrance cascade", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({ stagger: 0.15 }));

    const delay = perValue(
      result.current.getItemProps({ entranceRank: 1 }).variants.visible
        .transition
    ).y?.delay;
    expect(delay).toBeCloseTo(0.15, 5);
  });

  it("enables layout tweening on item props so siblings glide (FLIP) on reorder", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    expect(result.current.getItemProps().layout).toBe(true);
  });

  it("ripples glides outward: layout delay grows with distance and is capped", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    const layoutDelay = (glideDistance: number) =>
      perValue(result.current.getItemProps({ glideDistance }).transition)
        .layout?.delay ?? 0;

    expect(layoutDelay(0)).toBe(0);
    expect(layoutDelay(2)).toBeGreaterThan(layoutDelay(1));
    // Far siblings are capped so the tail of a long list doesn't lag.
    expect(layoutDelay(50)).toBe(layoutDelay(100));
  });

  it("rises + un-blurs: hidden includes y + blur, visible clears both", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    const { hidden, visible } = result.current.getItemProps().variants;

    expect(hidden.opacity).toBe(0);
    expect(hidden.y).toBe(12);
    expect(hidden.filter).toBe("blur(1.5px)");

    expect(visible.opacity).toBe(1);
    expect(visible.y).toBe(0);
    expect(visible.filter).toBe("blur(0px)");
  });

  it("submerges on exit: sink + blur-out + slight shrink, labeled for AnimatePresence", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    const itemProps = result.current.getItemProps();
    expect(itemProps.exit).toBe("exit");

    const { exit } = itemProps.variants;
    expect(exit.opacity).toBe(0);
    expect(exit.y).toBeGreaterThan(0);
    expect(exit.filter).toBe("blur(1.5px)");
    expect(exit.scale).toBeLessThan(1);
  });

  it("exposes prefersReducedMotion: false when motion is allowed", async () => {
    const useFlow = await mockReducedMotion(false);
    const { result } = renderHook(() => useFlow({}));

    expect(result.current.prefersReducedMotion).toBe(false);
  });

  it("collapses item variants to opacity-only under prefers-reduced-motion", async () => {
    const useFlow = await mockReducedMotion(true);
    const { result } = renderHook(() => useFlow({}));

    const { hidden, visible, exit } = result.current.getItemProps({
      entranceRank: 3,
      glideDistance: 3,
    }).variants;

    expect(hidden).toEqual({ opacity: 0 });
    expect(visible.opacity).toBe(1);
    expect(visible.y).toBeUndefined();
    expect(visible.filter).toBeUndefined();
    // Exit loses the sink/blur/shrink too — a plain fade.
    expect(exit.opacity).toBe(0);
    expect(exit.y).toBeUndefined();
    expect(exit.scale).toBeUndefined();
  });

  it("exposes prefersReducedMotion: true and disables layout tweening under prefers-reduced-motion", async () => {
    const useFlow = await mockReducedMotion(true);
    const { result } = renderHook(() => useFlow({}));

    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.getItemProps().layout).toBe(false);
  });
});
