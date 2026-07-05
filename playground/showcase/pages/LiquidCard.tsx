import { useState } from "react";
import { LiquidCard } from "fluidkit";
import type { LiquidCardProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

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

function CardVariant({ material, intensity, opacity, variant, radius, tint, color }: {
  material: LiquidMaterial;
  intensity: Intensity;
  opacity?: number;
  variant: Variant;
  radius: number;
  /** Only meaningful on `variant="default"` — a named variant supplies its own accent otherwise. */
  tint?: string;
  color?: string;
}) {
  return (
    <LiquidCard
      material={material}
      intensity={intensity}
      opacity={opacity}
      variant={variant}
      radius={radius}
      tint={variant === "default" ? tint : undefined}
      color={variant === "default" && material !== "glass" ? (color ?? FLAT_COLOR) : undefined}
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
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [variant, setVariant] = useState<Variant>("default");
  const [radius, setRadius] = useState(20);
  // null = untouched: picker shows a neutral swatch, snippet/prop stay omitted.
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  return (
    <PageLayout
      title="LiquidCard"
      description="The base content surface: a card whose liquid backdrop measures and follows its content. Text lives outside the engine subtree, so it can never scale."
      hero={
        <>
          <Stage wall>
            <CardVariant material={material} intensity={intensity} opacity={opacityTouched ? opacity : undefined} variant={variant} radius={radius} tint={glassTint} color={color} />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
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
            <Seg label="variant" value={variant} set={setVariant} options={VARIANTS} />
            <Slider label="radius" value={radius} set={setRadius} min={0} max={32} step={1} suffix="px" />
            {variant === "default" && (material === "glass" ? (
              <ColorField label="tint" value={tint} set={setTint} />
            ) : (
              <ColorField label="color" value={color} set={setColor} />
            ))}
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
        <Snippet code={`<LiquidCard material="${material}" intensity={${intensity}}${variant !== "default" ? ` variant="${variant}"` : ""}${radius !== 20 ? ` radius={${radius}}` : ""}${variant === "default" && material === "glass" && glassTint ? ` tint="${glassTint}"` : ""}${variant === "default" && material === "flat" ? ` color="${color}"` : ""}>
  <h3>Surface tension</h3>
  <p>Cards size to their content.</p>
</LiquidCard>`} />
      }
    />
  );
}
