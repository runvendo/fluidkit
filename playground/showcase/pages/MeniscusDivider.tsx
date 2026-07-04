import { useState } from "react";
import { MeniscusDivider } from "fluidkit";
import type { MeniscusDividerProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<MeniscusDividerProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#b8bdc9";

const paragraph: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: "#4b5160",
  maxWidth: 300,
};

/** The divider between two lines of copy, the way it actually gets used. */
function DividerInContext({ material, thickness, intensity }: {
  material: LiquidMaterial;
  thickness: number;
  intensity: number;
}) {
  return (
    <div style={{ display: "grid", gap: 14, width: 300 }}>
      <p style={paragraph}>A bead of liquid resting between sections.</p>
      <MeniscusDivider
        material={material}
        thickness={thickness}
        intensity={intensity}
        color={material !== "glass" ? FLAT_COLOR : undefined}
      />
      <p style={paragraph}>The glint sits on the stretch facing the light.</p>
    </div>
  );
}

export default function MeniscusDividerPage() {
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [thickness, setThickness] = useState(4);
  const [intensity, setIntensity] = useState(0.35);

  return (
    <PageLayout
      title="MeniscusDivider"
      description="A divider rule as a bead of liquid: a thin engine pill spanning its container, lifted by shadow, with one glint facing the scene light."
      hero={
        <>
          <Stage wall>
            <DividerInContext material={material} thickness={thickness} intensity={intensity} />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="thickness" value={thickness} set={setThickness} min={2} max={12} step={1} suffix="px" />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass · hairline" wall>
            <DividerInContext material="glass" thickness={2} intensity={0.35} />
          </VariantCell>
          <VariantCell label="glass · bead" wall>
            <DividerInContext material="glass" thickness={6} intensity={0.7} />
          </VariantCell>
          <VariantCell label="flat" wall>
            <DividerInContext material="flat" thickness={4} intensity={0.35} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<MeniscusDivider material="${material}"${thickness !== 4 ? ` thickness={${thickness}}` : ""} intensity={${intensity}} />`} />
      }
    />
  );
}
