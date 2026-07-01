/**
 * `<LiquidGlass>` — a frosted glass panel that, on capable browsers, shows
 * real refraction (content behind it bends) by delegating to the
 * `@samasante/liquid-glass` engine. Everywhere else it degrades gracefully
 * to a plain frosted blur, then to a solid tint. It NEVER hard-fails: any
 * unsupported capability or a failed engine load just means a plainer (but
 * always rendered) panel.
 *
 * Adapter contract (from `node_modules/@samasante/liquid-glass/dist/index.d.ts`,
 * read directly — not guessed):
 *
 *   export const Glass: React.FC<GlassProps>;
 *   interface GlassProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
 *     children?: React.ReactNode;
 *     radius?: GlassValue;              // GlassValue = number | { get/set/on(...) }
 *     optics?: Partial<GlassOptics>;    // GlassOptics.frost: number — pre-refraction blur, px
 *     width?: GlassValue; height?: GlassValue; size?: ...;   // omitted: fit the wrapped element
 *     ... (many more optional "recipe" knobs we don't need — engine defaults
 *         to "a balanced" look per its own docs)
 *   }
 *
 * We map our minimal surface onto it directly:
 *   - `radius` (px)         -> `<Glass radius={radius}>`
 *   - `blur` (px)           -> `<Glass optics={{ frost: blur }}>`
 *   - `tint`                -> a `backgroundColor` on the SAME element `<Glass>`
 *                              renders (it forwards `HTMLAttributes<HTMLDivElement>`,
 *                              including `style`/`className`/`data-*`, onto its
 *                              root), so no extra overlay layer is needed — the
 *                              same trick used for the frosted/tint fallbacks.
 *   - `children`            -> passed straight through; `<Glass>` refracts the
 *                              live page behind whatever it wraps.
 *   - `width`/`height`/`size` are intentionally left unset: `<Glass>` fits the
 *     wrapped element, which is exactly what we want (`children`, laid out
 *     normally inside our panel).
 *
 * SSR / ESM-only safety: `@samasante/liquid-glass` is ESM-only and
 * `sideEffects:false`. It must never be imported at module load time (that
 * would break the CJS build's module graph and touch `window`/DOM during
 * SSR). So it is loaded via a dynamic `import()` inside a `useEffect`
 * (client-only, runs after mount) — never during render, never on the
 * server. The FIRST render (server or client) always renders a fallback;
 * only after the effect's dynamic import resolves does a re-render swap in
 * the engine. This also means the engine is never bundled unless a consumer
 * actually renders a `<LiquidGlass>` that ends up wanting refraction (good
 * for tree-shaking / lazy loading).
 */

import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import type { GlassProps as EngineGlassProps } from "@samasante/liquid-glass";
import {
  resolveColor,
  supportsBackdropFilter,
  supportsRefraction,
  usePrefersReducedMotion,
} from "../utils";

export interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  /** Frosted blur strength in px (also the engine's pre-refraction blur). Default 14. */
  blur?: number;
  /** `'auto'` (default) picks refraction when supported and motion isn't
   *  reduced; `true` opts in (still falls back if truly unsupported);
   *  `false` always uses the frosted/tint fallback and never loads the engine. */
  refraction?: "auto" | boolean;
  /** Panel corner radius in px. Default 16. */
  radius?: number;
  /** Overlay tint color. `true` = a more visible translucent default;
   *  `false` = no tint wash; a string is resolved via `resolveColor()`.
   *  Omitted (default) = a subtle translucent default. */
  tint?: string | boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_BLUR = 14;
const DEFAULT_RADIUS = 16;

/** Default tint when `tint` is omitted — subtle, so it reads as a hint of
 *  frost rather than a colored wash (the blur/refraction does the real work). */
const SUBTLE_TINT = "rgba(255, 255, 255, 0.14)";
/** `tint={true}` — "a sensible translucent default": still neutral/brand-free,
 *  but visible enough to work as the sole background when there's no blur. */
const STRONG_TINT = "rgba(255, 255, 255, 0.55)";

function resolveTint(tint: string | boolean | undefined): string {
  if (tint === false) return "transparent";
  if (tint === true) return STRONG_TINT;
  if (typeof tint === "string") return resolveColor(tint, STRONG_TINT);
  return SUBTLE_TINT;
}

/** Lazily-loaded engine component type, once `import()` resolves. */
type EngineGlass = React.ComponentType<EngineGlassProps>;

export function LiquidGlass({
  blur = DEFAULT_BLUR,
  refraction = "auto",
  radius = DEFAULT_RADIUS,
  tint,
  children,
  className,
  style,
  ...rest
}: LiquidGlassProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Whether we WANT the real refraction engine at all. `refraction === false`
  // always opts out. Reduced motion always opts out (accessibility overrides
  // any explicit `true`). Otherwise (`'auto'` or explicit `true`) we only
  // want it when the browser can actually do it — `refraction={true}` is an
  // opt-IN, not a promise to hard-fail if unsupported, so both `'auto'` and
  // `true` resolve identically here: gated on real capability.
  const wantsEngine =
    refraction !== false && !prefersReducedMotion && supportsRefraction();

  // Holds the dynamically-imported engine component once loaded. Starts
  // `null` on every render (including the very first, client or server) so
  // the engine is NEVER part of the initial paint.
  const [EngineGlassComponent, setEngineGlassComponent] =
    useState<EngineGlass | null>(null);

  useEffect(() => {
    if (!wantsEngine) return;

    let cancelled = false;
    import("@samasante/liquid-glass")
      .then((mod) => {
        if (!cancelled) setEngineGlassComponent(() => mod.Glass);
      })
      .catch(() => {
        // Never hard-fail: engine load failed (network hiccup, unsupported
        // environment, etc.) — simply stay on the frosted/tint fallback
        // that's already rendered.
      });

    return () => {
      cancelled = true;
    };
  }, [wantsEngine]);

  const resolvedTint = resolveTint(tint);

  // Base fallback rung: frosted blur where `backdrop-filter` works, else a
  // solid tint. Recomputed on every render (a cheap `CSS.supports` call, and
  // SSR-safe: guarded utilities return `false` when `CSS`/`document` are
  // absent), so it always reflects the real runtime environment rather than
  // being frozen at mount.
  const fallbackMode: "frosted" | "tint" = supportsBackdropFilter()
    ? "frosted"
    : "tint";

  // Only ever render "refraction" once we both want it AND the engine has
  // actually finished loading. If `wantsEngine` flips back to false later
  // (e.g. the OS reduced-motion preference changes mid-session), we drop
  // straight back to the fallback even if the engine is still loaded.
  const mode: "refraction" | "frosted" | "tint" =
    wantsEngine && EngineGlassComponent ? "refraction" : fallbackMode;

  const cssVars = {
    "--fluidkit-glass-blur": `${blur}px`,
    "--fluidkit-glass-radius": `${radius}px`,
    "--fluidkit-glass-tint": resolvedTint,
  } as CSSProperties;

  if (mode === "refraction" && EngineGlassComponent) {
    const Glass = EngineGlassComponent;
    return (
      <Glass
        data-fluidkit="liquid-glass"
        data-glass-mode="refraction"
        radius={radius}
        optics={{ frost: blur }}
        className={className}
        style={{
          ...cssVars,
          borderRadius: "var(--fluidkit-glass-radius)",
          backgroundColor: "var(--fluidkit-glass-tint)",
          ...style,
        }}
        {...rest}
      >
        {children}
      </Glass>
    );
  }

  const isFrosted = mode === "frosted";
  return (
    <div
      data-fluidkit="liquid-glass"
      data-glass-mode={mode}
      className={className}
      style={{
        ...cssVars,
        borderRadius: "var(--fluidkit-glass-radius)",
        backgroundColor: "var(--fluidkit-glass-tint)",
        ...(isFrosted && {
          backdropFilter: "blur(var(--fluidkit-glass-blur))",
          WebkitBackdropFilter: "blur(var(--fluidkit-glass-blur))",
        }),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
