import { describe, expect, it } from "vitest";
import { resolveColor } from "../../src/utils/color";

describe("resolveColor", () => {
  it("passes through a provided hex color unchanged", () => {
    expect(resolveColor("#ff0000")).toBe("#ff0000");
  });

  it("passes through a provided rgb() color unchanged", () => {
    expect(resolveColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
  });

  it("passes through a provided named color unchanged", () => {
    expect(resolveColor("tomato")).toBe("tomato");
  });

  it("passes through a CSS custom-property reference unchanged", () => {
    expect(resolveColor("var(--fluidkit-accent)")).toBe(
      "var(--fluidkit-accent)"
    );
  });

  it("falls back to currentColor when color is omitted", () => {
    expect(resolveColor(undefined)).toBe("currentColor");
  });

  it("falls back to currentColor when color is an empty string", () => {
    expect(resolveColor("")).toBe("currentColor");
  });

  it("falls back to currentColor when color is whitespace-only", () => {
    expect(resolveColor("   ")).toBe("currentColor");
  });

  it("honors a custom fallback when color is omitted", () => {
    expect(resolveColor(undefined, "#000000")).toBe("#000000");
  });
});
