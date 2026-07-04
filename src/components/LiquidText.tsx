/**
 * Display text where the GLYPHS THEMSELVES ARE GLASS: translucent
 * letterforms that blur and tint whatever sits behind them, with a
 * specular sheen drifting across — light passing over glass lettering.
 * The text geometry never changes (no squash, no wobble — the engine
 * invariant): only light and backdrop move.
 *
 * How the glass works: `backdrop-filter` can't be clipped to text by
 * `background-clip`, so the glass layer is MASKED by an SVG rendering of
 * the same string (same font/size/weight, read from the live element).
 * The real text stays in normal flow as invisible ink — it keeps layout,
 * selection and screen-reader semantics — while the masked glass paints
 * the visible glyphs above it. Because SVG-as-mask can only use system
 * fonts, exotic web-font pages may see slightly different letterforms in
 * the mask; `material="flat"` is the safe fallback there (and for
 * non-string children, which can't be rendered into a mask).
 *
 * The sheen is the same swept gradient in both materials (zero
 * per-frame JS — a CSS `@keyframes` loop per the ambient-component house
 * pattern). Angle defaults to the house light direction. Reduced motion:
 * the sweep parks on the light-facing third. Off-screen it pauses
 * in-phase. No backdrop-filter support → flat.
 *
 * LiquidText takes no `light`/`reflection`/`refraction`/`shadow` from the
 * surface style pack: its lighting IS the sheen sweep, not the scene light.
 *
 * Inline by design: wrap the text inside your own heading —
 *   <h1><LiquidText>Liquid type</LiquidText></h1>
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { resolveMaterial } from "../liquid/materials";
import { supportsBackdropFilter } from "../utils/featureDetect";
import { useInView, usePrefersReducedMotion } from "../utils";
import { injectStyleOnce } from "../utils/injectStyleOnce";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";

export type LiquidTextMaterial = "glass" | "flat";

export interface LiquidTextProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * `"glass"` (default): the glyphs are translucent glass over the
   * backdrop. `"flat"`: solid-color glyphs. Both get the sheen sweep.
   */
  material?: LiquidTextMaterial;
  /** Solid color of the glyphs (`material="flat"`). Defaults to `#23242c`. */
  color?: string;
  /** Glass tint (any CSS color, normally translucent white). */
  tint?: string;
  /** Sheen color. Defaults to white. */
  sheenColor?: string;
  /**
   * How bright the sheen reads: 0–1, or the presets `"whisper"` (0.35) /
   * `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidIntensity;
  /** Sweep speed multiplier — 1 is one pass every ~7s. Defaults to `1`. */
  speed?: number;
  /**
   * Sweep angle in degrees (CSS gradient angle). Defaults to `115` —
   * perpendicular to the house light's above-left direction.
   */
  angle?: number;
  children: ReactNode;
}

const KEYFRAMES_STYLE_ID = "fluidkit-liquid-text-keyframes";
const SWEEP_KEYFRAMES_NAME = "fluidkit-liquid-text-sweep";

/** Seconds per sweep cycle at `speed` 1 (includes the dwell between passes). */
const PERIOD_S = 7;

/**
 * Post-resolve blur override: the glass recipe comes from the shared
 * `resolveMaterial`, but glyph-masked glass frosts harder than a panel at
 * the same radius — the shared 16px turns letterforms to fog. 10px keeps
 * the glyphs legible, so only the blur radius diverges from the resolver.
 */
const GLYPH_BLUR = "blur(10px)";

/**
 * The sheen layer is 2.5× the text box, so the moving band spends most of
 * each cycle off-glyph — a pass, then a rest, like a light source arcing
 * by. Only `background-position` animates (compositor-friendly).
 */
const KEYFRAMES_CSS = `
@keyframes ${SWEEP_KEYFRAMES_NAME} {
  0% { background-position: 200% 0; }
  100% { background-position: -100% 0; }
}
`;

/** Reduced-motion park position: sheen rests on the light-facing third. */
const STATIC_POSITION = "60% 0";

function supportsTextClip(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function")
    return false;
  return (
    CSS.supports("-webkit-background-clip", "text") ||
    CSS.supports("background-clip", "text")
  );
}

interface GlyphMask {
  uri: string;
  w: number;
  h: number;
}

/** SVG-of-the-text data URI for masking, matching the live font styles. */
function buildGlyphMask(el: HTMLElement, text: string): GlyphMask | null {
  const w = Math.ceil(el.offsetWidth);
  const h = Math.ceil(el.offsetHeight);
  if (!w || !h) return null;
  const cs = getComputedStyle(el);
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Font names must be quote-free: any quote inside the attribute breaks
  // the XML, and an invalid mask image hides the whole layer.
  const family = cs.fontFamily.replace(/["']/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="${family}" ` +
    `font-size="${cs.fontSize}" font-weight="${cs.fontWeight}" ` +
    `font-style="${cs.fontStyle}" letter-spacing="${cs.letterSpacing === "normal" ? "0" : cs.letterSpacing}" ` +
    `fill="#fff">${escaped}</text></svg>`;
  return { uri: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, w, h };
}

export function LiquidText({
  material = "glass",
  color = "#23242c",
  tint,
  sheenColor = "#ffffff",
  intensity = "whisper",
  speed = 1,
  angle = 115,
  children,
  className,
  style,
  ...rest
}: LiquidTextProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref: inViewRef, inView } = useInView<HTMLSpanElement>();
  const elRef = useRef<HTMLSpanElement | null>(null);
  const setRef = (node: HTMLSpanElement | null) => {
    elRef.current = node;
    inViewRef(node);
  };

  useEffect(() => {
    injectStyleOnce(KEYFRAMES_STYLE_ID, KEYFRAMES_CSS);
  }, []);

  const volume = resolveIntensity(intensity);
  const clipSupported = useMemo(supportsTextClip, []);

  // Glass needs a string to render into the mask, and backdrop support.
  const text = typeof children === "string" ? children : null;
  const glass =
    material === "glass" && text !== null && supportsBackdropFilter();

  const [mask, setMask] = useState<GlyphMask | null>(null);
  useLayoutEffect(() => {
    if (!glass) {
      setMask(null);
      return;
    }
    const el = elRef.current;
    if (!el) return;
    const rebuild = () => setMask(buildGlyphMask(el, text));
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(el);
    return () => ro.disconnect();
  }, [glass, text]);

  const sheen = `color-mix(in srgb, ${sheenColor} ${Math.round(
    85 * volume
  )}%, transparent)`;
  // Narrow band: 8% of the 2.5×-wide layer ≈ a fifth of the text box, so
  // even short words read a passing line, not a full-word flash.
  const sheenGradient = `linear-gradient(${angle}deg, transparent 46%, ${sheen} 50%, transparent 54%)`;
  const sweepAnimation: CSSProperties =
    volume > 0
      ? {
          animationName: prefersReducedMotion ? "none" : SWEEP_KEYFRAMES_NAME,
          animationDuration: `${PERIOD_S / Math.max(speed, 0.1)}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: inView ? "running" : "paused",
        }
      : {};

  // Flat: sheen + solid color clipped to the glyphs (single element).
  const flatStyle = useMemo<CSSProperties>(() => {
    if (!clipSupported) return { color };
    return {
      backgroundImage: `${sheenGradient}, linear-gradient(${color}, ${color})`,
      backgroundSize: "250% 100%, 100% 100%",
      backgroundPosition: `${STATIC_POSITION}, 0 0`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      ...sweepAnimation,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipSupported, color, sheenGradient, JSON.stringify(sweepAnimation)]);

  // Glass: the layer carries backdrop blur + tint, masked to the glyphs.
  // The recipe (tint, saturation, compositor hint) is the shared resolver's;
  // only the blur radius is swapped for GLYPH_BLUR (see its comment).
  const glassFill = glass ? resolveMaterial("glass", { tint }).fillStyle : null;
  const glassBackdrop = glassFill
    ? String(glassFill.backdropFilter).replace(/blur\([^)]*\)/, GLYPH_BLUR)
    : undefined;
  const glassLayer: CSSProperties | null =
    glass && mask && glassFill
      ? {
          position: "absolute",
          inset: 0,
          background: glassFill.background,
          backdropFilter: glassBackdrop,
          WebkitBackdropFilter: glassBackdrop,
          willChange: glassFill.willChange,
          WebkitMaskImage: mask.uri,
          maskImage: mask.uri,
          WebkitMaskSize: `${mask.w}px ${mask.h}px`,
          maskSize: `${mask.w}px ${mask.h}px`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          pointerEvents: "none",
        }
      : null;

  // Sheen over glass: its own masked layer so the band lights the glyphs.
  const glassSheenLayer: CSSProperties | null =
    glassLayer && volume > 0
      ? {
          ...glassLayer,
          background: "transparent",
          backdropFilter: undefined,
          WebkitBackdropFilter: undefined,
          willChange: undefined,
          backgroundImage: sheenGradient,
          backgroundSize: "250% 100%",
          backgroundPosition: STATIC_POSITION,
          ...sweepAnimation,
        }
      : null;

  return (
    <span
      ref={setRef}
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        ...(glass ? { color: "transparent" } : flatStyle),
        ...style,
      }}
      data-fluidkit="liquid-text"
      data-material={glass ? "glass" : "flat"}
      {...rest}
    >
      {children}
      {glassLayer && <span aria-hidden="true" style={glassLayer} />}
      {glassSheenLayer && <span aria-hidden="true" style={glassSheenLayer} />}
    </span>
  );
}
