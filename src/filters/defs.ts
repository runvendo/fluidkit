/**
 * Shared SVG filter definitions.
 *
 * Several primitives (Metaballs, ThinkingBlob, LiquidTabs, and LiquidGlass's
 * fallback path) rely on `filter: url(#fluidkit-*)` resolving to an SVG
 * `<filter>` that lives somewhere in the DOM. This module is the single
 * source of truth for those filters' ids and markup: pure data + builders,
 * no React, no module-load side effects. `injectDefs.ts` owns mounting the
 * node this builds into the live document.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Fuses same-color shapes together (mercury-style blob merging). */
export const GOO_FILTER_ID = "fluidkit-goo";

/** Displacement refraction used by the LiquidGlass fallback path. */
export const LENS_FILTER_ID = "fluidkit-lens";

/** Id of the hidden `<svg>` singleton that hosts both filters. */
export const DEFS_CONTAINER_ID = "fluidkit-defs";

/** CSS `filter` value referencing the goo filter. */
export function gooFilterUrl(): string {
  return `url(#${GOO_FILTER_ID})`;
}

/** CSS `filter` value referencing the lens filter. */
export function lensFilterUrl(): string {
  return `url(#${LENS_FILTER_ID})`;
}

function createGooFilter(doc: Document): SVGFilterElement {
  const filter = doc.createElementNS(SVG_NS, "filter") as SVGFilterElement;
  filter.setAttribute("id", GOO_FILTER_ID);

  const blur = doc.createElementNS(SVG_NS, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "8");
  blur.setAttribute("result", "blur");

  const colorMatrix = doc.createElementNS(SVG_NS, "feColorMatrix");
  colorMatrix.setAttribute("in", "blur");
  colorMatrix.setAttribute("mode", "matrix");
  colorMatrix.setAttribute(
    "values",
    "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
  );

  filter.append(blur, colorMatrix);
  return filter;
}

function createLensFilter(doc: Document): SVGFilterElement {
  const filter = doc.createElementNS(SVG_NS, "filter") as SVGFilterElement;
  filter.setAttribute("id", LENS_FILTER_ID);
  filter.setAttribute("x", "-20%");
  filter.setAttribute("y", "-20%");
  filter.setAttribute("width", "140%");
  filter.setAttribute("height", "140%");

  const turbulence = doc.createElementNS(SVG_NS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", "0.008 0.01");
  turbulence.setAttribute("numOctaves", "2");
  turbulence.setAttribute("seed", "4");
  turbulence.setAttribute("result", "noise");

  const displacement = doc.createElementNS(SVG_NS, "feDisplacementMap");
  displacement.setAttribute("in", "SourceGraphic");
  displacement.setAttribute("in2", "noise");
  displacement.setAttribute("scale", "20");
  displacement.setAttribute("xChannelSelector", "R");
  displacement.setAttribute("yChannelSelector", "G");

  filter.append(turbulence, displacement);
  return filter;
}

/**
 * Builds the hidden `<svg>` node containing both filters inside a single
 * `<defs>`. Pure builder — it does not touch the live document tree; the
 * caller (the injector) is responsible for appending/removing it.
 *
 * Visually inert by construction: `aria-hidden`, zero-size, and positioned
 * off the layout flow, so it never affects rendering on its own.
 */
export function createFilterDefsElement(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("id", DEFS_CONTAINER_ID);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute(
    "style",
    "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;"
  );

  const defs = doc.createElementNS(SVG_NS, "defs");
  defs.append(createGooFilter(doc), createLensFilter(doc));
  svg.append(defs);

  return svg;
}
