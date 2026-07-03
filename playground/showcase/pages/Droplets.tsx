import { useState } from "react";
import { Droplets } from "fluidkit";
import type { DropletsProps } from "fluidkit";
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
} from "../kit";

type LiquidMaterial = NonNullable<DropletsProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/** Flat material needs an explicit fill — matches the old demo's neutral. */
const FLAT_COLOR = "#8d94a1";

export default function DropletsPage() {
  const [count, setCount] = useState(3);
  const [size, setSize] = useState(36);
  const [spread, setSpread] = useState(110);
  const [speed, setSpeed] = useState(1);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  const [interactive, setInteractive] = useState(true);
  const [refraction, setRefraction] = useState(false);

  const usage = `import { Droplets } from "fluidkit";

<Droplets${interactive ? " interactive" : " followPointer"} bleed={120} material="${material}"${refraction ? " refraction" : ""} />`;

  return (
    <PageLayout
      title="Droplets"
      description="Liquid drops with surface tension: touch-connect, stretch, snap. Grab one, drag it out until the neck tears, release to re-merge."
      hero={
        <>
          <Stage wall hint="drag a drop — tear it off">
            <Droplets
              // when drag is off, follow the pointer instead so the stage stays alive
              followPointer={!interactive}
              interactive={interactive}
              count={count}
              size={size}
              spread={spread}
              // room to drag drops around the stage, not just the cluster box
              bleed={120}
              speed={speed}
              material={material}
              reflection={reflection}
              refraction={refraction}
              color={material === "flat" ? FLAT_COLOR : undefined}
            />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Toggle label="interactive" value={interactive} set={setInteractive} />
            <Toggle label="reflection" value={reflection} set={setReflection} />
            <Toggle label="refraction" value={refraction} set={setRefraction} />
            <Slider label="count" value={count} set={setCount} min={1} max={5} />
            <Slider label="size" value={size} set={setSize} min={20} max={64} />
            <Slider label="spread" value={spread} set={setSpread} min={40} max={160} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.2} max={3} step={0.1} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass" wall>
            <Droplets interactive material="glass" />
          </VariantCell>
          <VariantCell label="mercury" wall>
            <Droplets interactive material="mercury" />
          </VariantCell>
          <VariantCell label="flat" wall>
            <Droplets interactive material="flat" color={FLAT_COLOR} />
          </VariantCell>
          <VariantCell label="glass + refraction" wall>
            <Droplets interactive material="glass" refraction />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
