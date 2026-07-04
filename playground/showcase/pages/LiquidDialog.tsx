import { useState } from "react";
import { LiquidDialog, JellyButton } from "fluidkit";
import type { LiquidDialogProps } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet } from "../kit";

type LiquidMaterial = NonNullable<LiquidDialogProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "flat"];

/** Neutral fill so the flat material doesn't render as bare currentColor. */
const FLAT_COLOR = "#eef0f4";

const bodyText: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 13.5,
  lineHeight: 1.55,
  color: "#4b5160",
  maxWidth: 300,
};

export default function LiquidDialogPage() {
  const [open, setOpen] = useState(false);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [intensity, setIntensity] = useState(0.5);

  return (
    <PageLayout
      title="LiquidDialog"
      description="A modal on a liquid surface: opening is a surface-tension pop — geometry springs taut with one small overshoot — over a shallow-water backdrop. Content never scales."
      hero={
        <>
          <Stage wall hint="open the dialog, press Escape or click away to close">
            <JellyButton onClick={() => setOpen(true)} style={{ color: "#23242c", fontSize: 14, fontWeight: 650 }}>
              Open dialog
            </JellyButton>
            <LiquidDialog
              open={open}
              onClose={() => setOpen(false)}
              aria-label="Example dialog"
              material={material}
              intensity={intensity}
              color={material !== "glass" ? FLAT_COLOR : undefined}
            >
              <div style={{ maxWidth: 300 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#23242c" }}>
                  Surface tension
                </p>
                <p style={bodyText}>
                  The surface popped taut around this content. The page behind
                  sits a hand&apos;s depth under water.
                </p>
                <div style={{ marginTop: 18 }}>
                  <JellyButton
                    width={120}
                    height={40}
                    onClick={() => setOpen(false)}
                    style={{ color: "#23242c", fontSize: 13, fontWeight: 650 }}
                  >
                    Done
                  </JellyButton>
                </div>
              </div>
            </LiquidDialog>
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Slider label="intensity" value={intensity} set={setIntensity} min={0} max={1} step={0.05} />
          </Controls>
        </>
      }
      usage={
        <Snippet code={`<LiquidDialog open={open} onClose={() => setOpen(false)} aria-label="Settings" material="${material}" intensity={${intensity}}>
  <h2>Settings</h2>
  …
</LiquidDialog>`} />
      }
    />
  );
}
