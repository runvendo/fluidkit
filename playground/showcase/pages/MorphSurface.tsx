import { useState } from "react";
import { MorphSurface } from "fluidkit";
import type { MorphSurfaceProps } from "fluidkit";
import { PageLayout, Stage, Controls, Toggle, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

type LiquidMaterial = NonNullable<MorphSurfaceProps["material"]>;
type Anchor = NonNullable<MorphSurfaceProps["anchor"]>;
type Absorption = NonNullable<MorphSurfaceProps["absorption"]>;

const MATERIALS: LiquidMaterial[] = ["glass", "mercury", "flat"];
const ANCHORS: Anchor[] = ["center", "top"];
const ABSORPTIONS: Absorption[] = ["shrink", "pull"];

const SPRING_PRESETS = {
  standard: { stiffness: 240, damping: 24 },
  taut: { stiffness: 280, damping: 32 },
  calm: { stiffness: 190, damping: 26 },
  wobbly: { stiffness: 170, damping: 15 },
};
type SpringPreset = keyof typeof SPRING_PRESETS;
const SPRING_NAMES = Object.keys(SPRING_PRESETS) as SpringPreset[];

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
  const [anchor, setAnchor] = useState<Anchor>("center");
  const [absorption, setAbsorption] = useState<Absorption>("shrink");
  const [spring, setSpring] = useState<SpringPreset>("standard");

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
              anchor={anchor}
              absorption={absorption}
              bodySpring={SPRING_PRESETS[spring]}
              closedContent={<PillFace />}
              openContent={<PanelFace />}
            />
          </Stage>
          <Controls>
            <Seg label="material" value={material} set={setMaterial} options={MATERIALS} />
            <Seg label="anchor" value={anchor} set={setAnchor} options={ANCHORS} />
            <Seg label="absorption" value={absorption} set={setAbsorption} options={ABSORPTIONS} />
            <Seg label="spring" value={spring} set={setSpring} options={SPRING_NAMES} />
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
  material="${material}"${anchor !== "center" ? `\n  anchor="${anchor}"` : ""}${absorption !== "shrink" ? `\n  absorption="${absorption}"` : ""}${spring !== "standard" ? `\n  bodySpring={{ stiffness: ${SPRING_PRESETS[spring].stiffness}, damping: ${SPRING_PRESETS[spring].damping} }}` : ""}${refraction ? "\n  refraction" : ""}
  closedContent={<PillFace />}
  openContent={<PanelFace />}
/>`} />
      }
    />
  );
}
