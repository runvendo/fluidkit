import { useState } from "react";
import type { CSSProperties } from "react";
import { Magnetic } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Snippet, VariantGrid, VariantCell } from "../kit";

/** Shared magnet target — hero and variants use the same dot treatment. */
const DOT_STYLE: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "linear-gradient(160deg, #4a6cf7, #7c9bff)",
  boxShadow: "0 10px 28px rgba(74,108,247,.35)",
};

function Dot() {
  return <div style={DOT_STYLE} />;
}

export default function MagneticPage() {
  const [strength, setStrength] = useState(0.3);
  const [radius, setRadius] = useState(120);

  return (
    <PageLayout
      title="Magnetic"
      description="Pulls its child toward the pointer while it's within radius px of the element's center, and springs back to rest outside that radius."
      hero={
        <>
          <Stage hint="move your pointer near the dot">
            <Magnetic strength={strength} radius={radius}>
              <Dot />
            </Magnetic>
          </Stage>
          <Controls>
            <Slider label="strength" value={strength} set={setStrength} min={0.05} max={1} step={0.05} />
            <Slider label="radius" value={radius} set={setRadius} min={40} max={240} step={10} suffix="px" />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="weak · 0.15" hint="approach">
            <Magnetic strength={0.15}>
              <Dot />
            </Magnetic>
          </VariantCell>
          <VariantCell label="medium · 0.3" hint="approach">
            <Magnetic strength={0.3}>
              <Dot />
            </Magnetic>
          </VariantCell>
          <VariantCell label="strong · 0.6" hint="approach">
            <Magnetic strength={0.6}>
              <Dot />
            </Magnetic>
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<Magnetic strength={${strength}} radius={${radius}}>
  <button className="cta">Get started</button>
</Magnetic>`}
        />
      }
    />
  );
}
