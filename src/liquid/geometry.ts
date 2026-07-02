/**
 * Pure metaball geometry for the liquid engine.
 *
 * Shapes are emitted as SVG path-data SUBPATHS (each ends with `Z `) so
 * callers can concatenate circles, rounded rects, and bridge curves into one
 * string and hand it to `clip-path: path(...)`, which unions overlapping
 * subpaths under the nonzero fill rule. The bridge is the classic two-circle
 * metaball construction (Hiroyuki Sato / paper.js form): tangent points on
 * each circle joined by two bezier curves whose handles create the liquid
 * "neck".
 */

export interface Vec {
  x: number;
  y: number;
}

/** A circle participating in the liquid simulation. */
export interface LiquidBody extends Vec {
  /** Stable identity — pairs of ids key the tension hysteresis state. */
  id: string;
  r: number;
}

const fmt = (n: number): string => n.toFixed(1);

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a: Vec, b: Vec): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function vecAt(p: Vec, angle: number, r: number): Vec {
  return { x: p.x + r * Math.cos(angle), y: p.y + r * Math.sin(angle) };
}

/** Closed circular subpath (two arcs). Empty for sub-pixel radii. */
export function circlePath(center: Vec, r: number): string {
  if (r <= 0.5) return "";
  return (
    `M ${fmt(center.x + r)} ${fmt(center.y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(center.x - r)} ${fmt(center.y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(center.x + r)} ${fmt(center.y)} Z `
  );
}

/** Closed rounded-rectangle subpath centered on `center`. */
export function roundRectPath(
  center: Vec,
  width: number,
  height: number,
  radius: number
): string {
  const r = Math.min(radius, width / 2, height / 2);
  const x = center.x - width / 2;
  const y = center.y - height / 2;
  return (
    `M ${fmt(x + r)} ${fmt(y)} L ${fmt(x + width - r)} ${fmt(y)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + width)} ${fmt(y + r)} ` +
    `L ${fmt(x + width)} ${fmt(y + height - r)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + width - r)} ${fmt(y + height)} ` +
    `L ${fmt(x + r)} ${fmt(y + height)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + height - r)} ` +
    `L ${fmt(x)} ${fmt(y + r)} ` +
    `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + r)} ${fmt(y)} Z `
  );
}

/**
 * Metaball bridge between two circles. `waist` (0..~1) controls neck width.
 * Returns "" when out of reach, contained, or degenerate.
 */
export function bridgePath(
  c1: Vec,
  r1: number,
  c2: Vec,
  r2: number,
  waist: number,
  handle = 2.1,
  reach = 1.6
): string {
  if (r1 <= 0.5 || r2 <= 0.5) return "";
  const d = dist(c1, c2);
  const maxD = (r1 + r2) * reach;
  if (d > maxD || d <= Math.abs(r1 - r2) + 0.5) return "";

  let u1 = 0;
  let u2 = 0;
  if (d < r1 + r2) {
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d));
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d));
  }

  const ang = angleBetween(c1, c2);
  const maxSpread = Math.acos((r1 - r2) / d);
  const a1 = ang + u1 + (maxSpread - u1) * waist;
  const a2 = ang - u1 - (maxSpread - u1) * waist;
  const a3 = ang + Math.PI - u2 - (Math.PI - u2 - maxSpread) * waist;
  const a4 = ang - Math.PI + u2 + (Math.PI - u2 - maxSpread) * waist;

  const p1 = vecAt(c1, a1, r1);
  const p2 = vecAt(c1, a2, r1);
  const p3 = vecAt(c2, a3, r2);
  const p4 = vecAt(c2, a4, r2);

  const totalR = r1 + r2;
  const d2 =
    Math.min(waist * handle, dist(p1, p3) / totalR) *
    Math.min(1, (d * 2) / totalR);
  const hr1 = r1 * d2;
  const hr2 = r2 * d2;

  const h1 = vecAt(p1, a1 - Math.PI / 2, hr1);
  const h2 = vecAt(p2, a2 + Math.PI / 2, hr1);
  const h3 = vecAt(p3, a3 + Math.PI / 2, hr2);
  const h4 = vecAt(p4, a4 - Math.PI / 2, hr2);

  return (
    `M ${fmt(p1.x)} ${fmt(p1.y)} ` +
    `C ${fmt(h1.x)} ${fmt(h1.y)} ${fmt(h3.x)} ${fmt(h3.y)} ${fmt(p3.x)} ${fmt(p3.y)} ` +
    `L ${fmt(p4.x)} ${fmt(p4.y)} ` +
    `C ${fmt(h4.x)} ${fmt(h4.y)} ${fmt(h2.x)} ${fmt(h2.y)} ${fmt(p2.x)} ${fmt(p2.y)} Z `
  );
}
