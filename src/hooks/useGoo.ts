/**
 * Headless goo primitive.
 *
 * Returns the `style` a consumer spreads onto their own container so that
 * container's children fuse like mercury (same-color, overlapping shapes
 * merge via the shared `fluidkit-goo` SVG filter). `LiquidTabs` is the
 * batteries-included component built on top of this.
 */

import type { CSSProperties } from "react";
import { gooFilterUrl, useFilterDefs } from "../filters";
import { usePrefersReducedMotion } from "../utils";

export interface UseGooResult {
  /** Spread onto the consumer's container element. */
  style: CSSProperties;
}

export function useGoo(): UseGooResult {
  // Always mount the shared defs, unconditionally (rules of hooks), so the
  // `fluidkit-goo` filter exists in the DOM whenever this hook is used —
  // even on the reduced-motion path, where we don't currently need it, but
  // conditionally calling hooks based on a value that can change across
  // renders is not safe.
  useFilterDefs();

  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    // The goo merge reads as motion/organic blending. Under
    // prefers-reduced-motion we present the plain, separated shapes instead
    // of fusing them, since that's the clearer, less "animated" rendering.
    return { style: {} };
  }

  return { style: { filter: gooFilterUrl() } };
}
