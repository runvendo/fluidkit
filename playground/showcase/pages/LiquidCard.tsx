import { useState } from "react";
import { LiquidCard } from "fluidkit";
import type { LiquidCardProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<LiquidCardProps["material"]>;
type Intensity = NonNullable<LiquidCardProps["intensity"]>;
type Variant = NonNullable<LiquidCardProps["variant"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const VARIANTS: Variant[] = ["default", "info", "success", "warning"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#e8eaef";

const bodyText: React.CSSProperties = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "#4b5160" };
const titleText: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 650, color: "#23242c" };

function CardContent({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ maxWidth: 280 }}>
      <p style={titleText}>{title}</p>
      <p style={bodyText}>{body}</p>
    </div>
  );
}

function CardVariant({ material, intensity, variant, radius }: {
  material: LiquidMaterial;
  intensity: Intensity;
  variant: Variant;
  radius: number;
}) {
  return (
    <LiquidCard
      material={material}
      intensity={intensity}
      variant={variant}
      radius={radius}
      color={material !== "glass" && variant === "default" ? FLAT_COLOR : undefined}
    >
      <CardContent
        title="Surface tension"
        body="Content sits in normal flow above the liquid backdrop — the surface follows the text, never the other way around."
      />
    </LiquidCard>
  );
}

export default function LiquidCardPage() {
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.35);
  const [variant, setVariant] = useState<Variant>("default");
  const [radius, setRadius] = useState(20);

  return (
    <PageLayout
      title="LiquidCard"
      description="The base content surface: a card whose liquid backdrop measures and follows its content. Text lives outside the engine subtree, so it can never scale."
      hero={
        <>
          <Stage wall>
            <CardVariant material={material} intensity={intensity} variant={variant} radius={radius} />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Seg label="variant" value={variant} set={setVariant} options={VARIANTS} />
            <Slider label="radius" value={radius} set={setRadius} min={0} max={32} step={1} suffix="px" />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass · whisper" wall>
            <CardVariant material="glass" intensity="whisper" variant="default" radius={20} />
          </VariantCell>
          <VariantCell label="glass · present" wall>
            <CardVariant material="glass" intensity="present" variant="default" radius={20} />
          </VariantCell>
          <VariantCell label="info callout" wall>
            <CardVariant material="glass" intensity="whisper" variant="info" radius={20} />
          </VariantCell>
          <VariantCell label="success callout" wall>
            <CardVariant material="glass" intensity="whisper" variant="success" radius={20} />
          </VariantCell>
          <VariantCell label="warning callout" wall>
            <CardVariant material="glass" intensity="whisper" variant="warning" radius={20} />
          </VariantCell>
          <VariantCell label="flat · neutral" wall>
            <CardVariant material="flat" intensity="whisper" variant="default" radius={20} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<LiquidCard material="${material}" intensity={${intensity}}${variant !== "default" ? ` variant="${variant}"` : ""}${radius !== 20 ? ` radius={${radius}}` : ""}>
  <h3>Surface tension</h3>
  <p>Cards size to their content.</p>
</LiquidCard>`} />
      }
    />
  );
}
