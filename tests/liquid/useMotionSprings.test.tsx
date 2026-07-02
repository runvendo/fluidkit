import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMotionSprings } from "../../src/liquid/useMotionSprings";

describe("useMotionSprings", () => {
  it("creates one motion value per slot, seeded by the initializer", () => {
    const { result } = renderHook(() =>
      useMotionSprings(3, (i) => i * 10, { stiffness: 170, damping: 15 })
    );
    expect(result.current.values).toHaveLength(3);
    expect(result.current.values.map((v) => v.get())).toEqual([0, 10, 20]);
  });

  it("keeps value identity across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      useMotionSprings(2, () => 0, { stiffness: 170, damping: 15 })
    );
    const first = result.current.values;
    rerender();
    expect(result.current.values).toBe(first);
  });

  it("snapTo() sets values instantly (reduced-motion path)", () => {
    const { result } = renderHook(() =>
      useMotionSprings(2, () => 0, { stiffness: 170, damping: 15 })
    );
    result.current.snapTo([5, 7]);
    expect(result.current.values.map((v) => v.get())).toEqual([5, 7]);
  });

  it("accepts a per-slot config function and resolves it for every slot", async () => {
    const configs: number[] = [];
    const { result } = renderHook(() =>
      useMotionSprings(
        2,
        () => 0,
        (i) => {
          configs[i] = i;
          return { stiffness: 900, damping: 90 };
        }
      )
    );
    result.current.setTargets([50, 60]);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(result.current.values.map((v) => Math.round(v.get()))).toEqual([
      50, 60,
    ]);
    expect(configs).toEqual([0, 1]);
  });

  it("setTarget() retargets one slot without touching the others", async () => {
    const { result } = renderHook(() =>
      useMotionSprings(2, (i) => i * 10, { stiffness: 900, damping: 90 })
    );
    result.current.setTarget(0, 99, { stiffness: 900, damping: 90 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(Math.round(result.current.values[0].get())).toBe(99);
    expect(result.current.values[1].get()).toBe(10); // untouched
  });

  it("setTargets() eventually settles values at the targets", async () => {
    const { result } = renderHook(() =>
      useMotionSprings(1, () => 0, { stiffness: 800, damping: 80 })
    );
    result.current.setTargets([100]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(result.current.values[0].get()).toBeCloseTo(100, 0);
  });
});
