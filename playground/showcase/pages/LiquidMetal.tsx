import { useState } from "react";
import { LiquidMetal } from "fluidkit/liquid-metal";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  Seg,
  Snippet,
  VariantGrid,
  VariantCell,
  MountOnView,
} from "../kit";

type LiquidMetalPreset = "mercury" | "gold" | "obsidian";

const LIQUID_METAL_PRESET_KEYS: LiquidMetalPreset[] = ["mercury", "gold", "obsidian"];

/** color/backgroundColor pairs; "mercury" mirrors the shader's own default look. */
const LIQUID_METAL_PRESETS: Record<LiquidMetalPreset, { color: string; backgroundColor: string }> = {
  mercury: { color: "#ffffff", backgroundColor: "#aaaaac" },
  gold: { color: "#fff4d6", backgroundColor: "#8a6a2f" },
  obsidian: { color: "#c9d6e3", backgroundColor: "#1b1d24" },
};

export default function LiquidMetalPage() {
  const [preset, setPreset] = useState<LiquidMetalPreset>("mercury");
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(0.07);

  const { color, backgroundColor } = LIQUID_METAL_PRESETS[preset];

  const usage = `// optional peer: npm i @paper-design/shaders-react@0.0.76
import { LiquidMetal } from "fluidkit/liquid-metal";

<div style={{ position: "relative" }}>
  <LiquidMetal
    color="${color}"
    backgroundColor="${backgroundColor}"
    speed={${speed}}
    intensity={${intensity}}
  />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="LiquidMetal"
      description="Optional GPU tier: a WebGL liquid-metal shader from @paper-design/shaders-react (pinned exact), wrapped with fluidkit's capability + reduced-motion gating and off-screen pausing. Lives behind the fluidkit/liquid-metal subpath — install the optional peer to use it; the core bundle never pays for it."
      hero={
        <>
          <Stage hint="fluidkit/liquid-metal — optional peer: npm i @paper-design/shaders-react@0.0.76">
            <MountOnView>
              <LiquidMetal
                color={color}
                backgroundColor={backgroundColor}
                speed={speed}
                intensity={intensity}
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
            <Seg label="preset" value={preset} set={setPreset} options={LIQUID_METAL_PRESET_KEYS} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.1} max={3} step={0.1} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={0.3} step={0.01} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="mercury">
            <MountOnView>
              <LiquidMetal
                color={LIQUID_METAL_PRESETS.mercury.color}
                backgroundColor={LIQUID_METAL_PRESETS.mercury.backgroundColor}
              />
            </MountOnView>
          </VariantCell>
          <VariantCell label="gold">
            <MountOnView>
              <LiquidMetal
                color={LIQUID_METAL_PRESETS.gold.color}
                backgroundColor={LIQUID_METAL_PRESETS.gold.backgroundColor}
              />
            </MountOnView>
          </VariantCell>
          <VariantCell label="obsidian">
            <MountOnView>
              <LiquidMetal
                color={LIQUID_METAL_PRESETS.obsidian.color}
                backgroundColor={LIQUID_METAL_PRESETS.obsidian.backgroundColor}
              />
            </MountOnView>
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
