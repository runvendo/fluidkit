/**
 * A checkbox whose check is LIQUID, not a tick: on check the pool rises to
 * fill the box's well, settling with a wobble; on uncheck it drains back
 * out. (Review round: no falling droplet — just the pour.) `indeterminate`
 * — a real capability of the native checkbox — reads as a half-filled well
 * with a flat meniscus.
 *
 * A real (visually hidden) `<input type="checkbox">` powers it: keyboard,
 * screen readers, form submission, and label association are the
 * browser's job. Controlled and uncontrolled both work. Keyboard focus
 * shows the shared focus meniscus.
 *
 * Reduced motion: fill level snaps between states; no wobble.
 */

import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { focusMeniscusStyle, useFocusVisible } from "./focus";
import { useCheckedState, visuallyHiddenInput } from "./formControl";
import type { SurfaceStyleProps } from "./surface";

export interface LiquidCheckboxProps
  extends SurfaceStyleProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      "size" | "type" | "checked" | "defaultChecked" | "onChange" | "color"
    > {
  /** Controlled state. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  /** Fires with the next state on every toggle. */
  onCheckedChange?: (checked: boolean) => void;
  /** Mixed state: half-filled well, native `indeterminate` set. */
  indeterminate?: boolean;
  /** Label text, rendered beside the box and natively associated. */
  label?: ReactNode;
  /** Box size in px. Defaults to `20`. */
  size?: number;
  /**
   * How loudly the material reads. Defaults to `"present"` — the pool is
   * a droplet visual and carries Droplets' specular brightness (documented
   * divergence from the pack's `"whisper"`).
   */
  intensity?: LiquidIntensity;
}

const FILL_SPRING = { stiffness: 170, damping: 14 };
const SETTLE_MS = 900;

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

export function LiquidCheckbox({
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate = false,
  label,
  size = 20,
  material = "glass",
  tint,
  color,
  intensity = "present",
  light,
  reflection = true,
  refraction: _refraction, // reserved: edge lensing is not wired on checkboxes yet
  shadow = true,
  disabled,
  className,
  style,
  ...inputRest
}: LiquidCheckboxProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animating = !prefersReducedMotion;
  const state = useCheckedState(checked, defaultChecked, onCheckedChange);
  const focus = useFocusVisible();

  /* ------------------------------ geometry ------------------------------ */

  const wall = Math.max(2.5, size * 0.14);
  const inner = size - wall * 2;
  const radius = Math.max(5, size * 0.3);
  const bleed = Math.ceil(size * 0.8);
  const W = size + bleed * 2;
  const H = size + bleed * 2;
  const cx = W / 2;
  const boxBottom = bleed + size - wall;
  const innerRad = Math.max(2, radius - wall);

  const sceneLight = useMemo<Vec | null>(() => {
    if (!reflection || light === null) return null;
    return light
      ? { x: light.x + bleed, y: light.y + bleed }
      : defaultLight(W, H);
  }, [reflection, light, bleed, W, H]);
  const volume = resolveIntensity(intensity);
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const wellMaterial = useMemo(
    () => resolveMaterial(material, { tint: "rgba(120, 128, 150, 0.16)", color }),
    [material, color]
  );

  /* ------------------------------- motion -------------------------------- */

  const fillTarget = indeterminate ? 0.5 : state.checked ? 1 : 0;
  // One spring slot: the fill fraction.
  const springs = useMotionSprings(1, () => fillTarget, FILL_SPRING);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevTarget = useRef(fillTarget);
  useEffect(() => {
    if (prevTarget.current !== fillTarget) {
      if (animating) {
        springs.setTargets([fillTarget]);
        settlingRef.current = true;
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settlingRef.current = false;
          setSettling(false);
        }, SETTLE_MS);
      } else {
        springs.snapTo([fillTarget]);
      }
    }
    prevTarget.current = fillTarget;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillTarget, animating]);

  useEffect(() => {
    if (!animating) {
      settlingRef.current = false;
      setSettling(false);
    }
  }, [animating]);

  const buildScene = (f: number): Scene => {
    let path = "";
    const speculars: SpecularSpot[] = [];
    const poolH = Math.max(0, Math.min(1, f)) * inner;
    if (poolH > 0.5) {
      const poolCy = boxBottom - poolH / 2;
      path += roundRectPath(
        { x: cx, y: poolCy },
        inner,
        poolH,
        Math.min(innerRad, poolH / 2)
      );
      if (resolved.specular && sceneLight) {
        speculars.push(
          specularPlacement(
            { x: cx, y: poolCy, r: Math.min(inner, poolH) * 0.45 },
            sceneLight,
            volume
          )
        );
      }
    }
    return { path, speculars };
  };

  const staticScene = useMemo(
    () => buildScene(fillTarget),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fillTarget, size, resolved.specular, sceneLight, volume]
  );

  const renderer = useRef<LiquidSceneHandle>(null);
  useEffect(() => {
    if (!(animating && settlingRef.current))
      renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    renderer.current?.setScene(buildScene(springs.values[0].get()));
  });

  /* ------------------------------- render -------------------------------- */

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const wellPath = roundRectPath(
    { x: cx, y: bleed + size / 2 },
    size,
    size,
    radius
  );

  const rootStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
    ...style,
  };

  return (
    <label
      data-fluidkit="liquid-checkbox"
      data-checked={state.checked}
      data-indeterminate={indeterminate || undefined}
      data-animating={animating && settling}
      className={className}
      onPointerDown={focus.onPointerDown}
      style={rootStyle}
    >
      <span style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer path={wellPath} material={wellMaterial} shadow={shadow} />
        </span>
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer
            ref={renderer}
            path={staticScene.path}
            material={resolved}
            speculars={staticScene.speculars}
            specularSlots={resolved.specular && sceneLight ? 1 : 0}
            shadow={false}
          />
        </span>
        {focus.focusVisible && (
          <span
            aria-hidden
            data-fluidkit="liquid-checkbox-focus"
            style={focusMeniscusStyle(radius)}
          />
        )}
        <input
          ref={inputRef}
          type="checkbox"
          style={visuallyHiddenInput}
          disabled={disabled}
          checked={checked !== undefined ? checked : undefined}
          defaultChecked={checked !== undefined ? undefined : defaultChecked}
          onChange={(e) => state.handleChange(e.target.checked)}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          {...inputRest}
        />
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}
