/**
 * Graceful-degradation contract — Ripple.
 *
 * Already pinned in tests/components/Ripple.test.tsx (not duplicated):
 * reduced motion spawns NO ripple element on pointerdown, and the
 * missing-backdrop-filter glass fallback (the resolver's frosted flat
 * fill, no backdropFilter) is asserted directly.
 *
 * Asserted here: the remaining contract leg — under reduced motion the
 * children still render and stay fully interactive (the existing onClick
 * test runs with motion allowed).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { mockEnv, unmockEnv } from "./harness";

async function loadRipple(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/Ripple");
  return mod.Ripple;
}

describe("Ripple degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: children render and clicks still land", async () => {
    const Ripple = await loadRipple(true);
    const onClick = vi.fn();
    const { getByText } = render(<Ripple onClick={onClick}>Click me</Ripple>);
    expect(getByText("Click me")).toBeInTheDocument();
    fireEvent.pointerDown(getByText("Click me"), { clientX: 5, clientY: 5 });
    fireEvent.click(getByText("Click me"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
