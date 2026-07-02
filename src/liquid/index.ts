/**
 * Internal liquid engine barrel. The engine is NOT part of the public
 * package surface in v0.2 (components are); only its types leak out through
 * component props.
 */
export type { Vec, LiquidBody } from "./geometry";
export { circlePath, roundRectPath, bridgePath, dist } from "./geometry";
export { TensionField, neckWaist } from "./tension";
export type { SpecularSpot } from "./specular";
export { specularPlacement, defaultLight } from "./specular";
export type {
  LiquidMaterial,
  ResolvedMaterial,
  ResolveMaterialOptions,
} from "./materials";
export { resolveMaterial, MERCURY_GRADIENT } from "./materials";
export { LiquidRenderer } from "./LiquidRenderer";
export type { LiquidRendererProps } from "./LiquidRenderer";
