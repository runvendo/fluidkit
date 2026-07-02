import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";

/**
 * `Magnetic` reads `usePrefersReducedMotion()`, which reads Motion's
 * `useReducedMotion()` under the hood. Same per-test mocking pattern as
 * FlowStagger/Droplets: mock `motion/react`, keep the real `motion` factory
 * via `importOriginal`, reset the module registry so `Magnetic` and its
 * dependency chain re-import fresh against the mock.
 *
 * The mock reads from a mutable `state` object so tests can flip the
 * preference mid-test (gating-flip cleanup) and have the hook re-read it on
 * a plain rerender — matches the pattern proven in tests/hooks/useSquish.test.tsx.
 */
async function loadMagnetic(initialReduced: boolean) {
  vi.resetModules();
  const state = { reduced: initialReduced };
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => state.reduced };
  });
  const mod = await import("../../src/components/Magnetic");
  return { Magnetic: mod.Magnetic, state };
}

/** jsdom's `getBoundingClientRect` is all-zeros by default (no layout
 * engine), so the wrapper's center sits at (0, 0) and a pointer event's
 * `clientX`/`clientY` double as the offset from center directly — same
 * trick the Droplets tests rely on for their fixed drop coordinates. */
function moveWindowPointer(clientX: number, clientY: number) {
  fireEvent.pointerMove(window, { clientX, clientY });
}

/** Motion writes `x`/`y` motion values onto the element as
 * `translateX(...)`/`translateY(...)` substrings of the inline `transform`
 * (confirmed by probing `motion.div` directly); a value that was never
 * animated away from its initial 0 is omitted entirely (`transform: none`).
 * Parsing the live DOM this way lets tests assert on the springs' settled
 * position without reaching into Motion internals. */
function readTranslate(el: HTMLElement): { x: number; y: number } {
  const transform = el.style.transform;
  const x = /translateX\(([-\d.]+)px\)/.exec(transform);
  const y = /translateY\(([-\d.]+)px\)/.exec(transform);
  return { x: x ? parseFloat(x[1]) : 0, y: y ? parseFloat(y[1]) : 0 };
}

async function settlesNear(
  getEl: () => HTMLElement,
  target: { x: number; y: number },
  precision = 0
) {
  await vi.waitFor(
    () => {
      const { x, y } = readTranslate(getEl());
      expect(x).toBeCloseTo(target.x, precision);
      expect(y).toBeCloseTo(target.y, precision);
    },
    { timeout: 3000, interval: 10 }
  );
}

describe("Magnetic", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
    // A failing assertion between spyOn and mockRestore would otherwise
    // leak the window spy into every later test.
    vi.restoreAllMocks();
  });

  it('renders its children inside a data-fluidkit="magnetic" wrapper', async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container, getByText } = render(
      <Magnetic>
        <span>pull me</span>
      </Magnetic>
    );
    const root = container.querySelector('[data-fluidkit="magnetic"]');
    expect(root).not.toBeNull();
    expect(getByText("pull me")).toBeInTheDocument();
  });

  it("forwards className, style, and rest props onto the wrapper", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic
        className="my-magnet"
        style={{ marginTop: 4 }}
        data-testid="magnet"
      >
        <span>x</span>
      </Magnetic>
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("my-magnet");
    expect(root.style.marginTop).toBe("4px");
    expect(root.getAttribute("data-testid")).toBe("magnet");
  });

  it("does not touch window merely by importing the module (SSR-safe)", async () => {
    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });
    const addSpy = vi.spyOn(window, "addEventListener");
    await import("../../src/components/Magnetic");
    expect(addSpy).not.toHaveBeenCalledWith("pointermove", expect.anything());
    addSpy.mockRestore();
  });

  it("attaches window pointermove/pointerout/blur/pointercancel listeners once mounted and animating", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const addSpy = vi.spyOn(window, "addEventListener");
    render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    // pointermove is a passive hint: the handler never calls preventDefault.
    expect(addSpy).toHaveBeenCalledWith("pointermove", expect.any(Function), {
      passive: true,
    });
    expect(addSpy).toHaveBeenCalledWith("pointerout", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function)
    );
    addSpy.mockRestore();
  });

  it("computes attraction from the home center, not the translated position", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    // Simulate a real browser, where the transform MOVES the measured box:
    // getBoundingClientRect reflects the current translation (jsdom's
    // default all-zeros rect never moves, which would hide the feedback
    // loop this test guards against).
    const el = root();
    el.getBoundingClientRect = () => {
      const { x, y } = readTranslate(el);
      return {
        left: x,
        top: y,
        right: x,
        bottom: y,
        x,
        y,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };

    // Home center (0,0), pointer at (30,0), defaults strength 0.3 / radius
    // 120: dist 30 → falloff 0.75 → target x = 30 · 0.3 · 0.75 = 6.75.
    moveWindowPointer(30, 0);
    await vi.waitFor(
      () => {
        expect(readTranslate(root()).x).toBeCloseTo(6.75, 1);
      },
      { timeout: 3000, interval: 10 }
    );

    // Re-fire at the SAME pointer position once displaced. A pure
    // pointer-vs-home computation retargets to the same 6.75; measuring the
    // already-translated center would compute dx = 30 - 6.75 and shrink the
    // target to ~5.62 (weakened pull / hysteresis feedback loop).
    moveWindowPointer(30, 0);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(readTranslate(root()).x).toBeCloseTo(6.75, 1);
  });

  it("window pointerout with relatedTarget null (pointer left the window) retargets back to 0", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    moveWindowPointer(30, 0);
    await vi.waitFor(() => {
      expect(readTranslate(root()).x).toBeGreaterThan(0);
    });

    // relatedTarget null = the pointer exited the viewport entirely (an
    // in-page element hop always carries the element being entered).
    fireEvent.pointerOut(window, { relatedTarget: null });
    await settlesNear(root, { x: 0, y: 0 });
  });

  it("window pointerout onto an in-page element does NOT reset the pull", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container, getByText } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    // Let the spring fully settle at its target (30 · 0.3 · 0.75 = 6.75)
    // before the hop, so the assertion isn't racing the rise.
    moveWindowPointer(30, 0);
    await settlesNear(root, { x: 6.75, y: 0 }, 1);

    // Hopping between elements bubbles pointerout to window too, but with a
    // relatedTarget — the magnet must keep pulling.
    fireEvent.pointerOut(window, { relatedTarget: getByText("x") });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(readTranslate(root()).x).toBeCloseTo(6.75, 1);
  });

  it("window pointermove inside the radius pulls the wrapper toward the pointer", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    moveWindowPointer(30, 0);

    await vi.waitFor(() => {
      const { x, y } = readTranslate(root());
      expect(x).toBeGreaterThan(0);
      expect(y).toBeCloseTo(0, 0);
    });
  });

  it("window pointermove outside the radius (default 120px) retargets back to 0", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    moveWindowPointer(30, 0);
    await vi.waitFor(() => {
      expect(readTranslate(root()).x).toBeGreaterThan(0);
    });

    moveWindowPointer(500, 0);
    await settlesNear(root, { x: 0, y: 0 });
  });

  it("window blur retargets back to 0", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    moveWindowPointer(30, 0);
    await vi.waitFor(() => {
      expect(readTranslate(root()).x).toBeGreaterThan(0);
    });

    fireEvent(window, new Event("blur"));
    await settlesNear(root, { x: 0, y: 0 });
  });

  it("pointercancel retargets back to 0", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    moveWindowPointer(30, 0);
    await vi.waitFor(() => {
      expect(readTranslate(root()).x).toBeGreaterThan(0);
    });

    fireEvent.pointerCancel(window);
    await settlesNear(root, { x: 0, y: 0 });
  });

  it("caps travel at radius/2 even with an extreme strength", async () => {
    const { Magnetic } = await loadMagnetic(false);
    // strength runs past its documented 0-1 range on purpose: the cap must
    // hold as a hard safety invariant, not just an artifact of small inputs.
    const { container } = render(
      <Magnetic strength={5} radius={100}>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    // Distance 60 (< radius 100), well inside — with strength=5 this would
    // fly past radius/2 (50px) without the cap.
    moveWindowPointer(60, 0);

    await vi.waitFor(() => {
      expect(readTranslate(root()).x).toBeGreaterThan(0);
    });
    // Give the spring time to fully settle at its (capped) target.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(readTranslate(root()).x).toBeLessThanOrEqual(50 + 1);
  });

  it("reduced motion: no window pointermove listener, no movement", async () => {
    const { Magnetic } = await loadMagnetic(true);
    const addSpy = vi.spyOn(window, "addEventListener");
    const { container } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    expect(addSpy).not.toHaveBeenCalledWith(
      "pointermove",
      expect.anything()
    );
    addSpy.mockRestore();

    const root = container.querySelector(
      '[data-fluidkit="magnetic"]'
    ) as HTMLElement;
    moveWindowPointer(30, 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(readTranslate(root)).toEqual({ x: 0, y: 0 });
  });

  it("unmount removes the window listeners", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const { unmount } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const removeSpy = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function)
    );
    expect(removeSpy).toHaveBeenCalledWith("pointerout", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function)
    );
    removeSpy.mockRestore();
  });

  it("gating flip (reduced motion turning on) removes the listener AND returns a displaced element home", async () => {
    const { Magnetic, state } = await loadMagnetic(false);
    const { container, rerender } = render(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );
    const root = () =>
      container.querySelector('[data-fluidkit="magnetic"]') as HTMLElement;

    // Displace first — the flip must never freeze the element mid-pull.
    moveWindowPointer(30, 0);
    await vi.waitFor(() => {
      expect(readTranslate(root()).x).toBeGreaterThan(0);
    });

    state.reduced = true;
    rerender(
      <Magnetic>
        <span>x</span>
      </Magnetic>
    );

    // Back at rest…
    await settlesNear(root, { x: 0, y: 0 });

    // …and the listener is gone: further movement does nothing.
    moveWindowPointer(30, 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(readTranslate(root())).toEqual({ x: 0, y: 0 });
  });

  it("commits no React updates while the pointer moves (springs driven imperatively)", async () => {
    const { Magnetic } = await loadMagnetic(false);
    const onRender = vi.fn();
    render(
      <Profiler id="magnetic" onRender={onRender}>
        <Magnetic>
          <span>x</span>
        </Magnetic>
      </Profiler>
    );
    const commitsAfterMount = onRender.mock.calls.length;

    for (let i = 0; i < 10; i++) {
      moveWindowPointer(i * 5, 0);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onRender.mock.calls.length).toBe(commitsAfterMount);
  });
});
