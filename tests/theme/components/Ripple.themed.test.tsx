import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

/**
 * Theme wiring for `Ripple`. Spawning a ripple requires motion to be
 * allowed, so `useReducedMotion` is mocked to `false` (same pattern as
 * tests/components/Ripple.test.tsx). Because the mock resets the module
 * registry, `FluidThemeProvider` is dynamically imported from the SAME
 * fresh registry as `Ripple` — a statically-imported provider would carry
 * a different React context and never reach the component.
 *
 * Ripple defaults to the `flat` material, and the derived accent tint only
 * feeds glass (that is the actual wiring: `tint` is consumed solely by the
 * glass recipe), so surfacing the accent requires the theme to also set
 * `material: "glass"`. jsdom can't answer `supportsBackdropFilter()`, so
 * glass degrades to the resolver's flat fallback whose background IS the
 * tint. jsdom normalizes the hex inside `color-mix()` to `rgb(...)`, so
 * assertions accept both forms.
 */
async function loadThemedRipple() {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => false };
  });
  const { Ripple } = await import("../../../src/components/Ripple");
  const { FluidThemeProvider } = await import("../../../src/theme");
  return { Ripple, FluidThemeProvider };
}

/** Pointer-taps the wrapper and returns the spawned ripple element. */
function spawnRipple(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector(
    '[data-fluidkit="ripple-surface"]'
  ) as HTMLElement;
  fireEvent.pointerDown(wrapper, { clientX: 5, clientY: 5 });
  return container.querySelector('[data-fluidkit="ripple"]') as HTMLElement;
}

// Ripple's derived accent share is 14% (src/theme/derive.ts).
const ACCENT_MIX =
  /^color-mix\(in srgb, (?:#2D6A4F|rgb\(45, 106, 79\)) 14%, transparent\)$/;

describe("Ripple (themed)", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("theme accent tints the ripple when the theme also sets material=glass", async () => {
    const { Ripple, FluidThemeProvider } = await loadThemedRipple();
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#2D6A4F", material: "glass" }}>
        <Ripple>Click me</Ripple>
      </FluidThemeProvider>
    );
    expect(spawnRipple(container).style.background).toMatch(ACCENT_MIX);
  });

  it("an accent-only theme leaves the default flat wash untinted (tint feeds glass only)", async () => {
    const { Ripple, FluidThemeProvider } = await loadThemedRipple();
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#2D6A4F" }}>
        <Ripple>Click me</Ripple>
      </FluidThemeProvider>
    );
    expect(spawnRipple(container).style.background).not.toContain("color-mix");
  });

  it("theme accent colors the flat wash", async () => {
    // Ripple ink derives from accent — it is click feedback in the brand
    // color, not a container filled with the surface color.
    const { Ripple, FluidThemeProvider } = await loadThemedRipple();
    const { container } = render(
      <FluidThemeProvider theme={{ accent: "#123456", surface: "#FFFFFF" }}>
        <Ripple>Click me</Ripple>
      </FluidThemeProvider>
    );
    expect(spawnRipple(container).style.background).toBe("rgb(18, 52, 86)");
  });

  it("explicit material and color beat the theme's", async () => {
    const { Ripple, FluidThemeProvider } = await loadThemedRipple();
    const { container } = render(
      <FluidThemeProvider
        theme={{ material: "glass", accent: "#2D6A4F", surface: "#123456" }}
      >
        <Ripple material="flat" color="#ff0000">
          Click me
        </Ripple>
      </FluidThemeProvider>
    );
    expect(spawnRipple(container).style.background).toBe("rgb(255, 0, 0)");
  });

  it("theme intensity scales the peak opacity; explicit intensity wins", async () => {
    const { Ripple, FluidThemeProvider } = await loadThemedRipple();
    // "present" (0.7) doubles the default volume: 0.4 × (0.7 / 0.35) = 0.8.
    const themedOnly = render(
      <FluidThemeProvider theme={{ intensity: "present" }}>
        <Ripple>Click me</Ripple>
      </FluidThemeProvider>
    );
    expect(spawnRipple(themedOnly.container).style.opacity).toBe("0.8");
    const explicit = render(
      <FluidThemeProvider theme={{ intensity: "present" }}>
        <Ripple intensity="whisper">Click me</Ripple>
      </FluidThemeProvider>
    );
    expect(spawnRipple(explicit.container).style.opacity).toBe("0.4");
  });

  it("renders the default currentColor wash with no provider mounted", async () => {
    const { Ripple } = await loadThemedRipple();
    const { container } = render(<Ripple>Click me</Ripple>);
    const ripple = spawnRipple(container);
    expect(ripple.style.background).not.toContain("color-mix");
    expect(ripple.style.opacity).toBe("0.4");
  });
});
