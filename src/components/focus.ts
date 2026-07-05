/**
 * The focus meniscus: fluidkit's shared focus-visible treatment for form
 * controls. Instead of the browser's rectangular outline, the surface gets
 * a liquid-shaped ring hugging its rounded geometry — a swell at the edge
 * where the surface meets the page — plus a soft outer glow.
 *
 * Focus-visibility is tracked by input modality (the heuristic behind
 * `:focus-visible`): focus arriving right after a pointer press stays
 * quiet; focus arriving any other way (keyboard, programmatic) shows the
 * ring. Never less visible than the platform default, per WCAG.
 */

import type { CSSProperties, FocusEvent } from "react";
import { useRef, useState } from "react";
import { colorWithAlpha } from "../utils/color";

/** Pointer-press → focus handoff window. */
const POINTER_FOCUS_MS = 400;

export interface FocusVisible {
  focusVisible: boolean;
  /** Spread these onto the focusable control (and onPointerDown onto its
   * activation surface, e.g. the wrapping label). */
  onPointerDown: () => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
}

export function useFocusVisible(): FocusVisible {
  const [focusVisible, setFocusVisible] = useState(false);
  const lastPointer = useRef(0);
  return {
    focusVisible,
    onPointerDown: () => {
      lastPointer.current = Date.now();
    },
    onFocus: () => {
      setFocusVisible(Date.now() - lastPointer.current > POINTER_FOCUS_MS);
    },
    onBlur: () => setFocusVisible(false),
  };
}

/** The ring itself, sized to hug a rounded-rect surface of `radius`. */
export function focusMeniscusStyle(
  radius: number,
  tint = "rgba(96, 156, 220, 0.55)"
): CSSProperties {
  return {
    position: "absolute",
    inset: -3,
    borderRadius: radius + 3,
    boxShadow: `0 0 0 2px ${tint}, 0 0 8px 2px ${colorWithAlpha(tint, 0.25)}`,
    pointerEvents: "none",
  };
}
