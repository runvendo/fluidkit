/**
 * Surface style pack conformance helper (no standalone tests). Each
 * participating component's test file wires its own render function —
 * with whatever module mocks it needs (featureDetect for real glass,
 * motion/react for reduced motion, ResizeObserver/offset stubs for
 * measuring components) — and calls only the assertions that physically
 * apply to it: a component without a shadow layer skips the shadow check,
 * one without intensity-driven speculars skips the intensity check.
 *
 * Color values are asserted verbatim against `style.background`, so pass
 * colors in the form jsdom serializes: `rgba(r, g, b, a)` with spaces.
 */

import { expect } from "vitest";
import type { RenderResult } from "@testing-library/react";
import type { SurfaceStyleProps } from "../../src/components/surface";
import type { LiquidIntensity } from "../../src/components/intensity";

/** Renders the component under test with the given pack props. */
export type SurfaceRender = (props: SurfaceStyleProps) => RenderResult;

function fillOf(container: HTMLElement): HTMLElement {
  const fill = container.querySelector('[data-fluidkit="liquid-fill"]');
  expect(fill, "expected a [data-fluidkit=liquid-fill] layer").not.toBeNull();
  return fill as HTMLElement;
}

/** Opacities of the specular ellipses that actually paint (opacity > 0). */
function visibleSpecularOpacities(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll("ellipse"))
    .map((el) => Number(el.getAttribute("opacity") ?? 0))
    .filter((opacity) => opacity > 0);
}

/**
 * (a) `tint` reaches the glass fill's background. Mock featureDetect's
 * `supportsBackdropFilter` to true in the test file so this exercises real
 * glass, not jsdom's degraded flat fallback.
 */
export function expectTintReachesGlassFill(
  render: SurfaceRender,
  tint = "rgba(200, 220, 255, 0.4)"
): void {
  const { container } = render({ material: "glass", tint });
  const fill = fillOf(container);
  expect(fill.style.background).toBe(tint);
  // Real glass, not the degraded flat fallback — the fallback would also
  // carry the tint, so require the backdrop chain to be present.
  expect(
    fill.style.backdropFilter,
    "expected real glass (mock supportsBackdropFilter to true)"
  ).toContain("blur");
}

/** (b) `color` fills the flat material. */
export function expectColorFillsFlat(
  render: SurfaceRender,
  color = "rgb(18, 52, 86)"
): void {
  const { container } = render({ material: "flat", color });
  expect(fillOf(container).style.background).toBe(color);
}

/**
 * (c) The shadow layer renders by default and `shadow={false}` removes it.
 * Only for components that support shadow.
 */
export function expectShadowToggles(render: SurfaceRender): void {
  const withDefault = render({});
  expect(
    withDefault.container.querySelector('[data-fluidkit="liquid-shadow"]'),
    "expected the default render to paint the shadow layer"
  ).not.toBeNull();
  const without = render({ shadow: false });
  expect(
    without.container.querySelector('[data-fluidkit="liquid-shadow"]'),
    "expected shadow={false} to remove the shadow layer"
  ).toBeNull();
}

/** (d) `light={null}` paints zero specular ellipses. */
export function expectNullLightPaintsNoSpeculars(render: SurfaceRender): void {
  const { container } = render({ material: "glass", light: null });
  expect(visibleSpecularOpacities(container)).toHaveLength(0);
}

/**
 * (e) Higher `intensity` reads louder: the brightest specular at `high`
 * out-paints the brightest at `low`, and both actually paint. Only for
 * components with intensity-driven speculars.
 */
export function expectIntensityScalesSpeculars(
  render: SurfaceRender,
  { low = 0.2, high = 0.9 }: { low?: LiquidIntensity; high?: LiquidIntensity } = {}
): void {
  const brightest = (intensity: LiquidIntensity) =>
    Math.max(
      ...visibleSpecularOpacities(
        render({ material: "glass", intensity }).container
      )
    );
  const dim = brightest(low);
  const bright = brightest(high);
  expect(dim, "expected the low-intensity render to paint a specular")
    .toBeGreaterThan(0);
  expect(bright).toBeGreaterThan(dim);
}
