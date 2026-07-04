import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { LiquidRenderer } from "../../src/liquid/LiquidRenderer";
import type { LiquidSceneHandle } from "../../src/liquid/LiquidRenderer";
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

  it("setScene() writes clip paths and ellipse attrs straight to the DOM", () => {
    const handle = createRef<LiquidSceneHandle>();
    const { container } = render(
      <LiquidRenderer
        ref={handle}
        path={PATH}
        material={resolveMaterial("glass")}
        speculars={[{ cx: 5, cy: 5, rx: 4, ry: 2, rotate: 10, opacity: 0.7 }]}
        specularSlots={2}
        shadow
        clipContent
      >
        <span>content</span>
      </LiquidRenderer>
    );
    const NEW = "M 0 0 L 9 0 L 9 9 Z ";
    handle.current!.setScene({
      path: NEW,
      speculars: [{ cx: 1, cy: 2, rx: 3, ry: 4, rotate: 45, opacity: 0.5 }],
    });
    const clip = container.querySelector(
      '[data-fluidkit="liquid-clip"]'
    ) as HTMLElement;
    const shadow = container.querySelector(
      '[data-fluidkit="liquid-shadow"]'
    ) as HTMLElement;
    const content = container.querySelector(
      '[data-fluidkit="liquid-content"]'
    ) as HTMLElement;
    expect(clip.style.clipPath).toContain("M 0 0");
    expect(shadow.style.clipPath).toContain("M 0 0");
    expect(content.style.clipPath).toContain("M 0 0");
    // Ellipse pool: slot 0 updated, slot 1 hidden.
    const ellipses = container.querySelectorAll("ellipse");
    expect(ellipses).toHaveLength(2);
    expect(ellipses[0].getAttribute("cx")).toBe("1");
    expect(ellipses[0].getAttribute("opacity")).toBe("0.5");
    expect(ellipses[1].getAttribute("opacity")).toBe("0");
  });

  it("renders a specularSlots-sized ellipse pool even when fewer speculars are given", () => {
    const { container } = render(
      <LiquidRenderer
        path={PATH}
        material={resolveMaterial("glass")}
        speculars={[{ cx: 5, cy: 5, rx: 4, ry: 2, rotate: 10, opacity: 0.7 }]}
        specularSlots={3}
      />
    );
    const ellipses = container.querySelectorAll("ellipse");
    expect(ellipses).toHaveLength(3);
    expect(ellipses[1].getAttribute("opacity")).toBe("0");
    expect(ellipses[2].getAttribute("opacity")).toBe("0");
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

  it("mounts the caustics layer inside the clip for caustics material", () => {
    const { container } = render(
      <LiquidRenderer path={PATH} material={resolveMaterial("caustics")} />
    );
    const clip = container.querySelector('[data-fluidkit="liquid-clip"]');
    expect(
      clip?.querySelector('[data-fluidkit="caustics-layer"]')
    ).toBeTruthy();
  });

  it("mounts no caustics layer for glass", () => {
    const { container } = render(
      <LiquidRenderer path={PATH} material={resolveMaterial("glass")} />
    );
    expect(
      container.querySelector('[data-fluidkit="caustics-layer"]')
    ).toBeNull();
  });
});
