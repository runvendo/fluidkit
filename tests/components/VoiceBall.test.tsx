import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { expectTintReachesGlassFill } from "./surfacePack";

/**
 * Loads VoiceBall fresh with `featureDetect` mocked so refraction and real
 * glass can be exercised (jsdom's real `CSS.supports` always says no).
 */
async function loadVoiceBall({
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
  const mod = await import("../../src/components/VoiceBall");
  return mod.VoiceBall;
}

describe("VoiceBall refraction", () => {
  afterEach(() => {
    vi.doUnmock("../../src/utils/featureDetect");
    vi.resetModules();
  });

  it("mounts the refraction filter defs only when enabled on glass", async () => {
    const VoiceBall = await loadVoiceBall({ supportsRefraction: true });
    const withDefault = render(<VoiceBall />);
    expect(withDefault.container.querySelector("filter")).toBeNull();
    const withRefraction = render(<VoiceBall refraction material="glass" />);
    expect(withRefraction.container.querySelector("filter")).not.toBeNull();
  });

  it("does not mount refraction defs on flat material even when refraction is enabled", async () => {
    const VoiceBall = await loadVoiceBall({ supportsRefraction: true });
    const { container } = render(<VoiceBall refraction material="flat" />);
    expect(container.querySelector("filter")).toBeNull();
  });

  it("does not mount refraction defs when unsupported, even if enabled on glass", async () => {
    const VoiceBall = await loadVoiceBall({ supportsRefraction: false });
    const { container } = render(<VoiceBall refraction material="glass" />);
    expect(container.querySelector("filter")).toBeNull();
  });

  // Surface style pack conformance smoke: `tint` reaches the glass fill.
  it("applies `tint` to the glass fill", async () => {
    const VoiceBall = await loadVoiceBall({ supportsBackdropFilter: true });
    expectTintReachesGlassFill((props) => render(<VoiceBall {...props} />));
  });
});
