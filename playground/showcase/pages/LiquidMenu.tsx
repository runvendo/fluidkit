import { useState } from "react";
import { JellyButton, LiquidMenu } from "fluidkit";
import type { LiquidMenuAlign, LiquidMenuProps, LiquidMenuSide } from "fluidkit";
import {
  ColorField,
  Controls,
  PageLayout,
  Seg,
  Slider,
  Snippet,
  Stage,
  glassTintFromHex,
} from "../kit";

const SIDES: LiquidMenuSide[] = ["bottom", "top"];
const ALIGNS: LiquidMenuAlign[] = ["start", "end"];

type LiquidMaterial = NonNullable<LiquidMenuProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#e7eaf2";

export default function LiquidMenuPage() {
  const [side, setSide] = useState<LiquidMenuSide>("bottom");
  const [align, setAlign] = useState<LiquidMenuAlign>("start");
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.35);
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const [last, setLast] = useState<string | null>(null);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  const items = [
    { label: "Rename", onSelect: () => setLast("Rename") },
    { label: "Duplicate", onSelect: () => setLast("Duplicate") },
    { type: "separator" as const },
    { label: "Archive", onSelect: () => setLast("Archive"), disabled: true },
    { label: "Delete", onSelect: () => setLast("Delete") },
  ];

  return (
    <PageLayout
      title="LiquidMenu"
      description="A dropdown that pours from its trigger: the surface grows from the trigger's edge on a spring, items rise in once it has arrived, and dismissal drains it back."
      hero={
        <>
          <Stage wall hint="open the menu — arrows, Home/End, Escape all work">
            <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
              <LiquidMenu
                trigger={<JellyButton>Options</JellyButton>}
                items={items}
                side={side}
                align={align}
                material={material}
                intensity={intensity}
                tint={material === "glass" ? glassTint : undefined}
                color={material === "flat" ? color : undefined}
              />
              <span style={{ fontSize: 12, color: "#5a6275", minHeight: 16 }}>
                {last ? `selected: ${last}` : ""}
              </span>
            </div>
          </Stage>
          <Controls>
            <Seg label="side" value={side} set={setSide} options={SIDES} />
            <Seg label="align" value={align} set={setAlign} options={ALIGNS} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider
              label="intensity"
              value={intensity}
              set={setIntensity}
              min={0}
              max={1}
              step={0.05}
            />
            {material === "glass" ? (
              <ColorField label="tint" value={tint} set={setTint} />
            ) : (
              <ColorField label="color" value={color} set={setColor} />
            )}
          </Controls>
        </>
      }
      usage={
        <Snippet
          code={`<LiquidMenu
  trigger={<JellyButton>Options</JellyButton>}${side !== "bottom" ? `\n  side="${side}"` : ""}${align !== "start" ? `\n  align="${align}"` : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.35 ? `\n  intensity={${intensity}}` : ""}${material === "glass" && glassTint ? `\n  tint="${glassTint}"` : ""}
  items={[
    { label: "Rename", onSelect: rename },
    { label: "Duplicate", onSelect: duplicate },
    { type: "separator" },
    { label: "Delete", onSelect: del },
  ]}
/>`}
        />
      }
    />
  );
}
