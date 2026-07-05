import { useState } from "react";
import { LiquidTabs } from "fluidkit";
import { PageLayout, Stage, Controls, Toggle, Seg, Slider, ColorField, Snippet, VariantGrid, VariantCell, glassTintFromHex } from "../kit";

const FLAT_COLOR = "#23242c";

/** Component defaults, mirrored so untouched pickers stay honest in the snippet. */
const LABEL_DEFAULT = "#4b4c56";
const ACTIVE_LABEL_DEFAULTS = { flat: "#ffffff", glass: "#17181c" };

/** One self-managing tab strip for the variants grid (uncontrolled via `defaultValue`). */
function TabsVariant({ flow, material, size, color = FLAT_COLOR, activeLabelColor, reflection }: {
  flow: "slide" | "stretch";
  material: "flat" | "glass";
  size: "sm" | "md" | "lg";
  color?: string;
  activeLabelColor?: string;
  reflection?: boolean;
}) {
  return (
    <LiquidTabs
      defaultValue="chat"
      flow={flow}
      material={material}
      size={size}
      color={color}
      activeLabelColor={activeLabelColor}
      reflection={reflection}
      items={[
        { id: "chat", label: "Chat" },
        { id: "files", label: "Files" },
        { id: "media", label: "Media" },
      ]}
    />
  );
}

export default function LiquidTabsPage() {
  const [value, setValue] = useState("chat");
  const [flow, setFlow] = useState<"slide" | "stretch">("slide");
  const [material, setMaterial] = useState<"flat" | "glass">("flat");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [disableOne, setDisableOne] = useState(false);
  const [color, setColor] = useState(FLAT_COLOR);
  const [reflection, setReflection] = useState(false);
  const [intensity, setIntensity] = useState(0.35);
  const [opacity, setOpacity] = useState(0.5);
  const [opacityTouched, setOpacityTouched] = useState(false);
  const [shadow, setShadow] = useState(false);
  // null = untouched: picker shows the component default, snippet omits the prop.
  const [labelColor, setLabelColor] = useState<string | null>(null);
  const [activeLabelColor, setActiveLabelColor] = useState<string | null>(null);
  const [tintHue, setTintHue] = useState<string | null>(null);
  const tint = tintHue ? glassTintFromHex(tintHue) : undefined;

  const items = [
    { id: "chat", label: "Chat" },
    { id: "automations", label: "Automations", disabled: disableOne },
    { id: "connections", label: "Connections" },
  ];

  return (
    <PageLayout
      title="LiquidTabs"
      description="The active indicator is a liquid engine body that flows between tabs; label color tracks how much ink covers each tab, and the labels stay crisp on their own layer."
      hero={
        <>
          <Stage wall hint="click a tab — try each flow and material">
            <LiquidTabs
              value={value}
              onChange={setValue}
              flow={flow}
              material={material}
              size={size}
              color={color}
              tint={material === "glass" ? tint : undefined}
              reflection={reflection}
              intensity={intensity}
              opacity={opacityTouched ? opacity : undefined}
              shadow={shadow}
              labelColor={labelColor ?? undefined}
              activeLabelColor={activeLabelColor ?? undefined}
              items={items}
            />
          </Stage>
          <Controls>
            <Seg label="flow" value={flow} set={setFlow} options={["slide", "stretch"]} />
            <Seg label="material" value={material} set={setMaterial} options={["flat", "glass"]} />
            <Seg label="size" value={size} set={setSize} options={["sm", "md", "lg"]} />
            {material === "flat" ? (
              <ColorField label="color" value={color} set={setColor} />
            ) : (
              <ColorField
                label="tint"
                value={tintHue ?? "#ffffff"}
                set={setTintHue}
              />
            )}
            <ColorField
              label="label"
              value={labelColor ?? LABEL_DEFAULT}
              set={setLabelColor}
            />
            <ColorField
              label="active label"
              value={activeLabelColor ?? ACTIVE_LABEL_DEFAULTS[material]}
              set={setActiveLabelColor}
            />
            {material === "glass" && (
              <Toggle label="reflection" value={reflection} set={setReflection} />
            )}
            {material === "glass" && reflection && (
              <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
            )}
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
            <Toggle label="shadow" value={shadow} set={setShadow} />
            <Toggle label="disable Automations" value={disableOne} set={setDisableOne} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="slide · flat" wall>
            <TabsVariant flow="slide" material="flat" size="md" />
          </VariantCell>
          <VariantCell label="slide · glass" wall>
            <TabsVariant flow="slide" material="glass" size="md" />
          </VariantCell>
          <VariantCell label="stretch · flat" wall>
            <TabsVariant flow="stretch" material="flat" size="md" />
          </VariantCell>
          <VariantCell label="stretch · glass" wall>
            <TabsVariant flow="stretch" material="glass" size="md" />
          </VariantCell>
          <VariantCell label="glass · lit" wall>
            <TabsVariant flow="slide" material="glass" size="md" reflection />
          </VariantCell>
          <VariantCell label="size sm" wall>
            <TabsVariant flow="slide" material="flat" size="sm" />
          </VariantCell>
          <VariantCell label="size md" wall>
            <TabsVariant flow="slide" material="flat" size="md" />
          </VariantCell>
          <VariantCell label="size lg" wall>
            <TabsVariant flow="slide" material="flat" size="lg" />
          </VariantCell>
          <VariantCell label="custom color" wall>
            <TabsVariant flow="slide" material="flat" size="md" color="#4a6cf7" />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<LiquidTabs
  items={[{ id: "chat", label: "Chat" }, { id: "files", label: "Files" }]}
  defaultValue="chat"
  flow="${flow}"
  material="${material}"
  size="${size}"${material === "flat" ? `\n  color="${color}"` : ""}${material === "glass" && tint ? `\n  tint="${tint}"` : ""}${material === "glass" && reflection ? `\n  reflection` : ""}${material === "glass" && reflection && intensity !== 0.35 ? `\n  intensity={${intensity}}` : ""}${shadow ? `\n  shadow` : ""}${labelColor ? `\n  labelColor="${labelColor}"` : ""}${activeLabelColor ? `\n  activeLabelColor="${activeLabelColor}"` : ""}
/>`}
        />
      }
    />
  );
}
