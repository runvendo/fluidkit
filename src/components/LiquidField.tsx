/**
 * A text field on a liquid surface. The ONE control where the input stays
 * visible — text must remain crisp, real, selectable — so the liquid is
 * entirely the field's background: an engine glass pane sized by a
 * ResizeObserver (the LiquidCard construction; the input lives in normal
 * flow ABOVE the surface, never clipped by it). On focus the surface
 * swells slightly and the focus meniscus appears; on blur it relaxes.
 *
 * Everything text-related is native: placeholder, autofill, validation,
 * selection, IME. `multiline` swaps the `<input>` for a `<textarea>`.
 *
 * Reduced motion: the swell is dropped but the focus meniscus still shows
 * — focus visibility is not motion.
 */

import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { SpecularSpot, Vec } from "../liquid";
import { usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import { focusMeniscusStyle, useFocusVisible } from "./focus";
import { rimGlowStyle, rimStyle } from "./rim";
import type { SurfaceStyleProps } from "./surface";

type NativeFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>,
  "color" | "size"
>;

export interface LiquidFieldProps extends Omit<SurfaceStyleProps, "refraction">, NativeFieldProps {
  /** Label rendered above the field, associated via `htmlFor`. */
  label?: ReactNode;
  /** Render a `<textarea>` instead of a single-line input. */
  multiline?: boolean;
  /** Corner radius in px. Defaults to `12`. */
  radius?: number;
}

const SWELL_SCALE = 1.015;

export function LiquidField({
  label,
  multiline = false,
  radius = 12,
  material = "glass",
  tint,
  opacity,
  color,
  intensity = "whisper",
  light,
  reflection = true,
  shadow = true,
  className,
  style,
  id: idProp,
  onFocus,
  onBlur,
  ...nativeRest
}: LiquidFieldProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const autoId = useId();
  const id = idProp ?? `fluidkit-field-${autoId}`;
  const focus = useFocusVisible();
  const [focused, setFocused] = useState(false);

  /* The surface follows the field's box (LiquidCard construction). */
  const boxRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) => {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color, opacity }),
    [material, tint, color, opacity]
  );
  const volume = resolveIntensity(intensity);
  const sceneLight = useMemo<Vec | null>(() => {
    if (!reflection || light === null || !size) return null;
    return light ?? defaultLight(size.w, size.h);
  }, [reflection, light, size]);

  const scene = useMemo<{ path: string; speculars: SpecularSpot[] } | null>(() => {
    if (!size) return null;
    const path = roundRectPath(
      { x: size.w / 2, y: size.h / 2 },
      size.w,
      size.h,
      radius
    );
    const speculars =
      resolved.specular && sceneLight
        ? [
            specularPlacement(
              { x: size.w / 2, y: size.h / 2, r: Math.min(size.w, size.h) * 0.48 },
              sceneLight,
              0.4 * volume
            ),
          ]
        : [];
    return { path, speculars };
  }, [size, radius, resolved.specular, sceneLight, volume]);

  const fieldTextStyle: CSSProperties = {
    position: "relative",
    display: "block",
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    font: "inherit",
    fontSize: 14,
    lineHeight: 1.45,
    color: "inherit",
    padding: "10px 14px",
    margin: 0,
    resize: multiline ? "vertical" : undefined,
    minHeight: multiline ? 72 : undefined,
  };

  const sharedNativeProps = {
    id,
    style: fieldTextStyle,
    onFocus: (e: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      setFocused(true);
      focus.onFocus(e);
      onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      setFocused(false);
      focus.onBlur();
      onBlur?.(e);
    },
    ...nativeRest,
  };

  return (
    <div
      data-fluidkit="liquid-field"
      data-focused={focused}
      className={className}
      onPointerDown={focus.onPointerDown}
      style={{ display: "grid", gap: 6, ...style }}
    >
      {label != null && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500 }}>
          {label}
        </label>
      )}
      <span ref={boxRef} style={{ position: "relative", display: "block" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            pointerEvents: "none",
            // The swell: the surface leans toward the reader on focus.
            transform:
              focused && !prefersReducedMotion
                ? `scale(${SWELL_SCALE})`
                : "scale(1)",
            transition: prefersReducedMotion
              ? undefined
              : "transform 240ms cubic-bezier(.22,1,.36,1)",
          }}
        >
          {scene && (
            <LiquidRenderer
              path={scene.path}
              material={resolved}
              speculars={scene.speculars}
              shadow={shadow}
            />
          )}
          {size && resolved.specular && sceneLight && volume > 0 && (
            <>
              <span
                aria-hidden
                style={rimGlowStyle(size.w, size.h, radius, volume)}
              />
              <span
                aria-hidden
                style={rimStyle(size.w, size.h, radius, sceneLight, volume)}
              />
            </>
          )}
        </span>
        {focus.focusVisible && (
          <span
            aria-hidden
            data-fluidkit="liquid-field-focus"
            style={focusMeniscusStyle(radius)}
          />
        )}
        {multiline ? (
          <textarea {...sharedNativeProps} />
        ) : (
          <input {...sharedNativeProps} />
        )}
      </span>
    </div>
  );
}
