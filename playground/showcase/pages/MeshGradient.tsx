import { useState } from "react";
import { MeshGradient } from "fluidkit";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  ColorField,
  Snippet,
  VariantGrid,
  VariantCell,
} from "../kit";

/** Tasteful, restrained light-mode presets — "pastel" (the component
 * default) seeds the pickers; the others feed the variants grid. */
const MESH_PALETTES: Record<"pastel" | "citrus" | "mint", string[]> = {
  pastel: ["#aac2ff", "#cfaaf0", "#f8b4cb"],
  citrus: ["#ffd98a", "#ffb37a", "#ff9eb0"],
  mint: ["#93e6c8", "#8ad4ea", "#b3c0f5"],
};

export default function MeshGradientPage() {
  const [colors, setColors] = useState<string[]>(MESH_PALETTES.pastel);
  const [speed, setSpeed] = useState(1);
  const [blur, setBlur] = useState(60);

  const setColorAt = (index: number) => (value: string) =>
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));

  const usage = `import { MeshGradient } from "fluidkit";

<div style={{ position: "relative" }}>
  <MeshGradient
    colors={${JSON.stringify(colors)}}
    speed={${speed}}
    blur={${blur}}
  />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="MeshGradient"
      description="Ambient CSS backdrop: a handful of large, softly blurred radial-gradient blobs drift on long-period keyframe loops behind your content — zero per-frame JS once mounted. Pauses off-screen and renders a static frame under reduced motion."
      hero={
        <>
          <Stage hint="ambient — sits behind the panel below">
            <MeshGradient colors={colors} speed={speed} blur={blur} />
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
                Dashboard
              </div>
              <div style={{ fontSize: 11.5, color: "#6b6c75" }}>
                MeshGradient is the layer behind this card
              </div>
            </div>
          </Stage>
          <Controls>
            <ColorField label="color 1" value={colors[0]} set={setColorAt(0)} />
            <ColorField label="color 2" value={colors[1]} set={setColorAt(1)} />
            <ColorField label="color 3" value={colors[2]} set={setColorAt(2)} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} />
            <Slider label="blur" value={blur} set={setBlur} min={20} max={100} step={5} suffix="px" />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="pastel">
            <MeshGradient colors={MESH_PALETTES.pastel} />
          </VariantCell>
          <VariantCell label="citrus">
            <MeshGradient colors={MESH_PALETTES.citrus} />
          </VariantCell>
          <VariantCell label="mint">
            <MeshGradient colors={MESH_PALETTES.mint} />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
