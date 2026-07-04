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
 *   Ripple, LiquidButton, MeshGradient,
 *   Silk, GlassPanes, LiquidCard, MeniscusDivider, LiquidPanel,
 *   LiquidTooltip, LiquidText, LiquidDialog, VoiceBall, then the GPU
 *   tier: LiquidMetal.
 *
 * Example entry:
 *   { slug: "liquid-button", title: "LiquidButton", load: () => import("./pages/LiquidButton") },
 * GPU entries additionally set `isGpu: true`.
 */
export const REGISTRY: ShowcasePage[] = [
  { slug: "demos", title: "Demos", load: () => import("./pages/Demos") },
  { slug: "droplets", title: "Droplets", load: () => import("./pages/Droplets") },
  { slug: "morph-surface", title: "MorphSurface", load: () => import("./pages/MorphSurface") },
  { slug: "thinking", title: "Thinking", load: () => import("./pages/Thinking") },
  { slug: "liquid-tabs", title: "LiquidTabs", load: () => import("./pages/LiquidTabs") },
  { slug: "flow-stagger", title: "FlowStagger", load: () => import("./pages/FlowStagger") },
  { slug: "ripple", title: "Ripple", load: () => import("./pages/Ripple") },
  { slug: "liquid-button", title: "LiquidButton", load: () => import("./pages/LiquidButton") },
  { slug: "mesh-gradient", title: "MeshGradient", load: () => import("./pages/MeshGradient") },
  { slug: "silk", title: "Silk", load: () => import("./pages/Silk") },
  { slug: "glass-panes", title: "GlassPanes", load: () => import("./pages/GlassPanes") },
  { slug: "liquid-card", title: "LiquidCard", load: () => import("./pages/LiquidCard") },
  { slug: "meniscus-divider", title: "MeniscusDivider", load: () => import("./pages/MeniscusDivider") },
  { slug: "liquid-panel", title: "LiquidPanel", load: () => import("./pages/LiquidPanel") },
  { slug: "liquid-tooltip", title: "LiquidTooltip", load: () => import("./pages/LiquidTooltip") },
  { slug: "liquid-text", title: "LiquidText", load: () => import("./pages/LiquidText") },
  { slug: "liquid-dialog", title: "LiquidDialog", load: () => import("./pages/LiquidDialog") },
  { slug: "voice-ball", title: "VoiceBall", load: () => import("./pages/VoiceBall") },
  { slug: "liquid-metal", title: "LiquidMetal", load: () => import("./pages/LiquidMetal"), isGpu: true },
];
