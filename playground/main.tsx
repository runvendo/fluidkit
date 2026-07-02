import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CSSProperties, ReactNode } from "react";
import {
  Droplets,
  FlowStagger,
  LiquidTabs,
  MorphSurface,
  Ripple,
  Thinking,
} from "../src/index";
import type { LiquidMaterial } from "../src/liquid";
import { PhoneFrame } from "./demos/PhoneFrame";
import { DynamicIsland } from "./demos/DynamicIsland";
import { MusicPlayer } from "./demos/MusicPlayer";
import { LiquidDock } from "./demos/LiquidDock";
import { GooButton } from "./demos/GooButton";
import dynamicIslandSrc from "./demos/DynamicIsland.tsx?raw";
import musicPlayerSrc from "./demos/MusicPlayer.tsx?raw";
import liquidDockSrc from "./demos/LiquidDock.tsx?raw";
import gooButtonSrc from "./demos/GooButton.tsx?raw";

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

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="snippet">
      <pre><code>{code}</code></pre>
      <button
        className="copy"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

function Card({ id, title, desc, hint, wall, stage, controls, code, onStageClick }: {
  id: string; title: string; desc: string; hint?: string; wall?: boolean; stage: ReactNode; controls?: ReactNode; code?: string; onStageClick?: () => void;
}) {
  return (
    <section className="card" id={id}>
      <div className={wall ? "stage wall" : "stage"} onClick={onStageClick} style={onStageClick ? { cursor: "pointer" } : undefined}>
        {hint ? <div className="hint">{hint}</div> : null}
        {wall ? <><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></> : null}
        {stage}
      </div>
      {controls ? <div className="controls">{controls}</div> : null}
      <div className="meta">
        <h2>{title}</h2>
        <p>{desc}</p>
        {code ? <Snippet code={code} /> : null}
      </div>
    </section>
  );
}

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/* ------------------------- hero ------------------------- */
function Hero() {
  const [open, setOpen] = useState(false);
  return (
    <header className="hero">
      <div className="hero-copy">
        <h1>fluidkit</h1>
        <p className="sub">
          Liquid UI animations for React. One metaball engine — real bridge geometry,
          springs, surface tension with touch-connect / snap-on-stretch — rendered in
          swappable materials: glass, mercury, flat. Built on Motion. Text never scales.
        </p>
        <Snippet code="npm install fluidkit react react-dom motion" />
        <nav className="toc">
          {[
            ["examples", "Examples"],
            ["droplets", "Droplets"],
            ["morph-surface", "MorphSurface"],
            ["thinking", "Thinking"],
            ["liquid-tabs", "LiquidTabs"],
            ["flow-stagger", "FlowStagger"],
            ["ripple", "Ripple"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
      </div>
      <div className="hero-stage wall" onClick={() => setOpen((v) => !v)}>
        <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
        <div className="hint">click the pill — drag the drops</div>
        <MorphSurface
          open={open}
          closedContent={<div className="pill-label"><span className="dot" />Ask fluidkit</div>}
          openContent={
            <div className="panel-body">
              <div className="ph"><span className="dot" />Assistant</div>
              <div className="row me">Make my UI feel liquid</div>
              <div className="row">Done — one engine, three materials.</div>
            </div>
          }
        />
        <div className="hero-drops" onClick={(e) => e.stopPropagation()}>
          <Droplets interactive followPointer size={30} spread={90} />
        </div>
      </div>
    </header>
  );
}

/* ------------------------- examples (phone showcases) ------------------------- */
function DemoPhone({ title, desc, source, screenStyle, children }: {
  title: string; desc: string; source: string; screenStyle?: CSSProperties; children: ReactNode;
}) {
  return (
    <div className="demo-card">
      <PhoneFrame screenStyle={screenStyle}>{children}</PhoneFrame>
      <div className="demo-meta">
        <h3>{title}</h3>
        <p>{desc}</p>
        <details className="src">
          <summary>view source</summary>
          <Snippet code={source} />
        </details>
      </div>
    </div>
  );
}

/** Lock-screen chrome behind the Dynamic Island (site chrome, not part of the recipe). */
function LockScreen() {
  return (
    <div style={{ position: "absolute", inset: 0, color: "#23242c", textAlign: "center", pointerEvents: "none" }}>
      <div style={{ marginTop: 96, fontSize: 15, fontWeight: 600, opacity: 0.7 }}>Wednesday, July 2</div>
      <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>9:41</div>
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 88, background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 18, padding: "11px 14px", textAlign: "left", boxShadow: "0 6px 18px rgba(46,44,72,.12)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>Messages</div>
        <div style={{ fontSize: 11.5, color: "#4b4c55" }}>Sam: the island demo is unreal</div>
      </div>
    </div>
  );
}

const WALL_BG = "linear-gradient(160deg, #dbe4ff 0%, #f3e3ff 45%, #ffe9f2 100%)";

function Examples() {
  return (
    <section className="examples" id="examples">
      <h2>Built with fluidkit</h2>
      <p className="sub">
        Real app moments, live in the frame — each composed from the public API.
        Every “view source” is the exact code running on that phone.
      </p>
      <div className="phones">
        <DemoPhone title="Dynamic Island" desc="One MorphSurface: the pill liquid-morphs into a live-activity card; controls are JellyButtons. Tap it."
          source={dynamicIslandSrc} screenStyle={{ background: WALL_BG }}>
          <LockScreen />
          <DynamicIsland />
        </DemoPhone>
        <DemoPhone title="Liquid Music Player" desc="A now-playing pill morphs into the full player sheet in glass. Play/pause is a JellyButton."
          source={musicPlayerSrc} screenStyle={{ background: WALL_BG }}>
          <MusicPlayer />
        </DemoPhone>
        <DemoPhone title="Liquid Dock" desc="LiquidTabs as a tab bar: the active pill drains, flies a tension bridge, snaps in. Content re-enters with FlowStagger."
          source={liquidDockSrc}>
          <LiquidDock />
        </DemoPhone>
        <DemoPhone title="Goo Progress Button" desc="JellyButton squashes on press, Thinking droplets churn while it downloads, the card ripples on tap."
          source={gooButtonSrc} screenStyle={{ background: WALL_BG }}>
          <GooButton />
        </DemoPhone>
      </div>
    </section>
  );
}

/* ------------------------- demos ------------------------- */
function DropletsDemo() {
  const [count, setCount] = useState(3), [size, setSize] = useState(36), [spread, setSpread] = useState(110), [speed, setSpeed] = useState(1);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  const [interactive, setInteractive] = useState(true);
  const [refraction, setRefraction] = useState(false);
  return <Card id="droplets" title="Droplets" desc="Liquid drops with surface tension: touch-connect, stretch, snap. Grab one, drag it out until the neck tears, release to re-merge." hint="drag a drop — tear it off" wall
    stage={<Droplets followPointer={!interactive} interactive={interactive} count={count} size={size} spread={spread} speed={speed} material={material} reflection={reflection} refraction={refraction} color={material === "flat" ? "#8d94a1" : undefined} />}
    code={`<Droplets interactive material="${material}"${refraction ? " refraction" : ""} />`}
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Toggle label="interactive" value={interactive} set={setInteractive} /><Toggle label="reflection" value={reflection} set={setReflection} /><Toggle label="refraction" value={refraction} set={setRefraction} /><Slider label="count" value={count} set={setCount} min={1} max={5} /><Slider label="size" value={size} set={setSize} min={20} max={64} /><Slider label="spread" value={spread} set={setSpread} min={40} max={160} /><Slider label="speed" value={speed} set={setSpeed} min={0.2} max={3} step={0.1} /></>} />;
}

function MorphDemo() {
  const [open, setOpen] = useState(false);
  const [satellites, setSatellites] = useState(true);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  const [refraction, setRefraction] = useState(false);
  return <Card id="morph-surface" title="MorphSurface" desc="One liquid body: pill morphs into panel, satellite droplets absorbed through real bridges. Text only cross-fades — never scales." hint="click — droplets absorb into the panel" wall
    onStageClick={() => setOpen((v) => !v)}
    code={`<MorphSurface
  open={open}
  material="${material}"${refraction ? "\n  refraction" : ""}
  closedContent={<PillLabel />}
  openContent={<Panel />}
/>`}
    stage={
      <MorphSurface
        open={open}
        material={material}
        reflection={reflection}
        refraction={refraction}
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
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Toggle label="reflection" value={reflection} set={setReflection} /><Toggle label="refraction" value={refraction} set={setRefraction} /><Toggle label="satellites" value={satellites} set={setSatellites} /></>} />;
}

function ThinkingDemo() {
  const [size, setSize] = useState(18), [speed, setSpeed] = useState(1.2);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  return <Card id="thinking" title="Thinking" desc="Working indicator: three droplets merge and split with fast-settle tension. role=status for assistive tech." wall
    stage={<Thinking size={size} speed={speed} material={material} color={material === "flat" ? "#8d94a1" : undefined} />}
    code={`{isWorking && <Thinking label="Generating" material="${material}" />}`}
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Slider label="size" value={size} set={setSize} min={10} max={32} /><Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} /></>} />;
}

function TabsDemo() {
  const [value, setValue] = useState("chat");
  return <Card id="liquid-tabs" title="LiquidTabs" desc="The indicator is an engine body: mass drains from the old tab, flows across a tension bridge, snaps free, and settles taut. Labels stay crisp on their own layer." hint="click a tab — watch the mass flow" wall
    code={`<LiquidTabs
  items={[{ id: "chat", label: "Chat" }, { id: "files", label: "Files" }]}
  value={value}
  onChange={setValue}
/>`}
    stage={<LiquidTabs value={value} onChange={setValue} color="#23242c" items={[{ id: "chat", label: "Chat" }, { id: "automations", label: "Automations" }, { id: "connections", label: "Connections" }]} style={{ display: "flex", gap: 4, padding: 5, borderRadius: 999, background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px) saturate(1.6)", WebkitBackdropFilter: "blur(14px) saturate(1.6)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 10px 28px rgba(46,44,72,.16)" }} />} />;
}

function FlowDemo() {
  const [items, setItems] = useState(["Summarize spending", "Move $500 to savings", "Cancel duplicate sub"]);
  const [stagger, setStagger] = useState(0.06);
  return <Card id="flow-stagger" title="FlowStagger" desc="Children rise + un-blur, staggered; siblings glide on change." hint="click Add / Remove"
    code={`<FlowStagger stagger={${stagger}}>
  {items.map((item) => <Row key={item} />)}
</FlowStagger>`}
    stage={<FlowStagger key={stagger} stagger={stagger} style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
      {items.map((t) => <div key={t} style={{ background: "#fff", border: "1px solid #e2e3ea", borderRadius: 12, padding: "10px 13px", fontSize: 13, boxShadow: "0 1px 2px rgba(24,25,36,.06)" }}>{t}</div>)}
    </FlowStagger>}
    controls={<><Slider label="stagger" value={stagger} set={setStagger} min={0} max={0.2} step={0.01} suffix="s" /><button className="btn" onClick={() => setItems((x) => [`New task ${x.length + 1}`, ...x])}>Add</button><button className="btn" onClick={() => setItems((x) => x.slice(1))}>Remove</button></>} />;
}

function RippleDemo() {
  const [duration, setDuration] = useState(650);
  return <Card id="ripple" title="Ripple" desc="Water ripple expands from the pointer on tap, clipped to the surface." hint="tap the surface" wall
    code={`<Ripple material="glass" duration={${duration}}>Tap me</Ripple>`}
    stage={<Ripple material="glass" duration={duration} style={{ display: "grid", placeItems: "center", width: 210, height: 92, borderRadius: 20, cursor: "pointer", userSelect: "none", background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px) saturate(1.6)", WebkitBackdropFilter: "blur(14px) saturate(1.6)", color: "#23242c", fontSize: 14, fontWeight: 650, boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 10px 28px rgba(46,44,72,.16)" }}>Tap me</Ripple>}
    controls={<Slider label="duration" value={duration} set={setDuration} min={200} max={2000} step={50} suffix="ms" />} />;
}

function App() {
  return (
    <>
      <Hero />
      <Examples />
      <div className="grid">
        <DropletsDemo />
        <MorphDemo />
        <ThinkingDemo />
        <TabsDemo />
        <FlowDemo />
        <RippleDemo />
      </div>
      <footer className="footer">
        MIT · <a href="https://github.com/yousefh409/fluidkit">github.com/yousefh409/fluidkit</a>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
