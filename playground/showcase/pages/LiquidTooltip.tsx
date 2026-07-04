import { useState } from "react";
import { LiquidTooltip } from "fluidkit";
import type { LiquidTooltipProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Toggle, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

type LiquidMaterial = NonNullable<LiquidTooltipProps["material"]>;
type Placement = NonNullable<LiquidTooltipProps["placement"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const PLACEMENTS: Placement[] = ["top", "bottom", "left", "right"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#e8eaef";

const triggerStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 18px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(35,36,44,0.12)",
  fontSize: 13,
  fontWeight: 650,
  color: "#23242c",
  cursor: "default",
};

function TooltipVariant({ placement, material, intensity, speed, refraction, label, tint, color }: {
  placement: Placement;
  material: LiquidMaterial;
  intensity: number;
  speed?: number;
  refraction?: boolean;
  label?: string;
  tint?: string;
  color?: string;
}) {
  return (
    <LiquidTooltip
      content="Condensed beside the trigger"
      placement={placement}
      material={material}
      intensity={intensity}
      speed={speed}
      refraction={refraction}
      tint={material === "glass" ? tint : undefined}
      color={material !== "glass" ? (color ?? FLAT_COLOR) : undefined}
    >
      <span tabIndex={0} style={triggerStyle}>{label ?? "Hover me"}</span>
    </LiquidTooltip>
  );
}

export default function LiquidTooltipPage() {
  const [placement, setPlacement] = useState<Placement>("top");
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.35);
  const [speed, setSpeed] = useState(1);
  const [refraction, setRefraction] = useState(false);
  // null = untouched: picker shows a neutral swatch, snippet/prop stay omitted.
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  return (
    <PageLayout
      title="LiquidTooltip"
      description="A tooltip as a droplet: the label pill condenses beside the trigger on a spring, with a tail bead fused to it through real surface tension, reaching back toward the anchor."
      hero={
        <>
          <Stage wall hint="hover or focus the trigger">
            <TooltipVariant placement={placement} material={material} intensity={intensity} speed={speed} refraction={refraction} tint={glassTint} color={color} />
          </Stage>
          <Controls>
            <Seg label="placement" value={placement} set={setPlacement} options={PLACEMENTS} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.25} max={2.5} step={0.25} suffix="×" />
            <Toggle label="refraction" value={refraction} set={setRefraction} />
            {material === "glass" ? (
              <ColorField label="tint" value={tint} set={setTint} />
            ) : (
              <ColorField label="color" value={color} set={setColor} />
            )}
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="placement · bottom" wall>
            <TooltipVariant placement="bottom" material="glass" intensity={0.35} />
          </VariantCell>
          <VariantCell label="placement · right" wall>
            <TooltipVariant placement="right" material="glass" intensity={0.35} />
          </VariantCell>
          <VariantCell label="flat" wall>
            <TooltipVariant placement="top" material="flat" intensity={0.35} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<LiquidTooltip content="Saved to drafts" placement="${placement}" material="${material}" intensity={${intensity}}${speed !== 1 ? ` speed={${speed}}` : ""}${material === "glass" && glassTint ? ` tint="${glassTint}"` : ""}${material === "flat" ? ` color="${color}"` : ""}${refraction ? "\n  refraction" : ""}>
  <button>Save</button>
</LiquidTooltip>`} />
      }
    />
  );
}
