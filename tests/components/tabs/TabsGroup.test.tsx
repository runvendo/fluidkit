import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TabsGroup, useTabsContext } from "../../../src/components/tabs/TabsGroup";

function Probe() {
  const ctx = useTabsContext();
  if (!ctx) return <div data-testid="no-ctx" />;
  return (
    <button data-testid="probe" data-value={ctx.value} onClick={() => ctx.setValue("y")}>
      {ctx.namespace ? "has-ns" : "no-ns"}
    </button>
  );
}

describe("TabsGroup", () => {
  it("returns null context outside a provider", () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("no-ctx")).toBeTruthy();
  });

  it("seeds uncontrolled value from defaultValue and updates on setValue", () => {
    const { getByTestId } = render(
      <TabsGroup defaultValue="x">
        <Probe />
      </TabsGroup>
    );
    const probe = getByTestId("probe");
    expect(probe.getAttribute("data-value")).toBe("x");
    fireEvent.click(probe);
    expect(getByTestId("probe").getAttribute("data-value")).toBe("y");
  });

  it("stays controlled: value prop wins, onChange fires, internal state does not move", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <TabsGroup value="x" onChange={onChange}>
        <Probe />
      </TabsGroup>
    );
    fireEvent.click(getByTestId("probe"));
    expect(onChange).toHaveBeenCalledWith("y");
    // value stays "x" because the parent controls it
    expect(getByTestId("probe").getAttribute("data-value")).toBe("x");
  });

  it("provides a stable namespace string", () => {
    const { getByTestId } = render(
      <TabsGroup defaultValue="x">
        <Probe />
      </TabsGroup>
    );
    expect(getByTestId("probe").textContent).toBe("has-ns");
  });
});
