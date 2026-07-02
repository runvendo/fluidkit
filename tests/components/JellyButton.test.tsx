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

  it("paints a specular highlight for glass but not for mercury", async () => {
    const JellyButton = await loadJellyButton(true);
    const glass = render(<JellyButton material="glass">G</JellyButton>);
    expect(
      glass.container.querySelectorAll("ellipse").length
    ).toBeGreaterThan(0);
    const mercury = render(<JellyButton material="mercury">M</JellyButton>);
    expect(mercury.container.querySelectorAll("ellipse")).toHaveLength(0);
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
