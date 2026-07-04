import { useState } from "react";
import { LiquidPanel } from "fluidkit";
import type { LiquidPanelProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Toggle, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

type LiquidMaterial = NonNullable<LiquidPanelProps["material"]>;
type Side = NonNullable<LiquidPanelProps["side"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const SIDES: Side[] = ["top", "bottom", "left", "right"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#e8eaef";

const itemStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: "#4b5160",
};

function PanelContent() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ ...itemStyle, fontWeight: 650, color: "#23242c" }}>Pour-in panel</p>
      <p style={itemStyle}>The surface pours from one edge on a spring.</p>
      <p style={itemStyle}>Content rises in once the liquid arrives.</p>
    </div>
  );
}

function PanelVariant({ open, side, material, intensity, tint, color }: {
  open: boolean;
  side: Side;
  material: LiquidMaterial;
  intensity: number;
  tint?: string;
  color?: string;
}) {
  return (
    <LiquidPanel
      open={open}
      side={side}
      material={material}
      intensity={intensity}
      tint={material === "glass" ? tint : undefined}
      color={material !== "glass" ? (color ?? FLAT_COLOR) : undefined}
      style={{ width: 260, height: 170 }}
    >
      <PanelContent />
    </LiquidPanel>
  );
}

export default function LiquidPanelPage() {
  const [open, setOpen] = useState(true);
  const [side, setSide] = useState<Side>("top");
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.35);
  // null = untouched: picker shows a neutral swatch, snippet/prop stay omitted.
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  return (
    <PageLayout
      title="LiquidPanel"
      description="A drawer/sheet surface that pours in from one edge — anchored engine geometry on a spring — with content that rises in only after the liquid arrives."
      hero={
        <>
          <Stage wall hint="toggle open, watch the pour" onClick={() => setOpen((o) => !o)}>
            <PanelVariant open={open} side={side} material={material} intensity={intensity} tint={glassTint} color={color} />
          </Stage>
          <Controls>
            <Toggle label="open" value={open} set={setOpen} />
            <Seg label="side" value={side} set={setSide} options={SIDES} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
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
          <VariantCell label="pours from left" wall>
            <PanelVariant open side="left" material="glass" intensity={0.35} />
          </VariantCell>
          <VariantCell label="pours from bottom" wall>
            <PanelVariant open side="bottom" material="glass" intensity={0.35} />
          </VariantCell>
          <VariantCell label="flat" wall>
            <PanelVariant open side="top" material="flat" intensity={0.35} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<LiquidPanel open={open} side="${side}" material="${material}" intensity={${intensity}}${material === "glass" && glassTint ? ` tint="${glassTint}"` : ""}${material === "flat" ? ` color="${color}"` : ""}>
  <nav>…</nav>
</LiquidPanel>`} />
      }
    />
  );
}
