import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Profiler } from "react";

/** Same mocking pattern as the other component tests. */
async function loadJellyButton(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/JellyButton");
  return mod.JellyButton;
}

describe("JellyButton", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("renders a focusable button carrying the label", async () => {
    const JellyButton = await loadJellyButton(false);
    const { getByRole } = render(<JellyButton>Click me</JellyButton>);
    const button = getByRole("button", { name: "Click me" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toBeDisabled();
    expect(button.getAttribute("data-fluidkit")).toBe("jelly-button");
  });

  it("disabled prop disables the real button and blocks clicks", async () => {
    const JellyButton = await loadJellyButton(false);
    const onClick = vi.fn();
    const { getByRole } = render(
      <JellyButton disabled onClick={onClick}>
        Nope
      </JellyButton>
    );
    const button = getByRole("button", { name: "Nope" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("label sits on the unclipped content overlay, never inside the clipped fill", async () => {
    const JellyButton = await loadJellyButton(false);
    const { getByText, container } = render(<JellyButton>Label</JellyButton>);
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
    const JellyButton = await loadJellyButton(true);
    const { container } = render(<JellyButton>Go</JellyButton>);
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const closures = (clip.style.clipPath.match(/Z/g) ?? []).length;
    expect(closures).toBe(1);
  });

  it("sizes the button from the width/height props", async () => {
    const JellyButton = await loadJellyButton(true);
    const { getByRole } = render(
      <JellyButton width={200} height={60}>
        Big
      </JellyButton>
    );
    const button = getByRole("button", { name: "Big" });
    expect(button.style.width).toBe("200px");
    expect(button.style.height).toBe("60px");
  });

  it("press (pointerdown) while animating starts geometry deformation", async () => {
    const JellyButton = await loadJellyButton(false);
    const { getByRole, container } = render(<JellyButton>Press</JellyButton>);
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
    const JellyButton = await loadJellyButton(false);
    const { getByRole } = render(<JellyButton>Kbd</JellyButton>);
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
    const JellyButton = await loadJellyButton(true);
    const onClick = vi.fn();
    const { getByRole, container } = render(
      <JellyButton onClick={onClick}>Reduced</JellyButton>
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

  it("commits no React updates during the settle loop (frames go through the imperative handle)", async () => {
    const JellyButton = await loadJellyButton(false);
    const onRender = vi.fn();
    const { getByRole } = render(
      <Profiler id="jelly" onRender={onRender}>
        <JellyButton>Profiled</JellyButton>
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
    const JellyButton = await loadJellyButton(true);
    const { getByRole, container } = render(
      <JellyButton width={160} height={48} intensity={0.12}>
        B
      </JellyButton>
    );
    // The button's layout box stays at the requested size...
    const button = getByRole("button", { name: "B" });
    expect(button.style.width).toBe("160px");
    expect(button.style.height).toBe("48px");
    // ...while the paint canvas extends `bleed` px past every edge, so the
    // widened press geometry (plus spring overshoot) has room to paint.
    // bleed = ceil(160 * 0.12) = 20.
    const canvas = container.querySelector(
      '[data-fluidkit="jelly-canvas"]'
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
    const JellyButton = await loadJellyButton(false);
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    const { getByRole } = render(
      <JellyButton
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        Compose
      </JellyButton>
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
    const JellyButton = await loadJellyButton(false);
    const { getByRole, container, rerender } = render(
      <JellyButton>Hold</JellyButton>
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

    rerender(<JellyButton disabled>Hold</JellyButton>);
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
    const JellyButton = await loadJellyButton(true);
    const glass = render(<JellyButton material="glass">G</JellyButton>);
    expect(
      glass.container.querySelectorAll("ellipse").length
    ).toBeGreaterThan(0);
    const flat = render(<JellyButton material="flat">F</JellyButton>);
    expect(flat.container.querySelectorAll("ellipse")).toHaveLength(0);
  });

  it("pressColor paints the pressed fill and reverts on release", async () => {
    const JellyButton = await loadJellyButton(false);
    const { getByRole, container } = render(
      <JellyButton material="flat" color="rgb(100, 110, 120)" pressColor="rgb(10, 20, 30)">
        Tint
      </JellyButton>
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
    const JellyButton = await loadJellyButton(false);
    const { getByRole, container } = render(
      <JellyButton
        material="flat"
        color="rgb(100, 110, 120)"
        pressColor="rgb(10, 20, 30)"
        pressFeedback={false}
      >
        Off
      </JellyButton>
    );
    const fill = container.querySelector(
      '[data-fluidkit="liquid-fill"]'
    ) as HTMLElement;
    fireEvent.pointerDown(getByRole("button", { name: "Off" }));
    expect(fill.style.background).toBe("rgb(100, 110, 120)");
  });

  it("press feedback still applies under reduced motion (color, not motion)", async () => {
    const JellyButton = await loadJellyButton(true);
    const { getByRole, container } = render(
      <JellyButton material="flat" color="rgb(100, 110, 120)" pressColor="rgb(10, 20, 30)">
        Calm
      </JellyButton>
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
    const JellyButton = await loadJellyButton(true);
    const { container } = render(
      <JellyButton material="glass" reflection={false}>
        R
      </JellyButton>
    );
    expect(container.querySelectorAll("ellipse")).toHaveLength(0);
  });
});
