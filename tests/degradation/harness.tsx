/**
 * Shared harness for the per-component graceful-degradation contract tests
 * (tests/degradation/*.contract.test.tsx).
 *
 * The contract, per exported component:
 *  1. Reduced motion — the component still renders its content and stays
 *     interactive; no looping animation and no rAF-driven geometry runs.
 *     Opacity-only fades are allowed (intentional existing behavior).
 *  2. Missing capability — where a component uses WebGL, backdrop-filter,
 *     or SVG-filter refraction, its DOCUMENTED fallback rendering appears
 *     (asserted directly, not just "didn't crash").
 *
 * Environment notes (why the missing-capability side usually needs no
 * mocking): jsdom has no `CSS.supports`, so `supportsBackdropFilter()` /
 * `supportsRefraction()` (src/utils/featureDetect.ts) answer false, and
 * jsdom creates no WebGL contexts, so `supportsWebGL()` answers false —
 * the bare test environment IS the capability-missing browser. Mocks are
 * only added for the capability-PRESENT side of a test.
 *
 * Mocking conventions mirror the existing component tests
 * (tests/components/Thinking.test.tsx, Ripple.test.tsx,
 * LiquidCard.test.tsx): mock only Motion's `useReducedMotion` on
 * `motion/react` (keeping the real module otherwise via `importOriginal`),
 * mock `featureDetect` only when real glass/refraction must be exercised,
 * and stub ResizeObserver + offsetWidth/offsetHeight for components that
 * measure their own box (jsdom has neither ResizeObserver nor layout).
 */

import { expect, vi } from "vitest";

export interface EnvOptions {
  /** What Motion's `useReducedMotion()` reports. Defaults to `true`. */
  reduced?: boolean;
  /**
   * When set, `featureDetect` is mocked with this `supportsBackdropFilter`
   * answer (capability-present side); when omitted the real detector runs
   * (false in jsdom — the capability-missing side).
   */
  backdrop?: boolean;
  /** Same as `backdrop`, for `supportsRefraction`. */
  refraction?: boolean;
}

/**
 * Resets the module registry and installs the standard mocks. Call at the
 * top of each test, then dynamically import the component under test so it
 * (and its whole dependency chain) binds against the mocks.
 */
export function mockEnv({ reduced = true, backdrop, refraction }: EnvOptions = {}): void {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  if (backdrop !== undefined || refraction !== undefined) {
    vi.doMock("../../src/utils/featureDetect", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../src/utils/featureDetect")>();
      return {
        ...actual,
        supportsBackdropFilter: () => backdrop ?? false,
        supportsRefraction: () => refraction ?? false,
      };
    });
  }
}

/** Undo `mockEnv` — call from `afterEach`. */
export function unmockEnv(): void {
  vi.doUnmock("motion/react");
  vi.doUnmock("../../src/utils/featureDetect");
  vi.resetModules();
}

/**
 * For components that measure their own box (LiquidCard, LiquidPanel,
 * LiquidDialog, LiquidTooltip, MeniscusDivider): stub ResizeObserver and
 * pin offsetWidth/offsetHeight. Pair with `vi.restoreAllMocks()` +
 * `vi.unstubAllGlobals()` in `afterEach`.
 */
export function stubMeasurement(width = 300, height = 120): void {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(height);
}

/**
 * The engine's documented no-backdrop-filter glass rendering: glass
 * degrades to a frosted flat fill (src/liquid/materials.ts,
 * GLASS_FALLBACK_FILL) with no backdrop chain. jsdom serializes it with
 * spaces.
 */
export const GLASS_FALLBACK_FILL = "rgba(255, 255, 255, 0.65)";

/** The engine's liquid fill layer inside `root`. */
export function fillOf(root: ParentNode): HTMLElement {
  const fill = root.querySelector('[data-fluidkit="liquid-fill"]');
  expect(fill, "expected a [data-fluidkit=liquid-fill] layer").not.toBeNull();
  return fill as HTMLElement;
}

/**
 * Asserts the documented missing-backdrop-filter rendering on an engine
 * surface: the frosted flat fallback fill, and no backdrop-filter chain.
 */
export function expectGlassFallbackFill(root: ParentNode): void {
  const fill = fillOf(root);
  expect(fill.style.background).toBe(GLASS_FALLBACK_FILL);
  expect(fill.style.backdropFilter).toBe("");
}

/** The engine's clip-path (the liquid geometry) inside `root`. */
export function clipPathOf(root: ParentNode): string {
  const clip = root.querySelector('[data-fluidkit="liquid-clip"]');
  expect(clip, "expected a [data-fluidkit=liquid-clip] layer").not.toBeNull();
  return (clip as HTMLElement).style.clipPath;
}

/** Real-timer wait, long enough for several would-be animation frames. */
export function frames(ms = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asserts no rAF-driven geometry under reduced motion: the engine clip
 * path is byte-identical after `ms` of real time. (Motion's shared
 * frameloop may still tick for components that register
 * `useAnimationFrame` — the promise is that no frame WRITES geometry, and
 * a static clip path is exactly that promise.)
 */
export async function expectStaticGeometry(
  root: ParentNode,
  ms = 150
): Promise<void> {
  const before = clipPathOf(root);
  expect(before).toContain("path(");
  await frames(ms);
  expect(clipPathOf(root)).toBe(before);
}
