/**
 * Surface tension for the liquid engine.
 *
 * Bridges between bodies use HYSTERESIS so liquid feels like liquid instead
 * of a graphics trick: a pair connects only when the drops actually touch
 * (the neck starts at a real minimum width — never a hairline filament),
 * stays connected while stretching, and snaps apart past the break distance
 * while the neck is still chunky. "Stretch" is center distance divided by
 * combined radii: 1.0 = just touching.
 */

import type { LiquidBody } from "./geometry";
import { bridgePath, dist } from "./geometry";

/** A fresh (unconnected) pair connects when stretch falls below this. */
export const CONNECT_STRETCH = 1.02;
/** A connected pair snaps when stretch exceeds this. */
export const SNAP_STRETCH = 1.3;
/** The neck waist never drops below this fraction of the base waist. */
export const MIN_WAIST_FACTOR = 0.6;

const BASE_WAIST = 0.55;

/** Neck waist for a connected pair at the given stretch (thins, then snaps). */
export function neckWaist(stretch: number): number {
  return (
    BASE_WAIST *
    Math.max(MIN_WAIST_FACTOR, Math.min(1, (SNAP_STRETCH - stretch) / 0.35))
  );
}

/** Tracks which pairs are currently fused. One instance per liquid scene. */
export class TensionField {
  private connected = new Set<string>();

  /** Bridge subpaths for every connected pair in `bodies`. */
  bridges(bodies: readonly LiquidBody[]): string {
    let path = "";
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const key = `${a.id}|${b.id}`;
        if (a.r <= 0.5 || b.r <= 0.5) {
          this.connected.delete(key);
          continue;
        }
        const stretch = dist(a, b) / (a.r + b.r);
        const isConnected = this.connected.has(key)
          ? stretch < SNAP_STRETCH
          : stretch < CONNECT_STRETCH;
        if (!isConnected) {
          this.connected.delete(key);
          continue;
        }
        this.connected.add(key);
        path += bridgePath(a, a.r, b, b.r, neckWaist(stretch));
      }
    }
    return path;
  }

  /** Whether any live bridge involves `id`. */
  connectedTo(id: string): boolean {
    for (const key of this.connected) {
      const [a, b] = key.split("|");
      if (a === id || b === id) return true;
    }
    return false;
  }

  /** Forget connections (all of them, or those whose key matches). */
  clear(predicate?: (key: string) => boolean): void {
    if (!predicate) {
      this.connected.clear();
      return;
    }
    for (const key of [...this.connected]) {
      if (predicate(key)) this.connected.delete(key);
    }
  }
}
