import { useState } from "react";
import { Thinking } from "fluidkit";
import type { ThinkingProps, ThinkingVariant } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Toggle, Snippet, VariantGrid, VariantCell } from "../kit";

// LiquidMaterial isn't exported from the package root; derive it consumer-style.
type LiquidMaterial = NonNullable<ThinkingProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];
const VARIANTS: ThinkingVariant[] = ["gather", "orbit", "wave"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#8d94a1";

export default function ThinkingPage() {
  const [variant, setVariant] = useState<ThinkingVariant>("gather");
  const [size, setSize] = useState(18);
  const [speed, setSpeed] = useState(1);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  return (
    <PageLayout
      title="Thinking"
      description="Working indicator in three liquid choreographies: gather, orbit, and wave. role=status for assistive tech."
      hero={
        <>
          <Stage wall>
            <Thinking
              variant={variant}
              size={size}
              speed={speed}
              material={material}
              reflection={reflection}
              color={material === "flat" ? FLAT_COLOR : undefined}
            />
          </Stage>
          <Controls>
            <Seg label="variant" value={variant} set={setVariant} options={VARIANTS} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Toggle label="reflection" value={reflection} set={setReflection} />
            <Slider label="size" value={size} set={setSize} min={10} max={32} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="gather" wall>
            <Thinking variant="gather" />
          </VariantCell>
          <VariantCell label="orbit" wall>
            <Thinking variant="orbit" />
          </VariantCell>
          <VariantCell label="wave" wall>
            <Thinking variant="wave" />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={`{isWorking && <Thinking variant="${variant}" label="Generating" />}`} />}
    />
  );
}
