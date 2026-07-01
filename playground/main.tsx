import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "motion/react";
import {
  Metaballs, ThinkingBlob, MorphSurface, FlowStagger, LiquidTabs, Ripple, LiquidGlass,
  useMorph, useGoo,
} from "../src/index";

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
function Color({ label, value, set }: { label: string; value: string; set: (s: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="color" value={value} onChange={(e) => set(e.target.value)} />
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

function Card({ title, desc, hint, stage, controls }: {
  title: string; desc: string; hint?: string; stage: React.ReactNode; controls: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="stage">{hint ? <div className="hint">{hint}</div> : null}{stage}</div>
      <div className="controls">{controls}</div>
      <div className="meta"><h2>{title}</h2><p>{desc}</p></div>
    </div>
  );
}

/* ------------------------- fluid morph (flat color, configurable) ------------------------- */
const BLOB_RADII = [
  "38% 62% 63% 37% / 41% 44% 56% 59%",
  "62% 38% 41% 59% / 59% 56% 44% 41%",
  "45% 55% 52% 48% / 63% 38% 62% 37%",
  "55% 45% 57% 43% / 38% 63% 37% 62%",
];
// deterministic satellite placements (fractions of the panel box)
const SAT = [
  { fx: 0.16, fy: 0.14, s: 0.34, dx: -34, dy: -22, dur: 5.2, delay: 0 },
  { fx: 0.9, fy: 0.3, s: 0.3, dx: 30, dy: 18, dur: 6.1, delay: 0.6 },
  { fx: 0.84, fy: 0.9, s: 0.32, dx: 26, dy: 30, dur: 5.7, delay: 0.3 },
  { fx: 0.1, fy: 0.82, s: 0.28, dx: -28, dy: 26, dur: 6.6, delay: 0.9 },
  { fx: 0.5, fy: 0.06, s: 0.24, dx: 8, dy: -26, dur: 5.0, delay: 1.2 },
  { fx: 0.5, fy: 0.98, s: 0.24, dx: -8, dy: 26, dur: 6.3, delay: 0.4 },
];

function FluidMorph({ color, blobs, wobble, stiffness, damping }: {
  color: string; blobs: number; wobble: number; stiffness: number; damping: number;
}) {
  const [open, setOpen] = useState(true);
  const spring = { type: "spring" as const, stiffness, damping, mass: 1.15 };
  const { surfaceProps, contentProps } = useMorph({ open, transition: spring });
  const { key, ...restContent } = contentProps;
  const goo = useGoo();
  const W = open ? 300 : 190, H = open ? 190 : 52;
  const base = Math.min(W, H);

  return (
    <>
      <button className="btn" style={{ position: "absolute", left: 12, bottom: 12, zIndex: 6 }} onClick={() => setOpen((v) => !v)}>Toggle morph</button>
      <div style={{ position: "relative", width: W, height: H, transition: "width .5s cubic-bezier(.34,1.3,.4,1), height .5s cubic-bezier(.34,1.3,.4,1)" }}>
        {/* liquid mass: flat, single color, goo-fused (no gradient => seamless) */}
        <div style={{ position: "absolute", inset: -46, ...goo.style }}>
          <div style={{ position: "absolute", inset: 46 }}>
            <motion.div
              {...surfaceProps}
              style={{ position: "absolute", inset: 0, background: color, borderRadius: 28 }}
              animate={{ borderRadius: BLOB_RADII.map((r) => wobble > 0 ? r : "28px") }}
              transition={{ ...spring, borderRadius: { duration: 9 - wobble * 4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } }}
            />
            {open && SAT.slice(0, blobs).map((b, i) => (
              <motion.div key={i}
                style={{ position: "absolute", left: W * b.fx, top: H * b.fy, width: base * b.s, height: base * b.s, marginLeft: -base * b.s / 2, marginTop: -base * b.s / 2, borderRadius: "50%", background: color }}
                animate={{ x: [0, b.dx * wobble, 0], y: [0, b.dy * wobble, 0], scale: [1, 1 + 0.18 * wobble, 0.92, 1] }}
                transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
              />
            ))}
          </div>
        </div>
        {/* crisp content layer */}
        <div style={{ position: "absolute", inset: 0, padding: 18, color: "#141417" }}>
          <motion.div key={key} {...restContent}>
            {open ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontWeight: 650, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#141417" }} /> Assistant
                </div>
                <div style={{ alignSelf: "flex-end", background: "#141417", color: "#fff", padding: "7px 11px", borderRadius: "12px 12px 4px 12px", fontSize: 12 }}>Move $500 to savings</div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>Done, scheduled for tomorrow. Want a reminder?</div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%", paddingLeft: 6, fontWeight: 650, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#141417" }} /> Ask fluidkit
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}

/* ------------------------- per-component demos with controls ------------------------- */
function MetaballsDemo() {
  const [color, setColor] = useState("#e7e8ec");
  const [count, setCount] = useState(4), [size, setSize] = useState(64), [spread, setSpread] = useState(90), [speed, setSpeed] = useState(1);
  return <Card title="Metaballs" desc="Same-color blobs that fuse like mercury (goo filter)."
    stage={<div style={{ color }}><Metaballs count={count} size={size} spread={spread} speed={speed} color={color} /></div>}
    controls={<><Color label="color" value={color} set={setColor} /><Slider label="count" value={count} set={setCount} min={1} max={6} /><Slider label="size" value={size} set={setSize} min={20} max={100} /><Slider label="spread" value={spread} set={setSpread} min={20} max={140} /><Slider label="speed" value={speed} set={setSpeed} min={0.2} max={3} step={0.1} /></>} />;
}
function ThinkingDemo() {
  const [color, setColor] = useState("#e7e8ec");
  const [size, setSize] = useState(20), [speed, setSpeed] = useState(1), [active, setActive] = useState(true);
  return <Card title="ThinkingBlob" desc="Organic working indicator. Blobs merge and split."
    stage={<div style={{ color, transform: "scale(2)" }}><ThinkingBlob size={size} speed={speed} active={active} color={color} /></div>}
    controls={<><Color label="color" value={color} set={setColor} /><Slider label="size" value={size} set={setSize} min={10} max={40} /><Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} /><Toggle label="active" value={active} set={setActive} /></>} />;
}
function FluidMorphDemo() {
  const [color, setColor] = useState("#c9a9ff");
  const [blobs, setBlobs] = useState(4), [wobble, setWobble] = useState(1), [stiffness, setStiffness] = useState(230), [damping, setDamping] = useState(15);
  return <Card title="Fluid morph (MorphSurface + goo)" desc="Flat, single-color liquid mass. Body + satellites fuse seamlessly. Surface morphs; text stays crisp." hint="click Toggle morph"
    stage={<FluidMorph color={color} blobs={blobs} wobble={wobble} stiffness={stiffness} damping={damping} />}
    controls={<><Color label="color" value={color} set={setColor} /><Slider label="blobs" value={blobs} set={setBlobs} min={0} max={6} /><Slider label="wobble" value={wobble} set={setWobble} min={0} max={1} step={0.05} /><Slider label="stiffness" value={stiffness} set={setStiffness} min={80} max={500} step={10} /><Slider label="damping" value={damping} set={setDamping} min={6} max={40} /></>} />;
}
function MorphDemo() {
  const [open, setOpen] = useState(false);
  return <Card title="MorphSurface (plain)" desc="The library primitive: surface morphs, text never scales." hint="click Toggle morph"
    stage={<>
      <button className="btn" style={{ position: "absolute", left: 12, bottom: 12, zIndex: 6 }} onClick={() => setOpen((v) => !v)}>Toggle morph</button>
      <MorphSurface open={open} surface={{ className: "demo-surface" }}>
        {open ? (
          <div className="panel-body"><div className="ph"><span className="dot" />Assistant</div><div className="row me">Move $500 to savings</div><div className="row">Done, scheduled for tomorrow.</div></div>
        ) : (<div className="pill-label"><span className="dot" />Ask fluidkit</div>)}
      </MorphSurface>
    </>}
    controls={<span className="field"><label>Reduced-motion collapses this to an instant fade.</label></span>} />;
}
function FlowDemo() {
  const [items, setItems] = useState(["Summarize spending", "Move $500 to savings", "Cancel duplicate sub"]);
  const [stagger, setStagger] = useState(0.06);
  return <Card title="FlowStagger" desc="Children rise + un-blur, staggered; siblings glide on change." hint="click Add / Remove"
    stage={<FlowStagger key={stagger} stagger={stagger} style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
      {items.map((t) => <div key={t} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 13px", fontSize: 13 }}>{t}</div>)}
    </FlowStagger>}
    controls={<><Slider label="stagger" value={stagger} set={setStagger} min={0} max={0.2} step={0.01} suffix="s" /><button className="btn" onClick={() => setItems((x) => [`New task ${x.length + 1}`, ...x])}>Add</button><button className="btn" onClick={() => setItems((x) => x.slice(1))}>Remove</button></>} />;
}
function TabsDemo() {
  const [value, setValue] = useState("chat");
  const [color, setColor] = useState("#e7e8ec");
  return <Card title="LiquidTabs" desc="Indicator glides + stretches like mercury; labels stay crisp." hint="click a tab"
    stage={<div style={{ color: "#e7e8ec" }}><LiquidTabs value={value} onChange={setValue} color={color} items={[{ id: "chat", label: "Chat" }, { id: "automations", label: "Automations" }, { id: "connections", label: "Connections" }]} style={{ display: "flex", gap: 4, padding: 5, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)" }} /></div>}
    controls={<Color label="indicator" value={color} set={setColor} />} />;
}
function RippleDemo() {
  const [color, setColor] = useState("#e7e8ec");
  const [duration, setDuration] = useState(650);
  return <Card title="Ripple" desc="Water ripple expands from the pointer on tap." hint="tap the surface"
    stage={<Ripple color={color} duration={duration} style={{ display: "grid", placeItems: "center", width: 200, height: 90, borderRadius: 16, cursor: "pointer", userSelect: "none", background: "#1b1c22", border: "1px solid rgba(255,255,255,.12)", color: "#e7e8ec", fontSize: 14, fontWeight: 600 }}>Tap me</Ripple>}
    controls={<><Color label="color" value={color} set={setColor} /><Slider label="duration" value={duration} set={setDuration} min={200} max={2000} step={50} suffix="ms" /></>} />;
}
function GlassDemo() {
  const [blur, setBlur] = useState(2), [radius, setRadius] = useState(24);
  const [refraction, setRefraction] = useState<"auto" | "on" | "off">("auto");
  return <Card title="LiquidGlass" desc="Frosted panel with real refraction (Chromium) via @samasante; degrades cleanly."
    stage={<div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "conic-gradient(from 20deg at 30% 30%, #ff9a5a, #ff5aa8, #6b5bff, #2ad6c0, #ff9a5a)" }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.55)", fontSize: 24, letterSpacing: 6, fontWeight: 600 }}>abcdefg 1234 ~~~~ ====</div>
      <LiquidGlass blur={blur} radius={radius} refraction={refraction === "auto" ? "auto" : refraction === "on"} style={{ position: "relative", zIndex: 2, width: 210, height: 104, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 14, textShadow: "0 1px 6px rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.35)", boxShadow: "inset 0 1px 1px rgba(255,255,255,.6), 0 18px 40px rgba(0,0,0,.3)" }}>Liquid Glass</LiquidGlass>
    </div>}
    controls={<><Slider label="blur" value={blur} set={setBlur} min={0} max={30} suffix="px" /><Slider label="radius" value={radius} set={setRadius} min={0} max={40} suffix="px" /><Seg label="refraction" value={refraction} set={setRefraction} options={["auto", "on", "off"]} /></>} />;
}

function App() {
  return (
    <>
      <h1>fluidkit</h1>
      <p className="sub">A React library of fluid / liquid UI animations, built on Motion. Every primitive live, with controls. Tune values, then we bake the ones you like into the library.</p>
      <div className="grid">
        <FluidMorphDemo />
        <MetaballsDemo />
        <ThinkingDemo />
        <MorphDemo />
        <FlowDemo />
        <TabsDemo />
        <RippleDemo />
        <GlassDemo />
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
