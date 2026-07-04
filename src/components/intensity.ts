/**
 * Shared material-volume scale for the base surface family (LiquidCard,
 * MeniscusDivider, …): a continuous 0–1, with two named presets so common
 * levels read at the call site. Each component maps the resolved number
 * onto its own lights (sheen, rim, glint) — the scale is shared, the
 * rendering is not.
 */

export type LiquidIntensity = "whisper" | "present" | number;

export const INTENSITY_PRESETS: Record<"whisper" | "present", number> = {
  whisper: 0.35,
  present: 0.7,
};

export function resolveIntensity(intensity: LiquidIntensity): number {
  if (typeof intensity === "number") return Math.min(Math.max(intensity, 0), 1);
  return INTENSITY_PRESETS[intensity];
}
