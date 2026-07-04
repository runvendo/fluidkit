import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Ripple } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

/** Shared tappable glass surface — hero and variants use the same treatment. */
const SURFACE_STYLE: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 210,
  height: 92,
  borderRadius: 20,
  cursor: "pointer",
  userSelect: "none",
  background: "rgba(255,255,255,.55)",
  backdropFilter: "blur(14px) saturate(1.6)",
  WebkitBackdropFilter: "blur(14px) saturate(1.6)",
  color: "#23242c",
  fontSize: 14,
  fontWeight: 650,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 10px 28px rgba(46,44,72,.16)",
};

function Surface({
  material,
  duration,
  intensity = 0.35,
  children = "Tap me",
}: {
  material: "flat" | "glass";
  duration: number;
  intensity?: number;
  children?: ReactNode;
}) {
  return (
    <Ripple material={material} duration={duration} intensity={intensity} style={SURFACE_STYLE}>
      {children}
    </Ripple>
  );
}

export default function RipplePage() {
  const [duration, setDuration] = useState(600);
  const [material, setMaterial] = useState<"flat" | "glass">("glass");
  const [intensity, setIntensity] = useState(0.35);

  return (
    <PageLayout
      title="Ripple"
      description="Water ripple expands from the pointer on tap and fades out, clipped to the surface's box and border-radius. Flat is a translucent wash of currentColor; glass is a frosted water lens."
      hero={
        <>
          <Stage wall hint="tap the surface">
            <Surface material={material} duration={duration} intensity={intensity} />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={["flat", "glass"]} />
            <Slider label="duration" value={duration} set={setDuration} min={200} max={2000} step={50} suffix="ms" />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="quick · 250ms" wall hint="tap">
            <Surface material="glass" duration={250} />
          </VariantCell>
          <VariantCell label="default · 600ms" wall hint="tap">
            <Surface material="glass" duration={600} />
          </VariantCell>
          <VariantCell label="slow · 1400ms" wall hint="tap">
            <Surface material="glass" duration={1400} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<Ripple material="${material}" duration={${duration}}${intensity !== 0.35 ? ` intensity={${intensity}}` : ""} className="btn">
  Tap me
</Ripple>`}
        />
      }
    />
  );
}
