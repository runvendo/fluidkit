import { useState } from "react";
import { JellyButton, LiquidMenu } from "fluidkit";
import type { LiquidMenuAlign, LiquidMenuSide } from "fluidkit";
import {
  ColorField,
  Controls,
  PageLayout,
  Seg,
  Snippet,
  Stage,
  glassTintFromHex,
} from "../kit";

const SIDES: LiquidMenuSide[] = ["bottom", "top"];
const ALIGNS: LiquidMenuAlign[] = ["start", "end"];

export default function LiquidMenuPage() {
  const [side, setSide] = useState<LiquidMenuSide>("bottom");
  const [align, setAlign] = useState<LiquidMenuAlign>("start");
  const [tint, setTint] = useState<string | null>(null);
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
                tint={glassTint}
              />
              <span style={{ fontSize: 12, color: "#5a6275", minHeight: 16 }}>
                {last ? `selected: ${last}` : ""}
              </span>
            </div>
          </Stage>
          <Controls>
            <Seg label="side" value={side} set={setSide} options={SIDES} />
            <Seg label="align" value={align} set={setAlign} options={ALIGNS} />
            <ColorField label="tint" value={tint} set={setTint} />
          </Controls>
        </>
      }
      usage={
        <Snippet
          code={`<LiquidMenu
  trigger={<JellyButton>Options</JellyButton>}${side !== "bottom" ? `\n  side="${side}"` : ""}${align !== "start" ? `\n  align="${align}"` : ""}${glassTint ? `\n  tint="${glassTint}"` : ""}
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
