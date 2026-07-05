import { parseColor, type RGB } from "./tabs/tint";

/** WCAG relative luminance of an sRGB triple (0..1). */
function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * The readable label ink for text sitting ON a solid fill: white over dark
 * fills, near-black ink over light ones. A brand theme can put any accent
 * under a label (a graphite accent gives a near-black button fill), so the
 * pairing must be computed, not assumed. Returns null when the fill can't
 * be parsed numerically (`color-mix()`, `var()`, named colors) so callers
 * keep their existing default.
 */
export function readableInk(fill?: string): string | null {
  const rgb = parseColor(fill);
  if (!rgb) return null;
  return luminance(rgb) < 0.45 ? "#ffffff" : "#17181c";
}
