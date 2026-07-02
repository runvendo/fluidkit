import { useState } from "react";
import { JellyButton } from "fluidkit";
import type { JellyButtonProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<JellyButtonProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#8d94a1";

/** One pill — hero and variant cells alike — with the flat-material color/text fallbacks. */
function JellyVariant({ material, intensity }: {
  material: LiquidMaterial;
  intensity: number;
}) {
  return (
    <JellyButton
      material={material}
      intensity={intensity}
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

  return (
    <PageLayout
      title="JellyButton"
      description="An engine pill that squashes on press via geometry, not a CSS transform, so the label never scales."
      hero={
        <>
          <Stage wall hint="press and hold">
            <JellyVariant material={material} intensity={intensity} />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0.02} max={0.3} step={0.01} />
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
          <VariantCell label="mercury · soft" wall>
            <JellyVariant material="mercury" intensity={0.06} />
          </VariantCell>
          <VariantCell label="mercury · strong" wall>
            <JellyVariant material="mercury" intensity={0.2} />
          </VariantCell>
          <VariantCell label="flat · soft" wall>
            <JellyVariant material="flat" intensity={0.06} />
          </VariantCell>
          <VariantCell label="flat · strong" wall>
            <JellyVariant material="flat" intensity={0.2} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<JellyButton material="${material}" intensity={${intensity}} onClick={save}>
  Save changes
</JellyButton>`} />
      }
    />
  );
}
