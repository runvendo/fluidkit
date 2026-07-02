import { useState } from "react";
import { WaterField } from "fluidkit/water-field";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  Toggle,
  Seg,
  Snippet,
  VariantGrid,
  VariantCell,
  MountOnView,
} from "../kit";

type WaterFieldPreset = "lagoon" | "sunset" | "ember";

const WATER_FIELD_PRESET_KEYS: WaterFieldPreset[] = ["lagoon", "sunset", "ember"];

/** two-color splat palettes; "lagoon" mirrors the wrapper's own default colors. */
const WATER_FIELD_PRESETS: Record<WaterFieldPreset, string[]> = {
  lagoon: ["#a8dadc", "#1d3557"],
  sunset: ["#ffb37a", "#6a0572"],
  ember: ["#ffcf7a", "#7a1f1f"],
};

export default function WaterFieldPage() {
  const [preset, setPreset] = useState<WaterFieldPreset>("lagoon");
  const [intensity, setIntensity] = useState(0.6);
  const [interactive, setInteractive] = useState(true);
  const colors = WATER_FIELD_PRESETS[preset];

  const usage = `// optional peer: npm i webgl-fluid-enhanced
import { WaterField } from "fluidkit/water-field";

<div style={{ position: "relative" }}>
  <WaterField
    colors={${JSON.stringify(colors)}}
    intensity={${intensity}}
    interactive={${interactive}}
  />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="WaterField"
      description="Optional GPU tier: a WebGL fluid simulation from webgl-fluid-enhanced, wrapped with the same capability + reduced-motion gating, off-screen pause/resume, and teardown-on-unmount. Lives behind the fluidkit/water-field subpath — install the optional peer to use it; the core bundle never pays for it."
      hero={
        <>
          <Stage hint="fluidkit/water-field — optional peer: npm i webgl-fluid-enhanced — move your pointer over the field">
            <MountOnView>
              <WaterField colors={colors} intensity={intensity} interactive={interactive} />
            </MountOnView>
          </Stage>
          <Controls>
            <Seg label="colors" value={preset} set={setPreset} options={WATER_FIELD_PRESET_KEYS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0.1} max={1} step={0.05} />
            <Toggle label="interactive" value={interactive} set={setInteractive} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          {WATER_FIELD_PRESET_KEYS.map((key) => (
            <VariantCell key={key} label={key} hint="move your pointer">
              <MountOnView>
                <WaterField colors={WATER_FIELD_PRESETS[key]} interactive />
              </MountOnView>
            </VariantCell>
          ))}
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
