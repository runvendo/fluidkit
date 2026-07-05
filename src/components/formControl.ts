/**
 * Shared plumbing for the form-control family (Switch, Checkbox, Slider,
 * Field): the visually-hidden native input recipe and the controlled/
 * uncontrolled checked-state pattern. The native input stays fully
 * interactive — keyboard, screen readers, form submission, and label
 * association are the browser's job; fluidkit only paints.
 */

import type { CSSProperties } from "react";
import { useState } from "react";

/** Covers the visual footprint invisibly; stays focusable and clickable. */
export const visuallyHiddenInput: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  margin: 0,
  cursor: "inherit",
};

export interface CheckedState {
  /** The current state, whichever side owns it. */
  checked: boolean;
  /** Wire to the native input's onChange. */
  handleChange: (next: boolean) => void;
}

/** Controlled (`checked`) / uncontrolled (`defaultChecked`) resolution,
 * exactly like a native React input. */
export function useCheckedState(
  controlled: boolean | undefined,
  defaultChecked: boolean | undefined,
  onCheckedChange?: (checked: boolean) => void
): CheckedState {
  const isControlled = controlled !== undefined;
  const [internal, setInternal] = useState(defaultChecked ?? false);
  return {
    checked: isControlled ? controlled : internal,
    handleChange: (next) => {
      if (!isControlled) setInternal(next);
      onCheckedChange?.(next);
    },
  };
}
