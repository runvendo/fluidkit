import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FluidThemeProvider, LiquidButton } from "../../../src";
import { readableInk } from "../../../src/components/ink";

const labelOf = (container: HTMLElement) =>
  container.querySelector('[data-fluidkit="liquid-label"]') as HTMLElement;

describe("label ink pairs with the fill (contrast, not assumption)", () => {
  it("flat button on a graphite accent gets a white label — never black-on-black", () => {
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#1B1C22", text: "#14151A", material: "flat" }}>
        <LiquidButton>Continue</LiquidButton>
      </FluidThemeProvider>,
    );
    expect(labelOf(container).style.color).toBe("rgb(255, 255, 255)");
  });

  it("flat button on a pastel accent gets dark ink", () => {
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#FFD54F", material: "flat" }}>
        <LiquidButton>Continue</LiquidButton>
      </FluidThemeProvider>,
    );
    expect(labelOf(container).style.color).toBe("rgb(23, 24, 28)");
  });

  it("glass button label follows the brand text color (tracks dark mode)", () => {
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#8B7CFF", text: "#F2F3F7", mode: "dark" }}>
        <LiquidButton>Continue</LiquidButton>
      </FluidThemeProvider>,
    );
    expect(labelOf(container).style.color).toBe("rgb(242, 243, 247)");
  });

  it("no theme → label inherits currentColor exactly as before", () => {
    const { container } = render(<LiquidButton>Continue</LiquidButton>);
    expect(labelOf(container).style.color).toBe("");
  });

  it("explicit style.color from the consumer always wins", () => {
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#1B1C22", material: "flat" }}>
        <LiquidButton style={{ color: "hotpink" }}>Continue</LiquidButton>
      </FluidThemeProvider>,
    );
    expect(labelOf(container).style.color).toBe("");
  });

  // LiquidTabs' active label uses the same pairing via readableInk(fill) —
  // jsdom paints zero ink coverage (no layout), so the pairing itself is
  // pinned here and the rendered result is verified in the browser sweep.
  it("readableInk: white over dark fills, dark ink over light ones, null when unparseable", () => {
    expect(readableInk("#1B1C22")).toBe("#ffffff"); // graphite accent
    expect(readableInk("#0A7CFF")).toBe("#ffffff"); // chromatic blue
    expect(readableInk("#FFD54F")).toBe("#17181c"); // pastel
    expect(readableInk("rgb(255, 255, 255)")).toBe("#17181c");
    expect(readableInk("color-mix(in srgb, #000 20%, transparent)")).toBeNull();
    expect(readableInk(undefined)).toBeNull();
  });
});
