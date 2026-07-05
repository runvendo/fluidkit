/**
 * A toggle whose thumb is a DROPLET: on flip it stretches toward the far
 * well, the neck tears (leaving a satellite at the pinch-off, the Droplets
 * recipe), and it settles into the far seat with a wobble. The wells hold
 * no visible resting liquid — a transit bead materializes under the thumb
 * as it departs and the residue drains away after the tear. The track fill
 * tints on the on side, so state is carried by position AND color.
 *
 * A real (visually hidden) `<input type="checkbox" role="switch">` powers
 * it: keyboard, screen readers, form submission, and label association are
 * the browser's job. Controlled (`checked` + `onCheckedChange`) and
 * uncontrolled (`defaultChecked`) both work, like a native React input.
 * Keyboard focus shows the shared focus meniscus, not a browser outline.
 *
 * Reduced motion: the thumb snaps between seats (no bridge, no satellite);
 * the tint still flips so state never depends on motion.
 */

import type { InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  dist,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { LiquidBody, LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { CONNECT_STRETCH, SNAP_STRETCH } from "../liquid/tension";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { focusMeniscusStyle, useFocusVisible } from "./focus";
import { useCheckedState, visuallyHiddenInput } from "./formControl";
import type { SurfaceStyleProps } from "./surface";

export interface LiquidSwitchProps
  extends Omit<SurfaceStyleProps, "refraction">,
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
  /** Label text, rendered beside the track and natively associated. */
  label?: ReactNode;
  /** Thumb diameter in px. Defaults to `24`. */
  size?: number;
  /** Track tint while on. Defaults to a quiet green. */
  checkedTint?: string;
  /**
   * How loudly the material reads. Defaults to `"present"` — a documented
   * divergence from the pack's usual `"whisper"`: the thumb is a droplet
   * and carries Droplets' specular brightness.
   */
  intensity?: LiquidIntensity;
}

/* Approved prototype values (plan: 2026-07-04 review gate). */
const TRAVEL_SPRING = { stiffness: 210, damping: 16 };
const BEAD_RATIO = 0.32;
const SAT_R_FACTOR = 0.28;
const SAT_LIFE_MS = 420;
/** Transit-bead drain ease after the tear. */
const DRAIN_TAU_MS = 90;
const SETTLE_MS = 900;
const DEFAULT_CHECKED_TINT = "rgba(64, 180, 120, 0.42)";

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

export function LiquidSwitch({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  size = 24,
  checkedTint = DEFAULT_CHECKED_TINT,
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
}: LiquidSwitchProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animating = !prefersReducedMotion;

  const state = useCheckedState(checked, defaultChecked, onCheckedChange);
  const on = state.checked;

  const focus = useFocusVisible();

  /* ------------------------------ geometry ------------------------------ */

  const thumbR = size / 2;
  const pad = Math.max(3, size * 0.12);
  const trackH = size + pad * 2;
  const trackW = size * 2.4 + pad * 2;
  const bleed = Math.ceil(size * 0.6);
  const W = trackW + bleed * 2;
  const H = trackH + bleed * 2;
  const cy = H / 2;
  const seatL = bleed + trackH / 2;
  const seatR = bleed + trackW - trackH / 2;
  const beadR = thumbR * BEAD_RATIO;

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
  // The track stays neutral on BOTH materials — passing the consumer color
  // through made the thumb invisible against its own track in flat.
  const trackMaterial = useMemo(
    () =>
      resolveMaterial(material, {
        tint: "rgba(120, 128, 150, 0.16)",
        color: "rgba(120, 128, 150, 0.16)",
      }),
    [material]
  );

  /* ------------------------------- motion -------------------------------- */

  const x = useMotionSprings(1, () => (on ? seatR : seatL), TRAVEL_SPRING);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transit beads: invisible at rest; the departing seat's bead snaps to
  // full size under the leaving thumb, then drains once the neck tears.
  const beadRs = useRef({ L: 0, R: 0 });
  const beadTargets = useRef({ L: 0, R: 0 });

  const prevOn = useRef(on);
  useEffect(() => {
    if (prevOn.current !== on) {
      if (animating) {
        const departing = on ? "L" : "R";
        beadRs.current[departing] = beadR;
        beadTargets.current[departing] = beadR;
        x.setTargets([on ? seatR : seatL]);
        settlingRef.current = true;
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          settlingRef.current = false;
          setSettling(false);
        }, SETTLE_MS);
      } else {
        beadRs.current = { L: 0, R: 0 };
        beadTargets.current = { L: 0, R: 0 };
        x.snapTo([on ? seatR : seatL]);
      }
    }
    prevOn.current = on;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, animating]);

  useEffect(() => {
    if (!animating) {
      settlingRef.current = false;
      setSettling(false);
    }
  }, [animating]);

  const tension = useRef(new TensionField());
  const bonds = useRef(new Set<string>());
  const sats = useRef<{ x: number; y: number; r0: number; age: number }[]>([]);
  const renderer = useRef<LiquidSceneHandle>(null);
  const tintRef = useRef<HTMLSpanElement>(null);

  const buildFrame = (tx: number, delta: number): Scene => {
    const ease = 1 - Math.exp(-delta / DRAIN_TAU_MS);
    beadRs.current.L += (beadTargets.current.L - beadRs.current.L) * ease;
    beadRs.current.R += (beadTargets.current.R - beadRs.current.R) * ease;
    const bodies: LiquidBody[] = [
      { id: "L", x: seatL, y: cy, r: beadRs.current.L },
      { id: "R", x: seatR, y: cy, r: beadRs.current.R },
      { id: "T", x: tx, y: cy, r: thumbR },
    ];

    // Mirror the engine's pair hysteresis: the frame a bond breaks is the
    // tear — leave a satellite at the pinch-off and drain the residue.
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const key = `${a.id}|${b.id}`;
        if (a.r <= 0.5 || b.r <= 0.5) {
          bonds.current.delete(key);
          continue;
        }
        const d = dist(a, b);
        const stretch = d / (a.r + b.r);
        const was = bonds.current.has(key);
        if (was ? stretch < SNAP_STRETCH : stretch < CONNECT_STRETCH) {
          bonds.current.add(key);
        } else {
          if (was) {
            const t = (a.r + (d - a.r - b.r) / 2) / d;
            sats.current.push({
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
              r0: Math.min(a.r, b.r) * SAT_R_FACTOR,
              age: 0,
            });
            if (key.includes("T")) {
              beadTargets.current.L = 0;
              beadTargets.current.R = 0;
            }
          }
          bonds.current.delete(key);
        }
      }
    }

    let satPath = "";
    sats.current = sats.current.filter((s) => {
      s.age += delta;
      const life = 1 - s.age / SAT_LIFE_MS;
      if (life <= 0) return false;
      satPath += circlePath(s, s.r0 * life ** 1.4);
      return true;
    });

    const path =
      bodies.map((b) => circlePath(b, b.r)).join("") +
      tension.current.bridges(bodies) +
      satPath;
    const speculars =
      resolved.specular && sceneLight
        ? bodies
            .filter((b) => b.r > 0.5)
            .map((b) => specularPlacement(b, sceneLight, volume))
        : [];
    return { path, speculars };
  };

  const thumbSceneAt = (tx: number): Scene => {
    const thumb = { x: tx, y: cy, r: thumbR };
    return {
      path: circlePath(thumb, thumb.r),
      speculars:
        resolved.specular && sceneLight
          ? [specularPlacement(thumb, sceneLight, volume)]
          : [],
    };
  };
  const staticScene = useMemo<Scene>(
    () => thumbSceneAt(on ? seatR : seatL),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [on, seatR, seatL, cy, thumbR, resolved.specular, sceneLight, volume]
  );

  useEffect(() => {
    if (!(animating && settlingRef.current)) {
      renderer.current?.setScene(staticScene);
      if (tintRef.current) tintRef.current.style.opacity = on ? "1" : "0";
    }
  }, [animating, settling, staticScene, on]);

  useAnimationFrame((_, delta) => {
    if (!animating || !settling) return;
    const tx = x.values[0].get();
    renderer.current?.setScene(buildFrame(tx, delta));
    if (tintRef.current) {
      const progress = (tx - seatL) / (seatR - seatL);
      tintRef.current.style.opacity = String(Math.max(0, Math.min(1, progress)));
    }
  });

  /* ------------------------------- render -------------------------------- */

  const trackPath = roundRectPath(
    { x: bleed + trackW / 2, y: cy },
    trackW,
    trackH,
    trackH / 2
  );

  // Mid-travel (incl. the flip commit, where `settling` hasn't landed yet)
  // the declarative scene must be the CURRENT spring frame — the target
  // would paint the far seat one frame early (the LiquidPanel rule).
  const midTravel = animating && (settling || prevOn.current !== on);
  const renderScene = midTravel
    ? thumbSceneAt(x.values[0].get())
    : staticScene;

  return (
    <label
      data-fluidkit="liquid-switch"
      data-checked={on}
      data-animating={animating && settling}
      className={className}
      onPointerDown={focus.onPointerDown}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          width: trackW,
          height: trackH,
          flex: "none",
        }}
      >
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer path={trackPath} material={trackMaterial} shadow={shadow} />
        </span>
        <span
          ref={tintRef}
          aria-hidden
          data-fluidkit="liquid-switch-tint"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: trackH / 2,
            background: checkedTint,
            opacity: on ? 1 : 0,
            pointerEvents: "none",
          }}
        />
        <span aria-hidden style={{ position: "absolute", inset: -bleed }}>
          <LiquidRenderer
            ref={renderer}
            path={renderScene.path}
            material={resolved}
            speculars={renderScene.speculars}
            specularSlots={resolved.specular && sceneLight ? 3 : 0}
            shadow={shadow}
          />
        </span>
        {focus.focusVisible && (
          <span
            aria-hidden
            data-fluidkit="liquid-switch-focus"
            style={focusMeniscusStyle(trackH / 2)}
          />
        )}
        <input
          type="checkbox"
          role="switch"
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
