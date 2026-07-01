import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * `usePrefersReducedMotion` (src/utils/reducedMotion.ts) reads Motion's
 * `useReducedMotion()`, so mocking `motion/react` is the cleanest way to
 * drive both branches of `useGoo()` deterministically — it avoids relying on
 * jsdom's `matchMedia` behavior and matches the pattern already proven in
 * tests/utils/reducedMotion.test.ts. Each test resets the module registry so
 * `useGoo` (and its dependency chain) is re-imported fresh against the
 * mock; React itself is never reset, so component identity stays intact.
 */
describe("useGoo", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("applies the goo filter and mounts the shared defs when motion is allowed", async () => {
    vi.resetModules();
    vi.doMock("motion/react", () => ({
      useReducedMotion: () => false,
    }));
    const { useGoo } = await import("../../src/hooks/useGoo");

    function Consumer() {
      const { style } = useGoo();
      return <div data-testid="goo" style={style} />;
    }

    const { getByTestId } = render(<Consumer />);

    // jsdom's CSSOM normalizes `url(...)` values by quoting them, so the
    // serialized inline style differs from the raw string `gooFilterUrl()`
    // returns; the id inside is what actually matters here.
    expect(getByTestId("goo").style.filter).toBe('url("#fluidkit-goo")');
    expect(document.getElementById("fluidkit-defs")).not.toBeNull();
  });

  it("omits the filter (separate, un-fused shapes) when the user prefers reduced motion", async () => {
    vi.resetModules();
    vi.doMock("motion/react", () => ({
      useReducedMotion: () => true,
    }));
    const { useGoo } = await import("../../src/hooks/useGoo");

    function Consumer() {
      const { style } = useGoo();
      return <div data-testid="goo" style={style} />;
    }

    const { getByTestId } = render(<Consumer />);

    expect(getByTestId("goo").style.filter).toBe("");
  });
});
