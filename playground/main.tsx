import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CSSProperties, ReactNode } from "react";
import {
  Aurora,
  DripFuse,
  Droplets,
  FlowStagger,
  JellyButton,
  LiquidDrag,
  LiquidTabs,
  Magnetic,
  MeshGradient,
  MorphSurface,
  Ripple,
  Thinking,
} from "../src/index";
import type { LiquidMaterial } from "../src/liquid";
// The optional GPU tier lives behind its own subpath exports, not the core
// entry above — imported here exactly as a consumer would write it
// (`fluidkit/liquid-metal` / `fluidkit/water-field`), resolved by the
// playground's own alias in vite.config.ts straight to source.
import { LiquidMetal } from "fluidkit/liquid-metal";
import { WaterField } from "fluidkit/water-field";
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
const AXES: ("free" | "x" | "y")[] = ["free", "x", "y"];
const AURORA_BLENDS: ("screen" | "normal" | "multiply")[] = ["screen", "normal", "multiply"];

type MeshPalette = "pastel" | "citrus" | "mint";
const MESH_PALETTE_KEYS: MeshPalette[] = ["pastel", "citrus", "mint"];
/** Tasteful, restrained light-mode presets — each a 3-hue set in the same spirit as MeshGradient's own default. */
const MESH_PALETTES: Record<MeshPalette, string[]> = {
  pastel: ["#dbe4ff", "#e7d6f7", "#fbdce6"],
  citrus: ["#ffe8b8", "#ffd0a8", "#ffb8c8"],
  mint: ["#c8f0e0", "#b8e8f0", "#d0d8f7"],
};

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
            ["jelly-button", "JellyButton"],
            ["magnetic", "Magnetic"],
            ["liquid-drag", "LiquidDrag"],
            ["drip-fuse", "DripFuse"],
            ["mesh-gradient", "MeshGradient"],
            ["aurora", "Aurora"],
            ["liquid-metal", "LiquidMetal"],
            ["water-field", "WaterField"],
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
  const [flow, setFlow] = useState<"slide" | "stretch">("slide");
  const [material, setMaterial] = useState<"ink" | "glass">("ink");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [disableOne, setDisableOne] = useState(false);
  const items = [
    { id: "chat", label: "Chat" },
    { id: "automations", label: "Automations", disabled: disableOne },
    { id: "connections", label: "Connections" },
  ];
  return <Card id="liquid-tabs" title="LiquidTabs" desc="The active indicator is a liquid engine body that flows between tabs; label color tracks how much ink covers each tab, and the labels stay crisp on their own layer." hint="click a tab — try each flow and material" wall
    code={`<LiquidTabs
  items={[{ id: "chat", label: "Chat" }, { id: "files", label: "Files" }]}
  defaultValue="chat"
  flow="${flow}"
  material="${material}"
  size="${size}"
/>`}
    stage={<LiquidTabs value={value} onChange={setValue} flow={flow} material={material} size={size} color="#23242c" items={items} />}
    controls={<>
      <Seg label="flow" value={flow} set={setFlow} options={["slide", "stretch"]} />
      <Seg label="material" value={material} set={setMaterial} options={["ink", "glass"]} />
      <Seg label="size" value={size} set={setSize} options={["sm", "md", "lg"]} />
      <Toggle label="disable Automations" value={disableOne} set={setDisableOne} />
    </>} />;
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

function JellyButtonDemo() {
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.12);
  return <Card id="jelly-button" title="JellyButton" desc="An engine pill that squashes on press via geometry, not a CSS transform, so the label never scales." hint="press and hold" wall
    code={`<JellyButton material="${material}" intensity={${intensity}}>Press me</JellyButton>`}
    stage={
      <JellyButton
        material={material}
        intensity={intensity}
        color={material === "flat" ? "#8d94a1" : undefined}
        style={{ color: material === "flat" ? "#fff" : "#23242c", fontSize: 14, fontWeight: 650 }}
      >
        Press me
      </JellyButton>
    }
    controls={<><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /><Slider label="intensity" value={intensity} set={setIntensity} min={0.02} max={0.3} step={0.01} /></>} />;
}

function MagneticDemo() {
  const [strength, setStrength] = useState(0.3);
  const [radius, setRadius] = useState(120);
  return <Card id="magnetic" title="Magnetic" desc="Pulls its child toward the pointer while it's within radius px of the element's center, and springs back to rest outside that radius." hint="move your pointer near the dot"
    code={`<Magnetic strength={${strength}} radius={${radius}}>
  <Dot />
</Magnetic>`}
    stage={
      <Magnetic strength={strength} radius={radius}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(160deg, #4a6cf7, #7c9bff)", boxShadow: "0 10px 28px rgba(74,108,247,.35)" }} />
      </Magnetic>
    }
    controls={<><Slider label="strength" value={strength} set={setStrength} min={0.05} max={1} step={0.05} /><Slider label="radius" value={radius} set={setRadius} min={40} max={240} step={10} suffix="px" /></>} />;
}

function LiquidDragDemo() {
  const [elasticity, setElasticity] = useState(0.4);
  const [axis, setAxis] = useState<"free" | "x" | "y">("free");
  const constraintsRef = useRef<HTMLDivElement>(null);
  return <Card id="liquid-drag" title="LiquidDrag" desc="Wraps Motion's own drag gesture; velocity feeds a volume-preserving stretch that wobbles back to rest on release." hint="drag the blob"
    code={`<LiquidDrag elasticity={${elasticity}}${axis !== "free" ? ` axis="${axis}"` : ""}>
  <Blob />
</LiquidDrag>`}
    stage={
      <div ref={constraintsRef} style={{ position: "absolute", inset: 24 }}>
        <LiquidDrag
          elasticity={elasticity}
          axis={axis === "free" ? undefined : axis}
          dragConstraints={constraintsRef}
          style={{ width: 72, height: 72, margin: "auto", position: "absolute", inset: 0, cursor: "grab" }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "linear-gradient(160deg, #63dcb9, #4fc9a3)", boxShadow: "0 10px 28px rgba(99,220,185,.4)" }} />
        </LiquidDrag>
      </div>
    }
    controls={<><Slider label="elasticity" value={elasticity} set={setElasticity} min={0} max={1} step={0.05} /><Seg label="axis" value={axis} set={setAxis} options={AXES} /></>} />;
}

function DripFuseDemo() {
  const [fire, setFire] = useState(0);
  const [completions, setCompletions] = useState(0);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  return <Card id="drip-fuse" title="DripFuse" desc="A drop swells off a source body, tears free, springs to a target, and fuses in: one trigger-and-complete cycle." hint={`fired ${fire} · completed ${completions}`} wall
    code={`const [fire, setFire] = useState(0);
const [completed, setCompleted] = useState(0);

<DripFuse fire={fire} material="${material}" onComplete={() => setCompleted((c) => c + 1)} />`}
    stage={
      <DripFuse
        fire={fire}
        material={material}
        color={material === "flat" ? "#8d94a1" : undefined}
        onComplete={() => setCompletions((c) => c + 1)}
      />
    }
    controls={<><button className="btn" onClick={() => setFire((f) => f + 1)}>Fire</button><Seg label="material" value={material} set={setMaterial} options={MATERIALS} /></>} />;
}

function MeshGradientDemo() {
  const [palette, setPalette] = useState<MeshPalette>("pastel");
  const [speed, setSpeed] = useState(1);
  const [blur, setBlur] = useState(60);
  return <Card id="mesh-gradient" title="MeshGradient" desc="Ambient CSS backdrop: a handful of large, softly blurred radial-gradient blobs drift on long-period keyframe loops behind your content — zero per-frame JS once mounted. Pauses off-screen and renders a static frame under reduced motion." hint="ambient — sits behind the panel below"
    code={`<MeshGradient
  colors={${JSON.stringify(MESH_PALETTES[palette])}}
  speed={${speed}}
  blur={${blur}}
/>`}
    stage={
      <>
        <MeshGradient colors={MESH_PALETTES[palette]} speed={speed} blur={blur} />
        <div style={{ position: "relative", background: "rgba(255,255,255,.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 16, padding: "16px 20px", textAlign: "center", boxShadow: "0 10px 28px rgba(46,44,72,.12)" }}>
          <div style={{ fontWeight: 650, fontSize: 13, color: "#23242c", marginBottom: 3 }}>Dashboard</div>
          <div style={{ fontSize: 11.5, color: "#6b6c75" }}>MeshGradient is the layer behind this card</div>
        </div>
      </>
    }
    controls={<><Seg label="colors" value={palette} set={setPalette} options={MESH_PALETTE_KEYS} /><Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} /><Slider label="blur" value={blur} set={setBlur} min={20} max={100} step={5} suffix="px" /></>} />;
}

function AuroraDemo() {
  const [intensity, setIntensity] = useState(0.6);
  const [speed, setSpeed] = useState(1);
  const [blend, setBlend] = useState<"screen" | "normal" | "multiply">("screen");
  return <Card id="aurora" title="Aurora" desc={`Ambient CSS backdrop: blurred horizontal bands drift across the upper portion of the container. "blend" controls how bands composite: screen glows on dark/mid surfaces but washes toward invisible on white, so use normal or multiply on light surfaces.`} hint="same props, dark vs. light — blend is honest about the difference"
    code={`<Aurora
  intensity={${intensity}}
  speed={${speed}}
  blend="${blend}"
/>`}
    stage={
      <>
        <div style={{ position: "absolute", inset: "0 50% 0 0", overflow: "hidden", background: "#15161c" }}>
          <Aurora intensity={intensity} speed={speed} blend={blend} />
          <span style={{ position: "absolute", left: 10, bottom: 8, fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>dark</span>
        </div>
        <div style={{ position: "absolute", inset: "0 0 0 50%", overflow: "hidden", background: "#fff", borderLeft: "1px solid #ecedf2" }}>
          <Aurora intensity={intensity} speed={speed} blend={blend} />
          <span style={{ position: "absolute", left: 10, bottom: 8, fontSize: 10.5, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "rgba(28,29,35,.4)" }}>light</span>
        </div>
      </>
    }
    controls={<><Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} /><Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} /><Seg label="blend" value={blend} set={setBlend} options={AURORA_BLENDS} /></>} />;
}

/* ------------------------- optional GPU tier ------------------------- */
/**
 * Site chrome: mounts children the FIRST time the stage scrolls into view,
 * and never unmounts them after. The GPU demos below boot a real WebGL
 * context on mount (and WaterField keeps issuing draw calls each frame even
 * while paused), so mounting them eagerly would bill every docs visitor for
 * two live GPU contexts at page load, for cards at the bottom of the page.
 */
function MountOnView({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  return <div ref={ref} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{seen ? children : null}</div>;
}

type LiquidMetalPreset = "mercury" | "gold" | "obsidian";
const LIQUID_METAL_PRESET_KEYS: LiquidMetalPreset[] = ["mercury", "gold", "obsidian"];
/** color/backgroundColor pairs; "mercury" mirrors the shader's own default look. */
const LIQUID_METAL_PRESETS: Record<LiquidMetalPreset, { color: string; backgroundColor: string }> = {
  mercury: { color: "#ffffff", backgroundColor: "#aaaaac" },
  gold: { color: "#fff4d6", backgroundColor: "#8a6a2f" },
  obsidian: { color: "#c9d6e3", backgroundColor: "#1b1d24" },
};

function LiquidMetalDemo() {
  const [preset, setPreset] = useState<LiquidMetalPreset>("mercury");
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(0.07);
  const { color, backgroundColor } = LIQUID_METAL_PRESETS[preset];
  return <Card id="liquid-metal" title="LiquidMetal" desc="Optional GPU tier: a WebGL liquid-metal shader from @paper-design/shaders-react (pinned exact), wrapped with fluidkit's capability + reduced-motion gating and off-screen pausing. Lives behind the fluidkit/liquid-metal subpath — install the optional peer to use it; the core bundle never pays for it." hint={`fluidkit/liquid-metal — optional peer: npm i @paper-design/shaders-react@0.0.76`}
    code={`import { LiquidMetal } from "fluidkit/liquid-metal";

<LiquidMetal
  color="${color}"
  backgroundColor="${backgroundColor}"
  speed={${speed}}
  intensity={${intensity}}
/>`}
    stage={
      <MountOnView>
        <LiquidMetal color={color} backgroundColor={backgroundColor} speed={speed} intensity={intensity} />
        <div style={{ position: "relative", background: "rgba(255,255,255,.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 16, padding: "16px 20px", textAlign: "center", boxShadow: "0 10px 28px rgba(46,44,72,.12)" }}>
          <div style={{ fontWeight: 650, fontSize: 13, color: "#23242c", marginBottom: 3 }}>Now Playing</div>
          <div style={{ fontSize: 11.5, color: "#6b6c75" }}>LiquidMetal is the layer behind this card</div>
        </div>
      </MountOnView>
    }
    controls={<><Seg label="preset" value={preset} set={setPreset} options={LIQUID_METAL_PRESET_KEYS} /><Slider label="speed" value={speed} set={setSpeed} min={0.1} max={3} step={0.1} /><Slider label="intensity" value={intensity} set={setIntensity} min={0} max={0.3} step={0.01} /></>} />;
}

type WaterFieldPreset = "lagoon" | "sunset" | "ember";
const WATER_FIELD_PRESET_KEYS: WaterFieldPreset[] = ["lagoon", "sunset", "ember"];
/** two-color splat palettes; "lagoon" mirrors the wrapper's own default colors. */
const WATER_FIELD_PRESETS: Record<WaterFieldPreset, string[]> = {
  lagoon: ["#a8dadc", "#1d3557"],
  sunset: ["#ffb37a", "#6a0572"],
  ember: ["#ffcf7a", "#7a1f1f"],
};

function WaterFieldDemo() {
  const [preset, setPreset] = useState<WaterFieldPreset>("lagoon");
  const [intensity, setIntensity] = useState(0.6);
  const [interactive, setInteractive] = useState(true);
  const colors = WATER_FIELD_PRESETS[preset];
  return <Card id="water-field" title="WaterField" desc="Optional GPU tier: a WebGL fluid simulation from webgl-fluid-enhanced, wrapped with the same capability + reduced-motion gating, off-screen pause/resume, and teardown-on-unmount. Lives behind the fluidkit/water-field subpath — install the optional peer to use it; the core bundle never pays for it." hint="fluidkit/water-field — optional peer: npm i webgl-fluid-enhanced — move your pointer over the field"
    code={`import { WaterField } from "fluidkit/water-field";

<WaterField
  colors={${JSON.stringify(colors)}}
  intensity={${intensity}}
  interactive={${interactive}}
/>`}
    stage={<MountOnView><WaterField colors={colors} intensity={intensity} interactive={interactive} /></MountOnView>}
    controls={<><Seg label="colors" value={preset} set={setPreset} options={WATER_FIELD_PRESET_KEYS} /><Slider label="intensity" value={intensity} set={setIntensity} min={0.1} max={1} step={0.05} /><Toggle label="interactive" value={interactive} set={setInteractive} /></>} />;
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
        <JellyButtonDemo />
        <MagneticDemo />
        <LiquidDragDemo />
        <DripFuseDemo />
        <MeshGradientDemo />
        <AuroraDemo />
        <LiquidMetalDemo />
        <WaterFieldDemo />
      </div>
      <footer className="footer">
        MIT · <a href="https://github.com/yousefh409/fluidkit">github.com/yousefh409/fluidkit</a>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
