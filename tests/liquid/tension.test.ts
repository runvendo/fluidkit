import { describe, expect, it } from "vitest";
import type { LiquidBody } from "../../src/liquid/geometry";
import {
  CONNECT_STRETCH,
  MIN_WAIST_FACTOR,
  SNAP_STRETCH,
  TensionField,
  neckWaist,
} from "../../src/liquid/tension";

/** Two equal drops (r=20 each, combined 40) at a given center distance. */
function pair(d: number): LiquidBody[] {
  return [
    { id: "a", x: 0, y: 0, r: 20 },
    { id: "b", x: d, y: 0, r: 20 },
  ];
}

describe("neckWaist", () => {
  it("is full-width when drops overlap deeply", () => {
    expect(neckWaist(0.8)).toBeCloseTo(0.55);
  });

  it("never drops below the minimum waist factor", () => {
    expect(neckWaist(SNAP_STRETCH)).toBeCloseTo(0.55 * MIN_WAIST_FACTOR);
    expect(neckWaist(99)).toBeCloseTo(0.55 * MIN_WAIST_FACTOR);
  });
});

describe("TensionField", () => {
  it("does NOT bridge drops that approach without touching", () => {
    const field = new TensionField();
    // stretch 1.1 > CONNECT_STRETCH — close, but not touching
    expect(field.bridges(pair(40 * 1.1))).toBe("");
  });

  it("bridges on touch and keeps the bridge while stretching (hysteresis)", () => {
    const field = new TensionField();
    expect(field.bridges(pair(40 * 1.0))).not.toBe(""); // touch → connect
    // same distance that produced NO bridge pre-touch now stays bridged
    expect(field.bridges(pair(40 * 1.1))).not.toBe("");
    expect(field.bridges(pair(40 * (SNAP_STRETCH - 0.01)))).not.toBe("");
  });

  it("snaps the bridge past the break distance and requires touch to reconnect", () => {
    const field = new TensionField();
    field.bridges(pair(40 * 1.0)); // connect
    expect(field.bridges(pair(40 * (SNAP_STRETCH + 0.05)))).toBe(""); // snap
    expect(field.bridges(pair(40 * 1.1))).toBe(""); // approaching again: no bridge
    expect(field.bridges(pair(40 * (CONNECT_STRETCH - 0.01)))).not.toBe("");
  });

  it("drops state for bodies removed via clear(predicate)", () => {
    const field = new TensionField();
    field.bridges(pair(40)); // connect a|b
    field.clear((key) => key.includes("b"));
    expect(field.bridges(pair(40 * 1.1))).toBe(""); // must touch again
  });

  it("ignores degenerate bodies", () => {
    const field = new TensionField();
    const bodies: LiquidBody[] = [
      { id: "a", x: 0, y: 0, r: 20 },
      { id: "b", x: 10, y: 0, r: 0.2 },
    ];
    expect(field.bridges(bodies)).toBe("");
  });
});
