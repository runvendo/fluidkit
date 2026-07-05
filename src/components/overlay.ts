/**
 * The shared overlay layer: one z-index scale and one portal target for
 * every surface that floats above the page (dialog, menu, toast, tooltip).
 *
 * Internal — not a public export. Each layer's z-index is read through a
 * `--fluidkit-z-<layer>` CSS custom property with a library default, so an
 * app with its own z-index world overrides ours from a stylesheet without
 * forking:
 *
 *   :root { --fluidkit-z-dialog: 40; --fluidkit-z-toast: 60; }
 *
 * Default stack, bottom to top: dialog → menu → toast → tooltip. A menu
 * opened from inside a dialog must clear it; a toast must outlive both;
 * a tooltip explains whatever is topmost.
 */

export type OverlayLayer = "dialog" | "menu" | "toast" | "tooltip";

/** Default z-index per layer (the custom property's fallback). */
export const OVERLAY_Z: Record<OverlayLayer, number> = {
  dialog: 1000,
  menu: 1100,
  toast: 1200,
  tooltip: 1300,
};

/** The `z-index` value for a layer: overridable var with library default. */
export function overlayZ(layer: OverlayLayer): string {
  return `var(--fluidkit-z-${layer}, ${OVERLAY_Z[layer]})`;
}

/** Portal target for overlay surfaces; null during SSR. */
export function overlayRoot(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.body;
}
