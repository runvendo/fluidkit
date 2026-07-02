import { useState } from "react";
import { Thinking } from "fluidkit";
import type { ThinkingProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

// LiquidMaterial isn't exported from the package root; derive it consumer-style.
type LiquidMaterial = NonNullable<ThinkingProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#8d94a1";

export default function ThinkingPage() {
  const [size, setSize] = useState(18);
  const [speed, setSpeed] = useState(1.2);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  return (
    <PageLayout
      title="Thinking"
      description="Working indicator: three droplets merge and split with fast-settle tension. role=status for assistive tech."
      hero={
        <>
          <Stage wall>
            <Thinking
              size={size}
              speed={speed}
              material={material}
              color={material === "flat" ? FLAT_COLOR : undefined}
            />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="size" value={size} set={setSize} min={10} max={32} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass" wall>
            <Thinking material="glass" />
          </VariantCell>
          <VariantCell label="mercury" wall>
            <Thinking material="mercury" />
          </VariantCell>
          <VariantCell label="flat" wall>
            <Thinking material="flat" color={FLAT_COLOR} />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={`{isWorking && <Thinking label="Generating" material="${material}" />}`} />}
    />
  );
}
