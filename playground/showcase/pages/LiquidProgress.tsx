import { useEffect, useRef, useState } from "react";
import { LiquidProgress } from "fluidkit";
import type { LiquidProgressProps } from "fluidkit";
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

type LiquidMaterial = NonNullable<LiquidProgressProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#cdd3dd";

export default function LiquidProgressPage() {
  const [value, setValue] = useState(35);
  const [height, setHeight] = useState(12);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.7);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [fillTint, setFillTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const [playing, setPlaying] = useState(false);
  const fill = fillTint ? glassTintFromHex(fillTint) : undefined;

  // "Chunky download": jumps arrive in bursts so the meniscus can settle
  // between them — the wobble is a tell, not a show.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setValue((v) => (v >= 100 ? 0 : Math.min(100, v + 4 + Math.random() * 16)));
    }, 650);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing]);

  return (
    <PageLayout
      title="LiquidProgress"
      description="Determinate progress as a vessel filling. The fill edge is a meniscus bead that wobbles only while the value moves and settles flat at rest — idle progress never animates. Thinking owns indeterminate."
      hero={
        <>
          <Stage wall>
            <div style={{ display: "grid", gap: 22, justifyItems: "center" }}>
              <LiquidProgress
                value={value}
                max={100}
                width={320}
                height={height}
                material={material}
                intensity={intensity}
                opacity={opacityTouched ? opacity : undefined}
                fillTint={fill}
                color={material === "flat" ? color : undefined}
                aria-label="Demo progress"
              />
              <span style={{ fontSize: 12, color: "#5a6275" }}>
                {Math.round(value)}%
              </span>
            </div>
          </Stage>
          <Controls>
            <Slider
              label="value"
              value={Math.round(value)}
              set={(n) => {
                setPlaying(false);
                setValue(n);
              }}
              min={0}
              max={100}
              step={1}
              suffix="%"
            />
            <button className="btn" onClick={() => setPlaying((p) => !p)}>
              chunky download: {playing ? "on" : "off"}
            </button>
            <Slider label="height" value={height} set={setHeight} min={6} max={20} step={1} suffix="px" />
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
            <ColorField label="fill tint" value={fillTint} set={setFillTint} />
            {material === "flat" && <ColorField label="color" value={color} set={setColor} />}
          </Controls>
        </>
      }
      usage={
        <Snippet
          code={`<LiquidProgress value={progress} max={100} aria-label="Upload"${height !== 12 ? `\n  height={${height}}` : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.7 ? `\n  intensity={${intensity}}` : ""}${opacityTouched ? `\n  opacity={${opacity}}` : ""}${fill ? `\n  fillTint="${fill}"` : ""} />

// fractions work too — max defaults to 1
<LiquidProgress value={0.6} aria-label="Upload" />`}
        />
      }
    />
  );
}
