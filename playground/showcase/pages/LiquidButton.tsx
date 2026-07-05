import { useState } from "react";
import { LiquidButton } from "fluidkit";
import type { LiquidButtonProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

type LiquidMaterial = NonNullable<LiquidButtonProps["material"]>;
type LiquidVariantName = NonNullable<LiquidButtonProps["variant"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const VARIANTS: LiquidVariantName[] = ["jelly", "still"];

/** Neutral fill so the flat material doesn't render as bare currentColor on the wall. */
const FLAT_COLOR = "#8d94a1";


/** Named pressed-fill choices for the hero's `press color` control. `auto`
 * hands the choice back to the component's derived deepening. Translucent
 * values so they read on glass; solids darken them via the same fill. */
const PRESS_COLORS = {
  auto: undefined,
  ink: "rgba(30,32,40,0.30)",
  sky: "rgba(120,160,255,0.45)",
  rose: "rgba(255,120,150,0.40)",
} as const;
type PressColorKey = keyof typeof PRESS_COLORS;

/** One pill — hero and variant cells alike — with the flat-material color/text fallbacks. */
function LiquidVariant({ variant, material, squash, intensity, pressColor, tint, color }: {
  variant?: LiquidVariantName;
  material: LiquidMaterial;
  squash: number;
  intensity?: number;
  pressColor?: string;
  tint?: string;
  color?: string;
}) {
  return (
    <LiquidButton
      variant={variant}
      material={material}
      squash={squash}
      intensity={intensity}
      pressColor={pressColor}
      tint={material === "glass" ? tint : undefined}
      color={material === "flat" ? (color ?? FLAT_COLOR) : undefined}
      style={{ color: material === "flat" ? "#fff" : "#23242c", fontSize: 14, fontWeight: 650 }}
    >
      Press me
    </LiquidButton>
  );
}

export default function LiquidButtonPage() {
  const [variant, setVariant] = useState<LiquidVariantName>("still");
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [squash, setSquash] = useState(0.12);
  const [intensity, setIntensity] = useState(0.7);
  const [pressColorKey, setPressColorKey] = useState<PressColorKey>("auto");
  const pressColor = PRESS_COLORS[pressColorKey];
  // null = untouched: picker shows a neutral swatch, snippet/prop stay omitted.
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;
  const still = variant === "still";

  return (
    <PageLayout
      title="LiquidButton"
      description="A liquid pill button. The default jelly variant squashes on press via geometry, not a CSS transform, so the label never scales; the still variant holds the geometry rigid and presses through fill and glint only."
      hero={
        <>
          <Stage wall hint="press and hold">
            <LiquidVariant variant={variant} material={material} squash={squash} intensity={intensity} pressColor={pressColor} tint={glassTint} color={color} />
          </Stage>
          <Controls>
            <Seg label="variant" value={variant} set={setVariant} options={VARIANTS} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="squash" value={squash} set={setSquash} min={0.02} max={0.3} step={0.01} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            <Seg
              label="press color"
              value={pressColorKey}
              set={setPressColorKey}
              options={Object.keys(PRESS_COLORS) as PressColorKey[]}
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
          <VariantCell label="glass · soft" wall>
            <LiquidVariant material="glass" squash={0.06} />
          </VariantCell>
          <VariantCell label="glass · strong" wall>
            <LiquidVariant material="glass" squash={0.2} />
          </VariantCell>
          <VariantCell label="glass · still" wall>
            <LiquidVariant variant="still" material="glass" squash={0.12} />
          </VariantCell>
          <VariantCell label="glass · release wave" wall>
            <LiquidButton
              releaseWave
              style={{ color: "#23242c", fontSize: 14, fontWeight: 650 }}
            >
              Press me
            </LiquidButton>
          </VariantCell>
          <VariantCell label="flat · soft" wall>
            <LiquidVariant material="flat" squash={0.06} />
          </VariantCell>
          <VariantCell label="flat · strong" wall>
            <LiquidVariant material="flat" squash={0.2} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet code={`<LiquidButton material="${material}"${
          still ? ` variant="still"` : ""
        }${!still && squash !== 0.12 ? ` squash={${squash}}` : ""}${intensity !== 0.7 ? ` intensity={${intensity}}` : ""}${
          pressColor ? ` pressColor="${pressColor}"` : ""
        }${material === "glass" && glassTint ? ` tint="${glassTint}"` : ""}${
          material === "flat" ? ` color="${color}"` : ""
        } onClick={save}>
  Save changes
</LiquidButton>`} />
      }
    />
  );
}
