import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { acquireDefs, releaseDefs } from "../../src/filters/injectDefs";
import { useFilterDefs } from "../../src/filters/useFilterDefs";

/** Test-only component that acquires/releases the shared defs singleton. */
function Consumer() {
  useFilterDefs();
  return null;
}

describe("filter defs injector (via useFilterDefs)", () => {
  // Each mounted consumer is tracked so the afterEach below can unmount
  // whatever a test left mounted, returning the ref count to 0 before the
  // next test runs (in addition to the global afterEach(cleanup) already
  // registered in vitest.setup.ts).
  let mounted: ReturnType<typeof render>[] = [];

  afterEach(() => {
    mounted.forEach((instance) => instance.unmount());
    mounted = [];
  });

  it("mounts exactly one #fluidkit-defs node no matter how many consumers mount (idempotency)", () => {
    mounted.push(render(<Consumer />));
    mounted.push(render(<Consumer />));

    expect(document.querySelectorAll("#fluidkit-defs")).toHaveLength(1);
  });

  it("keeps the #fluidkit-defs node while at least one consumer remains mounted", () => {
    mounted.push(render(<Consumer />));
    mounted.push(render(<Consumer />));

    mounted.shift()?.unmount();

    expect(document.getElementById("fluidkit-defs")).not.toBeNull();
  });

  it("removes the #fluidkit-defs node once the last consumer unmounts", () => {
    const a = render(<Consumer />);
    const b = render(<Consumer />);

    a.unmount();
    b.unmount();

    expect(document.getElementById("fluidkit-defs")).toBeNull();
  });

  it("re-mounts cleanly after having been fully released", () => {
    const a = render(<Consumer />);
    a.unmount();
    expect(document.getElementById("fluidkit-defs")).toBeNull();

    mounted.push(render(<Consumer />));
    expect(document.querySelectorAll("#fluidkit-defs")).toHaveLength(1);
  });
});

describe("SSR safety", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("acquireDefs and releaseDefs are no-ops and do not throw when document is undefined", () => {
    vi.stubGlobal("document", undefined);

    expect(() => acquireDefs()).not.toThrow();
    expect(() => releaseDefs()).not.toThrow();
  });
});
