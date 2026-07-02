/**
 * Headless press-squash primitive: a volume-preserving jelly deformation
 * driven by pointer/keyboard press state. Press widens the element on X and
 * flattens it on Y (X · Y ≈ 1, so it never looks like it's gaining or losing
 * mass); release springs both scales back to 1, and the spring's natural
 * overshoot supplies the jiggle — no separate "bounce" animation needed.
 *
 * The hook renders nothing and owns no DOM node; it hands back Motion
 * values for `scaleX`/`scaleY` (usable directly in a `motion.div`'s `style`)
 * plus the handlers that drive them, so any element — engine or plain CSS —
 * can opt in.
 *
 * Keyboard support mirrors pointer support: Space/Enter `keydown` presses
 * (ignoring OS key-repeat via `event.repeat`), matching `keyup` releases,
 * so keyboard users get the same feedback as pointer users. `onBlur` also
 * releases, so a press can't get stuck when focus leaves mid-hold (Enter
 * opening a modal, Alt-Tab while holding Space) — the keyboard counterpart
 * to pointer cancel/leave.
 *
 * Under `prefers-reduced-motion`, pressing is inert: `pressed` never flips
 * and the scales stay pinned at 1, same calm-by-default posture as
 * `useRipple`. Release is never guarded — if the preference flips on
 * mid-press, release still snaps the scales back to 1 instead of leaving
 * the element frozen squished.
 */

import {
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { MotionValue } from "motion/react";
import { usePrefersReducedMotion } from "../utils";
import { useMotionSprings, type SpringConfig } from "../liquid/useMotionSprings";

/** Fractional squash: press scales X by `1 + intensity`, Y by its inverse. */
const DEFAULT_INTENSITY = 0.12;

/** Snappy but soft enough to overshoot slightly on release — that overshoot
 * is the entire "jiggle", so it's tuned deliberately rather than left at a
 * generic default. */
const DEFAULT_SPRING: SpringConfig = { stiffness: 500, damping: 20 };

/** The only keys that count as "activate" for a press-and-hold gesture. */
const ACTIVATION_KEYS = new Set([" ", "Enter"]);

export interface UseSquishOptions {
  /** Fractional squash at full press. Defaults to `0.12`. Changes apply from
   * the next press (per-render closures), while `spring` is applied per-call. */
  intensity?: number;
  /** Overrides the default press/release spring. */
  spring?: SpringConfig;
}

export interface UseSquishHandlers {
  /** Spread onto the target element to trigger the press deformation. */
  onPointerDown: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  /** Presses on Space/Enter, ignoring OS key-repeat. */
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
  /** Releases on focus loss so a keyboard press can't get stuck mid-hold. */
  onBlur: (e: FocusEvent) => void;
}

export interface UseSquishStyle {
  /** Feed straight into a `motion.div`'s `style.scaleX`. */
  scaleX: MotionValue<number>;
  /** Feed straight into a `motion.div`'s `style.scaleY`. */
  scaleY: MotionValue<number>;
}

export interface UseSquishResult {
  /** Spread onto the target element. */
  handlers: UseSquishHandlers;
  /** Motion values for `scaleX`/`scaleY`, usable directly as `motion.div` style. */
  style: UseSquishStyle;
  /** Whether the element is currently pressed. */
  pressed: boolean;
}

export function useSquish({
  intensity = DEFAULT_INTENSITY,
  spring = DEFAULT_SPRING,
}: UseSquishOptions = {}): UseSquishResult {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pressed, setPressed] = useState(false);
  const scales = useMotionSprings(2, () => 1, spring);

  function press() {
    if (prefersReducedMotion) return;
    setPressed(true);
    // `spring` rides along per-call (useMotionSprings memoizes its initial
    // config on slot count, so the override is what keeps it live).
    scales.setTargets([1 + intensity, 1 / (1 + intensity)], spring);
  }

  function release() {
    // Never guarded: if reduced motion flips on mid-press, the element must
    // still return to 1 rather than stay frozen squished.
    setPressed(false);
    if (prefersReducedMotion) {
      scales.snapTo([1, 1]);
    } else {
      scales.setTargets([1, 1], spring);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat || !ACTIVATION_KEYS.has(e.key)) return;
    press();
  }

  function onKeyUp(e: KeyboardEvent) {
    if (!ACTIVATION_KEYS.has(e.key)) return;
    release();
  }

  return {
    handlers: {
      onPointerDown: press,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      onKeyDown,
      onKeyUp,
      onBlur: release,
    },
    style: { scaleX: scales.values[0], scaleY: scales.values[1] },
    pressed,
  };
}
