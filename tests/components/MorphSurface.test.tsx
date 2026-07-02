import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

async function loadMorphSurface(reduced: boolean) {
  vi.resetModules();
  vi.doMock("motion/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("motion/react")>();
    return { ...actual, useReducedMotion: () => reduced };
  });
  const mod = await import("../../src/components/MorphSurface");
  return mod.MorphSurface;
}

describe("MorphSurface", () => {
  afterEach(() => {
    vi.doUnmock("motion/react");
    vi.resetModules();
  });

  it("shows closed content and hides open content when closed", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const closed = getByText("pill").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(closed.style.opacity).toBe("1");
    expect(opened.style.opacity).toBe("0");
    expect(opened.getAttribute("aria-hidden")).toBe("true");
  });

  it("cross-fades faces when open flips — content only fades, never scales", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { getByText, rerender } = render(
      <MorphSurface
        open={false}
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    rerender(
      <MorphSurface
        open
        closedContent={<span>pill</span>}
        openContent={<span>panel</span>}
      />
    );
    const opened = getByText("panel").closest(
      '[data-fluidkit="morph-face"]'
    ) as HTMLElement;
    expect(opened.style.opacity).toBe("1");
    // the face never scales — transform is reserved for centering only
    expect(opened.style.transform).not.toContain("scale");
  });

  it("renders the liquid clip stack and reports its state", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(<MorphSurface open={false} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(
      container.querySelector('[data-fluidkit="liquid-clip"]')
    ).not.toBeNull();
  });

  it("under reduced motion the surface renders the target size immediately", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container, rerender } = render(<MorphSurface open={false} />);
    rerender(<MorphSurface open />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-state")).toBe("open");
    expect(root.getAttribute("data-animating")).toBe("false");
  });

  it("sizes its container to fit the open state plus satellite margin", async () => {
    const MorphSurface = await loadMorphSurface(true);
    const { container } = render(
      <MorphSurface open={false} openSize={{ width: 200, height: 160 }} />
    );
    const root = container.firstChild as HTMLElement;
    expect(parseInt(root.style.width, 10)).toBeGreaterThanOrEqual(200);
    expect(parseInt(root.style.height, 10)).toBeGreaterThanOrEqual(160);
  });
});
