/**
 * A pill-shaped engine button whose `variant` picks the press feel. The
 * `"jelly"` default squashes on press — via GEOMETRY, not a CSS transform,
 * so the label never scales (the library's core principle). `"still"` keeps
 * the same pill rigid (zero geometry deformation), pressing only through the
 * non-geometric polish — fill deepening and the press glint — so it reads as
 * the reduced-motion presentation promoted to a first-class choice (reduced
 * motion itself still wins over `"jelly"`). The rest of this file describes
 * the jelly physics; `"still"` simply holds the geometry at rest.
 *
 * Renders a real `<button>` (focus, Enter/Space, disabled all work
 * natively); the liquid surface is the button's fill, and the label lives
 * on `LiquidRenderer`'s unclipped content overlay, layered on top of the
 * fill and never inside the clipped/filtered subtree.
 *
 * One pill body: width/height ride `useMotionSprings` slots. Press
 * retargets them wider/shorter (volume-preserving — width and height scale
 * by inverse factors, so `w · h` stays constant, mirroring `useSquish`'s
 * `scaleX`/`scaleY`); release springs back home, and the spring's natural
 * overshoot supplies the jiggle. Settle-timer engine pattern (per
 * `MorphSurface`): the rAF loop only runs while settling (or while a
 * press-anchored deformation holds), a static-scene `useMemo` covers every
 * other frame, and a resync effect keeps the two in sync.
 *
 * The press is point-aware by default (`deformPress`): the outline is
 * sampled and dented around the pointer, with the displaced mass bulging
 * away from it (zero-mean displacement ≈ area-preserving), smoothed by a
 * Catmull-Rom fit; keyboard presses stay symmetric. A specular glint
 * (`pressGlint`, glass only) spreads from the press point, and the fill
 * deepens while pressed (`pressFeedback`/`pressColor`) with an asymmetric
 * fade. `releaseWave` opts into a decaying outline ripple on release.
 *
 * The surface paints on a BLEED CANVAS: an absolutely-positioned wrapper
 * inset by `-bleed` px hosts the renderer, so the widened press geometry
 * (plus spring overshoot) extends past the button's border box without
 * getting sliced — background/backdrop-filter can only paint inside their
 * element's box, and clip-path can only subtract. The button's layout box
 * stays exactly `width × height`; the bleed is symmetric, so the label
 * (centered in the canvas) stays centered on the button.
 *
 * Press state (`data-pressed`) always tracks pointer/keyboard interaction,
 * even under reduced motion — but the GEOMETRY only deforms when animating
 * (not reduced motion, in view). Under reduced motion the button still
 * clicks normally; the pressed opacity dip and the fill deepening (color,
 * not motion) are the visual feedback.
 */

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
  useRefraction,
} from "../liquid";
import type { LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings, type SpringConfig } from "../liquid/useMotionSprings";
import { ACTIVATION_KEYS, DEFAULT_INTENSITY, DEFAULT_SPRING } from "../hooks/useSquish";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import type { SurfaceStyleProps } from "./surface";
import { useThemedSurface } from "../theme";
import { readableInk } from "./ink";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface LiquidButtonProps
  extends SurfaceStyleProps,
    ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Press feel. `"still"` (default) keeps the pill rigid: zero geometry
   * deformation, pressing only through the non-geometric polish (fill
   * deepening via `pressFeedback` and the press glint via `pressGlint`).
   * `"jelly"` deforms the geometry on press — volume-preserving squash,
   * point-aware dent, release jiggle, optional `releaseWave`. `squash`,
   * `spring`, `releaseWave`, and `deformPress` are jelly-only and inert on
   * `"still"`. Reduced motion still wins over `"jelly"`.
   */
  variant?: "jelly" | "still";
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"` (0.35) /
   * `"present"` (0.7). Defaults to `"present"` — a documented divergence
   * from the pack's usual `"whisper"`: 0.7 reproduces the button's
   * pre-pack glint brightness exactly.
   */
  intensity?: LiquidIntensity;
  /** Fractional squash at full press (volume-preserving). Defaults to the
   * same `0.12` as `useSquish`. */
  squash?: number;
  /** Resting pill width in px. Defaults to `160`. */
  width?: number;
  /** Resting pill height in px. Defaults to `48`. */
  height?: number;
  /** Overrides the press/release spring (same shape as `useSquish`'s). */
  spring?: SpringConfig;
  /**
   * Deepens the fill while pressed (glass frosts up, flat darkens)
   * with a short crossfade — press feedback beyond the geometry, and the
   * color counterpart to reduced motion's opacity dip. Defaults to `true`.
   */
  pressFeedback?: boolean;
  /**
   * Fill while pressed (any CSS color) — replaces the derived deepening.
   * On glass it becomes the pressed tint (the backdrop blur stays), so
   * translucent colors read best there. Ignored when `pressFeedback` is
   * `false`.
   */
  pressColor?: string;
  /**
   * Press-point-aware squash: the pill dents around the pointer and the
   * displaced mass bulges away from it, instead of squashing uniformly.
   * Keyboard presses stay symmetric. Defaults to `true`.
   */
  deformPress?: boolean;
  /**
   * On release, a single decaying ripple radiates through the outline from
   * the press point. Defaults to `false` — opt in when the extra motion
   * suits the surface.
   */
  releaseWave?: boolean;
  /**
   * On press, an expanding specular glint spreads from the press point —
   * light catching the wave. Specular materials only (glass;
   * flat paints no speculars). Defaults to `true`.
   */
  pressGlint?: boolean;
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 48;

/**
 * How long the loop keeps recomputing after a retarget: the spring's decay
 * envelope falls below 1% at t = 2·ln(100)/damping seconds, padded 40% for
 * slow tails — derived so a custom `spring` prop can't outlive (or get cut
 * off by) a fixed window.
 */
function settleMs(s: SpringConfig): number {
  return Math.ceil((9.2 / s.damping) * 1400);
}

/*
 * ── Press deformation tuning ──────────────────────────────────────────────
 * Tuned live against the showcase wall (2026-07): restraint over wobble —
 * amplitudes sit just above perception so the read is "liquid", not "toy".
 */
/** Press dent: gaussian falloff radius as a fraction of pill height. */
const DENT_SIGMA_RATIO = 0.55;
/** Press dent: max depth as a multiple of `height · squash`. */
const DENT_DEPTH_RATIO = 1.5;
/** Release wave lifetime. */
const WAVE_MS = 500;
/** Release wave: crest amplitude in px. */
const WAVE_AMP = 2.6;
/** Release wave: crest travel speed in px/s. */
const WAVE_SPEED = 320;
/** Release wave: amplitude decay time constant in s. */
const WAVE_TAU = 0.22;
/** Release wave: crest thickness (gaussian sigma) in px. */
const WAVE_SIGMA = 16;
/** Press glint lifetime. */
const GLINT_MS = 550;
/** Press glint: starting radius px / expansion px/s / peak opacity / decay s. */
const GLINT_R0 = 6;
const GLINT_SPEED = 150;
const GLINT_OPACITY = 0.35;
const GLINT_TAU = 0.28;

/** Outline samples per pill cap and per straight edge (interior points). */
const CAP_SAMPLES = 14;
const EDGE_SAMPLES = 10;

/** Press-feedback fill fade: quick in (contact), slow out (release decay).
 * The transition present AFTER a state flip is the one that runs, so press
 * and release each get their own duration. */
const FILL_FADE_IN = "background 180ms ease-out";
const FILL_FADE_OUT = "background 420ms ease-out";
/** How far the pressed glass tint mixes toward opaque white (frostier). */
const GLASS_PRESS_MIX = 28;
/** How far pressed flat fills mix toward black (deeper). */
const SOLID_PRESS_MIX = 10;

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

interface JellyDeform {
  /** Press point in canvas coordinates. */
  p: Vec;
  /** Press dent amount, 0..1 (rides its own spring slot). */
  dent: number;
  /** Seconds since release while the wave runs, else null. */
  waveT: number | null;
  /** The button's `squash` prop — scales the dent depth. */
  squash: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * Catmull-Rom fit through a closed point loop — the sampled outline stays
 * smooth after per-point displacement, instead of reading as a polygon.
 */
function smoothClosedPath(pts: Vec[]): string {
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d + " Z";
}

/**
 * Pill outline sampled as points + analytic outward normals (radial on the
 * caps, ±y on the straight edges), so deformations displace along the
 * surface normal like an actual liquid boundary.
 */
function pillSamples(w: number, h: number, cx: number, cy: number) {
  const r = Math.min(w, h) / 2;
  const right = cx + w / 2 - r;
  const left = cx - w / 2 + r;
  const pts: Vec[] = [];
  const normals: Vec[] = [];
  // Right cap, top→bottom (SVG y-down: -90° is the top).
  for (let i = 0; i <= CAP_SAMPLES; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / CAP_SAMPLES;
    const n = { x: Math.cos(a), y: Math.sin(a) };
    pts.push({ x: right + n.x * r, y: cy + n.y * r });
    normals.push(n);
  }
  // Bottom edge, right→left (interior samples — caps own the endpoints).
  for (let i = 1; i < EDGE_SAMPLES; i++) {
    pts.push({ x: right - ((right - left) * i) / EDGE_SAMPLES, y: cy + r });
    normals.push({ x: 0, y: 1 });
  }
  // Left cap, bottom→top.
  for (let i = 0; i <= CAP_SAMPLES; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / CAP_SAMPLES;
    const n = { x: Math.cos(a), y: Math.sin(a) };
    pts.push({ x: left + n.x * r, y: cy + n.y * r });
    normals.push(n);
  }
  // Top edge, left→right.
  for (let i = 1; i < EDGE_SAMPLES; i++) {
    pts.push({ x: left + ((right - left) * i) / EDGE_SAMPLES, y: cy - r });
    normals.push({ x: 0, y: -1 });
  }
  return { pts, normals };
}

/**
 * The deformed pill: a dent around the press point whose displaced mass
 * bulges out everywhere else (zero-mean displacement ≈ area-preserving, the
 * same volume story as the uniform squash), plus an optional decaying wave
 * crest radiating from the press point on release.
 */
function deformedPillPath(
  w: number,
  h: number,
  cx: number,
  cy: number,
  d: JellyDeform
): string {
  const { pts, normals } = pillSamples(w, h, cx, cy);
  const sigma = h * DENT_SIGMA_RATIO;
  const gauss = pts.map((q) => {
    const dx = q.x - d.p.x;
    const dy = q.y - d.p.y;
    return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  });
  const mean = gauss.reduce((s, g) => s + g, 0) / gauss.length;
  const dentPx = h * d.squash * DENT_DEPTH_RATIO;
  const waveEnv =
    d.waveT !== null ? WAVE_AMP * Math.exp(-d.waveT / WAVE_TAU) : 0;
  const front = d.waveT !== null ? WAVE_SPEED * d.waveT : 0;
  for (let i = 0; i < pts.length; i++) {
    let disp = -dentPx * d.dent * (gauss[i] - mean);
    if (waveEnv > 0) {
      const rr = Math.hypot(pts[i].x - d.p.x, pts[i].y - d.p.y);
      disp +=
        waveEnv * Math.exp(-((rr - front) * (rr - front)) / (2 * WAVE_SIGMA * WAVE_SIGMA));
    }
    pts[i] = {
      x: pts[i].x + normals[i].x * disp,
      y: pts[i].y + normals[i].y * disp,
    };
  }
  return smoothClosedPath(pts);
}

function buildJellyScene(
  w: number,
  h: number,
  cx: number,
  cy: number,
  light: Vec | null,
  intensity: number,
  deform?: JellyDeform | null,
  glint?: SpecularSpot | null
): Scene {
  // A radius larger than either half-dimension always clamps to a full
  // pill inside `roundRectPath`, regardless of the current squash.
  const path = deform
    ? deformedPillPath(w, h, cx, cy, deform)
    : roundRectPath({ x: cx, y: cy }, w, h, Math.max(w, h));
  const speculars: SpecularSpot[] = [];
  if (light) {
    speculars.push(
      specularPlacement(
        { x: cx, y: cy, r: Math.min(w, h) * 0.48 },
        light,
        0.4 * intensity
      )
    );
  }
  if (glint) speculars.push(glint);
  return { path, speculars };
}

export function LiquidButton(props: LiquidButtonProps) {
  // Theme overlay: folds in below explicit props (destructure defaults),
  // above the built-in defaults. Empty (all-undefined) with no provider.
  const themed = useThemedSurface("LiquidButton");
  const {
    variant = "still",
    material = themed.material ?? "glass",
    tint = themed.tint,
    color = themed.color,
    light,
    reflection = true,
    refraction = false,
    // Material volume defaults "present" (0.7) — brighter than the surface
    // family's "whisper", because the button's glint was designed brighter:
    // 0.4 · 0.7 reproduces the pre-pack 0.28 specular exactly.
    intensity = themed.intensity ?? "present",
    shadow = true,
    squash = DEFAULT_INTENSITY,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    spring = DEFAULT_SPRING,
    pressFeedback = true,
    pressColor,
    deformPress = true,
    releaseWave = false,
    pressGlint = true,
    disabled = false,
    children,
    className,
    style,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...rest
  } = props;
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLButtonElement>();
  const animating = !prefersReducedMotion && inView;

  const still = variant === "still";

  const [pressed, setPressed] = useState(false);
  // The press loop runs on any press while animating: it drives the release
  // settle, the press-anchored glint, and — jelly only — the geometry.
  const pressActive = pressed && animating;
  // Geometry only deforms for the jelly variant while animating. Under
  // reduced motion (or off-screen), or for `variant="still"`, `pressed` still
  // tracks for `data-pressed`/opacity/fill, but the body never leaves its
  // resting size. "still" keeps the loop alive for the glint + fill deepening
  // (unlike reduced motion, which also drops the glint) but adds no opacity
  // dip — the reduced-motion presentation for geometry, promoted to a choice.
  const geometryPressed = pressActive && !still;

  // Bleed canvas: at full press the body widens by width·squash (so
  // width·squash/2 per side); ceil(width·squash) gives 2x headroom
  // for the spring's release overshoot.
  const bleed = Math.ceil(width * squash);
  const canvasW = width + bleed * 2;
  const canvasH = height + bleed * 2;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const { url: refractionUrl, defs: refractionDefs } = useRefraction(
    refraction && material === "glass",
    canvasW,
    canvasH
  );
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color, refractionUrl }),
    [material, tint, color, refractionUrl]
  );
  // Press feedback decorates the resolved fill component-side: `color-mix`
  // derives the pressed shade from whatever the material resolved to (any
  // CSS color, including `currentColor`), so no color parsing is needed.
  const displayMaterial = useMemo(() => {
    if (!pressFeedback) return resolved;
    const base = resolved.fillStyle.background;
    const fillStyle = {
      ...resolved.fillStyle,
      transition: pressed ? FILL_FADE_IN : FILL_FADE_OUT,
    };
    if (pressed && typeof base === "string") {
      fillStyle.background =
        pressColor ??
        (resolved.kind === "glass"
          ? `color-mix(in srgb, ${base} ${100 - GLASS_PRESS_MIX}%, rgba(255,255,255,0.95))`
          : `color-mix(in srgb, ${base} ${100 - SOLID_PRESS_MIX}%, black)`);
    }
    return { ...resolved, fillStyle };
  }, [resolved, pressFeedback, pressed, pressColor]);
  // Consumer light arrives in button coordinates; the scene renders in
  // canvas coordinates, offset by the bleed. Memoized so the derived
  // object doesn't invalidate the static scene every render.
  const sceneLight = useMemo(() => {
    if (!reflection || light === null) return null;
    return light
      ? { x: light.x + bleed, y: light.y + bleed }
      : defaultLight(canvasW, canvasH);
  }, [reflection, light, bleed, canvasW, canvasH]);

  // Slot 0: width, slot 1: height, slot 2: press-dent amount (0..1, only
  // read when `deformPress` is on — riding a slot keeps the dent on the
  // same spring clock as the squash).
  const springs = useMotionSprings(
    3,
    (i) => (i === 0 ? width : i === 1 ? height : 0),
    spring
  );

  const targetW = geometryPressed ? width * (1 + squash) : width;
  const targetH = geometryPressed ? height / (1 + squash) : height;

  // Where the current/last press landed, in canvas coordinates (null for
  // keyboard presses — those stay symmetric). Timing refs drive the
  // prototype glint (press-anchored) and wave (release-anchored).
  const pressPoint = useRef<Vec | null>(null);
  const pressedAt = useRef<number | null>(null);
  const releasedAt = useRef<number | null>(null);

  const volume = resolveIntensity(intensity);
  const staticScene = useMemo(
    () =>
      buildJellyScene(
        targetW,
        targetH,
        cx,
        cy,
        resolved.specular ? sceneLight : null,
        volume
      ),
    [targetW, targetH, cx, cy, resolved.specular, sceneLight, volume]
  );

  const renderer = useRef<LiquidSceneHandle>(null);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React to press/release flips: spring (animated) or snap (reduced
  // motion / off-screen — where `targetW`/`targetH` already equal the
  // resting size, so the snap is a no-op).
  const prevPressActive = useRef(pressActive);
  useEffect(() => {
    if (prevPressActive.current !== pressActive) {
      // `targetW`/`targetH` and the dent slot already sit at rest for
      // `variant="still"` (via `geometryPressed`), so a still press retargets
      // to the resting size — the loop below then only paints the glint.
      const targets = [targetW, targetH, geometryPressed ? 1 : 0];
      if (animating) {
        springs.setTargets(targets, spring);
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        // Press-anchored deformation/glint needs the loop alive for the
        // whole hold (they track nothing React re-renders); the release
        // timer below takes over when the press ends. The glint keeps the
        // loop alive for `"still"` too; the jelly dent is jelly-only.
        if (pressActive && (pressGlint || (!still && deformPress))) {
          settleTimer.current = null;
        } else {
          const extra = !pressActive && !still && releaseWave ? WAVE_MS : 0;
          settleTimer.current = setTimeout(
            () => setSettling(false),
            settleMs(spring) + extra
          );
        }
      } else {
        springs.snapTo(targets);
      }
    }
    prevPressActive.current = pressActive;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressActive, animating]);

  // If `animating` flips off mid-settle (reduced motion turning on,
  // scrolling off-screen), the effect above cleans up the timer — so clear
  // `settling` here too, or it would stick true and hold `data-animating`
  // hostage when animation resumes.
  useEffect(() => {
    if (!animating) setSettling(false);
  }, [animating]);

  // The settle loop mutates the DOM behind React's back; whenever it isn't
  // running (settled, reduced motion, off-screen) resync the declarative
  // static scene so prop/state changes always win.
  useEffect(() => {
    if (!(animating && settling)) renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    const now = performance.now();
    const p = pressPoint.current;
    let deform: JellyDeform | null = null;
    let glint: SpecularSpot | null = null;
    if (p) {
      // Geometry deformation (dent + release wave) is jelly-only; `"still"`
      // leaves `deform` null so the body never moves, keeping only the glint.
      const waveT =
        !still && releaseWave && releasedAt.current !== null
          ? (now - releasedAt.current) / 1000
          : null;
      const waveActive = waveT !== null && waveT < WAVE_MS / 1000;
      const dent = !still && deformPress ? springs.values[2].get() : 0;
      if (dent > 0.004 || waveActive) {
        deform = { p, dent, waveT: waveActive ? waveT : null, squash };
      }
      // The glint is painted light: `reflection={false}` / `light={null}`
      // (both fold into a null `sceneLight`) turn it off with the speculars.
      if (pressGlint && resolved.specular && sceneLight && pressedAt.current !== null) {
        const t = (now - pressedAt.current) / 1000;
        if (t < GLINT_MS / 1000) {
          const rr = GLINT_R0 + GLINT_SPEED * t;
          glint = {
            cx: p.x,
            cy: p.y,
            rx: rr,
            ry: rr,
            rotate: 0,
            opacity: GLINT_OPACITY * Math.exp(-t / GLINT_TAU),
          };
        }
      }
    }
    renderer.current?.setScene(
      buildJellyScene(
        springs.values[0].get(),
        springs.values[1].get(),
        cx,
        cy,
        resolved.specular ? sceneLight : null,
        volume,
        deform,
        glint
      )
    );
  });

  function press(e?: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e) {
      // Canvas coordinates: button-relative, clamped to the resting pill,
      // shifted by the bleed inset.
      const rect = e.currentTarget.getBoundingClientRect();
      pressPoint.current = {
        x: clamp(e.clientX - rect.left, 0, width) + bleed,
        y: clamp(e.clientY - rect.top, 0, height) + bleed,
      };
    } else {
      pressPoint.current = null;
    }
    pressedAt.current = performance.now();
    releasedAt.current = null;
    setPressed(true);
  }
  // Release is never guarded: pointerup/cancel/leave, keyup, and blur must
  // always let go, even if `disabled` flipped on mid-hold — otherwise the
  // button freezes squished.
  function release() {
    // Only an actual press starts the release wave — pointerleave without a
    // press (or the pointerup echo after a leave) must not re-arm it.
    if (pressed) releasedAt.current = performance.now();
    setPressed(false);
  }

  // `disabled` flipping true mid-press fires no pointer/keyboard event, so
  // force the release here.
  useEffect(() => {
    if (disabled) setPressed(false);
  }, [disabled]);

  const buttonStyle: CSSProperties = {
    position: "relative",
    width,
    height,
    border: "none",
    padding: 0,
    margin: 0,
    background: "transparent",
    font: "inherit",
    color: "inherit",
    cursor: disabled ? "default" : "pointer",
    opacity: prefersReducedMotion && pressed ? 0.85 : 1,
    ...style,
  };

  // Label ink pairs with what's actually under it. On a flat fill the fill
  // itself is the backdrop, so contrast is computed from it (a graphite
  // accent must get a white label, a pastel one dark ink). On glass the
  // backdrop shows through, so the brand's own text color (theme `text`,
  // which tracks light/dark mode) is the right ink. No theme and no
  // parseable fill → inherit currentColor, exactly as before. An explicit
  // `style.color` from the consumer always wins.
  const labelInk =
    style?.color !== undefined
      ? undefined
      : material === "flat"
        ? (readableInk(color) ?? themed.ink)
        : themed.ink;
  const labelStyle: CSSProperties = {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
    ...(labelInk !== undefined ? { color: labelInk } : {}),
  };

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={className}
      style={buttonStyle}
      data-fluidkit="liquid-button"
      data-animating={animating && settling}
      data-pressed={pressed}
      onPointerDown={(e) => {
        press(e);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        release();
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        release();
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        release();
        onPointerLeave?.(e);
      }}
      onKeyDown={(e) => {
        if (!e.repeat && ACTIVATION_KEYS.has(e.key)) press();
        onKeyDown?.(e);
      }}
      onKeyUp={(e) => {
        if (ACTIVATION_KEYS.has(e.key)) release();
        onKeyUp?.(e);
      }}
      onBlur={(e) => {
        release();
        onBlur?.(e);
      }}
      {...rest}
    >
      {/*
       * Bleed canvas: extends `bleed` px past every button edge so the
       * widened press geometry has room to paint. pointer-events: none so
       * the overhang never widens the button's hit area — events land on
       * the button itself.
       */}
      <span
        data-fluidkit="liquid-canvas"
        style={{
          position: "absolute",
          top: -bleed,
          right: -bleed,
          bottom: -bleed,
          left: -bleed,
          display: "block",
          pointerEvents: "none",
        }}
      >
        {refractionDefs}
        <LiquidRenderer
          ref={renderer}
          path={staticScene.path}
          material={displayMaterial}
          speculars={staticScene.speculars}
          specularSlots={
            resolved.specular && sceneLight ? 1 + (pressGlint ? 1 : 0) : 0
          }
          shadow={shadow}
        >
          <span data-fluidkit="liquid-label" style={labelStyle}>
            {children}
          </span>
        </LiquidRenderer>
      </span>
    </button>
  );
}
