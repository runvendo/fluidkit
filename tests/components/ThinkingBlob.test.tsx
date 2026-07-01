import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * `ThinkingBlob` composes `useGoo()` (reduced-motion-aware goo filter),
 * `usePrefersReducedMotion()`, and `useInView()` — all of which read Motion's
 * `useReducedMotion()` under the hood. To drive each branch deterministically
 * (matching the pattern proven in tests/components/Metaballs.test.tsx), we
 * mock `motion/react` per test, always keeping the real `motion` factory (via
 * `importOriginal`) so `motion.div` still renders — only `useReducedMotion`
 * is overridden. Each test resets the module registry so `ThinkingBlob` and
 * its dependency chain are re-imported fresh against the mock.
 */

async function mockReducedMotion(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/ThinkingBlob");
  return mod.ThinkingBlob;
}

describe("ThinkingBlob", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.doUnmock("../../src/utils/useInView");
    vi.resetModules();
  });

  it("renders three blob elements", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob />);

    expect(
      container.querySelectorAll('[data-fluidkit="thinking-blob"]')
    ).toHaveLength(3);
  });

  it("defaults to active: container is animating and the goo filter is applied", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob />);

    const stage = container.firstChild as HTMLElement;

    // jsdom's CSSOM normalizes `url(...)` values by quoting them; the id
    // inside is what actually matters here (see useGoo.test.tsx).
    expect(stage.style.filter).toBe('url("#fluidkit-goo")');
    expect(document.getElementById("fluidkit-defs")).not.toBeNull();
    expect(stage.getAttribute("data-animating")).toBe("true");

    const blobs = container.querySelectorAll('[data-fluidkit="thinking-blob"]');
    blobs.forEach((blob) => {
      expect(blob.getAttribute("data-motion")).toBe("loop");
    });
  });

  it("active={false} stops the loop: container is not animating and blobs are not looping", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob active={false} />);

    const stage = container.firstChild as HTMLElement;

    expect(stage.getAttribute("data-animating")).toBe("false");

    const blobs = container.querySelectorAll('[data-fluidkit="thinking-blob"]');
    expect(blobs).toHaveLength(3);
    blobs.forEach((blob) => {
      expect(blob.getAttribute("data-motion")).not.toBe("loop");
    });
  });

  it("falls back to a calm indicator under prefers-reduced-motion: no goo filter, not animating, blobs not given transform/scale looping", async () => {
    const ThinkingBlob = await mockReducedMotion(true);
    const { container } = render(<ThinkingBlob />);

    const stage = container.firstChild as HTMLElement;

    expect(stage.style.filter).toBe("");
    expect(stage.getAttribute("data-animating")).toBe("false");

    const blobs = container.querySelectorAll('[data-fluidkit="thinking-blob"]');
    expect(blobs).toHaveLength(3);
    blobs.forEach((blob) => {
      // calm-path signal: blobs are marked "pulse" (opacity-only) rather
      // than "loop" (transform/scale), so no transform/scale animation is
      // ever attached on this path.
      expect(blob.getAttribute("data-motion")).toBe("pulse");
    });
  });

  it("renders statically when scrolled off-screen (inView false)", async () => {
    vi.resetModules();
    vi.doMock("motion/react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("motion/react")>();
      return { ...actual, useReducedMotion: () => false };
    });
    vi.doMock("../../src/utils/useInView", () => ({
      useInView: () => ({ ref: () => {}, inView: false }),
    }));
    const { ThinkingBlob } = await import("../../src/components/ThinkingBlob");

    const { container } = render(<ThinkingBlob />);
    const stage = container.firstChild as HTMLElement;

    expect(stage.getAttribute("data-animating")).toBe("false");
    // The goo filter itself is independent of in-view state (matches
    // Metaballs' behavior).
    expect(stage.style.filter).toBe('url("#fluidkit-goo")');
  });

  it("colors blobs with the resolved `color` prop", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob color="#abcdef" />);

    const blob = container.querySelector(
      '[data-fluidkit="thinking-blob"]'
    ) as HTMLElement;

    // jsdom's CSSOM normalizes hex colors to rgb() for backgroundColor, so
    // the serialized inline style differs from the raw hex string passed in;
    // #abcdef === rgb(171, 205, 239) is what actually matters here.
    expect(blob.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });

  it("defaults blob color to currentColor when `color` is omitted", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob />);

    const blob = container.querySelector(
      '[data-fluidkit="thinking-blob"]'
    ) as HTMLElement;

    // jsdom lowercases the `currentColor` keyword when serializing.
    expect(blob.style.backgroundColor).toBe("currentcolor");
  });

  it("sizes blobs from the `size` prop", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob size={30} />);

    const blob = container.querySelector(
      '[data-fluidkit="thinking-blob"]'
    ) as HTMLElement;

    expect(blob.style.width).toBe("30px");
    expect(blob.style.height).toBe("30px");
  });

  it("exposes a status role for accessibility, with a default label", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob />);

    const stage = container.firstChild as HTMLElement;

    expect(stage.getAttribute("role")).toBe("status");
    expect(stage.getAttribute("aria-label")).toBe("Thinking");
  });

  it("allows the consumer to override aria-label", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(<ThinkingBlob aria-label="Working" />);

    const stage = container.firstChild as HTMLElement;

    expect(stage.getAttribute("aria-label")).toBe("Working");
  });

  it("merges consumer className and style onto the container", async () => {
    const ThinkingBlob = await mockReducedMotion(false);
    const { container } = render(
      <ThinkingBlob className="custom-class" style={{ marginTop: 12 }} />
    );

    const stage = container.firstChild as HTMLElement;

    expect(stage.className).toContain("custom-class");
    expect(stage.style.marginTop).toBe("12px");
  });
});
