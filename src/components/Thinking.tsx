/**
 * Organic "working" indicator: three liquid droplets merging and splitting
 * on the engine's surface-tension cycle. A preset over `Droplets` with a
 * status role for assistive tech. Replaces the goo-based ThinkingBlob.
 */

import { Droplets } from "./Droplets";
import type { DropletsProps } from "./Droplets";

export interface ThinkingProps
  extends Omit<DropletsProps, "count" | "followPointer"> {
  /** Accessible label announced to screen readers. */
  label?: string;
}

export function Thinking({
  label = "Thinking",
  size = 18,
  spread = 44,
  speed = 1.2,
  material = "glass",
  ...rest
}: ThinkingProps) {
  return (
    <Droplets
      role="status"
      aria-label={label}
      count={3}
      size={size}
      spread={spread}
      speed={speed}
      material={material}
      {...rest}
    />
  );
}
