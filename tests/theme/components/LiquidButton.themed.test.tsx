import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FluidThemeProvider } from "../../../src/theme";
import { LiquidButton } from "../../../src/components/LiquidButton";

/**
 * jsdom has no `CSS.supports`, so the glass material degrades to its
 * fallback fill — `background` carries the tint directly, which is exactly
 * where the theme's accent-derived `color-mix()` must land. jsdom also
 * normalizes hex colors inside `color-mix()` to `rgb()`:
 * #2D6A4F → rgb(45, 106, 79).
 */
const ACCENT_MIX = "color-mix(in srgb, rgb(45, 106, 79)";

const fillOf = (container: HTMLElement) =>
  container.querySelector('[data-fluidkit="liquid-fill"]') as HTMLElement;

describe("LiquidButton theming", () => {
  it("a mounted theme's accent tints the default glass fill (20% share)", () => {
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#2D6A4F" }}>
        <LiquidButton>Save</LiquidButton>
      </FluidThemeProvider>
    );
    expect(fillOf(container).style.background).toContain(`${ACCENT_MIX} 20%`);
  });

  it("an explicit tint prop beats the theme's derived tint", () => {
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#2D6A4F" }}>
        <LiquidButton tint="rgba(200, 220, 255, 0.4)">Save</LiquidButton>
      </FluidThemeProvider>
    );
    expect(fillOf(container).style.background).toBe("rgba(200, 220, 255, 0.4)");
  });

  it("explicit material/color beat the theme's material and surface", () => {
    const { container } = render(
      <FluidThemeProvider
        theme={{ accent: "#2D6A4F", material: "glass", surface: "#101010" }}
      >
        <LiquidButton material="flat" color="rgb(1, 2, 3)">
          Save
        </LiquidButton>
      </FluidThemeProvider>
    );
    expect(fillOf(container).style.background).toBe("rgb(1, 2, 3)");
  });

  it("theme material+accent switch the default button to a flat accent fill", () => {
    // Buttons are ink surfaces: their flat fill derives from accent (the
    // brand mark), not from the (usually light) surface color.
    const { container } = render(
      <FluidThemeProvider theme={{ material: "flat", accent: "#101010", surface: "#FFFFFF" }}>
        <LiquidButton>Save</LiquidButton>
      </FluidThemeProvider>
    );
    expect(fillOf(container).style.background).toBe("rgb(16, 16, 16)");
  });

  it("no provider: the fill keeps the unthemed default", () => {
    const { container } = render(<LiquidButton>Save</LiquidButton>);
    // The glass fallback fill (jsdom path) — no theme contribution anywhere.
    expect(fillOf(container).style.background).toBe(
      "rgba(255, 255, 255, 0.65)"
    );
  });
});
