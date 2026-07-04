import { useState } from "react";
import { LiquidField } from "fluidkit";
import type { LiquidFieldProps } from "fluidkit";
import {
  ColorField,
  Controls,
  PageLayout,
  Seg,
  Slider,
  Snippet,
  Stage,
  Toggle,
  glassTintFromHex,
} from "../kit";

type LiquidMaterial = NonNullable<LiquidFieldProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#e7eaf2";

export default function LiquidFieldPage() {
  const [multiline, setMultiline] = useState(false);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.35);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  return (
    <PageLayout
      title="LiquidField"
      description="A text field on a liquid surface — the input stays real and crisp; the glass is only the background. Focus swells the surface and shows the focus meniscus instead of a browser outline."
      hero={
        <>
          <Stage wall hint="click in, type, tab away — the surface swells on focus">
            <div style={{ width: 320 }}>
              <LiquidField
                key={multiline ? "area" : "input"}
                label={multiline ? "Notes" : "Email"}
                placeholder={multiline ? "What happened?" : "you@example.com"}
                multiline={multiline}
                material={material}
                intensity={intensity}
                opacity={opacityTouched ? opacity : undefined}
                tint={material === "glass" ? glassTint : undefined}
                color={material === "flat" ? color : undefined}
              />
            </div>
          </Stage>
          <Controls>
            <Toggle label="multiline" value={multiline} set={setMultiline} />
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
          code={`<LiquidField
  label="Email"
  placeholder="you@example.com"
  name="email"${multiline ? "\n  multiline" : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.35 ? `\n  intensity={${intensity}}` : ""}${opacityTouched ? `\n  opacity={${opacity}}` : ""}${material === "glass" && glassTint ? `\n  tint="${glassTint}"` : ""}
/>`}
        />
      }
    />
  );
}
