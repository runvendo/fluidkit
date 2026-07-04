import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";
import * as LiquidButtonModule from "../../src/components/LiquidButton";
import type { LiquidButtonProps } from "../../src/components/LiquidButton";
import {
  expectIntensityScalesSpeculars,
  expectShadowToggles,
} from "./surfacePack";

/** Same mocking pattern as the other component tests. */
async function loadLiquidButton(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/LiquidButton");
  return mod.LiquidButton;
}

describe("LiquidButton", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders a focusable button carrying the label", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByRole } = render(<LiquidButton>Click me</LiquidButton>);
    const button = getByRole("button", { name: "Click me" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toBeDisabled();
    expect(button.getAttribute("data-fluidkit")).toBe("liquid-button");
  });

  it("disabled prop disables the real button and blocks clicks", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const onClick = vi.fn();
    const { getByRole } = render(
      <LiquidButton disabled onClick={onClick}>
        Nope
      </LiquidButton>
    );
    const button = getByRole("button", { name: "Nope" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("label sits on the unclipped content overlay, never inside the clipped fill", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByText, container } = render(<LiquidButton>Label</LiquidButton>);
    const label = getByText("Label");
    const overlay = label.closest('[data-fluidkit="liquid-content"]');
    expect(overlay).not.toBeNull();

    const fill = container.querySelector('[data-fluidkit="liquid-fill"]');
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    expect(fill?.textContent).toBe("");
    expect(clip.textContent).toBe("");

    // The overlay is unclipped: no clip-path applied to it, unlike the fill.
    expect((overlay as HTMLElement).style.clipPath).toBe("");
    expect(clip.style.clipPath).toContain("path(");
  });

  it("renders one round-rect body at rest (a single clipped subpath)", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { container } = render(<LiquidButton>Go</LiquidButton>);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(1);
  });

  it("sizes the button from the width/height props", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { getByRole } = render(
      <LiquidButton width={200} height={60}>
        Big
      </LiquidButton>
    );
    const button = getByRole("button", { name: "Big" });
    expect(button.style.width).toBe("200px");
    expect(button.style.height).toBe("60px");
  });

  it("press (pointerdown) while animating starts geometry deformation", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByRole, container } = render(<LiquidButton>Press</LiquidButton>);
    const button = getByRole("button", { name: "Press" });
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const initialClip = clip.style.clipPath;

    fireEvent.pointerDown(button);
    expect(button.getAttribute("data-pressed")).toBe("true");

    await vi.waitFor(() => {
      expect(clip.style.clipPath).not.toBe(initialClip);
    });
    expect(button.getAttribute("data-animating")).toBe("true");

    fireEvent.pointerUp(button);
    expect(button.getAttribute("data-pressed")).toBe("false");
  });

  it("keyboard press (Space/Enter) mirrors pointer press, ignoring key repeat", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByRole } = render(<LiquidButton>Kbd</LiquidButton>);
    const button = getByRole("button", { name: "Kbd" });

    fireEvent.keyDown(button, { key: " ", repeat: true });
    expect(button.getAttribute("data-pressed")).toBe("false");

    fireEvent.keyDown(button, { key: " " });
    expect(button.getAttribute("data-pressed")).toBe("true");

    fireEvent.keyUp(button, { key: " " });
    expect(button.getAttribute("data-pressed")).toBe("false");

    fireEvent.keyDown(button, { key: "Enter" });
    expect(button.getAttribute("data-pressed")).toBe("true");
    fireEvent.keyUp(button, { key: "Enter" });
    expect(button.getAttribute("data-pressed")).toBe("false");
  });

  it("reduced motion keeps data-animating false and the clip path static, but click still fires", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const onClick = vi.fn();
    const { getByRole, container } = render(
      <LiquidButton onClick={onClick}>Reduced</LiquidButton>
    );
    const button = getByRole("button", { name: "Reduced" });
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const initialClip = clip.style.clipPath;

    expect(button.getAttribute("data-animating")).toBe("false");

    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(clip.style.clipPath).toBe(initialClip);
    expect(button.getAttribute("data-animating")).toBe("false");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("variant='still' presses with zero geometry deformation while the fill still deepens", async () => {
    const LiquidButton = await loadLiquidButton(false);
    // Snappier spring so the settle window closes fast (matches the squash
    // behavior test's settle-resync read).
    const spring = { stiffness: 550, damping: 60 };
    const { getByRole, container } = render(
      <LiquidButton
        variant="still"
        material="flat"
        color="rgb(100, 110, 120)"
        pressColor="rgb(10, 20, 30)"
        deformPress={false}
        pressGlint={false}
        spring={spring}
      >
        Still
      </LiquidButton>
    );
    const button = getByRole("button", { name: "Still" });
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    const restingClip = clip.style.clipPath;

    fireEvent.keyDown(button, { key: " " });
    // The non-geometric press polish still runs: the fill deepens immediately.
    expect(fill.style.background).toBe("rgb(10, 20, 30)");
    // The press still enters the settle window...
    await vi.waitFor(() => {
      expect(button.getAttribute("data-animating")).toBe("true");
    });
    // ...but the geometry never leaves rest: the resynced clip once the
    // window closes is byte-identical to the resting path.
    await vi.waitFor(
      () => {
        expect(button.getAttribute("data-animating")).toBe("false");
      },
      { timeout: 2000, interval: 20 }
    );
    expect(clip.style.clipPath).toBe(restingClip);

    fireEvent.keyUp(button, { key: " " });
    expect(fill.style.background).toBe("rgb(100, 110, 120)");
  });

  it("variant='still' ignores releaseWave and deformPress — geometry never deforms", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const spring = { stiffness: 550, damping: 60 };
    const { getByRole, container } = render(
      <LiquidButton
        variant="still"
        releaseWave
        deformPress
        pressGlint={false}
        spring={spring}
      >
        Wave
      </LiquidButton>
    );
    const button = getByRole("button", { name: "Wave" });
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const restingClip = clip.style.clipPath;

    // A pointer press lands a press point (jelly would dent around it)...
    fireEvent.pointerDown(button);
    await vi.waitFor(() => {
      expect(button.getAttribute("data-animating")).toBe("true");
    });
    expect(clip.style.clipPath).toBe(restingClip);

    // ...and release (jelly would ripple with releaseWave) still moves nothing.
    fireEvent.pointerUp(button);
    await vi.waitFor(
      () => {
        expect(button.getAttribute("data-animating")).toBe("false");
      },
      { timeout: 2000, interval: 20 }
    );
    expect(clip.style.clipPath).toBe(restingClip);
  });

  it("renames JellyButton to LiquidButton (no JellyButton export)", () => {
    expect(LiquidButtonModule.LiquidButton).toBeDefined();
    // @ts-expect-error — JellyButton was renamed to LiquidButton; no alias.
    expect(LiquidButtonModule.JellyButton).toBeUndefined();
  });

  it("commits no React updates during the settle loop (frames go through the imperative handle)", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const onRender = vi.fn();
    const { getByRole } = render(
      <Profiler id="liquid" onRender={onRender}>
        <LiquidButton>Profiled</LiquidButton>
      </Profiler>
    );
    const button = getByRole("button", { name: "Profiled" });

    fireEvent.pointerDown(button);
    // Let the settle window's state flip land (one commit), then several
    // rAF ticks: the press keeps springing, but frames are imperative DOM
    // writes, never React commits.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const commitsAfterPress = onRender.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(onRender.mock.calls.length).toBe(commitsAfterPress);
  });

  it("paints on a bleed canvas so widened press geometry isn't sliced at the button box", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { getByRole, container } = render(
      <LiquidButton width={160} height={48} squash={0.12}>
        B
      </LiquidButton>
    );
    // The button's layout box stays at the requested size...
    const button = getByRole("button", { name: "B" });
    expect(button.style.width).toBe("160px");
    expect(button.style.height).toBe("48px");
    // ...while the paint canvas extends `bleed` px past every edge, so the
    // widened press geometry (plus spring overshoot) has room to paint.
    // bleed = ceil(160 * 0.12) = 20.
    const canvas = container.querySelector(
      '[data-fluidkit="liquid-canvas"]'
    ) as HTMLElement;
    expect(canvas).not.toBeNull();
    expect(canvas.style.top).toBe("-20px");
    expect(canvas.style.left).toBe("-20px");
    expect(canvas.style.right).toBe("-20px");
    expect(canvas.style.bottom).toBe("-20px");
    // The resting body is centered in the bleed canvas: its subpath starts
    // past the bleed margin, not at 0 (geometry coords are canvas coords,
    // so a widened body can reach into the margin instead of being cut).
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const firstX = parseFloat(
      (clip.style.clipPath.match(/M (-?[\d.]+)/) ?? [])[1] ?? "NaN"
    );
    expect(firstX).toBeGreaterThanOrEqual(20);
  });

  it("composes consumer pointer/keyboard handlers (they still fire)", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    const { getByRole } = render(
      <LiquidButton
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        Compose
      </LiquidButton>
    );
    const button = getByRole("button", { name: "Compose" });

    fireEvent.pointerDown(button);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button);
    expect(onPointerUp).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: " " });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(button, { key: " " });
    expect(onKeyUp).toHaveBeenCalledTimes(1);

    // Non-activation keys don't press, but the consumer still hears them.
    fireEvent.keyDown(button, { key: "a" });
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(button.getAttribute("data-pressed")).toBe("false");
  });

  it("force-releases when disabled flips true mid-press and geometry returns home", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByRole, container, rerender } = render(
      <LiquidButton>Hold</LiquidButton>
    );
    const button = getByRole("button", { name: "Hold" });
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const restingClip = clip.style.clipPath;

    fireEvent.pointerDown(button);
    expect(button.getAttribute("data-pressed")).toBe("true");
    await vi.waitFor(() => {
      expect(clip.style.clipPath).not.toBe(restingClip);
    });

    rerender(<LiquidButton disabled>Hold</LiquidButton>);
    expect(button.getAttribute("data-pressed")).toBe("false");

    // The spring retargets home; once it settles the clip is exactly the
    // resting path again (and the resync effect re-writes it regardless).
    await vi.waitFor(
      () => {
        expect(clip.style.clipPath).toBe(restingClip);
      },
      { timeout: 3000, interval: 20 }
    );
  });

  it("paints a specular highlight for glass but not for flat", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const glass = render(<LiquidButton material="glass">G</LiquidButton>);
    expect(
      glass.container.querySelectorAll("ellipse").length
    ).toBeGreaterThan(0);
    const flat = render(<LiquidButton material="flat">F</LiquidButton>);
    expect(flat.container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("pressColor paints the pressed fill and reverts on release", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByRole, container } = render(
      <LiquidButton material="flat" color="rgb(100, 110, 120)" pressColor="rgb(10, 20, 30)">
        Tint
      </LiquidButton>
    );
    const button = getByRole("button", { name: "Tint" });
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    expect(fill.style.background).toBe("rgb(100, 110, 120)");

    fireEvent.pointerDown(button);
    expect(fill.style.background).toBe("rgb(10, 20, 30)");
    // The fade is asymmetric: quick in, slow out — both directions carry a
    // transition so neither snaps.
    expect(fill.style.transition).toContain("background");

    fireEvent.pointerUp(button);
    expect(fill.style.background).toBe("rgb(100, 110, 120)");
    expect(fill.style.transition).toContain("background");
  });

  it("pressFeedback=false leaves the fill untouched while pressed", async () => {
    const LiquidButton = await loadLiquidButton(false);
    const { getByRole, container } = render(
      <LiquidButton
        material="flat"
        color="rgb(100, 110, 120)"
        pressColor="rgb(10, 20, 30)"
        pressFeedback={false}
      >
        Off
      </LiquidButton>
    );
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    fireEvent.pointerDown(getByRole("button", { name: "Off" }));
    expect(fill.style.background).toBe("rgb(100, 110, 120)");
  });

  it("press feedback still applies under reduced motion (color, not motion)", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { getByRole, container } = render(
      <LiquidButton material="flat" color="rgb(100, 110, 120)" pressColor="rgb(10, 20, 30)">
        Calm
      </LiquidButton>
    );
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    fireEvent.pointerDown(getByRole("button", { name: "Calm" }));
    expect(fill.style.background).toBe("rgb(10, 20, 30)");
    fireEvent.pointerUp(getByRole("button", { name: "Calm" }));
    expect(fill.style.background).toBe("rgb(100, 110, 120)");
  });

  it("disables speculars when reflection is false", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { container } = render(
      <LiquidButton material="glass" reflection={false}>
        R
      </LiquidButton>
    );
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("squash sets the press depth; intensity (material volume) never touches geometry", async () => {
    const LiquidButton = await loadLiquidButton(false);
    // Snappier spring than the default so the settle window closes fast.
    const spring = { stiffness: 550, damping: 60 };

    /** Press via keyboard (symmetric), wait for the settle window to close,
     * and read the resynced pressed clip — exactly the spring target. */
    async function settledPressClip(props: Partial<LiquidButtonProps>) {
      const utils = render(
        <LiquidButton
          deformPress={false}
          pressGlint={false}
          spring={spring}
          {...props}
        >
          P
        </LiquidButton>
      );
      const button = utils.getByRole("button", { name: "P" });
      const clip = utils.container.querySelector(
        '[data-fluidkit="liquid-clip"]'
      ) as HTMLElement;
      fireEvent.keyDown(button, { key: " " });
      await vi.waitFor(() => {
        expect(button.getAttribute("data-animating")).toBe("true");
      });
      await vi.waitFor(
        () => {
          expect(button.getAttribute("data-animating")).toBe("false");
        },
        { timeout: 2000, interval: 20 }
      );
      const path = clip.style.clipPath;
      utils.unmount();
      return path;
    }

    const base = await settledPressClip({});
    // A deeper squash presses deeper...
    expect(await settledPressClip({ squash: 0.25 })).not.toBe(base);
    // ...while intensity — even as a number — is material volume, so the
    // pressed geometry is identical to the default press.
    expect(await settledPressClip({ intensity: 0.9 })).toBe(base);
  });

  it("scales specular brightness with `intensity`", async () => {
    const LiquidButton = await loadLiquidButton(true);
    expectIntensityScalesSpeculars((props) =>
      render(<LiquidButton {...props}>I</LiquidButton>)
    );
  });

  it("renders the shadow layer by default and drops it on `shadow={false}`", async () => {
    const LiquidButton = await loadLiquidButton(true);
    expectShadowToggles((props) =>
      render(<LiquidButton {...props}>S</LiquidButton>)
    );
  });

  it("default speculars keep the pre-pack 0.28 opacity (intensity defaults to 'present')", async () => {
    const LiquidButton = await loadLiquidButton(true);
    const { container } = render(<LiquidButton>D</LiquidButton>);
    const opacities = Array.from(container.querySelectorAll("ellipse"))
      .map((el) => Number(el.getAttribute("opacity") ?? 0))
      .filter((opacity) => opacity > 0);
    // One lit body spot; 0.4 × "present" (0.7) = the old hardcoded 0.28.
    expect(opacities).toHaveLength(1);
    expect(opacities[0]).toBeCloseTo(0.28, 12);
  });
});
