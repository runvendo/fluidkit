import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useTabList, type TabListItem } from "../../../src/components/tabs/useTabList";

const ITEMS: TabListItem[] = [
  { id: "a" },
  { id: "b", disabled: true },
  { id: "c" },
];

function Harness({
  value,
  onChange,
  onNavigate,
  orientation,
}: {
  value: string;
  onChange: (id: string) => void;
  onNavigate?: (id: string) => void;
  orientation?: "horizontal" | "vertical";
}) {
  const list = useTabList({ items: ITEMS, value, onChange, onNavigate, orientation });
  return (
    <div>
      {ITEMS.map((item, i) => (
        <button key={item.id} data-testid={item.id} {...list.getTabProps(item, i)}>
          {item.id}
        </button>
      ))}
    </div>
  );
}

describe("useTabList", () => {
  it("gives the selected tab tabIndex 0 and the rest -1", () => {
    const { getByTestId } = render(<Harness value="c" onChange={() => {}} />);
    expect(getByTestId("a").tabIndex).toBe(-1);
    expect(getByTestId("c").tabIndex).toBe(0);
  });

  it("sets aria-selected on the selected tab only", () => {
    const { getByTestId } = render(<Harness value="a" onChange={() => {}} />);
    expect(getByTestId("a").getAttribute("aria-selected")).toBe("true");
    expect(getByTestId("c").getAttribute("aria-selected")).toBe("false");
  });

  it("marks disabled tabs with aria-disabled and does not fire onChange on click", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="a" onChange={onChange} />);
    expect(getByTestId("b").getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(getByTestId("b"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowRight skips the disabled tab and selects the next enabled one", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="a" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("a"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("c"); // skipped disabled "b"
  });

  it("ArrowRight wraps from the last enabled tab to the first", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="c" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("c"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("ArrowLeft moves to the previous enabled tab", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="c" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("c"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("a"); // skipped disabled "b"
  });

  it("Home selects the first enabled tab, End the last enabled tab", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="c" onChange={onChange} />);
    fireEvent.keyDown(getByTestId("c"), { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("a");
    fireEvent.keyDown(getByTestId("a"), { key: "End" });
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("clicking an enabled tab selects it", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness value="a" onChange={onChange} />);
    fireEvent.click(getByTestId("c"));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("onNavigate fires with the target id on ArrowRight (skipping disabled)", () => {
    const onNavigate = vi.fn();
    const { getByTestId } = render(
      <Harness value="a" onChange={() => {}} onNavigate={onNavigate} />
    );
    fireEvent.keyDown(getByTestId("a"), { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith("c"); // skipped disabled "b"
  });

  it("onNavigate does not fire on click", () => {
    const onNavigate = vi.fn();
    const { getByTestId } = render(
      <Harness value="a" onChange={() => {}} onNavigate={onNavigate} />
    );
    fireEvent.click(getByTestId("c"));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("vertical orientation: ArrowDown moves to the next enabled tab, ArrowRight does nothing", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <Harness value="a" onChange={onChange} orientation="vertical" />
    );
    fireEvent.keyDown(getByTestId("a"), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(getByTestId("a"), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("c"); // skipped disabled "b"
  });
});
