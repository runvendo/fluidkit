import { describe, expect, it } from "vitest";
import {
  GOO_FILTER_ID,
  LENS_FILTER_ID,
  createFilterDefsElement,
  gooFilterUrl,
  lensFilterUrl,
} from "../../src/filters/defs";

describe("filter id constants and url helpers", () => {
  it("exposes library-namespaced filter ids", () => {
    expect(GOO_FILTER_ID).toBe("fluidkit-goo");
    expect(LENS_FILTER_ID).toBe("fluidkit-lens");
  });

  it("builds CSS url() references from the ids", () => {
    expect(gooFilterUrl()).toBe("url(#fluidkit-goo)");
    expect(lensFilterUrl()).toBe("url(#fluidkit-lens)");
  });
});

describe("createFilterDefsElement", () => {
  it("contains exactly one goo filter with a blur + color-matrix chain", () => {
    const svg = createFilterDefsElement(document);

    const filters = svg.querySelectorAll(`#${GOO_FILTER_ID}`);
    expect(filters).toHaveLength(1);

    const goo = filters[0];
    expect(goo.tagName.toLowerCase()).toBe("filter");

    const blur = goo.querySelector("feGaussianBlur");
    expect(blur).not.toBeNull();
    expect(blur?.getAttribute("in")).toBe("SourceGraphic");
    expect(blur?.getAttribute("stdDeviation")).toBe("8");
    expect(blur?.getAttribute("result")).toBe("blur");

    const colorMatrix = goo.querySelector("feColorMatrix");
    expect(colorMatrix).not.toBeNull();
    expect(colorMatrix?.getAttribute("in")).toBe("blur");
    expect(colorMatrix?.getAttribute("mode")).toBe("matrix");
    expect(colorMatrix?.getAttribute("values")).toBe(
      "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
    );
  });

  it("contains exactly one lens filter with turbulence + displacement", () => {
    const svg = createFilterDefsElement(document);

    const filters = svg.querySelectorAll(`#${LENS_FILTER_ID}`);
    expect(filters).toHaveLength(1);

    const lens = filters[0];
    expect(lens.tagName.toLowerCase()).toBe("filter");
    expect(lens.getAttribute("x")).toBe("-20%");
    expect(lens.getAttribute("y")).toBe("-20%");
    expect(lens.getAttribute("width")).toBe("140%");
    expect(lens.getAttribute("height")).toBe("140%");

    const turbulence = lens.querySelector("feTurbulence");
    expect(turbulence).not.toBeNull();
    expect(turbulence?.getAttribute("type")).toBe("fractalNoise");
    expect(turbulence?.getAttribute("baseFrequency")).toBe("0.008 0.01");
    expect(turbulence?.getAttribute("numOctaves")).toBe("2");
    expect(turbulence?.getAttribute("seed")).toBe("4");
    expect(turbulence?.getAttribute("result")).toBe("noise");

    const displacement = lens.querySelector("feDisplacementMap");
    expect(displacement).not.toBeNull();
    expect(displacement?.getAttribute("in")).toBe("SourceGraphic");
    expect(displacement?.getAttribute("in2")).toBe("noise");
    expect(displacement?.getAttribute("scale")).toBe("20");
    expect(displacement?.getAttribute("xChannelSelector")).toBe("R");
    expect(displacement?.getAttribute("yChannelSelector")).toBe("G");
  });

  it("wraps both filters in a single <defs>", () => {
    const svg = createFilterDefsElement(document);

    const defsEls = svg.querySelectorAll("defs");
    expect(defsEls).toHaveLength(1);
    expect(defsEls[0].querySelectorAll("filter")).toHaveLength(2);
  });

  it("is inert: hidden, zero-size, and marked aria-hidden", () => {
    const svg = createFilterDefsElement(document);

    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("0");
    expect(svg.getAttribute("height")).toBe("0");
  });
});
