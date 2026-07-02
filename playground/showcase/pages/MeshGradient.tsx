import { useState } from "react";
import { MeshGradient } from "fluidkit";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  Seg,
  Snippet,
  VariantGrid,
  VariantCell,
} from "../kit";

type MeshPalette = "pastel" | "citrus" | "mint";

const MESH_PALETTE_KEYS: MeshPalette[] = ["pastel", "citrus", "mint"];

/** Tasteful, restrained light-mode presets — each a 3-hue set in the same spirit as MeshGradient's own default. */
const MESH_PALETTES: Record<MeshPalette, string[]> = {
  pastel: ["#dbe4ff", "#e7d6f7", "#fbdce6"],
  citrus: ["#ffe8b8", "#ffd0a8", "#ffb8c8"],
  mint: ["#c8f0e0", "#b8e8f0", "#d0d8f7"],
};

export default function MeshGradientPage() {
  const [palette, setPalette] = useState<MeshPalette>("pastel");
  const [speed, setSpeed] = useState(1);
  const [blur, setBlur] = useState(60);

  const usage = `import { MeshGradient } from "fluidkit";

<div style={{ position: "relative" }}>
  <MeshGradient
    colors={${JSON.stringify(MESH_PALETTES[palette])}}
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
            <MeshGradient colors={MESH_PALETTES[palette]} speed={speed} blur={blur} />
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
            <Seg label="colors" value={palette} set={setPalette} options={MESH_PALETTE_KEYS} />
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
