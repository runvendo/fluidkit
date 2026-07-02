import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import {
  Droplets,
  FlowStagger,
  LiquidTabs,
  MorphSurface,
  Ripple,
  Thinking,
} from "../src/index";
import type { LiquidMaterial } from "../src/liquid";

/* ------------------------- control primitives ------------------------- */
function Slider({ label, value, set, min, max, step = 1, suffix = "" }: {
  label: string; value: number; set: (n: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div className="field">
      <label>{label} <span className="val">{value}{suffix}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} />
    </div>
  );
}
function Toggle({ label, value, set }: { label: string; value: boolean; set: (b: boolean) => void }) {
  return <button className="btn" onClick={() => set(!value)}>{label}: {value ? "on" : "off"}</button>;
}
function Seg<T extends string>({ label, value, set, options }: { label: string; value: T; set: (v: T) => void; options: T[] }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="seg">{options.map((o) => <button key={o} className={o === value ? "on" : ""} onClick={() => set(o)}>{o}</button>)}</div>
    </div>
  );
}

function Card({ title, desc, hint, wall, stage, controls, onStageClick }: {
  title: string; desc: string; hint?: string; wall?: boolean; stage: ReactNode; controls?: ReactNode; onStageClick?: () => void;
}) {
  return (
    <div className="card">
      <div className={wall ? "stage wall" : "stage"} onClick={onStageClick} style={onStageClick ? { cursor: "pointer" } : undefined}>
        {hint ? <div className="hint">{hint}</div> : null}
        {wall ? <><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></> : null}
        {stage}
      </div>
      {controls ? <div className="controls">{controls}</div> : null}
      <div className="meta"><h2>{title}</h2><p>{desc}</p></div>
    </div>
  );
}

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/* ------------------------- demos ------------------------- */
function DropletsDemo() {
  const [count, setCount] = useState(3), [size, setSize] = useState(36), [spread, setSpread] = useState(110), [speed, setSpeed] = useState(1);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  return <Card title="Droplets" desc="Liquid drops with surface tension: touch-connect, stretch, snap. Your pointer drop merges with the cluster." hint="move pointer — your drop is alive" wall
    stage={<Droplets followPointer count={count} size={size} spread={spread} speed={speed} material={material} reflection={reflection} color="#8d94a1" />}
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Toggle label="reflection" value={reflection} set={setReflection} /><Slider label="count" value={count} set={setCount} min={1} max={5} /><Slider label="size" value={size} set={setSize} min={20} max={64} /><Slider label="spread" value={spread} set={setSpread} min={40} max={160} /><Slider label="speed" value={speed} set={setSpeed} min={0.2} max={3} step={0.1} /></>} />;
}

function MorphDemo() {
  const [open, setOpen] = useState(false);
  const [satellites, setSatellites] = useState(true);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  return <Card title="MorphSurface" desc="One liquid body: pill morphs into panel, satellite droplets absorbed through real bridges. Text only cross-fades — never scales." hint="click — droplets absorb into the panel" wall
    onStageClick={() => setOpen((v) => !v)}
    stage={
      <MorphSurface
        open={open}
        material={material}
        reflection={reflection}
        satellites={satellites}
        closedContent={<div className="pill-label"><span className="dot" />Ask fluidkit</div>}
        openContent={
          <div className="panel-body">
            <div className="ph"><span className="dot" />Assistant</div>
            <div className="row me">Move $500 to savings</div>
            <div className="row">Done — scheduled for tomorrow.</div>
            <div className="row">Want a weekly rule?</div>
          </div>
        }
      />
    }
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Toggle label="reflection" value={reflection} set={setReflection} /><Toggle label="satellites" value={satellites} set={setSatellites} /></>} />;
}

function ThinkingDemo() {
  const [size, setSize] = useState(18), [speed, setSpeed] = useState(1.2);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  return <Card title="Thinking" desc="Working indicator: three droplets merge and split with fast-settle tension. role=status for assistive tech." wall
    stage={<Thinking size={size} speed={speed} material={material} color="#8d94a1" />}
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Slider label="size" value={size} set={setSize} min={10} max={32} /><Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} /></>} />;
}

function MercuryDemo() {
  return <Card title="Droplets (mercury)" desc="Identical engine, mercury material: solid liquid metal, no gradient, no highlight. Materials are a prop, not separate components." hint="same engine, different material"
    stage={<Droplets material="mercury" spread={110} />} />;
}

function FlowDemo() {
  const [items, setItems] = useState(["Summarize spending", "Move $500 to savings", "Cancel duplicate sub"]);
  const [stagger, setStagger] = useState(0.06);
  return <Card title="FlowStagger" desc="Children rise + un-blur, staggered; siblings glide on change." hint="click Add / Remove"
    stage={<FlowStagger key={stagger} stagger={stagger} style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
      {items.map((t) => <div key={t} style={{ background: "#fff", border: "1px solid #e2e3ea", borderRadius: 12, padding: "10px 13px", fontSize: 13, boxShadow: "0 1px 2px rgba(24,25,36,.06)" }}>{t}</div>)}
    </FlowStagger>}
    controls={<><Slider label="stagger" value={stagger} set={setStagger} min={0} max={0.2} step={0.01} suffix="s" /><button className="btn" onClick={() => setItems((x) => [`New task ${x.length + 1}`, ...x])}>Add</button><button className="btn" onClick={() => setItems((x) => x.slice(1))}>Remove</button></>} />;
}

function TabsDemo() {
  const [value, setValue] = useState("chat");
  return <Card title="LiquidTabs" desc="Indicator glides on a taut spring; labels stay crisp. (Engine-driven stretch lands in v0.3.)" hint="click a tab" wall
    stage={<LiquidTabs value={value} onChange={setValue} color="#23242c" items={[{ id: "chat", label: "Chat" }, { id: "automations", label: "Automations" }, { id: "connections", label: "Connections" }]} style={{ display: "flex", gap: 4, padding: 5, borderRadius: 999, background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px) saturate(1.6)", WebkitBackdropFilter: "blur(14px) saturate(1.6)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 10px 28px rgba(46,44,72,.16)" }} />} />;
}

function RippleDemo() {
  const [duration, setDuration] = useState(650);
  return <Card title="Ripple" desc="Water ripple expands from the pointer on tap, clipped to the surface." hint="tap the surface" wall
    stage={<Ripple material="glass" duration={duration} style={{ display: "grid", placeItems: "center", width: 210, height: 92, borderRadius: 20, cursor: "pointer", userSelect: "none", background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px) saturate(1.6)", WebkitBackdropFilter: "blur(14px) saturate(1.6)", color: "#23242c", fontSize: 14, fontWeight: 650, boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 10px 28px rgba(46,44,72,.16)" }}>Tap me</Ripple>}
    controls={<Slider label="duration" value={duration} set={setDuration} min={200} max={2000} step={50} suffix="ms" />} />;
}

function App() {
  return (
    <>
      <h1>fluidkit</h1>
      <p className="sub">One liquid engine — metaball geometry, springs, surface tension with touch-connect / snap-on-stretch — rendered in swappable materials (glass, mercury, flat). Built on Motion. Text never scales.</p>
      <div className="grid">
        <DropletsDemo />
        <MorphDemo />
        <ThinkingDemo />
        <MercuryDemo />
        <FlowDemo />
        <TabsDemo />
        <RippleDemo />
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
