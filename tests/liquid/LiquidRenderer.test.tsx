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
