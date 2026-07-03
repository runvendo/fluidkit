import { useState } from "react";
import { GlassPanes, MeshGradient } from "fluidkit";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  Snippet,
  VariantGrid,
  VariantCell,
} from "../kit";

/** Same .field/label look as the kit's Slider/Seg, with a native color input — the kit has no color control. */
function ColorField({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <div className="field">
      <label>
        {label} <span className="val">{value}</span>
      </label>
      <input
        type="color"
        value={value}
        onChange={(e) => set(e.target.value)}
        style={{ width: 44, height: 24, padding: 0, border: "none", background: "none", cursor: "pointer" }}
      />
    </div>
  );
}

export default function GlassPanesPage() {
  const [colors, setColors] = useState<string[]>(["#aac2ff", "#cfaaf0"]);
  const [count, setCount] = useState(3);
  const [intensity, setIntensity] = useState(0.35);
  const [speed, setSpeed] = useState(1);

  const setColorAt = (index: number) => (value: string) =>
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));

  const usage = `import { GlassPanes } from "fluidkit";

<div style={{ position: "relative" }}>
  {/* panes frost whatever renders behind them, each at its own depth */}
  <GlassPanes
    colors={${JSON.stringify(colors)}}
    count={${count}}
    intensity={${intensity}}
    speed={${speed}}
  />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="GlassPanes"
      description="Glass-native ambient backdrop: frosted panes on a shared slight diagonal, sliding past each other in slow motion. The panes tile the full surface — every point sits behind at least one pane — and each pane backdrop-blurs at a different strength, so the seams read as physical depth. The demo layers them over a MeshGradient so there's something to frost. Zero per-frame JS once mounted; degrades to layered frosted fills without backdrop-filter."
      hero={
        <>
          <Stage hint="glass over color — panes frost the mesh at different depths">
            {/* Something worth frosting: panes over a colorful mesh. */}
            <MeshGradient />
            <GlassPanes colors={colors} count={count} intensity={intensity} speed={speed} />
            <div
              style={{
                position: "relative",
                background: "rgba(255,255,255,.72)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                borderRadius: 16,
                padding: "16px 20px",
                textAlign: "center",
                boxShadow: "0 10px 28px rgba(46,44,72,.12)",
              }}
            >
              <div style={{ fontWeight: 650, fontSize: 13, color: "#23242c", marginBottom: 3 }}>
                Gallery
              </div>
              <div style={{ fontSize: 11.5, color: "#6b6c75" }}>
                GlassPanes is the layer behind this card
              </div>
            </div>
          </Stage>
          <Controls>
            <ColorField label="tint 1" value={colors[0]} set={setColorAt(0)} />
            <ColorField label="tint 2" value={colors[1]} set={setColorAt(1)} />
            <Slider label="count" value={count} set={setCount} min={1} max={8} step={1} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="over mesh — defaults">
            <MeshGradient />
            <GlassPanes />
          </VariantCell>
          <VariantCell label="dense — 6 panes">
            <MeshGradient colors={["#ffd98a", "#ffb37a", "#ff9eb0"]} />
            <GlassPanes count={6} />
          </VariantCell>
          <VariantCell label="tinted — sky/lilac panes">
            <MeshGradient colors={["#93e6c8", "#8ad4ea", "#b3c0f5"]} />
            <GlassPanes colors={["#aac2ff", "#cfaaf0"]} count={4} intensity={0.6} />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
