// Shared utilities will be re-exported from here as they are implemented.
export { resolveColor } from "./color";
export {
  supportsBackdropFilter,
  supportsRefraction,
  supportsRelativeColor,
  supportsViewTransition,
} from "./featureDetect";
export {
  resolvePrefersReducedMotion,
  usePrefersReducedMotion,
} from "./reducedMotion";
export { useInView } from "./useInView";
export type { UseInViewResult } from "./useInView";
