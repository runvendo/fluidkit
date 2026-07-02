import type { ComponentType } from "react";

export type ShowcasePage = {
  /** Hash-route segment: the page lives at `#/<slug>`. */
  slug: string;
  /** Sidebar label + page identity. */
  title: string;
  /** Lazy import — pages export their component as `default`. */
  load: () => Promise<{ default: ComponentType }>;
  /** GPU-tier pages are grouped under a "GPU tier" label in the sidebar. */
  isGpu?: boolean;
};

/**
 * Ordered list of showcase pages — the sidebar and router read this top to
 * bottom, and the first entry is the landing page.
 *
 * One line per page, added in the SAME COMMIT as the page file lands in
 * `./pages/` — never commit an entry whose page doesn't exist yet.
 *
 * Final order:
 *   Demos, Droplets, MorphSurface, Thinking, LiquidTabs, FlowStagger,
 *   Ripple, JellyButton, Magnetic, LiquidDrag, DripFuse, MeshGradient,
 *   Aurora, then the GPU tier: LiquidMetal, WaterField.
 *
 * Example entry:
 *   { slug: "jelly-button", title: "JellyButton", load: () => import("./pages/JellyButton") },
 * GPU entries additionally set `isGpu: true`.
 */
export const REGISTRY: ShowcasePage[] = [];
