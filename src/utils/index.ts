// Shared utilities will be re-exported from here as they are implemented.
export { resolveColor } from "./color";
export {
  supportsBackdropFilter,
  supportsRefraction,
  supportsViewTransition,
} from "./featureDetect";
export {
  resolvePrefersReducedMotion,
  usePrefersReducedMotion,
} from "./reducedMotion";
