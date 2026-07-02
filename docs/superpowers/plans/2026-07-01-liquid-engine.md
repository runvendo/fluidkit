# Liquid Engine + Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild fluidkit's core on a liquid engine (metaball geometry + surface-tension hysteresis + a shared light source) with swappable materials (glass / mercury / flat), replacing the goo-filter primitives.

**Architecture:** Pure geometry/tension/specular/material modules under `src/liquid/` (fully unit-testable), one internal presentational renderer (`LiquidRenderer`), and three public components built on it: `Droplets`, `Thinking`, and a rewritten `MorphSurface`. Old goo components (`Metaballs`, `ThinkingBlob`, `LiquidGlass`) and the `useMorph` hook are deleted; the goo filter infra stays internal-only because `LiquidTabs` still uses it (moves off in v0.3).

**Tech Stack:** TypeScript, React 18+, `motion/react` (springs via imperative `animate()` on `motionValue`s), Vitest + Testing Library, tsup. Spec: `docs/superpowers/specs/2026-07-01-liquid-engine-design.md`.

**Conventions to follow (from existing code):**
- File-top JSDoc comment explaining the module (see `src/components/Metaballs.tsx`).
- No `Math.random()` / no window access at import time. Feature detectors are functions.
- Reduced motion via `usePrefersReducedMotion()` (static-safe default), off-screen via `useInView()`.
- Components spread `...rest` onto the root div, merge `className`/`style`, set `data-fluidkit` and `data-animating` attributes.
- Tests mock `motion/react`'s `useReducedMotion` via `vi.doMock` + `vi.resetModules` (see `tests/components/Metaballs.test.tsx` for the exact pattern).

**Hard rendering constraints (from spec — violating any of these reintroduces visible bugs):**
1. `clip-path` and `backdrop-filter` must never sit on the same element → clip on a wrapper div, material fill on a child.
2. No CSS `blur()` for glows/highlights → radial gradients only.
3. Inline `<svg>` overlays need explicit `width="100%" height="100%"` (intrinsic 300x150 clips silently).
4. Glass must not backdrop-sample its own shadow → shadow layer is light (rgba ~.16), offset down, slightly shrunk.
5. Content (text) never scales — it lives on an unclipped sibling overlay and only cross-fades.

---

### Task 1: Liquid geometry (`circlePath`, `roundRectPath`, `bridgePath`)

**Files:**
- Create: `src/liquid/geometry.ts`
- Test: `tests/liquid/geometry.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/liquid/geometry.test.ts
import { describe, expect, it } from "vitest";
import {
  bridgePath,
  circlePath,
  dist,
  roundRectPath,
} from "../../src/liquid/geometry";

describe("dist", () => {
  it("returns the euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("circlePath", () => {
  it("emits a closed two-arc subpath through the horizontal extremes", () => {
    const p = circlePath({ x: 10, y: 20 }, 5);
    expect(p.startsWith("M 15.0 20.0")).toBe(true); // cx + r
    expect(p).toContain("A 5.0 5.0");
    expect(p).toContain("5.0 20.0"); // cx - r
    expect(p.trimEnd().endsWith("Z")).toBe(true);
  });

  it("returns an empty string for a degenerate radius", () => {
    expect(circlePath({ x: 0, y: 0 }, 0.4)).toBe("");
  });
});

describe("roundRectPath", () => {
  it("emits a closed subpath and clamps the corner radius to half the size", () => {
    const p = roundRectPath({ x: 50, y: 50 }, 100, 40, 999);
    // radius clamps to h/2 = 20; the first corner arc reflects that
    expect(p).toContain("A 20.0 20.0");
    expect(p.trimEnd().endsWith("Z")).toBe(true);
  });
});

describe("bridgePath", () => {
  const a = { x: 0, y: 0 };

  it("returns a closed bezier subpath when circles are near", () => {
    const p = bridgePath(a, 20, { x: 45, y: 0 }, 20, 0.5);
    expect(p.startsWith("M ")).toBe(true);
    expect(p).toContain("C ");
    expect(p.trimEnd().endsWith("Z")).toBe(true);
  });

  it("returns empty when the circles are beyond reach", () => {
    // reach default 1.6 → maxD = (20+20)*1.6 = 64
    expect(bridgePath(a, 20, { x: 100, y: 0 }, 20, 0.5)).toBe("");
  });

  it("returns empty when one circle contains the other", () => {
    expect(bridgePath(a, 30, { x: 2, y: 0 }, 5, 0.5)).toBe("");
  });

  it("returns empty for degenerate radii", () => {
    expect(bridgePath(a, 0.2, { x: 10, y: 0 }, 10, 0.5)).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liquid/geometry.test.ts`
Expected: FAIL — cannot resolve `../../src/liquid/geometry`.

- [ ] **Step 3: Implement the geometry module**

```ts
// src/liquid/geometry.ts
/**
 * Pure metaball geometry for the liquid engine.
 *
 * Shapes are emitted as SVG path-data SUBPATHS (each ends with `Z `) so
 * callers can concatenate circles, rounded rects, and bridge curves into one
 * string and hand it to `clip-path: path(...)`, which unions overlapping
 * subpaths under the nonzero fill rule. The bridge is the classic two-circle
 * metaball construction (Hiroyuki Sato / paper.js form): tangent points on
 * each circle joined by two bezier curves whose handles create the liquid
 * "neck".
 */

export interface Vec {
  x: number;
  y: number;
}

/** A circle participating in the liquid simulation. */
export interface LiquidBody extends Vec {
  /** Stable identity — pairs of ids key the tension hysteresis state. */
  id: string;
  r: number;
}

const fmt = (n: number): string => n.toFixed(1);

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a: Vec, b: Vec): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function vecAt(p: Vec, angle: number, r: number): Vec {
  return { x: p.x + r * Math.cos(angle), y: p.y + r * Math.sin(angle) };
}

/** Closed circular subpath (two arcs). Empty for sub-pixel radii. */
export function circlePath(center: Vec, r: number): string {
  if (r <= 0.5) return "";
  return (
    `M ${fmt(center.x + r)} ${fmt(center.y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(center.x - r)} ${fmt(center.y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(center.x + r)} ${fmt(center.y)} Z `
  );
}

/** Closed rounded-rectangle subpath centered on `center`. */
export function roundRectPath(
  center: Vec,
  width: number,
  height: number,
  radius: number
): string {
  const r = Math.min(radius, width / 2, height / 2);
  const x = center.x - width / 2;
  const y = center.y - height / 2;
  return (
    `M ${fmt(x + r)} ${fmt(y)} L ${fmt(x + width - r)} ${fmt(y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + width)} ${fmt(y + r)} ` +
    `L ${fmt(x + width)} ${fmt(y + height - r)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + width - r)} ${fmt(y + height)} ` +
    `L ${fmt(x + r)} ${fmt(y + height)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + height - r)} ` +
    `L ${fmt(x)} ${fmt(y + r)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + r)} ${fmt(y)} Z `
  );
}

/**
 * Metaball bridge between two circles. `waist` (0..~1) controls neck width.
 * Returns "" when out of reach, contained, or degenerate.
 */
export function bridgePath(
  c1: Vec,
  r1: number,
  c2: Vec,
  r2: number,
  waist: number,
  handle = 2.1,
  reach = 1.6
): string {
  if (r1 <= 0.5 || r2 <= 0.5) return "";
  const d = dist(c1, c2);
  const maxD = (r1 + r2) * reach;
  if (d > maxD || d <= Math.abs(r1 - r2) + 0.5) return "";

  let u1 = 0;
  let u2 = 0;
  if (d < r1 + r2) {
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d));
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d));
  }

  const ang = angleBetween(c1, c2);
  const maxSpread = Math.acos((r1 - r2) / d);
  const a1 = ang + u1 + (maxSpread - u1) * waist;
  const a2 = ang - u1 - (maxSpread - u1) * waist;
  const a3 = ang + Math.PI - u2 - (Math.PI - u2 - maxSpread) * waist;
  const a4 = ang - Math.PI + u2 + (Math.PI - u2 - maxSpread) * waist;

  const p1 = vecAt(c1, a1, r1);
  const p2 = vecAt(c1, a2, r1);
  const p3 = vecAt(c2, a3, r2);
  const p4 = vecAt(c2, a4, r2);

  const totalR = r1 + r2;
  const d2 =
    Math.min(waist * handle, dist(p1, p3) / totalR) *
    Math.min(1, (d * 2) / totalR);
  const hr1 = r1 * d2;
  const hr2 = r2 * d2;

  const h1 = vecAt(p1, a1 - Math.PI / 2, hr1);
  const h2 = vecAt(p2, a2 + Math.PI / 2, hr1);
  const h3 = vecAt(p3, a3 + Math.PI / 2, hr2);
  const h4 = vecAt(p4, a4 - Math.PI / 2, hr2);

  return (
    `M ${fmt(p1.x)} ${fmt(p1.y)} ` +
    `C ${fmt(h1.x)} ${fmt(h1.y)} ${fmt(h3.x)} ${fmt(h3.y)} ${fmt(p3.x)} ${fmt(p3.y)} ` +
    `L ${fmt(p4.x)} ${fmt(p4.y)} ` +
    `C ${fmt(h4.x)} ${fmt(h4.y)} ${fmt(h2.x)} ${fmt(h2.y)} ${fmt(p2.x)} ${fmt(p2.y)} Z `
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liquid/geometry.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/liquid/geometry.ts tests/liquid/geometry.test.ts
git commit -m "feat(liquid): metaball geometry (circle, roundrect, bridge subpaths)"
```

---

### Task 2: Surface tension with hysteresis (`TensionField`)

**Files:**
- Create: `src/liquid/tension.ts`
- Test: `tests/liquid/tension.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/liquid/tension.test.ts
import { describe, expect, it } from "vitest";
import type { LiquidBody } from "../../src/liquid/geometry";
import {
  CONNECT_STRETCH,
  MIN_WAIST_FACTOR,
  SNAP_STRETCH,
  TensionField,
  neckWaist,
} from "../../src/liquid/tension";

/** Two equal drops (r=20 each, combined 40) at a given center distance. */
function pair(d: number): LiquidBody[] {
  return [
    { id: "a", x: 0, y: 0, r: 20 },
    { id: "b", x: d, y: 0, r: 20 },
  ];
}

describe("neckWaist", () => {
  it("is full-width when drops overlap deeply", () => {
    expect(neckWaist(0.8)).toBeCloseTo(0.55);
  });

  it("never drops below the minimum waist factor", () => {
    expect(neckWaist(SNAP_STRETCH)).toBeCloseTo(0.55 * MIN_WAIST_FACTOR);
    expect(neckWaist(99)).toBeCloseTo(0.55 * MIN_WAIST_FACTOR);
  });
});

describe("TensionField", () => {
  it("does NOT bridge drops that approach without touching", () => {
    const field = new TensionField();
    // stretch 1.1 > CONNECT_STRETCH — close, but not touching
    expect(field.bridges(pair(40 * 1.1))).toBe("");
  });

  it("bridges on touch and keeps the bridge while stretching (hysteresis)", () => {
    const field = new TensionField();
    expect(field.bridges(pair(40 * 1.0))).not.toBe(""); // touch → connect
    // same distance that produced NO bridge pre-touch now stays bridged
    expect(field.bridges(pair(40 * 1.1))).not.toBe("");
    expect(field.bridges(pair(40 * (SNAP_STRETCH - 0.01)))).not.toBe("");
  });

  it("snaps the bridge past the break distance and requires touch to reconnect", () => {
    const field = new TensionField();
    field.bridges(pair(40 * 1.0)); // connect
    expect(field.bridges(pair(40 * (SNAP_STRETCH + 0.05)))).toBe(""); // snap
    expect(field.bridges(pair(40 * 1.1))).toBe(""); // approaching again: no bridge
    expect(field.bridges(pair(40 * (CONNECT_STRETCH - 0.01)))).not.toBe("");
  });

  it("drops state for bodies removed via clear(predicate)", () => {
    const field = new TensionField();
    field.bridges(pair(40)); // connect a|b
    field.clear((key) => key.includes("b"));
    expect(field.bridges(pair(40 * 1.1))).toBe(""); // must touch again
  });

  it("ignores degenerate bodies", () => {
    const field = new TensionField();
    const bodies: LiquidBody[] = [
      { id: "a", x: 0, y: 0, r: 20 },
      { id: "b", x: 10, y: 0, r: 0.2 },
    ];
    expect(field.bridges(bodies)).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liquid/tension.test.ts`
Expected: FAIL — cannot resolve `../../src/liquid/tension`.

- [ ] **Step 3: Implement the tension module**

```ts
// src/liquid/tension.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liquid/tension.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/liquid/tension.ts tests/liquid/tension.test.ts
git commit -m "feat(liquid): surface tension bridges with touch-connect/snap-on-stretch hysteresis"
```

---

### Task 3: Shared-light specular placement

**Files:**
- Create: `src/liquid/specular.ts`
- Test: `tests/liquid/specular.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/liquid/specular.test.ts
import { describe, expect, it } from "vitest";
import { defaultLight, specularPlacement } from "../../src/liquid/specular";

describe("specularPlacement", () => {
  it("places the highlight on the side of the drop FACING the light", () => {
    const drop = { x: 100, y: 100, r: 20 };
    const above = specularPlacement(drop, { x: 100, y: 0 });
    expect(above.cy).toBeLessThan(drop.y);
    expect(above.cx).toBeCloseTo(drop.x, 0);

    const toTheRight = specularPlacement(drop, { x: 300, y: 100 });
    expect(toTheRight.cx).toBeGreaterThan(drop.x);
    expect(toTheRight.cy).toBeCloseTo(drop.y, 0);
  });

  it("keeps the highlight inside the drop", () => {
    const drop = { x: 0, y: 0, r: 20 };
    const spot = specularPlacement(drop, { x: 0, y: -500 });
    expect(Math.hypot(spot.cx, spot.cy)).toBeLessThan(drop.r);
  });

  it("orients the ellipse tangent to the surface (light angle + 90deg)", () => {
    const drop = { x: 0, y: 0, r: 20 };
    const spot = specularPlacement(drop, { x: 0, y: -100 }); // light straight up
    // atan2(-100, 0) = -90deg → rotate = 0 (major axis horizontal)
    expect(spot.rotate).toBeCloseTo(0, 0);
  });

  it("scales the ellipse with the drop radius", () => {
    const small = specularPlacement({ x: 0, y: 0, r: 10 }, { x: 0, y: -100 });
    const big = specularPlacement({ x: 0, y: 0, r: 40 }, { x: 0, y: -100 });
    expect(big.rx).toBeCloseTo(small.rx * 4);
  });
});

describe("defaultLight", () => {
  it("sits above the scene, 30% from the left", () => {
    expect(defaultLight(400, 300)).toEqual({ x: 120, y: -40 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liquid/specular.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the specular module**

```ts
// src/liquid/specular.ts
/**
 * Specular highlight placement for glass bodies.
 *
 * All highlights in a scene come from ONE light source so reflections agree
 * on where the light is: each body's highlight sits on the side facing the
 * light, oriented tangent to the surface at that point. Soft falloff comes
 * from a radial-gradient fill (never a CSS blur filter — Chromium clips
 * blur's rectangular filter region into visible straight seams).
 */

import type { Vec } from "./geometry";

export interface SpecularSpot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Degrees. Major axis runs tangent to the surface. */
  rotate: number;
  opacity: number;
}

/** Default scene light: above the stage, 30% in from the left. */
export function defaultLight(width: number, _height: number): Vec {
  return { x: width * 0.3, y: -40 };
}

export function specularPlacement(
  body: Vec & { r: number },
  light: Vec,
  opacity = 0.7
): SpecularSpot {
  const angle = Math.atan2(light.y - body.y, light.x - body.x);
  return {
    cx: body.x + Math.cos(angle) * body.r * 0.52,
    cy: body.y + Math.sin(angle) * body.r * 0.52,
    rx: body.r * 0.42,
    ry: body.r * 0.2,
    rotate: (angle * 180) / Math.PI + 90,
    opacity,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liquid/specular.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/liquid/specular.ts tests/liquid/specular.test.ts
git commit -m "feat(liquid): shared-light specular placement"
```

---

### Task 4: Materials (`glass` / `mercury` / `flat`)

**Files:**
- Create: `src/liquid/materials.ts`
- Test: `tests/liquid/materials.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/liquid/materials.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadWithBackdropSupport(supported: boolean) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", () => ({
    supportsBackdropFilter: () => supported,
  }));
  return import("../../src/liquid/materials");
}

afterEach(() => {
  vi.doUnmock("../../src/utils/featureDetect");
  vi.resetModules();
});

describe("resolveMaterial", () => {
  it("glass: backdrop blur + saturation, tinted, with specular", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass");
    expect(m.kind).toBe("glass");
    expect(m.specular).toBe(true);
    expect(String(m.fillStyle.backdropFilter)).toContain("blur");
    expect(String(m.fillStyle.backdropFilter)).toContain("saturate");
    expect(m.fillStyle.background).toBe("rgba(255,255,255,0.3)");
  });

  it("glass: honors a custom tint", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("glass", { tint: "rgba(200,220,255,0.4)" });
    expect(m.fillStyle.background).toBe("rgba(200,220,255,0.4)");
  });

  it("glass: degrades to a frosted flat fill without backdrop-filter support", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(false);
    const m = resolveMaterial("glass");
    expect(m.kind).toBe("flat");
    expect(m.fillStyle.backdropFilter).toBeUndefined();
    expect(m.specular).toBe(true); // still lit — it is still "glass" to the user
  });

  it("mercury: gradient fill, NO specular", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    const m = resolveMaterial("mercury");
    expect(m.specular).toBe(false);
    expect(String(m.fillStyle.background)).toContain("linear-gradient");
  });

  it("flat: plain color fill, no specular, defaults to currentColor", async () => {
    const { resolveMaterial } = await loadWithBackdropSupport(true);
    expect(resolveMaterial("flat").fillStyle.background).toBe("currentColor");
    expect(resolveMaterial("flat", { color: "#abc" }).fillStyle.background).toBe(
      "#abc"
    );
    expect(resolveMaterial("flat").specular).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liquid/materials.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the materials module**

```ts
// src/liquid/materials.ts
/**
 * Liquid materials. A material is a PROP, not a component family: the same
 * engine shape renders as clear glass, mercury, or a flat fill.
 *
 * - glass: white tint + backdrop blur/saturation, lit by the scene light.
 *   Degrades to a frosted flat fill when backdrop-filter is unsupported.
 * - mercury: metallic gradient. No painted highlight — the gradient IS the
 *   reflection.
 * - flat: plain color; also the reduced/fallback rendering.
 */

import type { CSSProperties } from "react";
import { supportsBackdropFilter } from "../utils/featureDetect";

export type LiquidMaterial = "glass" | "mercury" | "flat";

export interface ResolveMaterialOptions {
  /** Glass tint (any CSS color, normally translucent white). */
  tint?: string;
  /** Fill for the `flat` material. */
  color?: string;
}

export interface ResolvedMaterial {
  /** What actually renders (glass may degrade to flat). */
  kind: LiquidMaterial;
  fillStyle: CSSProperties;
  /** Whether specular highlights should be painted. */
  specular: boolean;
}

const GLASS_TINT = "rgba(255,255,255,0.3)";
const GLASS_BACKDROP = "blur(16px) saturate(1.8)";
const GLASS_FALLBACK_FILL = "rgba(255,255,255,0.65)";
export const MERCURY_GRADIENT =
  "linear-gradient(150deg, #fdfdfe 0%, #ccd1d9 36%, #8d94a1 64%, #b7bcc7 84%, #e8eaef 100%)";

export function resolveMaterial(
  material: LiquidMaterial,
  options: ResolveMaterialOptions = {}
): ResolvedMaterial {
  if (material === "glass") {
    if (!supportsBackdropFilter()) {
      return {
        kind: "flat",
        fillStyle: { background: options.tint ?? GLASS_FALLBACK_FILL },
        specular: true,
      };
    }
    return {
      kind: "glass",
      fillStyle: {
        background: options.tint ?? GLASS_TINT,
        backdropFilter: GLASS_BACKDROP,
        WebkitBackdropFilter: GLASS_BACKDROP,
      },
      specular: true,
    };
  }
  if (material === "mercury") {
    return {
      kind: "mercury",
      fillStyle: { background: MERCURY_GRADIENT },
      specular: false,
    };
  }
  return {
    kind: "flat",
    fillStyle: { background: options.color ?? "currentColor" },
    specular: false,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liquid/materials.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/liquid/materials.ts tests/liquid/materials.test.ts
git commit -m "feat(liquid): glass/mercury/flat materials with backdrop-filter degradation"
```

---

### Task 5: `LiquidRenderer` (internal presentational layer stack)

**Files:**
- Create: `src/liquid/LiquidRenderer.tsx`
- Create: `src/liquid/index.ts`
- Test: `tests/liquid/LiquidRenderer.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/liquid/LiquidRenderer.test.tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LiquidRenderer } from "../../src/liquid/LiquidRenderer";
import { resolveMaterial } from "../../src/liquid/materials";

const PATH = "M 10 10 L 20 10 L 20 20 Z ";

describe("LiquidRenderer", () => {
  it("clips on a wrapper element, NOT on the backdrop-filter fill (Chromium artifact)", () => {
    const { container } = render(
      <LiquidRenderer path={PATH} material={resolveMaterial("glass")} />
    );
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    expect(clip.style.clipPath).toContain("path(");
    expect(fill.style.clipPath).toBe("");
    expect(fill.parentElement).toBe(clip);
  });

  it("gives the specular svg explicit 100% width/height (intrinsic 300x150 clips)", () => {
    const { container } = render(
      <LiquidRenderer
        path={PATH}
        material={resolveMaterial("glass")}
        speculars={[{ cx: 5, cy: 5, rx: 4, ry: 2, rotate: 10, opacity: 0.7 }]}
      />
    );
    const svg = container.querySelector(
      '[data-fluidkit="liquid-spec"]'
    ) as SVGElement;
    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.getAttribute("height")).toBe("100%");
    expect(svg.querySelectorAll("ellipse")).toHaveLength(1);
  });

  it("paints no specular ellipses when the material says so (mercury)", () => {
    const { container } = render(
      <LiquidRenderer
        path={PATH}
        material={resolveMaterial("mercury")}
        speculars={[{ cx: 5, cy: 5, rx: 4, ry: 2, rotate: 10, opacity: 0.7 }]}
      />
    );
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("renders the shadow as a light offset layer behind the liquid", () => {
    const { container } = render(
      <LiquidRenderer path={PATH} material={resolveMaterial("glass")} shadow />
    );
    const shadow = container.querySelector(
      '[data-fluidkit="liquid-shadow"]'
    ) as HTMLElement;
    expect(shadow).not.toBeNull();
    expect(shadow.style.clipPath).toContain("path(");
  });

  it("renders content children on an unclipped overlay (text never clips or scales)", () => {
    const { container, getByText } = render(
      <LiquidRenderer path={PATH} material={resolveMaterial("glass")}>
        <span>crisp text</span>
      </LiquidRenderer>
    );
    const overlay = getByText("crisp text").parentElement as HTMLElement;
    expect(overlay.getAttribute("data-fluidkit")).toBe("liquid-content");
    expect(overlay.style.clipPath).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liquid/LiquidRenderer.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the renderer and the internal barrel**

```tsx
// src/liquid/LiquidRenderer.tsx
/**
 * Internal presentational renderer for one liquid scene.
 *
 * Layer stack (bottom → top), sized by an absolutely-filled container the
 * parent positions:
 *   1. shadow  — light offset/shrunk fill, blurred via a WRAPPER filter so
 *                the clip applies before the blur (soft shadow, and glass
 *                never backdrop-samples a heavy black behind itself)
 *   2. clip    — wrapper holding the clip-path; the material fill (possibly
 *                backdrop-filtered) is its CHILD (Chromium artifact when
 *                clip-path + backdrop-filter share an element)
 *   3. spec    — svg with EXPLICIT 100% width/height, clipped to the shape,
 *                radial-gradient ellipses (no blur filters)
 *   4. content — unclipped overlay; only ever cross-fades, never scales
 */

import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import type { ResolvedMaterial } from "./materials";
import type { SpecularSpot } from "./specular";

export interface LiquidRendererProps {
  /** Concatenated SVG subpaths for `clip-path: path(...)`. */
  path: string;
  material: ResolvedMaterial;
  speculars?: SpecularSpot[];
  shadow?: boolean;
  children?: ReactNode;
}

const layer: CSSProperties = { position: "absolute", inset: 0 };
const fmtDeg = (n: number) => n.toFixed(1);

export function LiquidRenderer({
  path,
  material,
  speculars = [],
  shadow = false,
  children,
}: LiquidRendererProps) {
  const gradientId = useId();
  const clipPath = `path('${path}')`;
  const showSpec = material.specular && speculars.length > 0;

  return (
    <>
      {shadow && (
        <div
          style={{
            ...layer,
            filter: "blur(14px)",
            transform: "translateY(16px) scale(0.97)",
          }}
          aria-hidden
        >
          <div
            data-fluidkit="liquid-shadow"
            style={{ ...layer, background: "rgba(46,44,72,0.16)", clipPath }}
          />
        </div>
      )}
      <div data-fluidkit="liquid-clip" style={{ ...layer, clipPath }}>
        <div
          data-fluidkit="liquid-fill"
          style={{ ...layer, ...material.fillStyle }}
        />
      </div>
      {showSpec && (
        <svg
          data-fluidkit="liquid-spec"
          width="100%"
          height="100%"
          style={{ ...layer, clipPath, pointerEvents: "none" }}
          aria-hidden
        >
          <defs>
            <radialGradient id={gradientId}>
              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          {speculars.map((s, i) => (
            <ellipse
              key={i}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              transform={`rotate(${fmtDeg(s.rotate)} ${s.cx} ${s.cy})`}
              fill={`url(#${gradientId})`}
              opacity={s.opacity}
            />
          ))}
        </svg>
      )}
      {children != null && (
        <div data-fluidkit="liquid-content" style={{ ...layer }}>
          {children}
        </div>
      )}
    </>
  );
}
```

```ts
// src/liquid/index.ts
/**
 * Internal liquid engine barrel. The engine is NOT part of the public
 * package surface in v0.2 (components are); only its types leak out through
 * component props.
 */
export type { Vec, LiquidBody } from "./geometry";
export { circlePath, roundRectPath, bridgePath, dist } from "./geometry";
export { TensionField, neckWaist } from "./tension";
export type { SpecularSpot } from "./specular";
export { specularPlacement, defaultLight } from "./specular";
export type {
  LiquidMaterial,
  ResolvedMaterial,
  ResolveMaterialOptions,
} from "./materials";
export { resolveMaterial, MERCURY_GRADIENT } from "./materials";
export { LiquidRenderer } from "./LiquidRenderer";
export type { LiquidRendererProps } from "./LiquidRenderer";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liquid/LiquidRenderer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/liquid/LiquidRenderer.tsx src/liquid/index.ts tests/liquid/LiquidRenderer.test.tsx
git commit -m "feat(liquid): internal LiquidRenderer layer stack (shadow/clip/spec/content)"
```

---

### Task 6: `useMotionSprings` (Motion-driven spring values)

**Files:**
- Create: `src/liquid/useMotionSprings.ts`
- Test: `tests/liquid/useMotionSprings.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/liquid/useMotionSprings.test.tsx
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMotionSprings } from "../../src/liquid/useMotionSprings";

describe("useMotionSprings", () => {
  it("creates one motion value per slot, seeded by the initializer", () => {
    const { result } = renderHook(() =>
      useMotionSprings(3, (i) => i * 10, { stiffness: 170, damping: 15 })
    );
    expect(result.current.values).toHaveLength(3);
    expect(result.current.values.map((v) => v.get())).toEqual([0, 10, 20]);
  });

  it("keeps value identity across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      useMotionSprings(2, () => 0, { stiffness: 170, damping: 15 })
    );
    const first = result.current.values;
    rerender();
    expect(result.current.values).toBe(first);
  });

  it("snapTo() sets values instantly (reduced-motion path)", () => {
    const { result } = renderHook(() =>
      useMotionSprings(2, () => 0, { stiffness: 170, damping: 15 })
    );
    result.current.snapTo([5, 7]);
    expect(result.current.values.map((v) => v.get())).toEqual([5, 7]);
  });

  it("setTargets() eventually settles values at the targets", async () => {
    const { result } = renderHook(() =>
      useMotionSprings(1, () => 0, { stiffness: 800, damping: 80 })
    );
    result.current.setTargets([100]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(result.current.values[0].get()).toBeCloseTo(100, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liquid/useMotionSprings.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the hook**

```ts
// src/liquid/useMotionSprings.ts
/**
 * A dynamic-count array of spring-animated Motion values.
 *
 * Motion (the peer dependency) drives all spring physics — we never ship a
 * second integrator. Hook-per-value doesn't work when the count is a prop,
 * so values are created imperatively via `motionValue()` and animated with
 * `animate(value, target, { type: "spring", ... })`. `snapTo` is the
 * reduced-motion/instant path.
 */

import { useEffect, useMemo, useRef } from "react";
import type { MotionValue } from "motion/react";
import { animate, motionValue } from "motion/react";

type PlaybackControls = ReturnType<typeof animate>;

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export interface MotionSprings {
  values: MotionValue<number>[];
  setTargets(targets: readonly number[], config?: SpringConfig): void;
  snapTo(targets: readonly number[]): void;
}

export function useMotionSprings(
  count: number,
  init: (index: number) => number,
  config: SpringConfig
): MotionSprings {
  const animations = useRef<PlaybackControls[]>([]);
  const springs = useMemo<MotionSprings>(() => {
    const values = Array.from({ length: count }, (_, i) => motionValue(init(i)));
    return {
      values,
      setTargets(targets, override) {
        animations.current.forEach((a) => a.stop());
        animations.current = targets.map((target, i) =>
          animate(values[i], target, { type: "spring", ...(override ?? config) })
        );
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liquid/useMotionSprings.test.tsx`
Expected: PASS (4 tests). If the settle test flakes in jsdom, raise the timeout to 2500ms before weakening the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/liquid/useMotionSprings.ts tests/liquid/useMotionSprings.test.tsx
git commit -m "feat(liquid): useMotionSprings — Motion-driven dynamic spring value arrays"
```

---

### Task 7: `Droplets` component

**Files:**
- Create: `src/components/Droplets.tsx`
- Modify: `src/components/index.ts` (add export)
- Test: `tests/components/Droplets.test.tsx`

Public API:

```tsx
<Droplets
  count={3}            // number of drops
  size={36}            // base drop diameter px
  spread={100}         // cluster extent px
  speed={1}            // merge/split cycle speed multiplier
  material="glass"     // 'glass' | 'mercury' | 'flat'
  tint="..."           // glass tint
  color="..."          // flat fill
  light={{x, y}}       // scene light in px; null disables speculars; default defaultLight()
  followPointer        // an extra drop chases the pointer and merges
  seed={0}
/>
```

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/Droplets.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/** Same mocking pattern as tests/components/Metaballs.test.tsx. */
async function loadDroplets(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Droplets");
  return mod.Droplets;
}

describe("Droplets", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders the liquid layer stack with a computed clip path", async () => {
    const Droplets = await loadDroplets(false);
    const { container } = render(<Droplets />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(clip).not.toBeNull();
    expect(clip.style.clipPath).toContain("path(");
  });

  it("is static (no animation loop) under reduced motion, drops rendered as plain dots", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-animating")).toBe("false");
    // Static fallback = separate circles, no bridges: path has exactly
    // `count` subpath closures.
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(3);
  });

  it("paints speculars for glass but not for mercury", async () => {
    const Droplets = await loadDroplets(true);
    const glass = render(<Droplets material="glass" />);
    expect(glass.container.querySelectorAll("ellipse").length).toBeGreaterThan(0);
    const mercury = render(<Droplets material="mercury" />);
    expect(mercury.container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("disables speculars when light is null", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(<Droplets material="glass" light={null} />);
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("sizes the container from size + spread and merges consumer style/className", async () => {
    const Droplets = await loadDroplets(true);
    const { container } = render(
      <Droplets size={40} spread={80} className="c" style={{ marginTop: 4 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("c");
    expect(root.style.marginTop).toBe("4px");
    expect(root.style.width).toBe("120px"); // size + spread
    expect(root.style.height).toBe("120px");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/Droplets.test.tsx`
Expected: FAIL — cannot resolve `../../src/components/Droplets`.

- [ ] **Step 3: Implement `Droplets`**

```tsx
// src/components/Droplets.tsx
/**
 * A cluster of liquid drops with surface tension: they drift together,
 * merge through real necks (touch-connect / snap-on-stretch), and split
 * again. Optionally an extra drop chases the pointer and merges with the
 * cluster. Rendered by the liquid engine; the material (glass / mercury /
 * flat) is a prop, not a different component.
 *
 * Reduced motion / off-screen: renders the drops as separate static dots
 * (no bridges, no animation loop).
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  specularPlacement,
} from "../liquid";
import type { LiquidBody, LiquidMaterial, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface DropletsProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of drops in the cluster. */
  count?: number;
  /** Base drop diameter in px. */
  size?: number;
  /** Px extent the cluster spreads across. */
  spread?: number;
  /** Merge/split cycle speed multiplier. */
  speed?: number;
  /** Rendered material. */
  material?: LiquidMaterial;
  /** Glass tint (translucent white by default). */
  tint?: string;
  /** Flat-material fill color. */
  color?: string;
  /**
   * Scene light position in px (container coordinates). `null` disables
   * specular highlights. Defaults to above the stage, 30% from the left.
   */
  light?: Vec | null;
  /** An extra drop chases the pointer and merges with the cluster. */
  followPointer?: boolean;
  /** Deterministic per-instance layout offset. */
  seed?: number;
}

const DEFAULT_COUNT = 3;
const DEFAULT_SIZE = 36;
const DEFAULT_SPREAD = 100;
const CYCLE_MS = 1500;
const SQUEEZE = 0.36;
const DROP_SPRING = { stiffness: 170, damping: 15 };
const POINTER_SPRING = { stiffness: 120, damping: 13 };
/** Radius variation so the cluster reads organic, not gridded. */
const R_SCALE = [0.95, 1.2, 0.8];

/** Deterministic per-drop angle (same scheme the old Metaballs used). */
function dropAngle(index: number, seed: number): number {
  return index * 2.399963 + seed * 0.618034;
}

interface Home {
  x: number;
  y: number;
  r: number;
}

function layoutHomes(
  count: number,
  size: number,
  spread: number,
  seed: number
): Home[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = dropAngle(i, seed);
    return {
      x: Math.cos(angle) * spread * 0.42,
      y: Math.sin(angle) * spread * 0.16,
      r: (size / 2) * R_SCALE[i % R_SCALE.length],
    };
  });
}

export function Droplets({
  count = DEFAULT_COUNT,
  size = DEFAULT_SIZE,
  spread = DEFAULT_SPREAD,
  speed = 1,
  material = "glass",
  tint,
  color,
  light,
  followPointer = false,
  seed = 0,
  className,
  style,
  ...rest
}: DropletsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  const side = size + spread;
  const center = side / 2;
  const homes = useMemo(
    () => layoutHomes(count, size, spread, seed),
    [count, size, spread, seed]
  );
  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const sceneLight = light === undefined ? defaultLight(side, side) : light;

  // x/y springs per drop, interleaved [x0, y0, x1, y1, ...]
  const springs = useMotionSprings(
    count * 2,
    (i) => (i % 2 === 0 ? center + homes[(i / 2) | 0].x : center + homes[((i - 1) / 2) | 0].y),
    DROP_SPRING
  );
  const pointer = useMotionSprings(2, () => -9999, POINTER_SPRING);
  const pointerActive = useRef(false);

  const tension = useRef(new TensionField());
  const phase = useRef(0);
  const cycleT = useRef(0);

  const staticScene = useMemo(
    () => buildScene(homes.map((h, i) => bodyAt(h, center, i)), null, resolved.specular, sceneLight, false),
    [homes, center, resolved.specular, sceneLight]
  );
  const [scene, setScene] = useState(staticScene);

  useAnimationFrame((_, delta) => {
    if (!animating) return;
    cycleT.current += delta * speed;
    if (cycleT.current > CYCLE_MS) {
      cycleT.current = 0;
      phase.current = 1 - phase.current;
      const squeeze = phase.current === 1 ? SQUEEZE : 1;
      springs.setTargets(
        homes.flatMap((h) => [center + h.x * squeeze, center + h.y * squeeze])
      );
    }
    const bodies: LiquidBody[] = homes.map((h, i) => ({
      id: `d${i}`,
      x: springs.values[i * 2].get(),
      y: springs.values[i * 2 + 1].get(),
      r: h.r,
    }));
    if (followPointer && pointerActive.current) {
      bodies.push({
        id: "you",
        x: pointer.values[0].get(),
        y: pointer.values[1].get(),
        r: size * 0.38,
      });
    }
    setScene(
      buildScene(bodies, tension.current, resolved.specular, sceneLight, true)
    );
  });

  const containerStyle: CSSProperties = {
    position: "relative",
    width: side,
    height: side,
    ...style,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={containerStyle}
      data-fluidkit="droplets"
      data-animating={animating}
      onPointerMove={
        followPointer
          ? (e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - box.left;
              const y = e.clientY - box.top;
              if (!pointerActive.current) {
                pointerActive.current = true;
                pointer.snapTo([x, y]);
              } else {
                pointer.setTargets([x, y]);
              }
            }
          : undefined
      }
      onPointerLeave={
        followPointer
          ? () => {
              pointerActive.current = false;
              tension.current.clear((key) => key.includes("you"));
            }
          : undefined
      }
      {...rest}
    >
      <LiquidRenderer
        path={animating ? scene.path : staticScene.path}
        material={resolved}
        speculars={animating ? scene.speculars : staticScene.speculars}
        shadow
      />
    </div>
  );
}

function bodyAt(home: Home, center: number, index: number): LiquidBody {
  return { id: `d${index}`, x: center + home.x, y: center + home.y, r: home.r };
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildScene(
  bodies: LiquidBody[],
  tension: TensionField | null,
  wantSpecular: boolean,
  light: Vec | null,
  bridged: boolean
): Scene {
  let path = bodies.map((b) => circlePath(b, b.r)).join("");
  if (bridged && tension) path += tension.bridges(bodies);
  const speculars =
    wantSpecular && light
      ? bodies.map((b) => specularPlacement(b, light))
      : [];
  return { path, speculars };
}
```

Add to `src/components/index.ts`:

```ts
export { Droplets } from "./Droplets";
export type { DropletsProps } from "./Droplets";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/Droplets.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Droplets.tsx src/components/index.ts tests/components/Droplets.test.tsx
git commit -m "feat: Droplets — engine-driven liquid drop cluster with materials + pointer merge"
```

---

### Task 8: `Thinking` component

**Files:**
- Create: `src/components/Thinking.tsx`
- Modify: `src/components/index.ts` (add export)
- Test: `tests/components/Thinking.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/Thinking.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

async function loadThinking(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/Thinking");
  return mod.Thinking;
}

describe("Thinking", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("announces itself as a status indicator", async () => {
    const Thinking = await loadThinking(true);
    const { getByRole } = render(<Thinking />);
    const status = getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Thinking");
  });

  it("supports a custom label", async () => {
    const Thinking = await loadThinking(true);
    const { getByRole } = render(<Thinking label="Working" />);
    expect(getByRole("status").getAttribute("aria-label")).toBe("Working");
  });

  it("renders three static dots under reduced motion", async () => {
    const Thinking = await loadThinking(true);
    const { container } = render(<Thinking />);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect((clip.style.clipPath.match(/Z/g) ?? []).length).toBe(3);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-animating")).toBe("false");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/Thinking.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `Thinking`**

```tsx
// src/components/Thinking.tsx
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
```

Add to `src/components/index.ts`:

```ts
export { Thinking } from "./Thinking";
export type { ThinkingProps } from "./Thinking";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/Thinking.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Thinking.tsx src/components/index.ts tests/components/Thinking.test.tsx
git commit -m "feat: Thinking — droplet merge/split status indicator preset"
```

---

### Task 9: Rewrite `MorphSurface` on the engine (delete `useMorph`)

**Files:**
- Rewrite: `src/components/MorphSurface.tsx`
- Delete: `src/hooks/useMorph.ts`, `tests/hooks/useMorph.test.tsx`
- Modify: `src/hooks/index.ts` (remove useMorph exports)
- Rewrite: `tests/components/MorphSurface.test.tsx`

The old `MorphSurface` was Motion-`layoutId` based with `useMorph`; the engine version replaces both (spec open question resolved: engine mode only for v0.2; the library is unpublished, no consumers to break).

Public API:

```tsx
<MorphSurface
  open={open}
  closedSize={{ width: 150, height: 46 }}
  openSize={{ width: 250, height: 200 }}
  radius={24}
  material="glass"
  satellites            // absorb beat on open (default true)
  closedContent={<PillLabel />}
  openContent={<Panel />}
/>
```

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/MorphSurface.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

async function loadMorphSurface(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/MorphSurface");
  return mod.MorphSurface;
}

describe("MorphSurface", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("shows closed content and hides open content when closed", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const closed = getByText("pill").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(closed.style.opacity).toBe("1");
    expect(opened.style.opacity).toBe("0");
    expect(opened.getAttribute("aria-hidden")).toBe("true");
  });

  it("cross-fades faces when open flips — content only fades, never scales", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText, rerender } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    rerender(
      <MorphSurface
        open
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(opened.style.opacity).toBe("1");
    // the face never scales — transform is reserved for centering only
    expect(opened.style.transform).not.toContain("scale");
  });

  it("renders the liquid clip stack and reports its state", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(
      container.querySelector('[data-fluidkit="liquid-clip"]')
    ).not.toBeNull();
  });

  it("under reduced motion the surface renders the target size immediately", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container, rerender } = render(<MorphSurface open={false} />);
    rerender(<MorphSurface open />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("open");
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  it("sizes its container to fit the open state plus satellite margin", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(
      <MorphSurface open={false} openSize={{ width: 200, height: 160 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(parseInt(root.style.width, 10)).toBeGreaterThanOrEqual(200);
    expect(parseInt(root.style.height, 10)).toBeGreaterThanOrEqual(160);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/MorphSurface.test.tsx`
Expected: FAIL (new API doesn't exist yet).

- [ ] **Step 3: Rewrite `MorphSurface`**

```tsx
// src/components/MorphSurface.tsx
/**
 * One liquid body that morphs between a closed (pill) and open (panel)
 * shape. Optional satellite droplets park beside the closed pill and are
 * absorbed through real liquid bridges on open. The surface is engine
 * geometry (rounded-rect + drops + tension bridges as one clip path);
 * content faces live on an unclipped overlay and ONLY cross-fade — text
 * never scales. Reduced motion: the surface snaps to the target state.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type { LiquidBody, LiquidMaterial, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";

export interface MorphSize {
  width: number;
  height: number;
}

export interface MorphSurfaceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Controlled state: false = pill, true = panel. */
  open: boolean;
  closedSize?: MorphSize;
  openSize?: MorphSize;
  /** Corner radius of the open panel (the pill is always fully rounded). */
  radius?: number;
  material?: LiquidMaterial;
  tint?: string;
  color?: string;
  /** Scene light; null disables speculars. */
  light?: Vec | null;
  /** Satellite droplets absorbed into the surface on open. */
  satellites?: boolean;
  /** Content shown on the closed pill. */
  closedContent?: ReactNode;
  /** Content shown on the open panel. */
  openContent?: ReactNode;
}

const DEFAULT_CLOSED: MorphSize = { width: 150, height: 46 };
const DEFAULT_OPEN: MorphSize = { width: 250, height: 200 };
const BODY_SPRING = { stiffness: 240, damping: 24 };
const SAT_SPRING = { stiffness: 150, damping: 14 };
/** Horizontal margin reserved for parked satellites. */
const SAT_MARGIN = 56;
/** How long the loop keeps recomputing after a state flip (springs settle). */
const SETTLE_MS = 1600;

interface Sat {
  side: -1 | 1;
  y: number;
  r: number;
  park: number;
}

export function MorphSurface({
  open,
  closedSize = DEFAULT_CLOSED,
  openSize = DEFAULT_OPEN,
  radius = 24,
  material = "glass",
  tint,
  color,
  light,
  satellites = true,
  closedContent,
  openContent,
  className,
  style,
  ...rest
}: MorphSurfaceProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();

  const width = openSize.width + SAT_MARGIN * 2;
  const height = openSize.height + 40;
  const cx = width / 2;
  const cy = height / 2;

  const sats = useMemo<Sat[]>(
    () => [
      { side: -1, y: -4, r: 13, park: -(closedSize.width / 2 + 34) },
      { side: 1, y: 10, r: 11, park: closedSize.width / 2 + 38 },
    ],
    [closedSize.width]
  );

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const sceneLight = light === undefined ? defaultLight(width, height) : light;

  // [w, h, sat0pos, sat0r, sat1pos, sat1r]
  const springs = useMotionSprings(
    2 + sats.length * 2,
    (i) => initialSpringValue(i, open, closedSize, openSize, sats),
    BODY_SPRING
  );

  const tension = useRef(new TensionField());
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animating = !prefersReducedMotion && inView;

  // React to `open` flips: spring (animated) or snap (reduced motion).
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current !== open) {
      const targets = targetSpringValues(open, closedSize, openSize, sats);
      if (animating) {
        springs.setTargets(targets, BODY_SPRING);
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
      } else {
        springs.snapTo(targets);
      }
    }
    prevOpen.current = open;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animating]);

  const staticScene = useMemo(
    () =>
      buildMorphScene(
        targetSpringValues(open, closedSize, openSize, sats),
        cx,
        cy,
        radius,
        sats,
        satellites,
        null,
        resolved.specular ? sceneLight : null
      ),
    [open, closedSize, openSize, sats, cx, cy, radius, satellites, resolved.specular, sceneLight]
  );
  const [scene, setScene] = useState(staticScene);

  useAnimationFrame(() => {
    if (!animating || !settling) return;
    setScene(
      buildMorphScene(
        springs.values.map((v) => v.get()),
        cx,
        cy,
        radius,
        sats,
        satellites,
        tension.current,
        resolved.specular ? sceneLight : null
      )
    );
  });

  const activeScene = animating && settling ? scene : staticScene;

  const faceBase: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    display: "grid",
    placeItems: "center",
    transition: "opacity 0.18s ease",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width, height, ...style }}
      data-fluidkit="morph-surface"
      data-state={open ? "open" : "closed"}
      data-animating={animating && settling}
      {...rest}
    >
      <LiquidRenderer
        path={activeScene.path}
        material={resolved}
        speculars={activeScene.speculars}
        shadow
      >
        <div
          data-fluidkit="morph-face"
          aria-hidden={open ? "true" : undefined}
          style={{
            ...faceBase,
            width: closedSize.width,
            height: closedSize.height,
            opacity: open ? 0 : 1,
            pointerEvents: open ? "none" : undefined,
          }}
        >
          {closedContent}
        </div>
        <div
          data-fluidkit="morph-face"
          aria-hidden={open ? undefined : "true"}
          style={{
            ...faceBase,
            width: openSize.width,
            height: openSize.height,
            opacity: open ? 1 : 0,
            pointerEvents: open ? undefined : "none",
          }}
        >
          {openContent}
        </div>
      </LiquidRenderer>
    </div>
  );
}

function initialSpringValue(
  index: number,
  open: boolean,
  closedSize: MorphSize,
  openSize: MorphSize,
  sats: Sat[]
): number {
  return targetSpringValues(open, closedSize, openSize, sats)[index];
}

/** Spring targets: [w, h, sat0pos, sat0r, sat1pos, sat1r]. */
function targetSpringValues(
  open: boolean,
  closedSize: MorphSize,
  openSize: MorphSize,
  sats: Sat[]
): number[] {
  const size = open ? openSize : closedSize;
  const values = [size.width, size.height];
  for (const sat of sats) {
    values.push(open ? sat.side * (openSize.width / 2 - 20) : sat.park);
    values.push(open ? 0 : sat.r);
  }
  return values;
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildMorphScene(
  springValues: number[],
  cx: number,
  cy: number,
  radius: number,
  sats: Sat[],
  satellites: boolean,
  tension: TensionField | null,
  light: Vec | null
): Scene {
  const [w, h, ...satValues] = springValues;
  const rad = Math.min(radius, h / 2);
  let path = roundRectPath({ x: cx, y: cy }, w, h, rad);
  const speculars: SpecularSpot[] = [];

  if (satellites) {
    sats.forEach((sat, i) => {
      const pos = satValues[i * 2];
      const r = Math.max(satValues[i * 2 + 1], 0);
      if (r <= 0.5) return;
      const drop: LiquidBody = {
        id: `sat${sat.side}`,
        x: cx + pos,
        y: cy + sat.y,
        r,
      };
      path += circlePath(drop, drop.r);
      if (tension) {
        const phantom: LiquidBody = {
          id: `edge${sat.side}`,
          x: cx + sat.side * (w / 2 - 16),
          y: cy + sat.y * 0.4,
          r: 15,
        };
        path += tension.bridges([drop, phantom]);
      }
      if (light) speculars.push(specularPlacement(drop, light));
    });
  }

  if (light) {
    // one quiet sheen on the body itself, lit by the same source
    speculars.push(
      specularPlacement(
        { x: cx, y: cy, r: Math.min(w, h) * 0.48 },
        light,
        0.28
      )
    );
  }
  return { path, speculars };
}
```

(Satellites use `BODY_SPRING` for all slots in v0.2 — one spring config per flip. `SAT_SPRING` is declared for the follow-up that gives satellites a softer feel; delete it if the compiler flags it unused.)

Then:
1. Delete `src/hooks/useMorph.ts` and `tests/hooks/useMorph.test.tsx` (`git rm`).
2. Remove the `useMorph` export block from `src/hooks/index.ts`.
3. Delete the old `tests/components/MorphSurface.test.tsx` content entirely (replaced by Step 1's file).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/components/MorphSurface.test.tsx && npx tsc --noEmit`
Expected: PASS (5 tests), no type errors. If `SAT_SPRING` is flagged unused, delete it.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/MorphSurface.tsx src/hooks tests
git commit -m "feat!: MorphSurface rebuilt on the liquid engine (absorb morph); drop useMorph"
```

---

### Task 10: Delete goo components + `LiquidGlass`, drop the dependency

**Files:**
- Delete: `src/components/Metaballs.tsx`, `src/components/ThinkingBlob.tsx`, `src/components/LiquidGlass.tsx`
- Delete: `tests/components/Metaballs.test.tsx`, `tests/components/ThinkingBlob.test.tsx`, `tests/components/LiquidGlass.test.tsx`
- Modify: `src/components/index.ts`, `package.json`

`useGoo` + `src/filters/*` STAY (LiquidTabs still consumes them; it moves to the engine in v0.3).

- [ ] **Step 1: Remove files and exports**

```bash
git rm src/components/Metaballs.tsx src/components/ThinkingBlob.tsx src/components/LiquidGlass.tsx \
       tests/components/Metaballs.test.tsx tests/components/ThinkingBlob.test.tsx tests/components/LiquidGlass.test.tsx
```

In `src/components/index.ts` remove these blocks (keep everything else):

```ts
export { Metaballs } from "./Metaballs";
export type { MetaballsProps } from "./Metaballs";
export { ThinkingBlob } from "./ThinkingBlob";
export type { ThinkingBlobProps } from "./ThinkingBlob";
export { LiquidGlass } from "./LiquidGlass";
export type { LiquidGlassProps } from "./LiquidGlass";
```

- [ ] **Step 2: Drop the dependency**

Run: `npm uninstall @samasante/liquid-glass`
Expected: `package.json` `dependencies` becomes empty/removed.

- [ ] **Step 3: Fix any stragglers**

Run: `grep -rn "Metaballs\|ThinkingBlob\|LiquidGlass\|liquid-glass\|useMorph" src tests --include="*.ts*"`
Expected: no hits outside `LiquidTabs`'s goo usage. Fix any that appear.

- [ ] **Step 4: Full suite, typecheck, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, tsup build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat!: remove goo components (Metaballs, ThinkingBlob) and LiquidGlass + dep"
```

---

### Task 11: Rebuild the playground (light mode, engine components)

**Files:**
- Rewrite: `playground/main.tsx` (demo cards for the new components; keep FlowStagger / LiquidTabs / Ripple cards as-is)
- Check: `playground/hero.tsx` for imports of deleted components (update or simplify to use `Droplets`/`MorphSurface`)

This task is visual, not TDD. Structure `playground/main.tsx` as a light-mode page (background `#f2f3f7`, cards white, wallpaper stages with the pastel gradient + radial-gradient orbs from `prototypes/07-liquid-glass-lab.html` — copy its `.stage.wall`/`.orb` CSS). Demo cards:

1. **Droplets (glass)** — `<Droplets followPointer />` on a wallpaper stage, hint "move pointer".
2. **MorphSurface (glass)** — controlled `open` on stage click; closed pill label + open panel rows (copy the face content structure from prototype 07).
3. **Thinking** — `<Thinking />` on a wallpaper stage.
4. **Droplets (mercury)** — `<Droplets material="mercury" light={null} />` on a plain light stage.
5. Existing FlowStagger / LiquidTabs / Ripple cards, restyled to the light theme (colors only — no behavior changes).

- [ ] **Step 1: Rewrite the playground and remove dead imports**

Run: `grep -n "Metaballs\|ThinkingBlob\|LiquidGlass" playground/*.tsx`
Expected after rewrite: no hits.

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev` (background), open `http://localhost:5173/` with Playwright, screenshot idle + after clicking the MorphSurface stage + after dispatching a pointermove over the Droplets stage.
Expected: glass drops merge with real necks, no seam lines, mercury has no painted highlight, morph absorbs satellites, text stays crisp.

- [ ] **Step 3: Commit**

```bash
git add playground
git commit -m "feat: rebuild playground light-mode-first around the liquid engine"
```

---

### Task 12: Sync docs

**Files:**
- Create: `docs/primitives/droplets.md`, `docs/primitives/thinking.md`
- Rewrite: `docs/primitives/morph-surface.md`
- Delete: `docs/primitives/metaballs.md`, `docs/primitives/thinking-blob.md`, `docs/primitives/liquid-glass.md`
- Modify: `README.md` (component list + positioning)

- [ ] **Step 1: Write the new primitive docs**

Each doc follows the existing `docs/primitives/*.md` shape (check `docs/primitives/ripple.md` for the exact section layout: what it is, props table, degradation, example). Content requirements:
- `droplets.md`: engine concept (metaball geometry + touch-connect/snap-on-stretch tension), `material` prop, `light` prop, `followPointer`, reduced-motion fallback (static dots).
- `thinking.md`: preset over Droplets, `role="status"`, `label` prop.
- `morph-surface.md`: engine morph, closed/open faces cross-fade only ("animate the surface, never the text"), `satellites` absorb beat, reduced-motion snap.

- [ ] **Step 2: Update README**

Update the component table to: `MorphSurface`, `Droplets`, `Thinking`, `FlowStagger`, `LiquidTabs`, `Ripple`. Add one paragraph on the engine + materials idea (one liquid engine, materials as a prop). Remove references to goo/Metaballs/ThinkingBlob/LiquidGlass.

- [ ] **Step 3: Remove stale docs and commit**

```bash
git rm docs/primitives/metaballs.md docs/primitives/thinking-blob.md docs/primitives/liquid-glass.md
git add docs README.md
git commit -m "docs: liquid engine primitives (droplets, thinking, morph-surface)"
```

---

## Final verification (after all tasks)

- [ ] `npx vitest run` — full suite green
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — tsup emits ESM + CJS + types
- [ ] Playground visual pass (Task 11 Step 2 screenshots) matches the feel validated in `prototypes/07-liquid-glass-lab.html`
- [ ] `grep -rn "samasante" package.json src` → no hits
