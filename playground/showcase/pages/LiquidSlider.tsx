import { useState } from "react";
import { LiquidSlider } from "fluidkit";
import type { LiquidSliderProps } from "fluidkit";
import {
  ColorField,
  Controls,
  PageLayout,
  Seg,
  Slider,
  Snippet,
  Stage,
  VariantCell,
  VariantGrid,
  glassTintFromHex,
} from "../kit";

type LiquidMaterial = NonNullable<LiquidSliderProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#cdd3dd";

export default function LiquidSliderPage() {
  const [v, setV] = useState(40);
  const [size, setSize] = useState(20);
  const [trackWidth, setTrackWidth] = useState(240);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.7);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const [fillTint, setFillTint] = useState<string | null>(null);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;
  const fill = fillTint ? glassTintFromHex(fillTint) : undefined;

  return (
    <PageLayout
      title="LiquidSlider"
      description="A droplet thumb riding the meniscus edge of a part-filled channel. A real hidden range input powers drag, keyboard steps, min/max/step, and forms — fluidkit only paints."
      hero={
        <>
          <Stage wall hint="drag the droplet, or focus and use arrow keys">
            <LiquidSlider
              aria-label="Volume"
              value={v}
              onValueChange={setV}
              width={trackWidth}
              size={size}
              material={material}
              intensity={intensity}
              opacity={opacityTouched ? opacity : undefined}
              tint={material === "glass" ? glassTint : undefined}
              color={material === "flat" ? color : undefined}
              fillTint={fill}
            />
          </Stage>
          <Controls>
            <Slider label="value" value={v} set={setV} min={0} max={100} step={1} />
            <Slider label="thumb size" value={size} set={setSize} min={14} max={36} step={2} suffix="px" />
            <Slider label="track width" value={trackWidth} set={setTrackWidth} min={140} max={420} step={10} suffix="px" />
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
            <ColorField label="fill tint" value={fillTint} set={setFillTint} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="with label" wall>
            <LiquidSlider label="Volume" defaultValue={65} width={180} />
          </VariantCell>
          <VariantCell label="stepped · 0–10" wall>
            <LiquidSlider aria-label="stepped" min={0} max={10} step={1} defaultValue={6} width={180} />
          </VariantCell>
          <VariantCell label="disabled" wall>
            <LiquidSlider aria-label="disabled" defaultValue={30} width={180} disabled />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<LiquidSlider
  aria-label="Volume"
  value={v}
  onValueChange={setV}${size !== 20 ? `\n  size={${size}}` : ""}${trackWidth !== 240 ? `\n  width={${trackWidth}}` : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.7 ? `\n  intensity={${intensity}}` : ""}${opacityTouched ? `\n  opacity={${opacity}}` : ""}${material === "glass" && glassTint ? `\n  tint="${glassTint}"` : ""}${fill ? `\n  fillTint="${fill}"` : ""}
/>

// or uncontrolled, inside a form
<LiquidSlider name="volume" defaultValue={40} min={0} max={100} step={5} label="Volume" />`}
        />
      }
    />
  );
}
