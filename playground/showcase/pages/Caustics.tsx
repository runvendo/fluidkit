import { useState } from "react";
import { Caustics, JellyButton, LiquidCard } from "fluidkit";
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

export default function CausticsPage() {
  const [color, setColor] = useState("#fffdf7");
  const [top, setTop] = useState("#f8f8f5");
  const [bottom, setBottom] = useState("#eceeef");
  const [intensity, setIntensity] = useState(0.5);
  const [scale, setScale] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [band, setBand] = useState(0.55);

  const usage = `import { Caustics } from "fluidkit";

<div style={{ position: "relative" }}>
  <Caustics
    color="${color}"
    background={["${top}", "${bottom}"]}
    intensity={${intensity}}
    scale={${scale}}
    speed={${speed}}
    band={${band}}
  />
  <YourContent />
</div>

// or as a surface material:
<LiquidCard material="caustics" />`;

  return (
    <PageLayout
      title="Caustics"
      description="Poolside light — the webbed patterns sun makes through water, drifting across a plaster wall. Self-contained WebGL (no GPU deps); degrades to the plain wall without WebGL and renders a still frame under reduced motion. Also a surface material: material=&quot;caustics&quot; on any liquid surface, tint recolors the light, color the wall."
      hero={
        <>
          <Stage hint="ambient — slow warm light behind this card">
            <Caustics
              color={color}
              background={[top, bottom]}
              intensity={intensity}
              scale={scale}
              speed={speed}
              band={band}
            />
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
                Poolside
              </div>
              <div style={{ fontSize: 11.5, color: "#6b6c75" }}>
                Caustics is the layer behind this card
              </div>
            </div>
          </Stage>
          <Controls>
            <ColorField label="light" value={color} set={setColor} />
            <ColorField label="wall top" value={top} set={setTop} />
            <ColorField label="wall bottom" value={bottom} set={setBottom} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Slider label="scale" value={scale} set={setScale} min={0.4} max={3} step={0.1} />
            <Slider label="speed" value={speed} set={setSpeed} min={0} max={3} step={0.1} />
            <Slider label="band" value={band} set={setBand} min={0} max={1} step={0.05} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label='LiquidCard material="caustics"'>
            <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 18 }}>
              <LiquidCard material="caustics" style={{ width: "100%" }}>
                <div style={{ padding: 18 }}>
                  <div style={{ fontWeight: 650, fontSize: 13 }}>Poolside card</div>
                  <div style={{ fontSize: 11.5, color: "#6b6c75" }}>The surface is the wall; the light is clipped to it.</div>
                </div>
              </LiquidCard>
            </div>
          </VariantCell>
          <VariantCell label='JellyButton material="caustics"'>
            <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
              <JellyButton material="caustics">Press me</JellyButton>
            </div>
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
