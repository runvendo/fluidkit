/**
 * Graceful-degradation contract — FlowStagger.
 *
 * Already pinned elsewhere (not duplicated): the container reflects the
 * reduced-motion decision via data-motion="fade"
 * (tests/components/FlowStagger.test.tsx), and `useFlow` collapses item
 * variants to opacity-only — no `y`, no `filter`, no `scale`, zero delays,
 * layout tweening off (tests/hooks/useFlow.test.tsx). That opacity-only
 * fade is the allowed reduced-motion behavior; Motion may drive it through
 * its frameloop, so no rAF assertions apply here.
 *
 * Missing capability: FlowStagger uses no WebGL, backdrop-filter, or
 * refraction — there is nothing to degrade, so no capability test.
 *
 * Asserted here: under reduced motion every child still renders, stays
 * interactive, and its wrapper carries no blur/translate styling.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { mockEnv, unmockEnv } from "./harness";

async function loadFlowStagger(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/FlowStagger");
  return mod.FlowStagger;
}

describe("FlowStagger degradation contract", () => {
  afterEach(unmockEnv);

  it("reduced motion: all children render, interactive, with no blur or rise styling", async () => {
    const FlowStagger = await loadFlowStagger(true);
    const onClick = vi.fn();
    const { container, getByText } = render(
      <FlowStagger>
        <span key="a">alpha</span>
        <button key="b" onClick={onClick}>
          beta
        </button>
        <span key="c">gamma</span>
      </FlowStagger>
    );

    const items = container.querySelectorAll('[data-fluidkit="flow-item"]');
    expect(items).toHaveLength(3);
    for (const item of Array.from(items) as HTMLElement[]) {
      // Opacity is the only permitted channel: no blur filter, no rise
      // translate on the reduced-motion variants.
      expect(item.style.filter).not.toContain("blur");
      expect(item.style.transform).not.toContain("translate");
    }

    fireEvent.click(getByText("beta"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
