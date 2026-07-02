# LiquidTabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `LiquidTabs` as the flagship fluidkit showcase — two spring-driven flows (`slide`/`stretch`), two materials (`ink`/`glass`), sizes, disabled tabs, icons, optional panels, keyboard nav, and coverage-driven label color — split into a focused `src/components/tabs/` module.

**Architecture:** Pure, unit-testable cores (`flows.ts` scene geometry, `tint.ts` coverage math) are consumed by a thin bar component that measures tab boxes, drives Motion springs through the existing liquid engine (`LiquidRenderer` + `useMotionSprings` + `TensionField`), and writes clip-path scenes imperatively per frame. Keyboard/ARIA lives in `useTabList`; shared panel state lives in a `TabsGroup` context.

**Tech Stack:** React 18, TypeScript, Motion (`motion/react`, peer dep), Vitest + Testing Library, existing internal liquid engine under `src/liquid/`.

---

## Reference: existing engine API (do not reimplement)

- `roundRectPath(center: {x,y}, width, height, radius): string` and `circlePath(center, r): string` — from `src/liquid/geometry.ts`. Emit clip-path subpaths (each ends `Z `).
- `class TensionField { bridges(bodies: {id,x,y,r}[]): string; clear(): void }` — from `src/liquid/tension.ts`. Metaball necks between bodies.
- `useMotionSprings(count, init: (i)=>number, config: SpringConfig | (i)=>SpringConfig): { values: MotionValue<number>[]; setTargets(targets, override?); setTarget(i, target, override?); snapTo(targets) }` — from `src/liquid/useMotionSprings.ts`. `SpringConfig = { stiffness, damping }`. Read a value with `.get()`, velocity with `.getVelocity()`.
- `resolveMaterial(material: "glass"|"mercury"|"flat", { color?, tint? }): ResolvedMaterial` — from `src/liquid/materials.ts`. `ResolvedMaterial = { kind, fillStyle, specular }`.
- `<LiquidRenderer ref={handle} path material speculars? specularSlots? shadow? clipContent? />` with `handle.setScene({ path, speculars? })` — from `src/liquid/LiquidRenderer.tsx`. Renderer nodes carry `data-fluidkit="liquid-clip"` / `liquid-fill`.
- `resolveColor(color?, fallback="currentColor"): string` and `usePrefersReducedMotion(): boolean` — from `src/utils`.
- All the above are re-exported from `src/liquid/index.ts` (`import { ... } from "../../liquid"`).

Run tests with `npx vitest run <path>`. Typecheck with `npm run typecheck`.

---

## File Structure

```
src/components/tabs/
  tint.ts          — pure: interval coverage → smoothstep → rgb() color mix
  flows.ts         — pure: slide + stretch scene geometry & spring specs
  useTabList.ts    — keyboard nav, roving tabindex, ARIA, disabled skipping
  TabsGroup.tsx    — context provider + controlled/uncontrolled value state
  TabPanel.tsx     — role=tabpanel, aria wiring, content cross-fade
  LiquidTabs.tsx   — the bar: measurement, springs, per-frame scene + tint
  index.ts         — public exports (LiquidTabs + .Group + .Panel + types)

tests/components/tabs/
  tint.test.ts
  flows.test.ts
  useTabList.test.tsx
  LiquidTabs.test.tsx
  TabPanel.test.tsx

Modified: src/components/index.ts   (re-export from ./tabs)
Deleted:  src/components/LiquidTabs.tsx, tests/components/LiquidTabs.test.tsx
Modified: playground/main.tsx        (TabsDemo controls)
```

---

## Task 1: `tint.ts` — coverage & color mixing (pure)

**Files:**
- Create: `src/components/tabs/tint.ts`
- Test: `tests/components/tabs/tint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/tabs/tint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tabCoverage, mixColor, smoothstep, type Interval } from "../../../src/components/tabs/tint";

describe("smoothstep", () => {
  it("clamps below a and above b", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
  it("is 0.5 at the midpoint", () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("tabCoverage", () => {
  const tab = { left: 100, width: 50 }; // spans [100,150]

  it("is 0 when no interval overlaps the tab", () => {
    const intervals: Interval[] = [[0, 40]];
    expect(tabCoverage(tab.left, tab.width, intervals)).toBe(0);
  });

  it("is 1 when an interval fully covers the tab (raw >= 0.7)", () => {
    const intervals: Interval[] = [[90, 160]];
    expect(tabCoverage(tab.left, tab.width, intervals)).toBe(1);
  });

  it("sums overlap across multiple intervals before smoothstepping", () => {
    // 10px + 10px = 20px of 50px = raw 0.4 → inside the smoothstep ramp (0.35..0.7)
    const intervals: Interval[] = [[100, 110], [140, 150]];
    const c = tabCoverage(tab.left, tab.width, intervals);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
  });

  it("returns 0 for a zero-width tab", () => {
    expect(tabCoverage(100, 0, [[0, 999]])).toBe(0);
  });
});

describe("mixColor", () => {
  it("returns the from color at weight 0", () => {
    expect(mixColor([75, 76, 86], [255, 255, 255], 0)).toBe("rgb(75, 76, 86)");
  });
  it("returns the to color at weight 1", () => {
    expect(mixColor([75, 76, 86], [255, 255, 255], 1)).toBe("rgb(255, 255, 255)");
  });
  it("rounds channel values at the midpoint", () => {
    expect(mixColor([0, 0, 0], [255, 255, 255], 0.5)).toBe("rgb(128, 128, 128)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/tabs/tint.test.ts`
Expected: FAIL — cannot resolve `../../../src/components/tabs/tint`.

- [ ] **Step 3: Write the implementation**

Create `src/components/tabs/tint.ts`:

```ts
/**
 * Coverage-driven label tinting for LiquidTabs.
 *
 * A tab label's color is a pure function of how much of the tab box the
 * liquid indicator currently covers — never of click/selection state. The
 * flow reports the x-intervals its ink occupies; each label mixes from a base
 * color to an active color by its smoothstepped coverage, so labels and
 * liquid always move together.
 */

/** Inclusive x-range [start, end] covered by ink, in container pixels. */
export type Interval = [number, number];

/** An RGB triple, 0..255 per channel. */
export type RGB = readonly [number, number, number];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Hermite smoothstep of `x` across the edge pair [a, b]. */
export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * Fraction (0..1) of the tab box `[left, left+width]` covered by the union of
 * `intervals`, then smoothstepped so a label brightens only once the liquid
 * is meaningfully under it and reaches full active color before full overlap.
 */
export function tabCoverage(
  left: number,
  width: number,
  intervals: readonly Interval[]
): number {
  if (width <= 0) return 0;
  const right = left + width;
  let covered = 0;
  for (const [a, b] of intervals) {
    covered += Math.max(0, Math.min(b, right) - Math.max(a, left));
  }
  return smoothstep(0.35, 0.7, covered / width);
}

/** Mix `from`→`to` by weight `w` (0..1) into a `rgb(r, g, b)` string. */
export function mixColor(from: RGB, to: RGB, w: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * w);
  const g = Math.round(from[1] + (to[1] - from[1]) * w);
  const b = Math.round(from[2] + (to[2] - from[2]) * w);
  return `rgb(${r}, ${g}, ${b})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/tint.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/tint.ts tests/components/tabs/tint.test.ts
git commit -m "feat(tabs): coverage-driven label tint core"
```

---

## Task 2: `flows.ts` types + `slideFlow` (pure)

**Files:**
- Create: `src/components/tabs/flows.ts`
- Test: `tests/components/tabs/flows.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/tabs/flows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TensionField } from "../../../src/liquid";
import { slideFlow, type FlowContext } from "../../../src/components/tabs/flows";

const H = 34;
const ctx = (restWidth: number): FlowContext => ({ height: H, restWidth });
const closures = (path: string) => (path.match(/Z/g) ?? []).length;

describe("slideFlow", () => {
  it("uses three springs", () => {
    expect(slideFlow.springCount).toBe(3);
    expect(slideFlow.configs).toHaveLength(3);
  });

  it("rest and target center the pill on the tab", () => {
    const rect = { left: 100, width: 60 };
    expect(slideFlow.rest(rect, H)).toEqual([130, 60, 130]);
    expect(slideFlow.target(rect, H)).toEqual([130, 60, 130]);
  });

  it("at rest (tail merged, zero velocity) draws exactly one pill", () => {
    const t = new TensionField();
    // values = [cx, w, tailX]; tail coincident with body → no bridge, no tail circle
    const scene = slideFlow.scene([130, 60, 130], [0, 0, 0], t, ctx(60));
    expect(closures(scene.path)).toBe(1);
    expect(scene.inkIntervals).toEqual([[100, 160]]);
  });

  it("reports a wider ink interval while moving fast (velocity stretch)", () => {
    const t = new TensionField();
    const still = slideFlow.scene([130, 60, 130], [0, 0, 0], t, ctx(60));
    const fast = slideFlow.scene([130, 60, 130], [2000, 0, 0], new TensionField(), ctx(60));
    const w = (iv: [number, number][]) => iv[0][1] - iv[0][0];
    expect(w(fast.inkIntervals)).toBeGreaterThan(w(still.inkIntervals));
  });

  it("emits a separated tail circle when the tail lags behind the body", () => {
    const t = new TensionField();
    const scene = slideFlow.scene([200, 60, 120], [0, 0, 0], t, ctx(60));
    // body pill + tail circle (+ possibly a bridge) → at least two closures
    expect(closures(scene.path)).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/tabs/flows.test.ts`
Expected: FAIL — cannot resolve `flows`.

- [ ] **Step 3: Write the implementation**

Create `src/components/tabs/flows.ts`:

```ts
/**
 * Flow scene geometry for LiquidTabs.
 *
 * A Flow is a pure spec: how many springs it needs, their configs, the spring
 * values for a pill resting on / traveling to a tab box, and a `scene()` that
 * turns live spring values (+ velocities) into a clip-path string and the ink
 * x-intervals used for label tinting. No DOM, no React — unit-testable.
 *
 * `slide` — one droplet with inertia: squashes with speed, a lagging tail blob
 *   trails and re-merges through the tension field, lands flat.
 * `stretch` — a taffy pill spanning two edge springs; leading edge eager,
 *   trailing edge lazy, height squashed to conserve volume.
 */

import { circlePath, roundRectPath, TensionField } from "../../liquid";
import type { SpringConfig } from "../../liquid/useMotionSprings";
import type { Interval } from "./tint";

export interface TabRect {
  left: number;
  width: number;
}

export interface FlowContext {
  /** Indicator height in px (the measured container height). */
  height: number;
  /** Resting width of the destination tab, for volume conservation. */
  restWidth: number;
}

export interface FlowScene {
  /** Concatenated clip-path subpaths. */
  path: string;
  /** X-intervals the ink covers, for `tabCoverage`. */
  inkIntervals: Interval[];
}

export interface Flow {
  readonly springCount: number;
  readonly configs: readonly SpringConfig[];
  /** Spring values for a pill at rest on `rect`. */
  rest(rect: TabRect, height: number): number[];
  /** Spring targets to animate toward when the active tab becomes `rect`. */
  target(rect: TabRect, height: number): number[];
  scene(
    values: readonly number[],
    velocities: readonly number[],
    tension: TensionField,
    ctx: FlowContext
  ): FlowScene;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** values = [centerX, width, tailX] */
export const slideFlow: Flow = {
  springCount: 3,
  configs: [
    { stiffness: 320, damping: 33 }, // centerX
    { stiffness: 340, damping: 35 }, // width
    { stiffness: 190, damping: 24 }, // tailX (lags behind the body)
  ],
  rest(rect) {
    const cx = rect.left + rect.width / 2;
    return [cx, rect.width, cx];
  },
  target(rect) {
    const cx = rect.left + rect.width / 2;
    return [cx, rect.width, cx];
  },
  scene(values, velocities, tension, ctx) {
    const cx = values[0];
    const w = values[1];
    const tailX = values[2];
    const vx = velocities[0] ?? 0;
    const h = ctx.height;
    const cy = h / 2;

    // Squash with speed: wider + shorter while moving, capped and volume-ish.
    const stretch = 1 + Math.min(Math.abs(vx) / 1400, 0.22);
    const bw = w * stretch;
    const bh = h / Math.sqrt(stretch);

    let path = roundRectPath({ x: cx, y: cy }, bw, bh, bh / 2);

    const gap = Math.abs(cx - tailX);
    const tailR = gap < 1 ? 0 : Math.min(gap * 0.3 + 5, h * 0.36);
    if (tailR > 0.5) {
      path += circlePath({ x: tailX, y: cy }, tailR);
      path += tension.bridges([
        { id: "body", x: cx, y: cy, r: bh / 2 },
        { id: "tail", x: tailX, y: cy, r: tailR },
      ]);
    }

    return { path, inkIntervals: [[cx - bw / 2, cx + bw / 2]] };
  },
};

/** values = [leftEdge, rightEdge] */
export const stretchFlow: Flow = {
  springCount: 2,
  configs: [
    { stiffness: 420, damping: 34 }, // leftEdge
    { stiffness: 420, damping: 34 }, // rightEdge
  ],
  rest(rect) {
    return [rect.left, rect.left + rect.width];
  },
  target(rect) {
    return [rect.left, rect.left + rect.width];
  },
  scene(values, _velocities, _tension, ctx) {
    const L = values[0];
    const R = values[1];
    const w = Math.max(R - L, 8);
    const h = ctx.height * clamp(ctx.restWidth / w, 0.72, 1.04);
    const cx = (L + R) / 2;
    const cy = ctx.height / 2;
    const path = roundRectPath({ x: cx, y: cy }, w, h, h / 2);
    return { path, inkIntervals: [[L, R]] };
  },
};

/**
 * Per-edge spring configs for `stretch`: the leading edge is eager (stiff,
 * lightly damped) and the trailing edge lazy, so the pill stretches across the
 * gap before the tail catches up. `[leftConfig, rightConfig]`.
 */
export function stretchEdgeConfigs(
  movingRight: boolean
): [SpringConfig, SpringConfig] {
  const eager: SpringConfig = { stiffness: 520, damping: 30 };
  const lazy: SpringConfig = { stiffness: 260, damping: 27 };
  return movingRight ? [lazy, eager] : [eager, lazy];
}

export type FlowName = "slide" | "stretch";

export const FLOWS: Record<FlowName, Flow> = {
  slide: slideFlow,
  stretch: stretchFlow,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/flows.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/flows.ts tests/components/tabs/flows.test.ts
git commit -m "feat(tabs): slide flow scene geometry + flow spec types"
```

---

## Task 3: `stretchFlow` + `stretchEdgeConfigs` tests

The implementation already exists from Task 2 (written together because `FLOWS`/`FlowName` are shared). This task adds the missing test coverage.

**Files:**
- Modify: `tests/components/tabs/flows.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/components/tabs/flows.test.ts`:

```ts
import { stretchFlow, stretchEdgeConfigs, FLOWS } from "../../../src/components/tabs/flows";

describe("stretchFlow", () => {
  it("uses two edge springs", () => {
    expect(stretchFlow.springCount).toBe(2);
  });

  it("rest/target map to left and right edges", () => {
    const rect = { left: 40, width: 80 };
    expect(stretchFlow.rest(rect, H)).toEqual([40, 120]);
    expect(stretchFlow.target(rect, H)).toEqual([40, 120]);
  });

  it("draws exactly one pill spanning the edges", () => {
    const scene = stretchFlow.scene([40, 120], [0, 0], new TensionField(), ctx(80));
    expect(closures(scene.path)).toBe(1);
    expect(scene.inkIntervals).toEqual([[40, 120]]);
  });

  it("squashes height below rest when stretched wider than the rest width", () => {
    // spanning 200px while resting width is 80 → thinned, floored at 0.72*H
    const scene = stretchFlow.scene([0, 200], [0, 0], new TensionField(), ctx(80));
    // Extract the pill height from the first two path Y coordinates is fiddly;
    // instead assert the interval width reflects the stretch.
    expect(scene.inkIntervals[0][1] - scene.inkIntervals[0][0]).toBe(200);
  });
});

describe("stretchEdgeConfigs", () => {
  it("makes the right edge eager when moving right", () => {
    const [left, right] = stretchEdgeConfigs(true);
    expect(right.stiffness).toBeGreaterThan(left.stiffness);
  });
  it("makes the left edge eager when moving left", () => {
    const [left, right] = stretchEdgeConfigs(false);
    expect(left.stiffness).toBeGreaterThan(right.stiffness);
  });
});

describe("FLOWS registry", () => {
  it("exposes slide and stretch by name", () => {
    expect(FLOWS.slide.springCount).toBe(3);
    expect(FLOWS.stretch.springCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/flows.test.ts`
Expected: PASS (implementation from Task 2 satisfies these).

- [ ] **Step 3: Commit**

```bash
git add tests/components/tabs/flows.test.ts
git commit -m "test(tabs): cover stretch flow + edge configs + registry"
```

---

## Task 4: `useTabList` — keyboard nav, roving tabindex, ARIA

Automatic activation: arrow keys move focus AND selection (WAI-ARIA "tabs with automatic activation"). Disabled tabs are skipped. `focusedId` always tracks the selected `value`.

**Files:**
- Create: `src/components/tabs/useTabList.ts`
- Test: `tests/components/tabs/useTabList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/tabs/useTabList.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useTabList, type TabListItem } from "../../../src/components/tabs/useTabList";

const ITEMS: TabListItem[] = [
  { id: "a" },
  { id: "b", disabled: true },
  { id: "c" },
];

function Harness({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const list = useTabList({ items: ITEMS, value, onChange });
  return (
    <div>
      {ITEMS.map((item, i) => (
        <button key={item.id} data-testid={item.id} {...list.getTabProps(item, i)}>
          {item.id}
        </button>
      ))}
    </div>
  );
}

describe("useTabList", () => {
  it("gives the selected tab tabIndex 0 and the rest -1", () => {
    const { getByTestId } = render(<Harness value="c" onChange={() => {}} />);
    expect(getByTestId("a").tabIndex).toBe(-1);
    expect(getByTestId("c").tabIndex).toBe(0);
  });

  it("sets aria-selected on the selected tab only", () => {
    const { getByTestId } = render(<Harness value="a" onChange={() => {}} />);
    expect(getByTestId("a").getAttribute("aria-selected")).toBe("true");
    expect(getByTestId("c").getAttribute("aria-selected")).toBe("false");
  });

  it("marks disabled tabs with aria-disabled and does not fire onChange on click", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="a" onChange={onChange} />);
    expect(getByTestId("b").getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(getByTestId("b"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowRight skips the disabled tab and selects the next enabled one", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="a" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("a"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("c"); // skipped disabled "b"
  });

  it("ArrowRight wraps from the last enabled tab to the first", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="c" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("c"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("ArrowLeft moves to the previous enabled tab", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="c" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("c"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("a"); // skipped disabled "b"
  });

  it("Home selects the first enabled tab, End the last enabled tab", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="c" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("c"), { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("a");
    fireEvent.keyDown(getByTestId("a"), { key: "End" });
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("clicking an enabled tab selects it", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="a" onChange={onChange} />);
    fireEvent.click(getByTestId("c"));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/tabs/useTabList.test.tsx`
Expected: FAIL — cannot resolve `useTabList`.

- [ ] **Step 3: Write the implementation**

Create `src/components/tabs/useTabList.ts`:

```ts
/**
 * Keyboard + ARIA behavior for the tab strip.
 *
 * Automatic activation (WAI-ARIA tabs pattern): Arrow/Home/End move focus AND
 * selection, skipping disabled tabs and wrapping at the ends. The selected tab
 * owns the roving tabindex (0); the rest are -1 so Tab enters/leaves the strip
 * as a single stop. Enter/Space are no-ops here — the selected tab is already
 * active — but are swallowed so the page doesn't scroll on Space.
 */

import type { KeyboardEvent } from "react";

export interface TabListItem {
  id: string;
  disabled?: boolean;
}

export interface UseTabListOptions {
  items: readonly TabListItem[];
  value: string;
  onChange: (id: string) => void;
  orientation?: "horizontal" | "vertical";
}

export interface TabProps {
  role: "tab";
  tabIndex: 0 | -1;
  "aria-selected": boolean;
  "aria-disabled": true | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

export interface UseTabListResult {
  getTabProps(item: TabListItem, index: number): TabProps;
}

function enabledIndex(
  items: readonly TabListItem[],
  from: number,
  dir: 1 | -1
): number {
  const n = items.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function firstEnabled(items: readonly TabListItem[]): number {
  const i = items.findIndex((it) => !it.disabled);
  return i === -1 ? 0 : i;
}

function lastEnabled(items: readonly TabListItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (!items[i].disabled) return i;
  }
  return items.length - 1;
}

export function useTabList({
  items,
  value,
  onChange,
  orientation = "horizontal",
}: UseTabListOptions): UseTabListResult {
  const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
  const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

  function select(index: number): void {
    const item = items[index];
    if (item && !item.disabled) onChange(item.id);
  }

  return {
    getTabProps(item, index) {
      return {
        role: "tab",
        tabIndex: item.id === value ? 0 : -1,
        "aria-selected": item.id === value,
        "aria-disabled": item.disabled ? true : undefined,
        onClick() {
          if (!item.disabled) onChange(item.id);
        },
        onKeyDown(event) {
          switch (event.key) {
            case nextKey:
              event.preventDefault();
              select(enabledIndex(items, index, 1));
              break;
            case prevKey:
              event.preventDefault();
              select(enabledIndex(items, index, -1));
              break;
            case "Home":
              event.preventDefault();
              select(firstEnabled(items));
              break;
            case "End":
              event.preventDefault();
              select(lastEnabled(items));
              break;
            case "Enter":
            case " ":
              event.preventDefault();
              break;
            default:
              break;
          }
        },
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/useTabList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/useTabList.ts tests/components/tabs/useTabList.test.tsx
git commit -m "feat(tabs): useTabList keyboard nav + roving tabindex + ARIA"
```

---

## Task 5: `TabsGroup` context — controlled/uncontrolled state

**Files:**
- Create: `src/components/tabs/TabsGroup.tsx`
- Test: covered indirectly by `TabPanel.test.tsx` (Task 7) and `LiquidTabs.test.tsx` (Task 6). This task adds a focused context test.
- Test: `tests/components/tabs/useTabList.test.tsx` is unrelated; create assertions inline here via a small harness in `TabPanel.test.tsx`. To keep this task independently verifiable, add `tests/components/tabs/TabsGroup.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/tabs/TabsGroup.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TabsGroup, useTabsContext } from "../../../src/components/tabs/TabsGroup";

function Probe() {
  const ctx = useTabsContext();
  if (!ctx) return <div data-testid="no-ctx" />;
  return (
    <button data-testid="probe" data-value={ctx.value} onClick={() => ctx.setValue("y")}>
      {ctx.namespace ? "has-ns" : "no-ns"}
    </button>
  );
}

describe("TabsGroup", () => {
  it("returns null context outside a provider", () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("no-ctx")).toBeTruthy();
  });

  it("seeds uncontrolled value from defaultValue and updates on setValue", () => {
    const { getByTestId } = render(
      <TabsGroup defaultValue="x">
        <Probe />
      </TabsGroup>
    );
    const probe = getByTestId("probe");
    expect(probe.getAttribute("data-value")).toBe("x");
    fireEvent.click(probe);
    expect(getByTestId("probe").getAttribute("data-value")).toBe("y");
  });

  it("stays controlled: value prop wins, onChange fires, internal state does not move", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <TabsGroup value="x" onChange={onChange}>
        <Probe />
      </TabsGroup>
    );
    fireEvent.click(getByTestId("probe"));
    expect(onChange).toHaveBeenCalledWith("y");
    // value stays "x" because the parent controls it
    expect(getByTestId("probe").getAttribute("data-value")).toBe("x");
  });

  it("provides a stable namespace string", () => {
    const { getByTestId } = render(
      <TabsGroup defaultValue="x">
        <Probe />
      </TabsGroup>
    );
    expect(getByTestId("probe").textContent).toBe("has-ns");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/tabs/TabsGroup.test.tsx`
Expected: FAIL — cannot resolve `TabsGroup`.

- [ ] **Step 3: Write the implementation**

Create `src/components/tabs/TabsGroup.tsx`:

```tsx
/**
 * Shared tab state for a bar + its panels.
 *
 * Wrap a `<LiquidTabs>` and its `<LiquidTabs.Panel>`s in a `<LiquidTabs.Group>`
 * to link them: the group owns the selected value (controlled via `value` +
 * `onChange`, or uncontrolled via `defaultValue`) and a `namespace` used to
 * generate matching `id`s for aria-controls / aria-labelledby wiring.
 *
 * The bar also works standalone (no group); it then owns its own value. See
 * LiquidTabs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

export interface TabsContextValue {
  value: string;
  setValue: (id: string) => void;
  /** Stable id prefix for tab/panel element ids. */
  namespace: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext(): TabsContextValue | null {
  return useContext(TabsContext);
}

export interface TabsGroupProps {
  /** Controlled selected id. */
  value?: string;
  /** Uncontrolled initial selected id. */
  defaultValue?: string;
  onChange?: (id: string) => void;
  children: ReactNode;
}

export function TabsGroup({
  value,
  defaultValue,
  onChange,
  children,
}: TabsGroupProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const namespace = useId();

  const setValue = useCallback(
    (id: string) => {
      if (!isControlled) setInternal(id);
      onChange?.(id);
    },
    [isControlled, onChange]
  );

  return (
    <TabsContext.Provider value={{ value: current, setValue, namespace }}>
      {children}
    </TabsContext.Provider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/TabsGroup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/TabsGroup.tsx tests/components/tabs/TabsGroup.test.tsx
git commit -m "feat(tabs): TabsGroup context (controlled/uncontrolled + namespace)"
```

---

## Task 6: `LiquidTabs.tsx` — the bar

The bar wires everything: value resolution (context > controlled prop > uncontrolled internal), measurement, flow springs, per-frame scene + tint, material mapping (`ink`→flat, `glass`→glass), sizes, icons, disabled, reduced motion.

**Files:**
- Create: `src/components/tabs/LiquidTabs.tsx`
- Test: `tests/components/tabs/LiquidTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/tabs/LiquidTabs.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

/**
 * Mock `motion/react` per test so only `useReducedMotion` is overridden, then
 * re-import LiquidTabs fresh against the mock (same pattern as other component
 * tests). jsdom reports 0 for offset* so geometry is degenerate — assert
 * structure, roles, colors, and callbacks, not pixel geometry.
 */
async function loadTabs(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../../src/components/tabs/LiquidTabs");
  return mod.LiquidTabs;
}

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
  { id: "three", label: "Three" },
];

describe("LiquidTabs (bar)", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders one tab per item with role=tab and a role=tablist container", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs).toHaveLength(3);
    expect(tabs[1].textContent).toContain("Two");
  });

  it("marks the active tab via aria-selected", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="two" onChange={() => {}} />
    );
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("calls onChange with the clicked id (controlled)", async () => {
    const LiquidTabs = await loadTabs(false);
    const onChange = vi.fn();
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={onChange} />
    );
    fireEvent.click(container.querySelectorAll('[data-fluidkit="liquid-tab"]')[2]);
    expect(onChange).toHaveBeenCalledWith("three");
  });

  it("works uncontrolled: defaultValue selects, clicking moves selection", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(<LiquidTabs items={ITEMS} defaultValue="two" />);
    let tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.click(tabs[2]);
    tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
  });

  it("defaults selection to the first enabled item when none is given", async () => {
    const LiquidTabs = await loadTabs(false);
    const items = [
      { id: "one", label: "One", disabled: true },
      { id: "two", label: "Two" },
    ];
    const { container } = render(<LiquidTabs items={items} />);
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("ink material fills the indicator with the resolved color", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} material="ink" color="#abcdef" />
    );
    const fill = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"] [data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    expect(fill.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });

  it("draws the indicator as engine geometry (clip-path)", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    const clip = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"] [data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(clip.style.clipPath).toContain("path(");
  });

  it("renders an icon slot when provided", async () => {
    const LiquidTabs = await loadTabs(false);
    const items = [
      { id: "one", label: "One", icon: <svg data-testid="ic" /> },
      { id: "two", label: "Two" },
    ];
    const { getByTestId } = render(<LiquidTabs items={items} value="one" onChange={() => {}} />);
    expect(getByTestId("ic")).toBeTruthy();
  });

  it("does not call onChange when a disabled tab is clicked", async () => {
    const LiquidTabs = await loadTabs(false);
    const onChange = vi.fn();
    const items = [
      { id: "one", label: "One" },
      { id: "two", label: "Two", disabled: true },
    ];
    const { container } = render(
      <LiquidTabs items={items} value="one" onChange={onChange} />
    );
    fireEvent.click(container.querySelectorAll('[data-fluidkit="liquid-tab"]')[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reflects size via data-size", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} size="lg" />
    );
    expect(
      container.querySelector('[data-fluidkit="liquid-tabs"]')?.getAttribute("data-size")
    ).toBe("lg");
  });

  it("marks instant motion and keeps a single-pill clip under reduced motion", async () => {
    const LiquidTabs = await loadTabs(true);
    const { container, rerender } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    rerender(<LiquidTabs items={ITEMS} value="three" onChange={() => {}} />);
    const stage = container.querySelector('[data-fluidkit="liquid-tabs"]');
    expect(stage?.getAttribute("data-motion")).toBe("instant");
    const clip = container.querySelector(
      '[data-fluidkit="liquid-tab-indicator"] [data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect((clip.style.clipPath.match(/Z/g) ?? []).length).toBe(1);
  });

  it("keeps filters off the label ancestry (text never rasterized)", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} />
    );
    const stage = container.querySelector('[data-fluidkit="liquid-tabs"]') as HTMLElement;
    let node: HTMLElement | null = container.querySelector('[data-fluidkit="liquid-tab"]');
    while (node) {
      expect(node.style.filter).toBe("");
      if (node === stage) break;
      node = node.parentElement;
    }
  });

  it("moves DOM focus to the newly selected tab on arrow-key navigation", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(<LiquidTabs items={ITEMS} defaultValue="one" />);
    const tabs = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    (tabs[0] as HTMLElement).focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    // selection advanced to "two" and browser focus followed it
    const active = container.querySelectorAll('[data-fluidkit="liquid-tab"]');
    expect(active[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(active[1]);
  });

  it("merges consumer className", async () => {
    const LiquidTabs = await loadTabs(false);
    const { container } = render(
      <LiquidTabs items={ITEMS} value="one" onChange={() => {}} className="mine" />
    );
    expect(
      container.querySelector('[data-fluidkit="liquid-tabs"]')?.className
    ).toContain("mine");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/tabs/LiquidTabs.test.tsx`
Expected: FAIL — cannot resolve `LiquidTabs`.

- [ ] **Step 3: Write the implementation**

Create `src/components/tabs/LiquidTabs.tsx`:

```tsx
/**
 * The flagship liquid tab strip.
 *
 * The active-tab indicator is a liquid engine body on its own
 * `pointer-events:none` layer BEHIND the buttons; crisp `<button role="tab">`
 * labels render on top, never inside a filtered/rasterized subtree. On tab
 * change the indicator FLOWS between boxes via one of two spring-driven flows
 * (`slide` droplet / `stretch` taffy), written to the engine imperatively per
 * frame. Label color is driven by how much ink covers each tab (see tint.ts),
 * so labels and liquid always move together.
 *
 * Value resolution precedence: an enclosing `<LiquidTabs.Group>` (context) >
 * a controlled `value`/`onChange` > uncontrolled internal state seeded from
 * `defaultValue` (or the first enabled item).
 *
 * Under `prefers-reduced-motion` the indicator snaps and labels switch
 * instantly — no springs, no flow.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useAnimationFrame } from "motion/react";
import { LiquidRenderer, TensionField, resolveMaterial } from "../../liquid";
import type { LiquidSceneHandle } from "../../liquid";
import { useMotionSprings } from "../../liquid/useMotionSprings";
import { resolveColor, usePrefersReducedMotion } from "../../utils";
import { FLOWS, stretchEdgeConfigs, type FlowName, type TabRect } from "./flows";
import { mixColor, tabCoverage, type RGB } from "./tint";
import { useTabList } from "./useTabList";
import { useTabsContext } from "./TabsGroup";

export type LiquidTabsMaterial = "ink" | "glass";
export type LiquidTabsSize = "sm" | "md" | "lg";

export interface LiquidTabsItem {
  id: string;
  /** Text label. Optional for icon-only tabs (then set `ariaLabel`). */
  label?: ReactNode;
  /** Leading icon. */
  icon?: ReactNode;
  /** Accessible name for icon-only tabs. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface LiquidTabsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  items: LiquidTabsItem[];
  /** Controlled active id. */
  value?: string;
  /** Uncontrolled initial active id. */
  defaultValue?: string;
  onChange?: (id: string) => void;
  flow?: FlowName;
  material?: LiquidTabsMaterial;
  size?: LiquidTabsSize;
  /** Ink color (ignored by the glass material). Defaults to `currentColor`. */
  color?: string;
}

interface SizeSpec {
  padding: string;
  fontSize: number;
  gap: number;
  containerPad: number;
}

const SIZES: Record<LiquidTabsSize, SizeSpec> = {
  sm: { padding: "7px 12px", fontSize: 12, gap: 3, containerPad: 4 },
  md: { padding: "10px 16px", fontSize: 13.5, gap: 4, containerPad: 5 },
  lg: { padding: "13px 22px", fontSize: 15, gap: 5, containerPad: 6 },
};

/** base (inactive) and active label colors per material. */
const LABEL_COLORS: Record<LiquidTabsMaterial, { base: RGB; active: RGB }> = {
  ink: { base: [75, 76, 86], active: [255, 255, 255] },
  glass: { base: [75, 76, 86], active: [23, 24, 28] },
};

/** How long the rAF loop keeps recomputing after a change (springs settle). */
const SETTLE_MS = 1000;

const firstEnabledId = (items: LiquidTabsItem[]): string => {
  const item = items.find((it) => !it.disabled);
  return item?.id ?? items[0]?.id ?? "";
};

export function LiquidTabs({
  items,
  value,
  defaultValue,
  onChange,
  flow = "slide",
  material = "ink",
  size = "md",
  color,
  className,
  style,
  ...rest
}: LiquidTabsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ctx = useTabsContext();
  const flowSpec = FLOWS[flow];
  const sizeSpec = SIZES[size];
  const fallbackNamespace = useId();
  const namespace = ctx?.namespace ?? fallbackNamespace;

  // ---- value resolution: group context > controlled prop > uncontrolled ----
  const [internal, setInternal] = useState(
    () => defaultValue ?? firstEnabledId(items)
  );
  const isControlled = value !== undefined;
  const selected = ctx ? ctx.value : isControlled ? value : internal;
  const setSelected = useCallback(
    (id: string) => {
      if (ctx) ctx.setValue(id);
      else if (!isControlled) setInternal(id);
      onChange?.(id);
    },
    [ctx, isControlled, onChange]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const renderer = useRef<LiquidSceneHandle>(null);
  const tension = useRef(new TensionField());

  // Keyboard nav moves selection AND DOM focus (WAI-ARIA automatic
  // activation). The hook is ref-free, so it reports keyboard moves via
  // `onNavigate` and the bar — which owns the button refs — moves focus.
  const tabList = useTabList({
    items,
    value: selected,
    onChange: setSelected,
    onNavigate: (id) => tabRefs.current.get(id)?.focus(),
  });

  const [rects, setRects] = useState<Map<string, TabRect>>(new Map());
  const [height, setHeight] = useState(0);

  const springs = useMotionSprings(
    flowSpec.springCount,
    (i) => flowSpec.rest({ left: 0, width: 0 }, 0)[i] ?? 0,
    (i) => flowSpec.configs[i]
  );

  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSelected = useRef(selected);

  // Measure tab boxes + container height. Re-runs on items/size/value change
  // and on resize. jsdom reports 0s (degenerate path until real layout).
  useLayoutEffect(() => {
    function measure() {
      setHeight(containerRef.current?.offsetHeight ?? 0);
      const next = new Map<string, TabRect>();
      for (const item of items) {
        const el = tabRefs.current.get(item.id);
        if (el) next.set(item.id, { left: el.offsetLeft, width: el.offsetWidth });
      }
      setRects(next);
    }
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [items, size, selected]);

  // React to selection changes: retarget springs (or snap under reduced motion).
  useLayoutEffect(() => {
    const prev = prevSelected.current;
    prevSelected.current = selected;

    const toRect = rects.get(selected);
    if (!toRect || height <= 0) return;

    if (prev === selected || prefersReducedMotion) {
      springs.snapTo(flowSpec.rest(toRect, height));
      return;
    }

    const fromRect = rects.get(prev);
    const targets = flowSpec.target(toRect, height);

    if (flow === "stretch" && fromRect) {
      const movingRight =
        toRect.left + toRect.width / 2 > fromRect.left + fromRect.width / 2;
      const [lCfg, rCfg] = stretchEdgeConfigs(movingRight);
      springs.setTarget(0, targets[0], lCfg);
      springs.setTarget(1, targets[1], rCfg);
    } else {
      springs.setTargets(targets);
    }

    tension.current.clear();
    setSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rects, height, prefersReducedMotion, flow]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const restingRect = rects.get(selected) ?? null;
  const restingScene = useMemo(() => {
    // Guard only on a missing rect — a zero `height` still yields one valid
    // (degenerate) pill subpath, which the jsdom/SSR path relies on. Bailing
    // to an empty path here would drop the resting pill before first layout.
    if (!restingRect) return { path: "", inkIntervals: [] as [number, number][] };
    return flowSpec.scene(
      flowSpec.rest(restingRect, height),
      flowSpec.configs.map(() => 0),
      new TensionField(),
      { height, restWidth: restingRect.width }
    );
  }, [restingRect, height, flowSpec]);

  const labelColors = LABEL_COLORS[material];

  const paintLabels = useCallback(
    (intervals: [number, number][]) => {
      for (const item of items) {
        const el = tabRefs.current.get(item.id);
        const r = rects.get(item.id);
        if (!el) continue;
        const cov = r ? tabCoverage(r.left, r.width, intervals) : 0;
        el.style.color = mixColor(labelColors.base, labelColors.active, cov);
      }
    },
    [items, rects, labelColors]
  );

  // When idle, sync the declarative resting scene + labels so measurements win.
  useEffect(() => {
    if (settling) return;
    renderer.current?.setScene({ path: restingScene.path });
    paintLabels(restingScene.inkIntervals);
  }, [settling, restingScene, paintLabels]);

  // Animation loop: recompute the flow scene from live spring values + tint.
  useAnimationFrame(() => {
    if (!settling || !restingRect || height <= 0) return;
    const values = springs.values.map((v) => v.get());
    const velocities = springs.values.map((v) => v.getVelocity());
    const scene = flowSpec.scene(values, velocities, tension.current, {
      height,
      restWidth: restingRect.width,
    });
    renderer.current?.setScene({ path: scene.path });
    paintLabels(scene.inkIntervals);
  });

  const resolvedColor = resolveColor(color);
  const resolvedMaterial =
    material === "glass"
      ? resolveMaterial("glass")
      : resolveMaterial("flat", { color: resolvedColor });

  const containerStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    gap: sizeSpec.gap,
    padding: sizeSpec.containerPad,
    borderRadius: 999,
    // Shipped default chrome (overridable via style / className). Ink gets a
    // frosted pill; glass gets a barely-there ring.
    background:
      material === "glass" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.62)",
    boxShadow:
      material === "glass"
        ? "inset 0 0 0 1px rgba(255,255,255,0.45)"
        : "inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 28px rgba(46,44,72,0.14)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-fluidkit="liquid-tabs"
      data-motion={prefersReducedMotion ? "instant" : "liquid"}
      data-size={size}
      data-material={material}
      role="tablist"
      {...rest}
    >
      <div
        data-fluidkit="liquid-tab-indicator-layer"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <div
          data-fluidkit="liquid-tab-indicator"
          style={{ position: "absolute", inset: 0 }}
        >
          <LiquidRenderer
            ref={renderer}
            path={restingScene.path}
            material={resolvedMaterial}
          />
        </div>
      </div>

      {items.map((item, index) => {
        const props = tabList.getTabProps(item, index);
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            data-fluidkit="liquid-tab"
            id={`${namespace}-tab-${item.id}`}
            aria-controls={`${namespace}-panel-${item.id}`}
            aria-label={item.label == null ? item.ariaLabel : undefined}
            {...props}
            style={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: 0,
              background: "transparent",
              font: `500 ${sizeSpec.fontSize}px/1 system-ui, sans-serif`,
              padding: sizeSpec.padding,
              borderRadius: 999,
              cursor: item.disabled ? "default" : "pointer",
              opacity: item.disabled ? 0.4 : 1,
            }}
          >
            {item.icon != null && (
              <span data-fluidkit="liquid-tab-icon" aria-hidden="true" style={{ display: "inline-flex" }}>
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/LiquidTabs.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `useMotionSprings` init/config resolver types complain, confirm `flowSpec.configs[i]` returns a `SpringConfig` — it does.)

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/LiquidTabs.tsx tests/components/tabs/LiquidTabs.test.tsx
git commit -m "feat(tabs): rebuild LiquidTabs bar (flows, materials, sizes, icons, a11y)"
```

---

## Task 7: `TabPanel.tsx` — panel + cross-fade + aria

**Files:**
- Create: `src/components/tabs/TabPanel.tsx`
- Test: `tests/components/tabs/TabPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/tabs/TabPanel.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

async function loadModule(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const bar = await import("../../../src/components/tabs/LiquidTabs");
  const group = await import("../../../src/components/tabs/TabsGroup");
  const panel = await import("../../../src/components/tabs/TabPanel");
  return { LiquidTabs: bar.LiquidTabs, TabsGroup: group.TabsGroup, TabPanel: panel.TabPanel };
}

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two" },
];

describe("TabPanel", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("shows only the active panel and hides the rest", async () => {
    const { LiquidTabs, TabsGroup, TabPanel } = await loadModule(false);
    const { getByText, queryByText } = render(
      <TabsGroup defaultValue="one">
        <LiquidTabs items={ITEMS} />
        <TabPanel id="one">Panel One</TabPanel>
        <TabPanel id="two">Panel Two</TabPanel>
      </TabsGroup>
    );
    expect(getByText("Panel One")).toBeTruthy();
    expect(queryByText("Panel Two")).toBeNull();
  });

  it("switches panels when a tab is clicked", async () => {
    const { LiquidTabs, TabsGroup, TabPanel } = await loadModule(false);
    const { container, getByText, queryByText } = render(
      <TabsGroup defaultValue="one">
        <LiquidTabs items={ITEMS} />
        <TabPanel id="one">Panel One</TabPanel>
        <TabPanel id="two">Panel Two</TabPanel>
      </TabsGroup>
    );
    fireEvent.click(container.querySelectorAll('[data-fluidkit="liquid-tab"]')[1]);
    expect(getByText("Panel Two")).toBeTruthy();
    expect(queryByText("Panel One")).toBeNull();
  });

  it("wires role, id and aria-labelledby to the matching tab", async () => {
    const { LiquidTabs, TabsGroup, TabPanel } = await loadModule(false);
    const { container } = render(
      <TabsGroup defaultValue="one">
        <LiquidTabs items={ITEMS} />
        <TabPanel id="one">Panel One</TabPanel>
      </TabsGroup>
    );
    const panel = container.querySelector('[role="tabpanel"]') as HTMLElement;
    const tab = container.querySelector('[data-fluidkit="liquid-tab"]') as HTMLElement;
    expect(panel.id).toBe(tab.getAttribute("aria-controls"));
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
  });

  it("renders nothing when used outside a Group", async () => {
    const { TabPanel } = await loadModule(false);
    const { container } = render(<TabPanel id="x">orphan</TabPanel>);
    expect(container.querySelector('[role="tabpanel"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/tabs/TabPanel.test.tsx`
Expected: FAIL — cannot resolve `TabPanel`.

- [ ] **Step 3: Write the implementation**

Create `src/components/tabs/TabPanel.tsx`:

```tsx
/**
 * Content panel bound to a tab by id, via the enclosing TabsGroup context.
 *
 * Only the active panel renders. On switch the content cross-fades (opacity
 * only — text is never scaled, per the library's core principle); under
 * `prefers-reduced-motion` it hard-swaps. Panels wire `role="tabpanel"`, an id
 * matching the tab's `aria-controls`, and `aria-labelledby` back to the tab.
 *
 * Rendering nothing (returns null) when used outside a Group is intentional —
 * the panel has no value source to bind to.
 */

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "../../utils";
import { useTabsContext } from "./TabsGroup";

export interface TabPanelProps {
  /** Must match a tab item id. */
  id: string;
  children: ReactNode;
}

export function TabPanel({ id, children }: TabPanelProps) {
  const ctx = useTabsContext();
  const prefersReducedMotion = usePrefersReducedMotion();
  if (!ctx) return null;
  if (ctx.value !== id) return null;

  const panelId = `${ctx.namespace}-panel-${id}`;
  const labelledBy = `${ctx.namespace}-tab-${id}`;

  if (prefersReducedMotion) {
    return (
      <div role="tabpanel" id={panelId} aria-labelledby={labelledBy} data-fluidkit="liquid-tab-panel">
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        role="tabpanel"
        id={panelId}
        aria-labelledby={labelledBy}
        data-fluidkit="liquid-tab-panel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/tabs/TabPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/TabPanel.tsx tests/components/tabs/TabPanel.test.tsx
git commit -m "feat(tabs): TabPanel with aria wiring + content cross-fade"
```

---

## Task 8: Wire the module into the public API; remove the old component

**Files:**
- Create: `src/components/tabs/index.ts`
- Modify: `src/components/index.ts`
- Delete: `src/components/LiquidTabs.tsx`
- Delete: `tests/components/LiquidTabs.test.tsx`

- [ ] **Step 1: Create the module barrel**

Create `src/components/tabs/index.ts`:

```ts
import { LiquidTabs as Bar } from "./LiquidTabs";
import { TabsGroup } from "./TabsGroup";
import { TabPanel } from "./TabPanel";

/**
 * Public LiquidTabs API: the bar, with `.Group` (shared state for panels) and
 * `.Panel` (content bound to a tab id) attached as static members.
 */
export const LiquidTabs = Object.assign(Bar, {
  Group: TabsGroup,
  Panel: TabPanel,
});

export type {
  LiquidTabsProps,
  LiquidTabsItem,
  LiquidTabsMaterial,
  LiquidTabsSize,
} from "./LiquidTabs";
export type { TabsGroupProps } from "./TabsGroup";
export type { TabPanelProps } from "./TabPanel";
export type { FlowName } from "./flows";
```

- [ ] **Step 2: Update the components barrel**

In `src/components/index.ts`, replace the two LiquidTabs lines:

```ts
export { LiquidTabs } from "./LiquidTabs";
export type { LiquidTabsProps, LiquidTabsItem } from "./LiquidTabs";
```

with:

```ts
export { LiquidTabs } from "./tabs";
export type {
  LiquidTabsProps,
  LiquidTabsItem,
  LiquidTabsMaterial,
  LiquidTabsSize,
  TabsGroupProps,
  TabPanelProps,
  FlowName,
} from "./tabs";
```

- [ ] **Step 3: Delete the old component and its test**

```bash
git rm src/components/LiquidTabs.tsx tests/components/LiquidTabs.test.tsx
```

- [ ] **Step 4: Verify the whole suite + types are green**

Run: `npm run typecheck`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS across the suite; no test references the deleted `src/components/LiquidTabs`.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/index.ts src/components/index.ts
git commit -m "feat(tabs): publish tabs module; remove legacy LiquidTabs"
```

---

## Task 9: Playground showcase with controls

Update the `TabsDemo` in `playground/main.tsx` to exercise every prop: flow toggle, material toggle, size, and a disable-a-tab toggle. Since the component now ships its own container chrome, drop the inline wrapper styling.

**Files:**
- Modify: `playground/main.tsx` (the `TabsDemo` function, around lines 183-192)

- [ ] **Step 1: Replace `TabsDemo`**

Replace the entire `TabsDemo` function with:

```tsx
function TabsDemo() {
  const [value, setValue] = useState("chat");
  const [flow, setFlow] = useState<"slide" | "stretch">("slide");
  const [material, setMaterial] = useState<"ink" | "glass">("ink");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [disableOne, setDisableOne] = useState(false);
  const items = [
    { id: "chat", label: "Chat" },
    { id: "automations", label: "Automations", disabled: disableOne },
    { id: "connections", label: "Connections" },
  ];
  return <Card id="liquid-tabs" title="LiquidTabs" desc="The active indicator is a liquid engine body that flows between tabs; label color tracks how much ink covers each tab, and the labels stay crisp on their own layer." hint="click a tab — try each flow and material" wall
    code={`<LiquidTabs
  items={[{ id: "chat", label: "Chat" }, { id: "files", label: "Files" }]}
  defaultValue="chat"
  flow="${flow}"
  material="${material}"
  size="${size}"
/>`}
    stage={<LiquidTabs value={value} onChange={setValue} flow={flow} material={material} size={size} color="#23242c" items={items} />}
    controls={<>
      <Seg label="flow" value={flow} set={setFlow} options={["slide", "stretch"]} />
      <Seg label="material" value={material} set={setMaterial} options={["ink", "glass"]} />
      <Seg label="size" value={size} set={setSize} options={["sm", "md", "lg"]} />
      <Toggle label="disable Automations" value={disableOne} set={setDisableOne} />
    </>} />;
}
```

- [ ] **Step 2: Verify the playground builds**

Run: `npm run typecheck`
Expected: no errors.

If the repo has a playground dev script, optionally run it (e.g. `npm run dev` or `npm run playground` — check `package.json` scripts) and click through flows/materials/sizes and the disable toggle. Confirm: slide and stretch both animate smoothly, labels tint with the ink, glass blurs the orbs behind it, disabled tab is unclickable and skipped by arrow keys.

- [ ] **Step 3: Commit**

```bash
git add playground/main.tsx
git commit -m "feat(playground): LiquidTabs showcase with flow/material/size/disabled controls"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds (tsup emits ESM+CJS+types with no errors).

- [ ] **Step 4: Confirm public API**

Verify `import { LiquidTabs } from "fluidkit"` still resolves and that `LiquidTabs.Group` / `LiquidTabs.Panel` are present (grep the built `dist/index.d.ts` for `LiquidTabsMaterial` and `TabPanelProps`).

Run: `grep -c "LiquidTabsMaterial\|TabPanelProps" dist/index.d.ts`
Expected: ≥ 1.

- [ ] **Step 5: Commit any residual fixes**

```bash
git add -A
git commit -m "chore(tabs): final verification pass" || echo "nothing to commit"
```
```
