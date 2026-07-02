import { useState } from "react";
import { LiquidTabs } from "fluidkit";
import { PageLayout, Stage, Controls, Toggle, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

const INK = "#23242c";

/** One self-managing tab strip for the variants grid (uncontrolled via `defaultValue`). */
function TabsVariant({ flow, material, size }: {
  flow: "slide" | "stretch";
  material: "ink" | "glass";
  size: "sm" | "md" | "lg";
}) {
  return (
    <LiquidTabs
      defaultValue="chat"
      flow={flow}
      material={material}
      size={size}
      color={INK}
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
              color={INK}
              items={items}
            />
          </Stage>
          <Controls>
            <Seg label="flow" value={flow} set={setFlow} options={["slide", "stretch"]} />
            <Seg label="material" value={material} set={setMaterial} options={["ink", "glass"]} />
            <Seg label="size" value={size} set={setSize} options={["sm", "md", "lg"]} />
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
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`<LiquidTabs
  items={[{ id: "chat", label: "Chat" }, { id: "files", label: "Files" }]}
  defaultValue="chat"
  flow="${flow}"
  material="${material}"
  size="${size}"
/>`}
        />
      }
    />
  );
}
