import { useState } from "react";
import { LiquidSwitch } from "fluidkit";
import type { LiquidSwitchProps } from "fluidkit";
import {
  ColorField,
  Controls,
  PageLayout,
  Seg,
  Slider,
  Snippet,
  Stage,
  Toggle,
  VariantCell,
  VariantGrid,
  glassTintFromHex,
} from "../kit";

type LiquidMaterial = NonNullable<LiquidSwitchProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#cdd3dd";

export default function LiquidSwitchPage() {
  const [on, setOn] = useState(false);
  const [size, setSize] = useState(24);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.7);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const [checkedTint, setCheckedTint] = useState<string | null>(null);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;
  const onTint = checkedTint ? glassTintFromHex(checkedTint) : undefined;

  return (
    <PageLayout
      title="LiquidSwitch"
      description="A toggle whose thumb is a droplet: it tears off one well through a real metaball bridge, leaves a satellite at the pinch-off, and settles into the far well. A real hidden checkbox powers keyboard, forms, and screen readers."
      hero={
        <>
          <Stage wall>
            <LiquidSwitch
              checked={on}
              onCheckedChange={setOn}
              label="Wi-Fi"
              size={size}
              material={material}
              intensity={intensity}
              opacity={opacityTouched ? opacity : undefined}
              tint={material === "glass" ? glassTint : undefined}
              color={material === "flat" ? color : undefined}
              checkedTint={onTint}
            />
          </Stage>
          <Controls>
            <Toggle label="state" value={on} set={setOn} />
            <Slider label="size" value={size} set={setSize} min={16} max={48} step={2} suffix="px" />
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
            <ColorField label="checked tint" value={checkedTint} set={setCheckedTint} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="small · 16px" wall>
            <LiquidSwitch defaultChecked size={16} aria-label="small" />
          </VariantCell>
          <VariantCell label="default · 24px" wall>
            <LiquidSwitch size={24} aria-label="default" />
          </VariantCell>
          <VariantCell label="large · 44px" wall>
            <LiquidSwitch defaultChecked size={44} aria-label="large" />
          </VariantCell>
          <VariantCell label="disabled" wall>
            <LiquidSwitch disabled label="locked" />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<LiquidSwitch
  checked={on}
  onCheckedChange={setOn}
  label="Wi-Fi"${size !== 24 ? `\n  size={${size}}` : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.7 ? `\n  intensity={${intensity}}` : ""}${opacityTouched ? `\n  opacity={${opacity}}` : ""}${material === "glass" && glassTint ? `\n  tint="${glassTint}"` : ""}${onTint ? `\n  checkedTint="${onTint}"` : ""}
/>

// or uncontrolled, inside a form
<LiquidSwitch name="wifi" defaultChecked label="Wi-Fi" />`}
        />
      }
    />
  );
}
