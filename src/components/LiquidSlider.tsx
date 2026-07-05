/**
 * A slider whose thumb is a DROPLET riding the meniscus edge of a
 * part-filled channel: the track is a shallow vessel filled with liquid up
 * to the value (the Progress read), and the thumb droplet sits fused to
 * the fill's leading edge, following it on a spring as the value moves.
 *
 * A real (visually hidden) `<input type="range">` covers the track:
 * pointer drag, keyboard steps, min/max/step, forms, and screen readers
 * are all the browser's native behavior — fluidkit only paints from the
 * input's value. Controlled (`value` + `onValueChange`) and uncontrolled
 * (`defaultValue`) both work. Keyboard focus shows the shared focus
 * meniscus.
 *
 * At rest the channel and thumb hold the FULL fill tint; while the user
 * is actively sliding (pointer held, or right after a keyboard step) they
 * turn to clear glass, refilling on release — the liquid responds to
 * being touched.
 *
 * Reduced motion: thumb and fill track the value with no spring lag; the
 * touch feedback still applies (state, not motion).
 */

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  circlePath,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { colorWithAlpha, usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { focusMeniscusStyle, useFocusVisible } from "./focus";
import { visuallyHiddenInput } from "./formControl";
import type { SurfaceStyleProps } from "./surface";

export interface LiquidSliderProps
  extends Omit<SurfaceStyleProps, "refraction">,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      | "size"
      | "type"
      | "value"
      | "defaultValue"
      | "onChange"
      | "color"
      | "min"
      | "max"
      | "step"
      | "width"
    > {
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  /** Fires with the next value on every change (drag, keyboard, form). */
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Label above the track, natively associated. */
  label?: ReactNode;
  /** Track length in px. Defaults to `240`. */
  width?: number;
  /** Thumb diameter in px. Defaults to `20`. */
  size?: number;
  /** Fill tint (the liquid in the channel). Defaults to a quiet blue. */
  fillTint?: string;
  /**
   * How loudly the material reads. Defaults to `"present"` — the thumb is
   * a droplet and carries Droplets' specular brightness (documented
   * divergence from the pack's `"whisper"`).
   */
  intensity?: LiquidIntensity;
}

/* Follow spring: responsive but liquid (drag must not feel laggy). */
const FOLLOW_SPRING = { stiffness: 400, damping: 30 };
const SETTLE_MS = 700;
const DEFAULT_FILL_TINT = "rgba(96, 156, 220, 0.45)";

/** The rest-state tint: the fill tint at near-full strength. */
function saturate(tint: string): string {
  return colorWithAlpha(tint, 0.85);
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

export function LiquidSlider({
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  width = 240,
  size = 20,
  fillTint = DEFAULT_FILL_TINT,
  material = "glass",
  tint,
  opacity,
  color,
  intensity = "present",
  light,
  reflection = true,
  shadow = true,
  disabled,
  className,
  style,
  ...inputRest
}: LiquidSliderProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animating = !prefersReducedMotion;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? min);
  const current = isControlled ? value : internal;
  const fraction = max > min ? (current - min) / (max - min) : 0;

  const focus = useFocusVisible();

  // "Being slid": pointer held on the control, or within a short window
  // of a keyboard step. Kept tight so the liquid settles back to its
  // filled rest state promptly on release (review: the old settle-length
  // window felt laggy).
  const [pointerHeld, setPointerHeld] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const keyboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markKeyboardActive = () => {
    setKeyboardActive(true);
    if (keyboardTimer.current) clearTimeout(keyboardTimer.current);
    keyboardTimer.current = setTimeout(() => setKeyboardActive(false), 250);
  };
  useEffect(
    () => () => {
      if (keyboardTimer.current) clearTimeout(keyboardTimer.current);
    },
    []
  );
  useEffect(() => {
    if (!pointerHeld) return;
    const release = () => setPointerHeld(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [pointerHeld]);

  /* ------------------------------ geometry ------------------------------ */

  const thumbR = size / 2;
  const trackH = Math.max(8, size * 0.5);
  const bleed = Math.ceil(size * 0.8);
  const W = width + bleed * 2;
  const H = Math.max(trackH, size) + bleed * 2;
  const cy = H / 2;
  // The thumb center travels the inner channel, seat to seat.
  const travelL = bleed + thumbR;
  const travelR = bleed + width - thumbR;

  const sceneLight = useMemo<Vec | null>(() => {
    if (!reflection || light === null) return null;
    return light
      ? { x: light.x + bleed, y: light.y + bleed }
      : defaultLight(W, H);
  }, [reflection, light, bleed, W, H]);
  const volume = resolveIntensity(intensity);
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color, opacity }),
    [material, tint, color, opacity]
  );
  const fillMaterial = useMemo(
    () => resolveMaterial(material, { tint: fillTint, color }),
    [material, fillTint, color]
  );
  const vividMaterial = useMemo(
    () => resolveMaterial(material, { tint: saturate(fillTint), color }),
    [material, fillTint, color]
  );
  const trackMaterial = useMemo(
    () => resolveMaterial(material, { tint: "rgba(120, 128, 150, 0.16)", color }),
    [material, color]
  );

  /* ------------------------------- motion -------------------------------- */

  const targetX = travelL + fraction * (travelR - travelL);
  const x = useMotionSprings(1, () => targetX, FOLLOW_SPRING);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevX = useRef(targetX);
  useEffect(() => {
    if (prevX.current !== targetX) {
      if (animating) {
        x.setTargets([targetX]);
        settlingRef.current = true;
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settlingRef.current = false;
          setSettling(false);
        }, SETTLE_MS);
      } else {
        x.snapTo([targetX]);
      }
    }
    prevX.current = targetX;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, animating]);

  useEffect(() => {
    if (!animating) {
      settlingRef.current = false;
      setSettling(false);
    }
  }, [animating]);

  /** Thumb droplet fused to the fill's leading edge. */
  const buildThumbScene = (tx: number): Scene => {
    const thumb = { x: tx, y: cy, r: thumbR };
    return {
      path: circlePath(thumb, thumb.r),
      speculars:
        resolved.specular && sceneLight
          ? [specularPlacement(thumb, sceneLight, volume)]
          : [],
    };
  };

  /** The liquid in the channel, up to the thumb. */
  const buildFillScene = (tx: number): Scene => {
    const fillW = Math.max(tx - bleed, trackH);
    if (tx <= travelL + 0.5) return { path: "", speculars: [] };
    return {
      path: roundRectPath(
        { x: bleed + fillW / 2, y: cy },
        fillW,
        trackH,
        trackH / 2
      ),
      speculars: [],
    };
  };

  const staticThumb = useMemo(
    () => buildThumbScene(targetX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetX, thumbR, cy, resolved.specular, sceneLight, volume]
  );
  const staticFill = useMemo(
    () => buildFillScene(targetX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetX, trackH, bleed, travelL, cy]
  );

  const thumbRenderer = useRef<LiquidSceneHandle>(null);
  const vividThumbRenderer = useRef<LiquidSceneHandle>(null);
  const fillRenderer = useRef<LiquidSceneHandle>(null);
  const vividRenderer = useRef<LiquidSceneHandle>(null);

  useEffect(() => {
    if (!(animating && settlingRef.current)) {
      thumbRenderer.current?.setScene(staticThumb);
      vividThumbRenderer.current?.setScene(staticThumb);
      fillRenderer.current?.setScene(staticFill);
      vividRenderer.current?.setScene(staticFill);
    }
  }, [animating, settling, staticThumb, staticFill]);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    const tx = x.values[0].get();
    const fillScene = buildFillScene(tx);
    const thumbScene = buildThumbScene(tx);
    thumbRenderer.current?.setScene(thumbScene);
    vividThumbRenderer.current?.setScene(thumbScene);
    fillRenderer.current?.setScene(fillScene);
    vividRenderer.current?.setScene(fillScene);
  });

  const active = pointerHeld || keyboardActive;

  // Mid-slide the declarative scenes must be the CURRENT spring frame —
  // the target would paint the destination one commit early and read as
  // a snap (the LiquidPanel rule).
  const midSlide = animating && (settling || prevX.current !== targetX);
  const renderThumb = midSlide ? buildThumbScene(x.values[0].get()) : staticThumb;
  const renderFill = midSlide ? buildFillScene(x.values[0].get()) : staticFill;

  /* ------------------------------- render -------------------------------- */

  const trackPath = roundRectPath(
    { x: bleed + width / 2, y: cy },
    width,
    trackH,
    trackH / 2
  );

  const rootStyle: CSSProperties = {
    display: "inline-grid",
    gap: 6,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
    ...style,
  };

  return (
    <label
      data-fluidkit="liquid-slider"
      data-value={current}
      data-active={active}
      data-animating={animating && settling}
      className={className}
      onPointerDown={() => {
        focus.onPointerDown();
        if (!disabled) setPointerHeld(true);
      }}
      style={rootStyle}
    >
      {label != null && <span>{label}</span>}
      <span
        style={{
          position: "relative",
          width,
          height: Math.max(trackH, size),
          flex: "none",
        }}
      >
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer path={trackPath} material={trackMaterial} shadow={shadow} />
        </span>
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer ref={fillRenderer} path={renderFill.path} material={fillMaterial} />
        </span>
        {/* The channel rests FILLED with the tint and turns to clear glass
            while the user is sliding (review: the inverse read is better
            UX), refilling on release. */}
        <span
          aria-hidden
          data-fluidkit="liquid-slider-active-fill"
          style={{
            position: "absolute",
            inset: -bleed,
            opacity: active ? 0 : 1,
            transition: "opacity 180ms ease",
            pointerEvents: "none",
          }}
        >
          <LiquidRenderer ref={vividRenderer} path={renderFill.path} material={vividMaterial} />
        </span>
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer
            ref={thumbRenderer}
            path={renderThumb.path}
            material={resolved}
            speculars={renderThumb.speculars}
            specularSlots={resolved.specular && sceneLight ? 1 : 0}
            shadow={shadow}
          />
        </span>
        {/* The thumb answers the touch with the channel: tinted at rest,
            glass in hand. */}
        <span
          aria-hidden
          data-fluidkit="liquid-slider-active-thumb"
          style={{
            position: "absolute",
            inset: -bleed,
            opacity: active ? 0 : 1,
            transition: "opacity 180ms ease",
            pointerEvents: "none",
          }}
        >
          <LiquidRenderer
            ref={vividThumbRenderer}
            path={renderThumb.path}
            material={vividMaterial}
          />
        </span>
        {focus.focusVisible && (
          <span
            aria-hidden
            data-fluidkit="liquid-slider-focus"
            style={focusMeniscusStyle(Math.max(trackH, size) / 2)}
          />
        )}
        <input
          type="range"
          style={visuallyHiddenInput}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue ?? min}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!isControlled) setInternal(next);
            if (!pointerHeld) markKeyboardActive();
            onValueChange?.(next);
          }}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          {...inputRest}
        />
      </span>
    </label>
  );
}
