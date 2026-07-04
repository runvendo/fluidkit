import { useState } from "react";
import { LiquidToastProvider, toast } from "fluidkit";
import type { LiquidToastPosition, LiquidToastProviderProps } from "fluidkit";
import {
  ColorField,
  Controls,
  PageLayout,
  Seg,
  Slider,
  Snippet,
  Stage,
  Toggle,
  glassTintFromHex,
} from "../kit";

const POSITIONS: LiquidToastPosition[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
];

const MESSAGES = [
  "Changes saved",
  "Link copied",
  "Upload complete",
  "Draft restored",
];
let msgIndex = 0;

type LiquidMaterial = NonNullable<LiquidToastProviderProps["material"]>;
const MATERIALS: LiquidMaterial[] = ["glass", "flat"];
const FLAT_COLOR = "#e7eaf2";

export default function LiquidToastPage() {
  const [position, setPosition] = useState<LiquidToastPosition>("bottom-right");
  const [duration, setDuration] = useState(5);
  const [dismissible, setDismissible] = useState(true);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.7);
  const [tint, setTint] = useState<string | null>(null);
  const [color, setColor] = useState(FLAT_COLOR);
  const glassTint = tint ? glassTintFromHex(tint) : undefined;

  return (
    <PageLayout
      title="LiquidToast"
      description="Notifications as liquid: each toast condenses at a screen corner and evaporates on dismiss. Fired imperatively — mount the provider once, call toast() from anywhere."
      hero={
        <>
          {/* The provider portals its viewport to the page body — toasts
              condense at the real screen corner, exactly like in an app. */}
          <LiquidToastProvider
            key={`${position}-${duration}-${dismissible}-${material}-${intensity}-${glassTint ?? ""}-${color}`}
            position={position}
            duration={duration * 1000}
            dismissible={dismissible}
            material={material}
            intensity={intensity}
            tint={material === "glass" ? glassTint : undefined}
            color={material === "flat" ? color : undefined}
          />
          <Stage wall hint="fire a toast — it condenses at the screen corner">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                className="btn"
                onClick={() => toast(MESSAGES[msgIndex++ % MESSAGES.length])}
              >
                toast()
              </button>
              <button
                className="btn"
                onClick={() =>
                  toast("Message deleted", {
                    action: { label: "Undo", onClick: () => {} },
                  })
                }
              >
                with action
              </button>
              <button
                className="btn"
                onClick={() => {
                  toast("One");
                  toast("Two");
                  toast("Three");
                  toast("Four — the oldest evaporates");
                }}
              >
                overflow the stack
              </button>
              <button className="btn" onClick={() => toast.dismiss()}>
                dismiss all
              </button>
            </div>
          </Stage>
          <Controls>
            <Seg label="position" value={position} set={setPosition} options={POSITIONS} />
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider
              label="intensity"
              value={intensity}
              set={setIntensity}
              min={0}
              max={1}
              step={0.05}
            />
            <Slider
              label="auto-dismiss (0 = sticky)"
              value={duration}
              set={setDuration}
              min={0}
              max={10}
              step={0.5}
              suffix="s"
            />
            <Toggle label="close button" value={dismissible} set={setDismissible} />
            {material === "glass" ? (
              <ColorField label="tint" value={tint} set={setTint} />
            ) : (
              <ColorField label="color" value={color} set={setColor} />
            )}
          </Controls>
        </>
      }
      usage={
        <Snippet
          code={`// once, near the root
<LiquidToastProvider${position !== "bottom-right" ? `\n  position="${position}"` : ""}${duration !== 5 ? `\n  duration={${duration * 1000}}` : ""}${!dismissible ? `\n  dismissible={false}` : ""}${material !== "glass" ? `\n  material="${material}" color="${color}"` : ""}${intensity !== 0.7 ? `\n  intensity={${intensity}}` : ""}${material === "glass" && glassTint ? `\n  tint="${glassTint}"` : ""}>
  <App />
</LiquidToastProvider>

// anywhere
import { toast } from "fluidkit";

toast("Changes saved");
toast("Message deleted", { action: { label: "Undo", onClick: restore } });`}
        />
      }
    />
  );
}
