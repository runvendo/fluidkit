import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Metaballs, ThinkingBlob, MorphSurface, FlowStagger, LiquidTabs, Ripple, LiquidGlass } from "../src/index";

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="stage">{children}</div>
      <div className="meta">
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function MorphDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="ctl"
        style={{ position: "absolute", left: 12, bottom: 12, zIndex: 5 }}
        onClick={() => setOpen((v) => !v)}
      >
        Toggle morph
      </button>
      <MorphSurface open={open} surface={{ className: "demo-surface" }}>
        {open ? (
          <div className="panel-body">
            <div className="ph">
              <span className="dot" />
              Northwind Assistant
            </div>
            <div className="row me">Move $500 to savings</div>
            <div className="row">Done — scheduled for tomorrow. Want a reminder?</div>
          </div>
        ) : (
          <div className="pill-label">
            <span className="dot" />
            Ask fluidkit
          </div>
        )}
      </MorphSurface>
    </>
  );
}

function FlowDemo() {
  const [items, setItems] = useState([
    "Summarize my spending",
    "Move $500 to savings",
    "Cancel the duplicate subscription",
  ]);
  const add = () =>
    setItems((xs) => [`New task ${xs.length + 1}`, ...xs]);
  return (
    <>
      <button
        className="ctl"
        style={{ position: "absolute", left: 12, bottom: 12, zIndex: 5 }}
        onClick={add}
      >
        Add item (glide)
      </button>
      <FlowStagger style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
        {items.map((t) => (
          <div
            key={t}
            style={{
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 12,
              padding: "10px 13px",
              fontSize: 13,
            }}
          >
            {t}
          </div>
        ))}
      </FlowStagger>
    </>
  );
}

function TabsDemo() {
  const [value, setValue] = useState("chat");
  return (
    <div style={{ color: "#e7e8ec" }}>
      <LiquidTabs
        value={value}
        onChange={setValue}
        color="#e7e8ec"
        items={[
          { id: "chat", label: "Chat" },
          { id: "automations", label: "Automations" },
          { id: "connections", label: "Connections" },
        ]}
        style={{
          display: "flex",
          gap: 4,
          padding: 5,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.04)",
        }}
      />
    </div>
  );
}

function GlassDemo() {
  return (
    <div
      style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        background: "conic-gradient(from 20deg at 30% 30%, #ff9a5a, #ff5aa8, #6b5bff, #2ad6c0, #ff9a5a)",
      }}
    >
      {/* content BEHIND the glass, so the refraction has something to bend */}
      <div
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          color: "rgba(255,255,255,.55)", fontSize: 26, letterSpacing: 6, fontWeight: 600,
        }}
      >
        abcdefg 1234 ~~~~ ==== ····
      </div>
      <LiquidGlass
        blur={2}
        radius={24}
        style={{
          position: "relative", zIndex: 2, width: 210, height: 104,
          display: "grid", placeItems: "center", color: "#fff", fontWeight: 700,
          fontSize: 14, textShadow: "0 1px 6px rgba(0,0,0,.4)",
          border: "1px solid rgba(255,255,255,.35)",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,.6), 0 18px 40px rgba(0,0,0,.3)",
        }}
      >
        Liquid Glass
      </LiquidGlass>
    </div>
  );
}

function App() {
  return (
    <>
      <h1>fluidkit playground</h1>
      <p className="sub">Live primitives rendered from source, on the prototype backdrop.</p>
      <div className="grid">
        <Card title="Metaballs" desc="Same-color blobs that fuse like mercury (goo filter).">
          <div style={{ color: "#e7e8ec" }}>
            <Metaballs count={4} size={64} spread={90} />
          </div>
        </Card>
        <Card title="ThinkingBlob" desc="Organic working indicator — blobs merge/split.">
          <div style={{ color: "#e7e8ec", transform: "scale(2)" }}>
            <ThinkingBlob />
          </div>
        </Card>
        <Card title="MorphSurface" desc="Launcher → panel. Surface morphs; text stays crisp.">
          <MorphDemo />
        </Card>
        <Card title="FlowStagger" desc="Children rise + un-blur + settle, staggered; siblings glide.">
          <FlowDemo />
        </Card>
        <Card title="LiquidTabs" desc="Active indicator glides + stretches like mercury; text stays crisp.">
          <TabsDemo />
        </Card>
        <Card title="Ripple" desc="Water ripple expands from the pointer on tap.">
          <Ripple
            color="#e7e8ec"
            duration={650}
            style={{
              display: "grid", placeItems: "center", width: 200, height: 90,
              borderRadius: 16, cursor: "pointer", userSelect: "none",
              background: "#1b1c22", border: "1px solid rgba(255,255,255,.12)",
              color: "#e7e8ec", fontSize: 14, fontWeight: 600,
            }}
          >
            Tap me
          </Ripple>
        </Card>
        <Card title="LiquidGlass" desc="Frosted panel with real refraction (Chromium) via @samasante; degrades cleanly.">
          <GlassDemo />
        </Card>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
