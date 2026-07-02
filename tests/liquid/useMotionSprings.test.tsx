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

  it("setTargets() eventually settles values at the targets", async () => {
    const { result } = renderHook(() =>
      useMotionSprings(1, () => 0, { stiffness: 800, damping: 80 })
    );
    result.current.setTargets([100]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(result.current.values[0].get()).toBeCloseTo(100, 0);
  });
});
