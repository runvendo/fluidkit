import { afterEach, describe, expect, it, vi } from "vitest";
import { injectStyleOnce } from "../../src/utils/injectStyleOnce";

describe("injectStyleOnce", () => {
  afterEach(() => {
    document.getElementById("test-style-id")?.remove();
    document.getElementById("other-style-id")?.remove();
    vi.unstubAllGlobals();
  });

  it("appends a <style> tag with the given id and css to document.head", () => {
    injectStyleOnce("test-style-id", "body { color: red; }");

    const style = document.getElementById("test-style-id");
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe("STYLE");
    expect(style?.textContent).toBe("body { color: red; }");
    expect(document.head.contains(style)).toBe(true);
  });

  it("is idempotent: a second call with the same id does not create a duplicate or overwrite content", () => {
    injectStyleOnce("test-style-id", "body { color: red; }");
    injectStyleOnce("test-style-id", "body { color: blue; }");

    const styles = document.querySelectorAll("#test-style-id");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe("body { color: red; }");
  });

  it("keeps separate ids independent", () => {
    injectStyleOnce("test-style-id", "body { color: red; }");
    injectStyleOnce("other-style-id", "body { color: green; }");

    expect(document.getElementById("test-style-id")?.textContent).toBe(
      "body { color: red; }"
    );
    expect(document.getElementById("other-style-id")?.textContent).toBe(
      "body { color: green; }"
    );
  });

  it("does not throw and is a no-op when document is undefined (SSR guard)", () => {
    vi.stubGlobal("document", undefined);
    expect(() => injectStyleOnce("test-style-id", "body {}")).not.toThrow();
    vi.unstubAllGlobals();
  });
});
