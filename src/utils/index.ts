// Public utils barrel — every export here is intended, frozen 1.0 API (see
// docs/superpowers/notes/2026-07-02-api-review.md for the per-export
// decisions). `supportsWebGL` (featureDetect.ts) is deliberately NOT
// exported: the GPU wrappers self-gate and render their own fallback.
export { resolveColor } from "./color";
export {
  supportsBackdropFilter,
  supportsRefraction,
} from "./featureDetect";
export {
  resolvePrefersReducedMotion,
  usePrefersReducedMotion,
} from "./reducedMotion";
export { useInView } from "./useInView";
export type { UseInViewResult } from "./useInView";
