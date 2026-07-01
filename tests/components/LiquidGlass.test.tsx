import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

/**
 * `LiquidGlass` reads three capability signals from `../../src/utils`
 * (`supportsBackdropFilter`, `supportsRefraction`, `usePrefersReducedMotion`)
 * to pick its rendering path, and lazily `import()`s the ESM-only
 * `@samasante/liquid-glass` engine only when it actually intends to use it.
 * Both are mocked per test, following the reset-and-reimport pattern proven
 * in tests/components/Ripple.test.tsx (there for `motion/react`): each test
 * calls `setup()`, which resets the module registry, installs fresh mocks,
 * and dynamically imports `LiquidGlass` fresh so its module-scope bindings
 * pick up the mocks.
 *
 * The engine itself is stubbed with a bare component that just spreads its
 * props onto a `<div>` — we're testing our adapter's decision logic, not the
 * engine's internals. `engineLoads` counts how many times the stub module
 * factory actually executed, so tests can assert the engine was (or wasn't)
 * requested at all.
 */

const engineLoads = { count: 0 };

function StubEngineGlass(props: Record<string, unknown>) {
  const { children, ...rest } = props;
  return <div {...rest}>{children as React.ReactNode}</div>;
}

interface SetupOptions {
  backdropFilter?: boolean;
  refraction?: boolean;
  reducedMotion?: boolean;
  /** Override the mocked engine module factory, e.g. to simulate import failure. */
  engineModule?: () => Record<string, unknown>;
}

async function setup({
  backdropFilter = true,
  refraction = true,
  reducedMotion = false,
  engineModule,
}: SetupOptions = {}) {
  vi.resetModules();
  engineLoads.count = 0;

  vi.doMock("../../src/utils", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/utils")>();
    return {
      ...actual,
      supportsBackdropFilter: () => backdropFilter,
      supportsRefraction: () => refraction,
      usePrefersReducedMotion: () => reducedMotion,
    };
  });

  vi.doMock("@samasante/liquid-glass", () => {
    engineLoads.count++;
    if (engineModule) return engineModule();
    return { Glass: StubEngineGlass };
  });

  const mod = await import("../../src/components/LiquidGlass");
  return mod.LiquidGlass;
}

/** Flush the microtask queue so any in-flight dynamic `import()` settles. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("LiquidGlass", () => {
  beforeEach(() => {
    engineLoads.count = 0;
  });

  afterEach(() => {
    vi.doUnmock("../../src/utils");
    vi.doUnmock("@samasante/liquid-glass");
    vi.resetModules();
  });

  it("renders the frosted fallback on first render, then switches to refraction once the engine loads (default refraction='auto')", async () => {
    const LiquidGlass = await setup({
      backdropFilter: true,
      refraction: true,
      reducedMotion: false,
    });
    const { container, getByText } = render(
      <LiquidGlass>Hello</LiquidGlass>
    );

    // Synchronously after render (before the dynamic import's promise has
    // had a chance to resolve), we must NEVER be showing the engine.
    const root = () =>
      container.querySelector('[data-fluidkit="liquid-glass"]') as HTMLElement;
    expect(root().getAttribute("data-glass-mode")).toBe("frosted");
    expect(getByText("Hello")).toBeInTheDocument();

    await waitFor(() =>
      expect(root().getAttribute("data-glass-mode")).toBe("refraction")
    );
    expect(getByText("Hello")).toBeInTheDocument();
  });

  it("refraction={false} stays frosted forever and never requests the engine, even when refraction is supported", async () => {
    const LiquidGlass = await setup({
      backdropFilter: true,
      refraction: true,
      reducedMotion: false,
    });
    const { container } = render(
      <LiquidGlass refraction={false}>Hello</LiquidGlass>
    );

    await flushMicrotasks();

    const root = container.querySelector(
      '[data-fluidkit="liquid-glass"]'
    ) as HTMLElement;
    expect(root.getAttribute("data-glass-mode")).toBe("frosted");
    expect(engineLoads.count).toBe(0);
  });

  it("falls back to a solid tint with no backdrop-filter or refraction support, and never throws", async () => {
    const LiquidGlass = await setup({
      backdropFilter: false,
      refraction: false,
      reducedMotion: false,
    });

    let container!: HTMLElement;
    expect(() => {
      ({ container } = render(<LiquidGlass>Hello</LiquidGlass>));
    }).not.toThrow();

    await flushMicrotasks();

    const root = container.querySelector(
      '[data-fluidkit="liquid-glass"]'
    ) as HTMLElement;
    expect(root.getAttribute("data-glass-mode")).toBe("tint");
    expect(root.style.getPropertyValue("--fluidkit-glass-tint")).not.toBe("");
    expect(engineLoads.count).toBe(0);
  });

  it("respects prefers-reduced-motion by staying on the fallback and never loading the engine, even when refraction is supported", async () => {
    const LiquidGlass = await setup({
      backdropFilter: true,
      refraction: true,
      reducedMotion: true,
    });
    const { container } = render(<LiquidGlass>Hello</LiquidGlass>);

    await flushMicrotasks();

    const root = container.querySelector(
      '[data-fluidkit="liquid-glass"]'
    ) as HTMLElement;
    expect(root.getAttribute("data-glass-mode")).toBe("frosted");
    expect(engineLoads.count).toBe(0);
  });

  it("applies blur/radius/tint via --fluidkit-* CSS custom properties on the fallback panel", async () => {
    // Force the fallback path deterministically via reduced motion so this
    // test isn't racing the async engine switch.
    const LiquidGlass = await setup({
      backdropFilter: true,
      refraction: true,
      reducedMotion: true,
    });
    const { container } = render(
      <LiquidGlass blur={20} radius={8} tint="#ff0000">
        Hello
      </LiquidGlass>
    );

    const root = container.querySelector(
      '[data-fluidkit="liquid-glass"]'
    ) as HTMLElement;
    expect(root.style.getPropertyValue("--fluidkit-glass-blur")).toBe("20px");
    expect(root.style.getPropertyValue("--fluidkit-glass-radius")).toBe(
      "8px"
    );
    expect(root.style.getPropertyValue("--fluidkit-glass-tint")).toBe(
      "#ff0000"
    );
  });

  it("forwards consumer className/style/rest props and always renders children", async () => {
    const LiquidGlass = await setup({
      backdropFilter: true,
      refraction: true,
      reducedMotion: true,
    });
    const onClick = vi.fn();
    const { container, getByText } = render(
      <LiquidGlass
        className="custom-class"
        style={{ margin: 4 }}
        onClick={onClick}
      >
        Hello
      </LiquidGlass>
    );

    const root = container.querySelector(
      '[data-fluidkit="liquid-glass"]'
    ) as HTMLElement;
    expect(root.className).toContain("custom-class");
    expect(root.style.margin).toBe("4px");

    fireEvent.click(getByText("Hello"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("never throws even if the dynamic engine import rejects, and stays on the fallback", async () => {
    const LiquidGlass = await setup({
      backdropFilter: true,
      refraction: true,
      reducedMotion: false,
      engineModule: () => {
        throw new Error("simulated engine load failure");
      },
    });

    let container!: HTMLElement;
    expect(() => {
      ({ container } = render(<LiquidGlass>Hello</LiquidGlass>));
    }).not.toThrow();

    await flushMicrotasks();

    const root = container.querySelector(
      '[data-fluidkit="liquid-glass"]'
    ) as HTMLElement;
    expect(root.getAttribute("data-glass-mode")).toBe("frosted");
  });
});
