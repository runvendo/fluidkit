import { describe, expect, it } from "vitest";
import { defaultLight, specularPlacement } from "../../src/liquid/specular";

describe("specularPlacement", () => {
  it("places the highlight on the side of the drop FACING the light", () => {
    const drop = { x: 100, y: 100, r: 20 };
    const above = specularPlacement(drop, { x: 100, y: 0 });
    expect(above.cy).toBeLessThan(drop.y);
    expect(above.cx).toBeCloseTo(drop.x, 0);

    const toTheRight = specularPlacement(drop, { x: 300, y: 100 });
    expect(toTheRight.cx).toBeGreaterThan(drop.x);
    expect(toTheRight.cy).toBeCloseTo(drop.y, 0);
  });

  it("keeps the highlight inside the drop", () => {
    const drop = { x: 0, y: 0, r: 20 };
    const spot = specularPlacement(drop, { x: 0, y: -500 });
    expect(Math.hypot(spot.cx, spot.cy)).toBeLessThan(drop.r);
  });

  it("orients the ellipse tangent to the surface (light angle + 90deg)", () => {
    const drop = { x: 0, y: 0, r: 20 };
    const spot = specularPlacement(drop, { x: 0, y: -100 }); // light straight up
    // atan2(-100, 0) = -90deg → rotate = 0 (major axis horizontal)
    expect(spot.rotate).toBeCloseTo(0, 0);
  });

  it("scales the ellipse with the drop radius", () => {
    const small = specularPlacement({ x: 0, y: 0, r: 10 }, { x: 0, y: -100 });
    const big = specularPlacement({ x: 0, y: 0, r: 40 }, { x: 0, y: -100 });
    expect(big.rx).toBeCloseTo(small.rx * 4);
  });
});

describe("defaultLight", () => {
  it("sits above the scene, 30% from the left", () => {
    expect(defaultLight(400, 300)).toEqual({ x: 120, y: -40 });
  });
});
