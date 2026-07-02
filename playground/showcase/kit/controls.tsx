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

/** Row of controls under a stage — same `.controls` treatment as the old cards. */
export function Controls({ children }: { children: ReactNode }) {
  return <div className="controls">{children}</div>;
}
