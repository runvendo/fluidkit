import { useState } from "react";
import { LiquidMetal } from "fluidkit/liquid-metal";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  ColorField,
  Snippet,
  VariantGrid,
  VariantCell,
  MountOnView,
} from "../kit";

export default function LiquidMetalPage() {
  const [speed, setSpeed] = useState(1);
  const [repetition, setRepetition] = useState(1.5);
  const [distortion, setDistortion] = useState(0.1);
  const [softness, setSoftness] = useState(0.05);
  const [colorBack, setColorBack] = useState("#aaaaac");
  const [colorTint, setColorTint] = useState("#ffffff");

  const usage = `// optional peer: npm i @paper-design/shaders-react@0.0.76
import { LiquidMetal } from "fluidkit/liquid-metal";

<div style={{ position: "relative" }}>
  <LiquidMetal
    colorBack="${colorBack}"
    colorTint="${colorTint}"
    speed={${speed}}
    repetition={${repetition}}
    distortion={${distortion}}
    softness={${softness}}
  />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="LiquidMetal"
      description="Optional GPU tier: a WebGL liquid-metal shader from @paper-design/shaders-react (pinned exact), wrapped with fluidkit's capability + reduced-motion gating and off-screen pausing. Fills its container with raw flowing metal by default; every shader param is a top-level prop. Lives behind the fluidkit/liquid-metal subpath — install the optional peer to use it; the core bundle never pays for it."
      hero={
        <>
          <Stage hint="fluidkit/liquid-metal — optional peer: npm i @paper-design/shaders-react@0.0.76">
            <MountOnView>
              <LiquidMetal
                colorBack={colorBack}
                colorTint={colorTint}
                speed={speed}
                repetition={repetition}
                distortion={distortion}
                softness={softness}
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
                  Now Playing
                </div>
                <div style={{ fontSize: 11.5, color: "#6b6c75" }}>
                  LiquidMetal is the layer behind this card
                </div>
              </div>
            </MountOnView>
          </Stage>
          <Controls>
            <ColorField label="colorBack" value={colorBack} set={setColorBack} />
            <ColorField label="colorTint" value={colorTint} set={setColorTint} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.1} max={3} step={0.1} />
            <Slider
              label="repetition"
              value={repetition}
              set={setRepetition}
              min={1}
              max={10}
              step={0.5}
            />
            <Slider
              label="distortion"
              value={distortion}
              set={setDistortion}
              min={0}
              max={1}
              step={0.05}
            />
            <Slider
              label="softness"
              value={softness}
              set={setSoftness}
              min={0}
              max={1}
              step={0.05}
            />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="backdrop (defaults)">
            <MountOnView>
              <LiquidMetal />
            </MountOnView>
          </VariantCell>
          <VariantCell label="dense stripes — repetition 4, softness 0.6">
            <MountOnView>
              <LiquidMetal repetition={4} softness={0.6} distortion={0.3} />
            </MountOnView>
          </VariantCell>
          <VariantCell label="masked shape — shape=metaballs, scale 0.7">
            <MountOnView>
              <LiquidMetal shape="metaballs" scale={0.7} />
            </MountOnView>
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
