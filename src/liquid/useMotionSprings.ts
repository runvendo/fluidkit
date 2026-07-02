/**
 * A dynamic-count array of spring-animated Motion values.
 *
 * Motion (the peer dependency) drives all spring physics — we never ship a
 * second integrator. Hook-per-value doesn't work when the count is a prop,
 * so values are created imperatively via `motionValue()` and animated with
 * `animate(value, target, { type: "spring", ... })`. `snapTo` is the
 * reduced-motion/instant path.
 *
 * `config` may be a per-slot resolver (index → SpringConfig) so grouped
 * slots (e.g. a morph body vs. its satellites) get their own tuning; the
 * `override` passed to `setTargets` still wins for every slot when given.
 */

import { useEffect, useMemo, useRef } from "react";
import type { MotionValue } from "motion/react";
import { animate, motionValue } from "motion/react";

type PlaybackControls = ReturnType<typeof animate>;

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

/** One config for every slot, or a resolver giving each slot its own. */
export type SpringConfigResolver =
  | SpringConfig
  | ((index: number) => SpringConfig);

export interface MotionSprings {
  values: MotionValue<number>[];
  setTargets(targets: readonly number[], config?: SpringConfig): void;
  /** Retarget ONE slot, leaving the other slots' animations running. */
  setTarget(index: number, target: number, config?: SpringConfig): void;
  snapTo(targets: readonly number[]): void;
}

export function useMotionSprings(
  count: number,
  init: (index: number) => number,
  config: SpringConfigResolver
): MotionSprings {
  const animations = useRef<PlaybackControls[]>([]);
  const springs = useMemo<MotionSprings>(() => {
    const resolve = typeof config === "function" ? config : () => config;
    const values = Array.from({ length: count }, (_, i) => motionValue(init(i)));
    return {
      values,
      setTargets(targets, override) {
        animations.current.forEach((a) => a.stop());
        animations.current = targets.map((target, i) =>
          animate(values[i], target, {
            type: "spring",
            ...(override ?? resolve(i)),
          })
        );
      },
      setTarget(index, target, override) {
        animations.current[index]?.stop();
        animations.current[index] = animate(values[index], target, {
          type: "spring",
          ...(override ?? resolve(index)),
        });
      },
      snapTo(targets) {
        animations.current.forEach((a) => a.stop());
        animations.current = [];
        targets.forEach((target, i) => values[i].set(target));
      },
    };
    // Recreate only when the slot count changes; init/config are captured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    return () => animations.current.forEach((a) => a.stop());
  }, [springs]);

  return springs;
}
