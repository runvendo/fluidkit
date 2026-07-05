/**
 * Graceful-degradation contract — LiquidField.
 *
 * Already pinned in tests/components/LiquidField.test.tsx: native
 * input/textarea semantics, label association, focus meniscus persistence
 * under reduced motion (focus visibility is not motion).
 *
 * Asserted here: the field is static (no loop to disable) and typing works
 * under reduced motion; glass degrades to a flat fill with no backdrop
 * chain.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expectStaticGeometry, mockEnv, stubMeasurement, unmockEnv } from "./harness";

async function load(reduced: boolean) {
  mockEnv({ reduced });
  stubMeasurement();
  const mod = await import("../../src/components/LiquidField");
  return mod.LiquidField;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unmockEnv();
});

describe("LiquidField degradation contract", () => {
  it("reduced motion: typing and focus work; the surface is rAF-static", async () => {
    const LiquidField = await load(true);
    const { container } = render(<LiquidField label="Email" />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;

    act(() => input.focus());
    // Focus visibility survives reduced motion — it is state, not motion.
    expect(
      container.querySelector('[data-fluidkit="liquid-field-focus"]')
    ).not.toBeNull();
    fireEvent.change(input, { target: { value: "yousef@vendo.run" } });
    expect(input.value).toBe("yousef@vendo.run");
    await expectStaticGeometry(container);
  });

  it("missing backdrop-filter: no backdrop chain on the surface fill", async () => {
    const LiquidField = await load(true);
    const { container } = render(<LiquidField label="Email" />);
    const fills = container.querySelectorAll('[data-fluidkit="liquid-fill"]');
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((fill) => {
      expect((fill as HTMLElement).style.backdropFilter).toBe("");
    });
  });
});
