import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";

/**
 * `LiquidDrag` reads `usePrefersReducedMotion()`, which reads Motion's
 * `useReducedMotion()` under the hood. Same per-test mocking pattern as
 * Magnetic/FlowStagger/Droplets: mock `motion/react`, keep the real
 * `motion` factory (and every real hook the pipeline needs — `useVelocity`,
 * `useTransform`, `useSpring`, `useMotionValue`) via `importOriginal`, reset
 * the module registry so `LiquidDrag` re-imports fresh against the mock.
 */
async function loadLiquidDrag(initialReduced: boolean) {
  vi.resetModules();
  const state = { reduced: initialReduced };
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => state.reduced };
  });
  const mod = await import("../../src/components/LiquidDrag");
  return {
    LiquidDrag: mod.LiquidDrag,
    velocityToStretch: mod.velocityToStretch,
    state,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Motion writes `x`/`y`/`scaleX`/`scaleY` motion values onto the element as
 * substrings of the inline `transform` (confirmed against Magnetic's
 * `readTranslate` helper); a value that was never animated away from its
 * default is omitted entirely. Parsing the live DOM lets tests assert on
 * the drag position and stretch without reaching into Motion internals. */
function readTransform(el: HTMLElement): {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
} {
  const transform = el.style.transform;
  const x = /translateX\(([-\d.]+)px\)/.exec(transform);
  const y = /translateY\(([-\d.]+)px\)/.exec(transform);
  const scaleX = /scaleX\(([-\d.]+)\)/.exec(transform);
  const scaleY = /scaleY\(([-\d.]+)\)/.exec(transform);
  return {
    x: x ? parseFloat(x[1]) : 0,
    y: y ? parseFloat(y[1]) : 0,
    scaleX: scaleX ? parseFloat(scaleX[1]) : 1,
    scaleY: scaleY ? parseFloat(scaleY[1]) : 1,
  };
}

/** jsdom doesn't run layout, so `getBoundingClientRect` is all-zeros by
 * default; a fixed stub keeps Motion's drag/pan measurement well-defined
 * across every test, same trick Magnetic's and Droplets' tests rely on. */
function stubRect(el: HTMLElement) {
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 50,
      bottom: 50,
      width: 50,
      height: 50,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

const POINTER_ID = 1;

function pointerDown(el: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(el, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: 1,
    isPrimary: true,
    pointerType: "mouse",
  });
}

function pointerMove(x: number, y: number) {
  fireEvent.pointerMove(window, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
    buttons: 1,
    isPrimary: true,
    pointerType: "mouse",
  });
}

function pointerUp(x: number, y: number) {
  fireEvent.pointerUp(window, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerType: "mouse",
  });
}

/** A single big jump: enough to move `x`/`y` but too fast/coarse (no real
 * elapsed time between samples) to register meaningful velocity — used by
 * tests that only care about drag POSITION, not the stretch pipeline. */
function dragOnce(el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  pointerDown(el, from.x, from.y);
  pointerMove(to.x, to.y);
}

/** A rapid multi-step drag with small real delays between samples, so
 * Motion's `useVelocity` has actual elapsed time to compute a meaningful
 * (large) velocity from — used by tests that assert on the stretch
 * pipeline. Leaves the pointer DOWN (mid-drag) so assertions land before
 * release/momentum complicate the picture. */
async function fastDrag(el: HTMLElement, steps: number, stepPx: number) {
  pointerDown(el, 0, 0);
  let cx = 0;
  for (let i = 0; i < steps; i++) {
    cx += stepPx;
    pointerMove(cx, 0);
    await new Promise((r) => setTimeout(r, 8));
  }
  return cx;
}

describe("LiquidDrag", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
    vi.restoreAllMocks();
    // Defensive: a failed assertion mid-drag (thrown before a test's own
    // `pointerUp`) would otherwise leave Motion's pan session "captured" on
    // `window`, corrupting whichever drag gesture the NEXT test starts.
    // Releasing the same synthetic pointer id here is a no-op when the
    // previous test already released cleanly.
    pointerUp(0, 0);
  });

  it('renders children inside a data-fluidkit="liquid-drag" wrapper that responds to pointer drag', async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const { container, getByText } = render(
      <LiquidDrag>
        <span>drag me</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    expect(root).not.toBeNull();
    expect(getByText("drag me")).toBeInTheDocument();

    stubRect(root);
    dragOnce(root, { x: 0, y: 0 }, { x: 40, y: 0 });
    await vi.waitFor(() => {
      expect(readTransform(root).x).toBeCloseTo(40, 0);
    });
    pointerUp(40, 0);
  });

  it("scales stay at 1 at rest (no scaleX/scaleY in the transform before any drag)", async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const { container } = render(
      <LiquidDrag>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    expect(readTransform(root)).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  });

  it("a velocity spike stretches the dominant axis and compresses the cross axis (volume-preserving)", async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const { container } = render(
      <LiquidDrag>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);

    const cx = await fastDrag(root, 8, 60);

    const { scaleX, scaleY } = readTransform(root);
    expect(scaleX).toBeGreaterThan(1);
    expect(scaleY).toBeLessThan(1);
    // Volume-preserving: scaleX * scaleY stays close to 1.
    expect(scaleX * scaleY).toBeCloseTo(1, 1);

    pointerUp(cx, 0);
  });

  it("reduced motion pins scaleX/scaleY at 1 while dragging still moves the element", async () => {
    const { LiquidDrag } = await loadLiquidDrag(true);
    const { container } = render(
      <LiquidDrag>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);

    const cx = await fastDrag(root, 8, 60);

    await vi.waitFor(() => {
      expect(readTransform(root).x).toBeCloseTo(cx, 0);
    });
    const { scaleX, scaleY } = readTransform(root);
    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
    expect(root.getAttribute("data-animating")).toBe("false");

    pointerUp(cx, 0);
  });

  it("elasticity={0} disables deformation entirely while dragging still moves the element", async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const { container } = render(
      <LiquidDrag elasticity={0}>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);

    const cx = await fastDrag(root, 8, 60);

    await vi.waitFor(() => {
      expect(readTransform(root).x).toBeCloseTo(cx, 0);
    });
    const { scaleX, scaleY } = readTransform(root);
    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
    expect(root.getAttribute("data-animating")).toBe("false");

    pointerUp(cx, 0);
  });

  it("onDragStart/onDragEnd receive Motion's PanInfo signature, not native DOM drag events", async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    const { container } = render(
      <LiquidDrag onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);

    // A genuine native HTML5 "dragstart" DOM event must NOT reach the
    // Motion-typed handler — proves it's wired through Motion's own
    // pointer-gesture system, not forwarded as a raw DOM attribute.
    fireEvent(root, new Event("dragstart", { bubbles: true }));
    expect(onDragStart).not.toHaveBeenCalled();

    dragOnce(root, { x: 0, y: 0 }, { x: 20, y: 0 });
    await vi.waitFor(() => {
      expect(onDragStart).toHaveBeenCalled();
    });
    const [, info] = onDragStart.mock.calls[0];
    // Motion's PanInfo shape: point/offset/velocity, each {x, y}. A native
    // DragEvent has none of these.
    expect(info).toHaveProperty("point.x");
    expect(info).toHaveProperty("offset.x");
    expect(info).toHaveProperty("velocity.x");

    pointerUp(20, 0);
    await vi.waitFor(() => {
      expect(onDragEnd).toHaveBeenCalled();
    });
  });

  it("commits no React updates while the pointer drags (springs driven imperatively)", async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const onRender = vi.fn();
    const { container } = render(
      <Profiler id="liquid-drag" onRender={onRender}>
        <LiquidDrag>
          <span>x</span>
        </LiquidDrag>
      </Profiler>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);
    const commitsAfterMount = onRender.mock.calls.length;

    pointerDown(root, 0, 0);
    for (let i = 0; i < 10; i++) {
      pointerMove(i * 8, 0);
      await new Promise((r) => setTimeout(r, 4));
    }
    pointerUp(80, 0);
    await new Promise((r) => setTimeout(r, 50));

    expect(onRender.mock.calls.length).toBe(commitsAfterMount);
  });

  it("flipping reduced motion ON mid-drag pins scales at exactly 1 while position keeps tracking", async () => {
    const { LiquidDrag, state } = await loadLiquidDrag(false);
    const { container, rerender } = render(
      <LiquidDrag>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);

    // Get genuinely mid-stretch first — the flip must never freeze the
    // wrapper deformed (same review lesson as Magnetic's gating-flip test).
    let cx = await fastDrag(root, 8, 60);
    expect(readTransform(root).scaleX).toBeGreaterThan(1);

    state.reduced = true;
    rerender(
      <LiquidDrag>
        <span>x</span>
      </LiquidDrag>
    );

    // Keep the same drag gesture going after the flip.
    for (let i = 0; i < 5; i++) {
      cx += 60;
      pointerMove(cx, 0);
      await sleep(8);
    }

    // Scales land at EXACTLY 1 — the literal-bypass path, not a spring
    // still wobbling toward 1 — while the drag position keeps following
    // the pointer (drag itself is never gated by reduced motion).
    await vi.waitFor(() => {
      const t = readTransform(root);
      expect(t.scaleX).toBe(1);
      expect(t.scaleY).toBe(1);
      expect(t.x).toBeCloseTo(cx, 0);
    });
    expect(root.getAttribute("data-animating")).toBe("false");

    pointerUp(cx, 0);
  });

  it("a mid-mount elasticity change is live in the stretch pipeline (no stale closure)", async () => {
    const { LiquidDrag } = await loadLiquidDrag(false);
    const { container, rerender } = render(
      <LiquidDrag elasticity={1}>
        <span>x</span>
      </LiquidDrag>
    );
    const root = container.querySelector(
      '[data-fluidkit="liquid-drag"]'
    ) as HTMLElement;
    stubRect(root);

    // elasticity=1 clamps at 1.25 — drag until the live stretch clearly
    // exceeds what the NEW clamp (1.01 below) could ever allow.
    pointerDown(root, 0, 0);
    let cx = 0;
    for (let i = 0; i < 60 && readTransform(root).scaleX <= 1.08; i++) {
      cx += 60;
      pointerMove(cx, 0);
      await sleep(8);
    }
    expect(readTransform(root).scaleX).toBeGreaterThan(1.08);

    // Same mount, new elasticity. If a future Motion version memoized the
    // useTransform callback (stale closure over the old elasticity), the
    // raw target would stay ~1.25 and the spring would hold well above the
    // new clamp for as long as the velocity stays high.
    rerender(
      <LiquidDrag elasticity={0.04}>
        <span>x</span>
      </LiquidDrag>
    );

    // Keep the velocity pegged while the smoothing spring adapts
    // (~320ms), then sample: every reading must respect the new clamp
    // (1.01) plus spring-wobble headroom — nowhere near the stale ~1.25.
    for (let i = 0; i < 40; i++) {
      cx += 60;
      pointerMove(cx, 0);
      await sleep(8);
    }
    let maxScaleX = 0;
    for (let i = 0; i < 10; i++) {
      cx += 60;
      pointerMove(cx, 0);
      await sleep(8);
      maxScaleX = Math.max(maxScaleX, readTransform(root).scaleX);
    }
    expect(maxScaleX).toBeLessThan(1.05);

    pointerUp(cx, 0);
  });
});

describe("velocityToStretch (the pure velocity → scale mapping)", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  const ELASTICITY = 0.4; // default → clamp at 1 + 0.4 · 0.25 = 1.1
  const FAST = 5000; // comfortably past the full-stretch velocity

  it("degenerates to the classic stretch/compress pair on a pure single-axis drag", async () => {
    const { velocityToStretch } = await loadLiquidDrag(false);
    const alongX = velocityToStretch(FAST, 0, ELASTICITY);
    expect(alongX.scaleX).toBeCloseTo(1.1, 6);
    expect(alongX.scaleY).toBeCloseTo(1 / 1.1, 6);

    const alongY = velocityToStretch(0, -FAST, ELASTICITY);
    expect(alongY.scaleY).toBeCloseTo(1.1, 6);
    expect(alongY.scaleX).toBeCloseTo(1 / 1.1, 6);
  });

  it("is shear-free at exactly 45°: scaleX = scaleY = 1 by symmetry", async () => {
    const { velocityToStretch } = await loadLiquidDrag(false);
    for (const [vx, vy] of [
      [FAST, FAST],
      [-FAST, FAST],
      [FAST, -FAST],
      [-FAST, -FAST],
    ]) {
      const s = velocityToStretch(vx, vy, ELASTICITY);
      expect(s.scaleX).toBeCloseTo(1, 6);
      expect(s.scaleY).toBeCloseTo(1, 6);
    }
  });

  it("has no step across the diagonal: samples just either side differ only slightly", async () => {
    const { velocityToStretch } = await loadLiquidDrag(false);
    // Both samples at full velocity, a hair either side of 45°. A binary
    // dominant-axis pick would cliff scaleX from 1.1 to 1/1.1 (~19%) here.
    const xDominant = velocityToStretch(FAST * 1.01, FAST, ELASTICITY);
    const yDominant = velocityToStretch(FAST, FAST * 1.01, ELASTICITY);
    expect(Math.abs(xDominant.scaleX - yDominant.scaleX)).toBeLessThan(0.01);
    expect(Math.abs(xDominant.scaleY - yDominant.scaleY)).toBeLessThan(0.01);
    // And both sit near the shear-free identity, not near the clamp.
    expect(xDominant.scaleX).toBeGreaterThan(0.99);
    expect(xDominant.scaleX).toBeLessThan(1.01);
  });

  it("preserves volume (scaleX · scaleY = 1) and respects the clamp at every angle", async () => {
    const { velocityToStretch } = await loadLiquidDrag(false);
    const maxStretch = 1 + ELASTICITY * 0.25;
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const s = velocityToStretch(
        FAST * Math.cos(rad),
        FAST * Math.sin(rad),
        ELASTICITY
      );
      expect(s.scaleX * s.scaleY).toBeCloseTo(1, 6);
      expect(s.scaleX).toBeGreaterThanOrEqual(1 / maxStretch - 1e-9);
      expect(s.scaleX).toBeLessThanOrEqual(maxStretch + 1e-9);
    }
  });
});
