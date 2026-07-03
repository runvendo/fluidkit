import { useState } from "react";
import { JellyButton } from "fluidkit";
import type { JellyButtonProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<JellyButtonProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#8d94a1";


/** Named pressed-fill choices for the hero's `press color` control. `auto`
 * hands the choice back to the component's derived deepening. Translucent
 * values so they read on glass; solids darken them via the same fill. */
const PRESS_COLORS = {
  auto: undefined,
  ink: "rgba(30,32,40,0.30)",
  sky: "rgba(120,160,255,0.45)",
  rose: "rgba(255,120,150,0.40)",
} as const;
type PressColorKey = keyof typeof PRESS_COLORS;

/** One pill — hero and variant cells alike — with the flat-material color/text fallbacks. */
function JellyVariant({ material, intensity, pressColor }: {
  material: LiquidMaterial;
  intensity: number;
  pressColor?: string;
}) {
  return (
    <JellyButton
      material={material}
      intensity={intensity}
      pressColor={pressColor}
      color={material === "flat" ? FLAT_COLOR : undefined}
      style={{ color: material === "flat" ? "#fff" : "#23242c", fontSize: 14, fontWeight: 650 }}
    >
      Press me
    </JellyButton>
  );
}

export default function JellyButtonPage() {
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.12);
  const [pressColorKey, setPressColorKey] = useState<PressColorKey>("auto");
  const pressColor = PRESS_COLORS[pressColorKey];

  return (
    <PageLayout
      title="JellyButton"
      description="An engine pill that squashes on press via geometry, not a CSS transform, so the label never scales."
      hero={
        <>
          <Stage wall hint="press and hold">
            <JellyVariant material={material} intensity={intensity} pressColor={pressColor} />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0.02} max={0.3} step={0.01} />
            <Seg
              label="press color"
              value={pressColorKey}
              set={setPressColorKey}
              options={Object.keys(PRESS_COLORS) as PressColorKey[]}
            />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass · soft" wall>
            <JellyVariant material="glass" intensity={0.06} />
          </VariantCell>
          <VariantCell label="glass · strong" wall>
            <JellyVariant material="glass" intensity={0.2} />
          </VariantCell>
          <VariantCell label="glass · release wave" wall>
            <JellyButton
              releaseWave
              style={{ color: "#23242c", fontSize: 14, fontWeight: 650 }}
            >
              Press me
            </JellyButton>
          </VariantCell>
          <VariantCell label="mercury · soft" wall>
            <JellyVariant material="mercury" intensity={0.06} />
          </VariantCell>
          <VariantCell label="mercury · strong" wall>
            <JellyVariant material="mercury" intensity={0.2} />
          </VariantCell>
          <VariantCell label="flat · strong" wall>
            <JellyVariant material="flat" intensity={0.2} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<JellyButton material="${material}" intensity={${intensity}}${
          pressColor ? ` pressColor="${pressColor}"` : ""
        } onClick={save}>
  Save changes
</JellyButton>`} />
      }
    />
  );
}
