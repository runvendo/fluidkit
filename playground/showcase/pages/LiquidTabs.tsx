import { useState } from "react";
import { LiquidTabs } from "fluidkit";
import { PageLayout, Stage, Controls, Toggle, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

const INK = "#23242c";

/** Component defaults, mirrored so untouched pickers stay honest in the snippet. */
const LABEL_DEFAULT = "#4b4c56";
const ACTIVE_LABEL_DEFAULTS = { ink: "#ffffff", glass: "#17181c" };

function ColorField({ label, value, set }: {
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="color" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );
}

/** One self-managing tab strip for the variants grid (uncontrolled via `defaultValue`). */
function TabsVariant({ flow, material, size, color = INK, activeLabelColor }: {
  flow: "slide" | "stretch";
  material: "ink" | "glass";
  size: "sm" | "md" | "lg";
  color?: string;
  activeLabelColor?: string;
}) {
  return (
    <LiquidTabs
      defaultValue="chat"
      flow={flow}
      material={material}
      size={size}
      color={color}
      activeLabelColor={activeLabelColor}
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
  const [material, setMaterial] = useState<"ink" | "glass">("ink");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [disableOne, setDisableOne] = useState(false);
  const [ink, setInk] = useState(INK);
  // null = untouched: picker shows the component default, snippet omits the prop.
  const [labelColor, setLabelColor] = useState<string | null>(null);
  const [activeLabelColor, setActiveLabelColor] = useState<string | null>(null);
  const [glassTintHue, setGlassTintHue] = useState<string | null>(null);
  // pickers can't do alpha; keep the tint translucent (0x4d ≈ 30%) like the default
  const glassTint = glassTintHue ? `${glassTintHue}4d` : undefined;

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
              color={ink}
              glassTint={material === "glass" ? glassTint : undefined}
              labelColor={labelColor ?? undefined}
              activeLabelColor={activeLabelColor ?? undefined}
              items={items}
            />
          </Stage>
          <Controls>
            <Seg label="flow" value={flow} set={setFlow} options={["slide", "stretch"]} />
            <Seg label="material" value={material} set={setMaterial} options={["ink", "glass"]} />
            <Seg label="size" value={size} set={setSize} options={["sm", "md", "lg"]} />
            {material === "ink" ? (
              <ColorField label="ink" value={ink} set={setInk} />
            ) : (
              <ColorField
                label="tint"
                value={glassTintHue ?? "#ffffff"}
                set={setGlassTintHue}
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
            <Toggle label="disable Automations" value={disableOne} set={setDisableOne} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="slide · ink" wall>
            <TabsVariant flow="slide" material="ink" size="md" />
          </VariantCell>
          <VariantCell label="slide · glass" wall>
            <TabsVariant flow="slide" material="glass" size="md" />
          </VariantCell>
          <VariantCell label="stretch · ink" wall>
            <TabsVariant flow="stretch" material="ink" size="md" />
          </VariantCell>
          <VariantCell label="stretch · glass" wall>
            <TabsVariant flow="stretch" material="glass" size="md" />
          </VariantCell>
          <VariantCell label="size sm" wall>
            <TabsVariant flow="slide" material="ink" size="sm" />
          </VariantCell>
          <VariantCell label="size md" wall>
            <TabsVariant flow="slide" material="ink" size="md" />
          </VariantCell>
          <VariantCell label="size lg" wall>
            <TabsVariant flow="slide" material="ink" size="lg" />
          </VariantCell>
          <VariantCell label="custom color" wall>
            <TabsVariant flow="slide" material="ink" size="md" color="#4a6cf7" />
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
  size="${size}"${material === "ink" ? `\n  color="${ink}"` : ""}${material === "glass" && glassTint ? `\n  glassTint="${glassTint}"` : ""}${labelColor ? `\n  labelColor="${labelColor}"` : ""}${activeLabelColor ? `\n  activeLabelColor="${activeLabelColor}"` : ""}
/>`}
        />
      }
    />
  );
}
