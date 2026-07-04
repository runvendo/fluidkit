import { useState } from "react";
import { LiquidCheckbox } from "fluidkit";
import type { LiquidCheckboxProps } from "fluidkit";
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

type LiquidMaterial = NonNullable<LiquidCheckboxProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#cdd3dd";

export default function LiquidCheckboxPage() {
  const [on, setOn] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [size, setSize] = useState(20);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.7);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  return (
    <PageLayout
      title="LiquidCheckbox"
      description="The check is liquid, not a tick: the pool rises to fill the well; unchecking drains it out. Indeterminate reads as a half-filled well with a flat meniscus."
      hero={
        <>
          <Stage wall>
            <LiquidCheckbox
              checked={on}
              onCheckedChange={(v) => {
                setOn(v);
                setIndeterminate(false);
              }}
              indeterminate={indeterminate}
              label="Remember me"
              size={size}
              material={material}
              intensity={intensity}
              opacity={opacityTouched ? opacity : undefined}
              tint={material === "glass" ? glassTint : undefined}
              color={material === "flat" ? color : undefined}
            />
          </Stage>
          <Controls>
            <Toggle label="checked" value={on} set={setOn} />
            <Toggle label="indeterminate" value={indeterminate} set={setIndeterminate} />
            <Slider label="size" value={size} set={setSize} min={14} max={36} step={2} suffix="px" />
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
      variants={
        <VariantGrid>
          <VariantCell label="unchecked" wall>
            <LiquidCheckbox aria-label="unchecked" />
          </VariantCell>
          <VariantCell label="checked" wall>
            <LiquidCheckbox defaultChecked aria-label="checked" />
          </VariantCell>
          <VariantCell label="indeterminate" wall>
            <LiquidCheckbox indeterminate aria-label="mixed" />
          </VariantCell>
          <VariantCell label="disabled" wall>
            <LiquidCheckbox disabled label="locked" />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<LiquidCheckbox
  checked={on}
  onCheckedChange={setOn}
  label="Remember me"${indeterminate ? "\n  indeterminate" : ""}${size !== 20 ? `\n  size={${size}}` : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.7 ? `\n  intensity={${intensity}}` : ""}${opacityTouched ? `\n  opacity={${opacity}}` : ""}${material === "glass" && glassTint ? `\n  tint="${glassTint}"` : ""}
/>

// or uncontrolled, inside a form
<LiquidCheckbox name="remember" defaultChecked label="Remember me" />`}
        />
      }
    />
  );
}
