/**
 * `WaterField` wraps `webgl-fluid-enhanced`'s `WebGLFluidEnhanced` WebGL
 * fluid simulation (`^0.8.0`) with the fluidkit wrapper contract: capability
 * + motion gating, off-screen pausing, teardown, and fluidkit-consistent
 * prop names.
 *
 * IMPORTANT — API note: the package's own README documents an OUTDATED
 * (pre-0.7) free-function API (`webGLFluidEnhanced.simulation(canvas,
 * config)` with `UPPER_SNAKE_CASE` config keys). The installed `0.8.0`
 * package (verified against `node_modules/webgl-fluid-enhanced/dist/
 * index.d.ts` and `index.es.js`) ships a different, class-based API:
 *
 *   const sim = new WebGLFluidEnhanced(containerEl); // container, not canvas
 *   sim.setConfig({ splatRadius: 0.25, ... });        // camelCase keys
 *   sim.start();                                      // begin the sim
 *   sim.togglePause(drawWhilePaused?);                 // TOGGLE, not set
 *   sim.stop();                                        // full teardown
 *
 * This wrapper is written against the real 0.8.0 API, not the stale README.
 *
 * Container behavior (verified from source): `WebGLFluidEnhanced`'s
 * constructor looks for an existing `<canvas>` inside the container via
 * `container.querySelector("canvas")` and reuses it if found (otherwise it
 * creates one). We always render our own `<canvas>` child, so the library
 * reuses it rather than creating a second one — this also keeps the DOM
 * SSR-renderable and keeps the canvas under our own styling/ref control.
 *
 * Container style side effect (verified from source): the constructor also
 * *synchronously* overwrites `container.style.{outline,position,display,
 * justifyContent,alignItems}` (it centers a canvas it may have just
 * created). Left alone, this would silently flip our wrapper from
 * `position: absolute` (the fluidkit ambient-overlay contract every other
 * primitive in this package relies on) to `position: relative` the moment
 * the sim boots. We restore `position`/`display` immediately after
 * constructing the instance, in the same synchronous effect tick (before
 * the browser paints), so there's no visible flash and no drift from the
 * shared wrapper contract.
 *
 * Prop mapping (fluidkit prop -> `setConfig` key):
 * - `colors` -> `colorPalette`, each entry passed through `resolveColor`.
 *   Omitted entirely (not set to `[]`) when `colors` is undefined, so the
 *   library's own default (empty palette -> random per-splat colors)
 *   applies.
 * - `intensity` (0-1, default `0.6`) -> `splatRadius` and `splatForce`,
 *   linearly scaled and anchored so the default `0.6` reproduces the
 *   library's own defaults exactly (`splatRadius: 0.25`, `splatForce:
 *   6000` — see `defaultConfig` in the installed package): `splatRadius =
 *   0.25 * (intensity / 0.6)`, `splatForce = 6000 * (intensity / 0.6)`.
 * - `interactive` (default `true`) -> `hover` in config AND `pointer-events`
 *   on the canvas (see below) — two separate mechanisms, both required.
 *
 * `config` is an escape hatch: raw options forwarded to `setConfig()`,
 * applied AFTER the mapped keys above, so any key set there wins (e.g.
 * `config={{ bloom: false }}`). Its type is derived from the installed
 * package's own (unexported) `setConfig` parameter type via `Parameters<>`
 * rather than redeclared by hand, so it can't silently drift from upstream.
 *
 * Precedence — config can NEVER defeat gating (same lesson as LiquidMetal's
 * `shaderProps.speed` fix, f2647c2), but by construction rather than by a
 * runtime override: whether the sim boots at all (`supportsWebGL()` +
 * reduced motion) and whether it's paused (`useInView`) are both decided
 * entirely by imperative calls (`new WebGLFluidEnhanced()` / `.start()` /
 * `.togglePause()`), which `config` never reaches — `config` only ever
 * flows into `setConfig()`, and `ConfigOptions` has no key that represents
 * "booted" or "paused" state. There is no shared key for gating logic and
 * the config escape hatch to collide on, so gating wins unconditionally.
 *
 * Pointer events: unlike fluidkit's other (purely decorative) primitives,
 * WaterField is meant to be touched — `pointer-events: none` on the wrapper
 * would stop the canvas from ever receiving the pointer events its splats
 * depend on. So the wrapper stays `pointer-events: none` (consistent with
 * the rest of fluidkit, and correct when `interactive` is false) while the
 * `<canvas>` itself gets an explicit `pointer-events: auto` override when
 * `interactive` is true — a child's explicit `pointer-events` value always
 * wins over an ancestor's `none`, so this correctly re-enables hit-testing
 * on just the canvas without touching the wrapper's own contract.
 * `aria-hidden` stays on the wrapper regardless (it's still decorative to
 * assistive tech, splats or not).
 *
 * Gating: renders a static, cool-water gradient fallback (`data-fallback`,
 * sim never constructed) when `supportsWebGL()` is false or the user
 * prefers reduced motion. `supportsWebGL()` is read once per mount (lazy
 * `useState` initializer), matching `LiquidMetal`.
 *
 * Off-screen pausing (verified from source): `togglePause(drawWhilePaused?)`
 * is a TOGGLE, not a set-paused call — repeated calls without tracking
 * state would drift out of sync with `useInView`, so a ref tracks our own
 * paused intent and only calls `togglePause()` when it needs to flip. Real
 * behavior worth documenting honestly: `togglePause()` does NOT cancel the
 * simulation's `requestAnimationFrame` loop — per the installed source, the
 * loop runs `this.paused || this.step(t), this.render(null), rAF(...)`, so
 * physics stepping and pointer splats stop while paused (the paused guard
 * quoted in `splatPointer()`), but `render(null)` still executes its draw
 * calls every tick, re-blitting the static frame, until `.stop()` is called. This is a
 * deliberate library trade-off (`togglePause` is cheap enough to call on
 * every scroll-driven `inView` flip; `.start()`/`.stop()` are not — `.stop()`
 * removes event listeners and `.start()` re-adds them and reinitializes
 * framebuffers), so we use `togglePause()` for the frequent inView-driven
 * pause and reserve `.stop()` for unmount.
 *
 * Teardown: `.stop()` is called on unmount (cancels the rAF loop, removes
 * the sim's `mousedown`/`mousemove`/`touchstart`/`touchmove` listeners on
 * the canvas and its `mouseup`/`touchend` listeners on `window`). KNOWN
 * LIMITATION (upstream, out of our hands at 0.8.0): the package exposes no
 * `dispose()`/`destroy()` that releases the WebGL context, GPU textures, or
 * compiled shader programs — `.stop()` only undoes what `.start()` did.
 * Removing our `<canvas>` from the DOM (which unmounting does) drops the
 * last strong reference to its WebGL context, making it eligible for
 * garbage collection, but nothing here forces immediate reclamation via
 * `WEBGL_lose_context`. On browsers/situations where GC is slow to run,
 * the context and its GPU-side resources may outlive the component branch
 * momentarily. `supportsWebGL()` and this teardown only gate/undo what
 * fluidkit controls; they can't force upstream to add a real dispose API.
 *
 * SSR: verified against the installed `0.8.0` bundle
 * (`dist/index.es.js`) that every `window`/`document` access lives inside
 * class method bodies (the simulation constructor, `start()`, `stop()`,
 * etc.) — none run at module top level. The only place `document` appears
 * in a constructor's default parameter (`constructor(t = document.body)`)
 * only evaluates when the class is instantiated *without* an argument,
 * which we never do. A plain static import is therefore SSR-safe.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import WebGLFluidEnhanced from "webgl-fluid-enhanced";
import { resolveColor, useInView, usePrefersReducedMotion } from "../utils";
import { supportsWebGL } from "../utils/supportsWebGL";

/**
 * The installed package doesn't export its config type (`Config`/
 * `ConfigOptions` are unexported `declare type`s in its `.d.ts`), so it's
 * derived structurally from `setConfig`'s own parameter type instead of
 * being hand-copied — this can't drift from upstream the way a manually
 * redeclared type could.
 */
type FluidConfig = Parameters<InstanceType<typeof WebGLFluidEnhanced>["setConfig"]>[0];

export interface WaterFieldProps extends HTMLAttributes<HTMLDivElement> {
  /** Splat color palette, passed through `resolveColor`. Defaults to the library's own (random-per-splat) palette when omitted. */
  colors?: string[];
  /** Splat strength, `0`-`1`. Maps to `splatRadius`/`splatForce`, anchored so `0.6` reproduces the library's own defaults. Defaults to `0.6`. */
  intensity?: number;
  /** Whether the field responds to pointer input. Maps to `hover` in config AND `pointer-events` on the canvas. Defaults to `true`. */
  interactive?: boolean;
  /**
   * Escape hatch: raw options forwarded to `webgl-fluid-enhanced`'s
   * `setConfig()`, applied AFTER `colors`/`intensity`/`interactive` above
   * (so any key here wins). Cannot affect whether the sim boots or is
   * paused — see the module doc's Precedence section. Advanced/unstable —
   * mirrors the upstream package's own (unexported) config shape.
   */
  config?: FluidConfig;
}

/** Mirrors the library's own `defaultConfig.splatRadius`. */
const BASE_SPLAT_RADIUS = 0.25;
/** Mirrors the library's own `defaultConfig.splatForce`. */
const BASE_SPLAT_FORCE = 6000;
/** The `intensity` value at which the mapped splat radius/force reproduce the library's own defaults exactly. */
const DEFAULT_INTENSITY = 0.6;

/** Cool, restrained water-like duo used for the fallback gradient and as the default palette anchor. */
const DEFAULT_COLORS: readonly [string, string] = ["#a8dadc", "#1d3557"];

export function WaterField({
  colors,
  intensity = DEFAULT_INTENSITY,
  interactive = true,
  config,
  className,
  style,
  ...rest
}: WaterFieldProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Read once per mount, not at module import time (SSR-safe) and not on
  // every render — capability doesn't change over a mounted lifetime.
  const [webglSupported] = useState(() => supportsWebGL());
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();

  const degraded = !webglSupported || prefersReducedMotion;
  const animating = !degraded && inView;

  const wrapperNodeRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<InstanceType<typeof WebGLFluidEnhanced> | null>(null);
  const pausedRef = useRef(false);

  // Combines the plain node ref (used to boot the sim against) with
  // useInView's ref callback into one stable function, so passing it as
  // `ref` doesn't re-trigger useInView's observe/disconnect effect on
  // every render (a fresh inline ref callback each render would).
  const setWrapperNode = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperNodeRef.current = node;
      inViewRef(node);
    },
    [inViewRef]
  );

  // Boot / teardown. Only re-runs when the gate itself flips (capability
  // and reduced-motion preference don't change mid-lifecycle in practice,
  // but this stays correct if they do) — NOT on every colors/intensity
  // change, which the config-sync effect below handles without a full
  // reconstruct.
  useEffect(() => {
    if (degraded) return;
    const container = wrapperNodeRef.current;
    if (!container) return;

    const instance = new WebGLFluidEnhanced(container);
    // See the module doc's "Container style side effect" note: the
    // constructor just overwrote position/display to center a canvas.
    // Restore the fluidkit overlay contract before the browser paints.
    container.style.position = "absolute";
    container.style.display = "block";

    instanceRef.current = instance;
    pausedRef.current = false;
    instance.start();

    return () => {
      instance.stop();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [degraded]);

  // Config sync: applies colors/intensity/interactive/config to the live
  // instance, both on initial boot (runs after the boot effect above, in
  // the same commit) and whenever any of these props change afterward.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;

    const mapped: FluidConfig = {
      ...(colors && colors.length > 0
        ? { colorPalette: colors.map((c) => resolveColor(c)) }
        : {}),
      splatRadius: BASE_SPLAT_RADIUS * (intensity / DEFAULT_INTENSITY),
      splatForce: BASE_SPLAT_FORCE * (intensity / DEFAULT_INTENSITY),
      hover: interactive,
      ...config,
    };
    instance.setConfig(mapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, intensity, interactive, config, degraded]);

  // Off-screen pause/resume. `togglePause()` toggles rather than sets, so
  // `pausedRef` tracks our own intent and this only calls it when the
  // desired state actually differs — otherwise a re-render with an
  // unrelated prop change would spuriously flip pause state.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const shouldPause = !inView;
    if (shouldPause !== pausedRef.current) {
      pausedRef.current = instance.togglePause();
    }
  }, [inView]);

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    ...style,
  };

  const canvasStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: interactive ? "auto" : "none",
  };

  const resolvedFirst = resolveColor(colors?.[0], DEFAULT_COLORS[0]);
  const resolvedSecond = resolveColor(colors?.[1], DEFAULT_COLORS[1]);

  return (
    <div
      ref={setWrapperNode}
      data-fluidkit="water-field"
      data-animating={animating}
      data-fallback={degraded}
      aria-hidden="true"
      className={className}
      style={wrapperStyle}
      {...rest}
    >
      {degraded ? (
        <div
          data-fluidkit="water-field-fallback"
          style={{
            width: "100%",
            height: "100%",
            // Restrained, cool water-like gradient using the same colors
            // the live sim would use — a static stand-in, not a blank div.
            background: `linear-gradient(135deg, ${resolvedFirst}, ${resolvedSecond}, ${resolvedFirst})`,
          }}
        />
      ) : (
        <canvas data-fluidkit="water-field-canvas" style={canvasStyle} />
      )}
    </div>
  );
}
