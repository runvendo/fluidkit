import { useState } from "react";
import { Thinking } from "fluidkit";
import type { ThinkingProps, ThinkingVariant } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Toggle, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

// LiquidMaterial isn't exported from the package root; derive it consumer-style.
type LiquidMaterial = NonNullable<ThinkingProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const VARIANTS: ThinkingVariant[] = ["gather", "orbit", "wave"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#8d94a1";

export default function ThinkingPage() {
  const [variant, setVariant] = useState<ThinkingVariant>("gather");
  const [size, setSize] = useState(18);
  const [speed, setSpeed] = useState(1);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  const [refraction, setRefraction] = useState(false);
  const [intensity, setIntensity] = useState(0.7);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  // null = untouched: picker shows a neutral swatch, snippet/prop stay omitted.
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  const usage = `{isWorking && <Thinking variant="${variant}" label="Generating"${refraction ? " refraction" : ""}${intensity !== 0.7 ? ` intensity={${intensity}}` : ""}${material === "glass" && glassTint ? ` tint="${glassTint}"` : ""}${material === "flat" ? ` color="${color}"` : ""} />}`;

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
              refraction={refraction}
              intensity={intensity}
              opacity={opacityTouched ? opacity : undefined}
              tint={material === "glass" ? glassTint : undefined}
              color={material === "flat" ? color : undefined}
            />
          </Stage>
          <Controls>
            <Seg label="variant" value={variant} set={setVariant} options={VARIANTS} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Toggle label="reflection" value={reflection} set={setReflection} />
            <Toggle label="refraction" value={refraction} set={setRefraction} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Slider
              label="opacity"
              value={opacity}
              set={(n) => {
                setOpacity(n);
                setOpacityTouched(true);
              }}
              min={0}
              max={1}
              step={0.02}
            />
            {material === "glass" ? (
              <ColorField label="tint" value={tint} set={setTint} />
            ) : (
              <ColorField label="color" value={color} set={setColor} />
            )}
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
      usage={<Snippet code={usage} />}
    />
  );
}
