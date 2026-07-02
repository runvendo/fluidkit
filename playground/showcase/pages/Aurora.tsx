import { useState } from "react";
import type { CSSProperties } from "react";
import { Aurora } from "fluidkit";
import {
  PageLayout,
  Stage,
  Controls,
  Slider,
  Seg,
  Snippet,
  VariantGrid,
  VariantCell,
} from "../kit";

type AuroraBlend = "screen" | "normal" | "multiply";

const BLENDS: AuroraBlend[] = ["screen", "normal", "multiply"];

const DARK_BG = "#15161c";
const LIGHT_BG = "#fff";

const cornerLabel = (tone: "dark" | "light"): CSSProperties => ({
  position: "absolute",
  left: 10,
  bottom: 8,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: tone === "dark" ? "rgba(255,255,255,.5)" : "rgba(28,29,35,.4)",
});

/** One opaque surface with an Aurora at default intensity/speed — the
 * variant grid shows each blend on both tones so the wash-out on white is
 * visible at a glance. */
function BlendSurface({ tone, blend }: { tone: "dark" | "light"; blend: AuroraBlend }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: tone === "dark" ? DARK_BG : LIGHT_BG,
      }}
    >
      <Aurora blend={blend} />
    </div>
  );
}

export default function AuroraPage() {
  const [intensity, setIntensity] = useState(0.6);
  const [speed, setSpeed] = useState(1);
  const [blend, setBlend] = useState<AuroraBlend>("screen");

  const usage = `import { Aurora } from "fluidkit";

<div style={{ position: "relative", background: "${blend === "screen" ? DARK_BG : LIGHT_BG}" }}>
  <Aurora intensity={${intensity}} speed={${speed}} blend="${blend}" />
  <YourContent />
</div>`;

  return (
    <PageLayout
      title="Aurora"
      description={`Ambient CSS backdrop: blurred horizontal bands drift across the upper portion of the container. "blend" controls how bands composite: screen glows on dark/mid surfaces but washes toward invisible on white, so use normal or multiply on light surfaces.`}
      hero={
        <>
          <Stage hint="same props, dark vs. light — blend is honest about the difference">
            <div
              style={{
                position: "absolute",
                inset: "0 50% 0 0",
                overflow: "hidden",
                background: DARK_BG,
              }}
            >
              <Aurora intensity={intensity} speed={speed} blend={blend} />
              <span style={cornerLabel("dark")}>dark</span>
            </div>
            <div
              style={{
                position: "absolute",
                inset: "0 0 0 50%",
                overflow: "hidden",
                background: LIGHT_BG,
                borderLeft: "1px solid #ecedf2",
              }}
            >
              <Aurora intensity={intensity} speed={speed} blend={blend} />
              <span style={cornerLabel("light")}>light</span>
            </div>
          </Stage>
          <Controls>
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Slider label="speed" value={speed} set={setSpeed} min={0.3} max={3} step={0.1} />
            <Seg label="blend" value={blend} set={setBlend} options={BLENDS} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="screen · dark">
            <BlendSurface tone="dark" blend="screen" />
          </VariantCell>
          <VariantCell label="screen · light">
            <BlendSurface tone="light" blend="screen" />
          </VariantCell>
          <VariantCell label="normal · dark">
            <BlendSurface tone="dark" blend="normal" />
          </VariantCell>
          <VariantCell label="normal · light">
            <BlendSurface tone="light" blend="normal" />
          </VariantCell>
          <VariantCell label="multiply · dark">
            <BlendSurface tone="dark" blend="multiply" />
          </VariantCell>
          <VariantCell label="multiply · light">
            <BlendSurface tone="light" blend="multiply" />
          </VariantCell>
        </VariantGrid>
      }
      usage={<Snippet code={usage} />}
    />
  );
}
