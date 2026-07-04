import { useEffect, useRef, useState } from "react";
import { VoiceBall } from "fluidkit";
import type { VoiceBallProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Toggle, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

type LiquidMaterial = NonNullable<VoiceBallProps["material"]>;
type Mode = NonNullable<VoiceBallProps["mode"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const MODES: Mode[] = ["idle", "listening", "speaking"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#cdd3dd";

/** Glass tint used by the "sky" variant-grid example. */
const SKY_TINT = "rgba(125, 170, 255, 0.35)";

/**
 * Deterministic speech envelope: overlapping sine bursts that read like
 * talking — phrases, pauses, plosives — with no randomness.
 */
function speechLevel(tMs: number): number {
  const t = tMs / 1000;
  const phrase = Math.max(0, Math.sin(t * 0.55)) ** 0.6; // talk/pause cycle
  const syllables = 0.55 + 0.45 * Math.sin(t * 7.3) * Math.sin(t * 4.1);
  const plosive = 0.2 * Math.max(0, Math.sin(t * 13.7 + 2));
  return Math.min(1, Math.max(0, phrase * (0.25 + 0.6 * syllables + plosive)));
}

/** Drives a live level: fake speech when auto, manual slider otherwise. */
function useVoiceLevel(auto: boolean, manual: number): number {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!auto) return;
    const start = performance.now();
    const tick = (now: number) => {
      setLevel(speechLevel(now - start));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [auto]);
  return auto ? level : manual;
}

export default function VoiceBallPage() {
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState(0.3);
  const [mode, setMode] = useState<Mode>("speaking");
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  // null = untouched: picker shows a neutral swatch, snippet/prop stay omitted.
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;
  const [size, setSize] = useState(96);
  const [intensity, setIntensity] = useState(0.35);
  const [refraction, setRefraction] = useState(false);
  const level = useVoiceLevel(auto, manual);

  return (
    <PageLayout
      title="VoiceBall"
      description="A voice-assistant orb driven by a live level prop: the liquid swells and undulates with the audio, and satellite beads surface at speech peaks, fused through real surface tension."
      hero={
        <>
          <Stage wall hint={auto ? "listening to a fake voice" : "drive the level yourself"}>
            <VoiceBall
              level={level}
              mode={mode}
              size={size}
              material={material}
              tint={material === "glass" ? glassTint : undefined}
              intensity={intensity}
              refraction={refraction}
              color={material === "flat" ? color : undefined}
            />
          </Stage>
          <Controls>
            <Seg label="mode" value={mode} set={setMode} options={MODES} />
            <Toggle label="auto voice" value={auto} set={setAuto} />
            <Slider label="level" value={auto ? Math.round(level * 100) / 100 : manual} set={setManual} min={0} max={1} step={0.05} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            {material === "glass" ? (
              <ColorField label="tint" value={tint} set={setTint} />
            ) : (
              <ColorField label="color" value={color} set={setColor} />
            )}
            <Slider label="size" value={size} set={setSize} min={48} max={160} step={8} suffix="px" />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Toggle label="refraction" value={refraction} set={setRefraction} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="idle" wall>
            <VoiceBall mode="idle" intensity={0.5} />
          </VariantCell>
          <VariantCell label="listening · sky tint" wall>
            <VoiceBall mode="listening" level={0.5} tint={SKY_TINT} intensity={0.5} />
          </VariantCell>
          <VariantCell label="speaking" wall>
            <VoiceBall mode="speaking" level={0.85} intensity={0.5} />
          </VariantCell>
          <VariantCell label="speaking · flat" wall>
            <VoiceBall mode="speaking" level={0.6} material="flat" color={FLAT_COLOR} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`// level: 0-1 from your audio stack (e.g. an AnalyserNode)
<VoiceBall mode="${mode}" level={level} size={${size}} material="${material}"${material === "glass" && glassTint ? ` tint="${glassTint}"` : ""}${material === "flat" ? ` color="${color}"` : ""}${intensity !== 0.35 ? ` intensity={${intensity}}` : ""}${refraction ? "\n  refraction" : ""} />`} />
      }
    />
  );
}
