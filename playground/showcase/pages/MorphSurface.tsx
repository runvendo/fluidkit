import { useState } from "react";
import { MorphSurface } from "fluidkit";
import type { MorphSurfaceProps } from "fluidkit";
import { PageLayout, Stage, Controls, Toggle, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<MorphSurfaceProps["material"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];

function PillFace() {
  return (
    <div className="pill-label">
      <span className="dot" />
      Ask fluidkit
    </div>
  );
}

function PanelFace() {
  return (
    <div className="panel-body">
      <div className="ph"><span className="dot" />Assistant</div>
      <div className="row me">Move $500 to savings</div>
      <div className="row">Done — scheduled for tomorrow.</div>
      <div className="row">Want a weekly rule?</div>
    </div>
  );
}

/** One material cell with its own open state — click the cell to morph. */
function MorphVariant({ material }: { material: LiquidMaterial }) {
  const [open, setOpen] = useState(false);
  return (
    <VariantCell label={material} wall hint="click to morph" onClick={() => setOpen((v) => !v)}>
      <MorphSurface
        open={open}
        material={material}
        closedSize={{ width: 128, height: 40 }}
        openSize={{ width: 196, height: 144 }}
        closedContent={<PillFace />}
        openContent={
          <div className="panel-body">
            <div className="ph"><span className="dot" />Assistant</div>
            <div className="row me">Move $500 to savings</div>
            <div className="row">Done — scheduled for tomorrow.</div>
          </div>
        }
      />
    </VariantCell>
  );
}

export default function MorphSurfacePage() {
  const [open, setOpen] = useState(false);
  const [satellites, setSatellites] = useState(true);
  const [material, setMaterial] = useState<LiquidMaterial>("glass");
  const [reflection, setReflection] = useState(true);
  const [refraction, setRefraction] = useState(false);

  return (
    <PageLayout
      title="MorphSurface"
      description="One liquid body: pill morphs into panel, satellite droplets absorbed through real bridges. Text only cross-fades — never scales."
      hero={
        <>
          <Stage wall hint="click — droplets absorb into the panel" onClick={() => setOpen((v) => !v)}>
            <MorphSurface
              open={open}
              material={material}
              reflection={reflection}
              refraction={refraction}
              satellites={satellites}
              closedContent={<PillFace />}
              openContent={<PanelFace />}
            />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Toggle label="reflection" value={reflection} set={setReflection} />
            <Toggle label="refraction" value={refraction} set={setRefraction} />
            <Toggle label="satellites" value={satellites} set={setSatellites} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <MorphVariant material="glass" />
          <MorphVariant material="mercury" />
          <MorphVariant material="flat" />
        </VariantGrid>
      }
      usage={
        <Snippet code={`<MorphSurface
  open={open}
  material="${material}"${refraction ? "\n  refraction" : ""}
  closedContent={<PillFace />}
  openContent={<PanelFace />}
/>`} />
      }
    />
  );
}
