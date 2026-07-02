import { useState } from "react";
import { DripFuse } from "fluidkit";
import type { DripFuseProps } from "fluidkit";
import { PageLayout, Stage, Controls, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<DripFuseProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

/** Flat material needs an explicit fill — matches the old demo's neutral. */
const FLAT_COLOR = "#8d94a1";

/** One self-firing variant cell: a DripFuse with its own fire counter and button. */
function FuseVariant({ material }: { material: LiquidMaterial }) {
  const [fire, setFire] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <DripFuse
        fire={fire}
        material={material}
        color={material === "flat" ? FLAT_COLOR : undefined}
      />
      <button className="btn" onClick={() => setFire((f) => f + 1)}>Fire</button>
    </div>
  );
}

export default function DripFusePage() {
  const [fire, setFire] = useState(0);
  const [completions, setCompletions] = useState(0);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");

  const usage = `import { DripFuse } from "fluidkit";

const [fire, setFire] = useState(0);
const [completions, setCompletions] = useState(0);

<DripFuse fire={fire} material="${material}" onComplete={() => setCompletions((c) => c + 1)} />`;

  return (
    <PageLayout
      title="DripFuse"
      description="A drop swells off a source body, tears free, springs to a target, and fuses in: one trigger-and-complete cycle."
      hero={
        <>
          <Stage wall hint={`fired ${fire} · completed ${completions}`}>
            <DripFuse
              fire={fire}
              material={material}
              color={material === "flat" ? FLAT_COLOR : undefined}
              onComplete={() => setCompletions((c) => c + 1)}
            />
          </Stage>
          <Controls>
            <button className="btn" onClick={() => setFire((f) => f + 1)}>Fire</button>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass" wall>
            <FuseVariant material="glass" />
          </VariantCell>
          <VariantCell label="mercury" wall>
            <FuseVariant material="mercury" />
          </VariantCell>
          <VariantCell label="flat" wall>
            <FuseVariant material="flat" />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
