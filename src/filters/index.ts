// Public surface for the shared SVG filter defs and their auto-injecting
// singleton. Components reference `gooFilterUrl()` / `lensFilterUrl()` in
// CSS and call `useFilterDefs()` once so the defs exist in the DOM; the
// imperative acquire/release internals in `injectDefs.ts` are not exported
// here since the hook is the intended public surface.
export { GOO_FILTER_ID, LENS_FILTER_ID, gooFilterUrl, lensFilterUrl } from "./defs";
export { useFilterDefs } from "./useFilterDefs";
