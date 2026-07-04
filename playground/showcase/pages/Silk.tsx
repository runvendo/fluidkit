import { useState } from "react";
import { Silk } from "fluidkit";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  Seg,
  ColorField,
  Snippet,
  VariantGrid,
  VariantCell,
} from "../kit";

/** Soft fabric sets — "lilac" seeds the pickers; the others feed the variants grid. */
const SILK_PALETTES: Record<"lilac" | "champagne" | "glacier", string[]> = {
  lilac: ["#cfc0f2", "#f2c0d8", "#b8d4f2"],
  champagne: ["#f2ddb8", "#f2c8ad", "#e6b8c2"],
  glacier: ["#b8e2f2", "#c2d4f7", "#d6e8f2"],
};

type SilkMaterial = "flat" | "glass";

const SILK_MATERIALS: SilkMaterial[] = ["flat", "glass"];

export default function SilkPage() {
  const [colors, setColors] = useState<string[]>(SILK_PALETTES.lilac);
  const [material, setMaterial] = useState<SilkMaterial>("flat");
  const [count, setCount] = useState(3);
  const [intensity, setIntensity] = useState(0.55);
  const [speed, setSpeed] = useState(1);

  const setColorAt = (index: number) => (value: string) =>
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));

  const usage = `import { Silk } from "fluidkit";

<div style={{ position: "relative" }}>
  <Silk
    colors={${JSON.stringify(colors)}}
    count={${count}}
    material="${material}"
    intensity={${intensity}}
    speed={${speed}}
  />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="Silk"
      description="Ambient CSS backdrop: smooth flowing silk — full-height diagonal gradient sheets drift and breathe like slow-motion fabric, all on a single shared flow direction. count controls density (sheets cycle colors); material=glass renders frosted, backdrop-blurring sheets. Zero per-frame JS once mounted; pauses off-screen and renders a static frame under reduced motion."
      hero={
        <>
          <Stage hint="ambient — sits behind the panel below">
            <Silk
              colors={colors}
              count={count}
              material={material}
              intensity={intensity}
              speed={speed}
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
                Atelier
              </div>
              <div style={{ fontSize: 11.5, color: "#6b6c75" }}>
                Silk is the layer behind this card
              </div>
            </div>
          </Stage>
          <Controls>
            <ColorField label="color 1" value={colors[0]} set={setColorAt(0)} />
            <ColorField label="color 2" value={colors[1]} set={setColorAt(1)} />
            <ColorField label="color 3" value={colors[2]} set={setColorAt(2)} />
            <Seg label="material" value={material} set={setMaterial} options={SILK_MATERIALS} />
            <Slider label="count" value={count} set={setCount} min={1} max={12} step={1} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0.2} max={1} step={0.05} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="lilac">
            <Silk colors={SILK_PALETTES.lilac} />
          </VariantCell>
          <VariantCell label="dense — count 8">
            <Silk colors={SILK_PALETTES.champagne} count={8} />
          </VariantCell>
          <VariantCell label="glass — frosted sheets over color">
            <div style={{ position: "absolute", inset: 0, background: "#e8ddf2" }}>
              <Silk material="glass" count={5} />
            </div>
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
