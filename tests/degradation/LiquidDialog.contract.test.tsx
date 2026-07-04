/**
 * Graceful-degradation contract — LiquidDialog.
 *
 * Already pinned in tests/components/LiquidDialog.test.tsx (not
 * duplicated): refraction gating, the backdrop compositor hint, and `tint`
 * reaching the real glass fill.
 *
 * Asserted here: the documented reduced-motion behavior — "no pop, no
 * travel — surface and content simply cross-fade" — plus the interactive
 * legs (content rendered, Escape closes), and the documented
 * no-backdrop-filter glass fallback.
 *
 * rAF note: the dialog schedules two rAFs even under reduced motion — the
 * `entered` gate that lets the (allowed) opacity/backdrop-fade CSS
 * transitions run from their hidden state. That rAF drives no geometry;
 * the geometry promise is asserted via data-animating + the at-rest
 * transform instead of a blanket rAF spy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  expectGlassFallbackFill,
  frames,
  mockEnv,
  stubMeasurement,
  unmockEnv,
} from "./harness";

async function loadLiquidDialog(reduced: boolean) {
  mockEnv({ reduced });
  const mod = await import("../../src/components/LiquidDialog");
  return mod.LiquidDialog;
}

describe("LiquidDialog degradation contract", () => {
  beforeEach(() => stubMeasurement(320, 180));

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    unmockEnv();
  });

  // The dialog portals to document.body, so queries go through `document`.
  it("reduced motion: opens with no travel and no settle loop; content renders; Escape closes", async () => {
    const LiquidDialog = await loadLiquidDialog(true);
    const onClose = vi.fn();
    render(
      <LiquidDialog open onClose={onClose} aria-label="Confirm">
        dialog body
      </LiquidDialog>
    );

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain("dialog body");
    expect(dialog.getAttribute("data-state")).toBe("open");
    // No morph loop, and no rise-from-trigger travel: the box sits at its
    // at-rest (centered) transform.
    expect(dialog.getAttribute("data-animating")).toBe("false");
    await frames(80);
    expect(dialog.style.transform).toBe("");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("missing backdrop-filter: glass degrades to the documented frosted flat fill", async () => {
    const LiquidDialog = await loadLiquidDialog(true);
    const { unmount } = render(
      <LiquidDialog open material="glass">
        dialog body
      </LiquidDialog>
    );
    expectGlassFallbackFill(document.body);
    unmount();
  });
});
