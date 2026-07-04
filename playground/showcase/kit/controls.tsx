/* ------------------------- control primitives ------------------------- */
import type { ReactNode } from "react";

export function Slider({ label, value, set, min, max, step = 1, suffix = "" }: {
  label: string; value: number; set: (n: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div className="field">
      <label>{label} <span className="val">{value}{suffix}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} />
    </div>
  );
}

export function Toggle({ label, value, set }: { label: string; value: boolean; set: (b: boolean) => void }) {
  return <button className="btn" onClick={() => set(!value)}>{label}: {value ? "on" : "off"}</button>;
}

export function Seg<T extends string>({ label, value, set, options }: { label: string; value: T; set: (v: T) => void; options: T[] }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="seg">{options.map((o) => <button key={o} className={o === value ? "on" : ""} onClick={() => set(o)}>{o}</button>)}</div>
    </div>
  );
}

/**
 * Native color picker with an "unset" state: pass `value={null}` while the
 * user hasn't picked one yet — shows a neutral swatch and lets pages omit
 * the prop entirely (component default renders). Once `set` fires, callers
 * typically hold a real string from then on.
 */
export function ColorField({ label, value, set }: { label: string; value: string | null; set: (v: string) => void }) {
  return (
    <div className="field">
      <label>
        {label} <span className="val">{value ?? "auto"}</span>
      </label>
      <input type="color" value={value ?? "#888888"} onChange={(e) => set(e.target.value)} />
    </div>
  );
}

/** Native `<input type="color">` only emits opaque hex; glass tints must stay translucent, so pages route picked values through this before handing them to a `tint` prop. */
export function glassTintFromHex(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.35)`;
}

/** Row of controls under a stage — same `.controls` treatment as the old cards. */
export function Controls({ children }: { children: ReactNode }) {
  return <div className="controls">{children}</div>;
}
