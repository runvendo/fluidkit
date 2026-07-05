import { useState } from "react";
import { LiquidText } from "fluidkit";
import type { LiquidTextProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type Material = NonNullable<LiquidTextProps["material"]>;

const MATERIALS: Material[] = ["glass", "flat"];

export default function LiquidTextPage() {
  const [material, setMaterial] = useState<Material>("glass");
  const [intensity, setIntensity] = useState(0.35);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [angle, setAngle] = useState(115);

  return (
    <PageLayout
      title="LiquidText"
      description="Glyphs made of glass: the letterforms blur and tint whatever sits behind them, with a specular sheen drifting across. The text geometry never changes — only light and backdrop move."
      hero={
        <>
          <Stage wall hint="glass letters over the wall">
            <h2 style={{ margin: 0, fontSize: 46, fontWeight: 800, letterSpacing: "-0.02em" }}>
              <LiquidText material={material} intensity={intensity} opacity={opacityTouched ? opacity : undefined} speed={speed} angle={angle}>
                Liquid lettering
              </LiquidText>
            </h2>
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
            <Slider label="speed" value={speed} set={setSpeed} min={0.25} max={3} step={0.25} suffix="×" />
            <Slider label="angle" value={angle} set={setAngle} min={60} max={160} step={5} suffix="°" />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="glass" wall>
            <h3 style={{ margin: 0, fontSize: 26, fontWeight: 750 }}>
              <LiquidText intensity={0.5}>Glass letters</LiquidText>
            </h3>
          </VariantCell>
          <VariantCell label="glass · sky tint" wall>
            <h3 style={{ margin: 0, fontSize: 26, fontWeight: 750 }}>
              <LiquidText tint="rgba(125,170,255,0.4)" intensity={0.5}>Tinted glass</LiquidText>
            </h3>
          </VariantCell>
          <VariantCell label="flat · whisper" wall>
            <h3 style={{ margin: 0, fontSize: 26, fontWeight: 750 }}>
              <LiquidText material="flat" intensity="whisper">Quiet shimmer</LiquidText>
            </h3>
          </VariantCell>
          <VariantCell label="flat · colored" wall>
            <h3 style={{ margin: 0, fontSize: 26, fontWeight: 750 }}>
              <LiquidText material="flat" intensity={0.6} color="#3b5bd9" sheenColor="#dff0ff">Ocean blue</LiquidText>
            </h3>
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<h1>
  <LiquidText${material !== "glass" ? ` material="${material}"` : ""}${intensity !== 0.35 ? ` intensity={${intensity}}` : ""}${speed !== 1 ? ` speed={${speed}}` : ""}${angle !== 115 ? ` angle={${angle}}` : ""}>
    Liquid lettering
  </LiquidText>
</h1>`} />
      }
    />
  );
}
