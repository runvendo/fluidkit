import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { expectTintReachesGlassFill } from "./surfacePack";

/**
 * Loads MeniscusDivider fresh with `featureDetect` mocked so refraction and
 * real glass can be exercised (jsdom's real `CSS.supports` always says no).
 */
async function loadMeniscusDivider({
  supportsBackdropFilter = false,
  supportsRefraction = false,
}: {
  supportsBackdropFilter?: boolean;
  supportsRefraction?: boolean;
} = {}) {
  vi.resetModules();
  vi.doMock("../../src/utils/featureDetect", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../src/utils/featureDetect")>();
    return {
      ...actual,
      supportsBackdropFilter: () => supportsBackdropFilter,
      supportsRefraction: () => supportsRefraction,
    };
  });
  const mod = await import("../../src/components/MeniscusDivider");
  return mod.MeniscusDivider;
}

const WIDTH = 300;

describe("MeniscusDivider refraction", () => {
  beforeEach(() => {
    // The divider measures its own box; jsdom has neither ResizeObserver nor
    // layout, so stub the observer and pin the measured width.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(WIDTH);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("../../src/utils/featureDetect");
    vi.resetModules();
  });

  it("mounts the refraction filter defs only when enabled on glass", async () => {
    const MeniscusDivider = await loadMeniscusDivider({
      supportsRefraction: true,
    });
    const withDefault = render(<MeniscusDivider />);
    expect(withDefault.container.querySelector("filter")).toBeNull();
    const withRefraction = render(
      <MeniscusDivider refraction material="glass" />
    );
    expect(withRefraction.container.querySelector("filter")).not.toBeNull();
  });

  it("does not mount refraction defs on flat material even when refraction is enabled", async () => {
    const MeniscusDivider = await loadMeniscusDivider({
      supportsRefraction: true,
    });
    const { container } = render(
      <MeniscusDivider refraction material="flat" />
    );
    expect(container.querySelector("filter")).toBeNull();
  });

  it("does not mount refraction defs when unsupported, even if enabled on glass", async () => {
    const MeniscusDivider = await loadMeniscusDivider({
      supportsRefraction: false,
    });
    const { container } = render(
      <MeniscusDivider refraction material="glass" />
    );
    expect(container.querySelector("filter")).toBeNull();
  });

  // Surface style pack conformance smoke: `tint` reaches the glass fill.
  it("applies `tint` to the glass fill", async () => {
    const MeniscusDivider = await loadMeniscusDivider({
      supportsBackdropFilter: true,
    });
    expectTintReachesGlassFill((props) => render(<MeniscusDivider {...props} />));
  });
});
