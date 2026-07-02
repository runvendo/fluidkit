import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { LiquidDrag } from "fluidkit";
import { PageLayout, Stage, Controls, Slider, Seg, Snippet, VariantGrid, VariantCell } from "../kit";

const AXES: ("free" | "x" | "y")[] = ["free", "x", "y"];

/** Shared blob treatment — hero and variants use the same draggable target. */
const BLOB_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: "linear-gradient(160deg, #63dcb9, #4fc9a3)",
  boxShadow: "0 10px 28px rgba(99,220,185,.4)",
};

/**
 * One draggable blob inside its own constraints box. Each instance owns its
 * ref because Motion's `dragConstraints` needs the element the blob is
 * bounded by, and hero/variant cells each have their own surface.
 */
function DragCell({
  elasticity,
  axis,
  inset = 24,
  size = 72,
}: {
  elasticity: number;
  axis?: "x" | "y";
  inset?: number;
  size?: number;
}) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={constraintsRef} style={{ position: "absolute", inset }}>
      <LiquidDrag
        elasticity={elasticity}
        axis={axis}
        dragConstraints={constraintsRef}
        style={{
          width: size,
          height: size,
          margin: "auto",
          position: "absolute",
          inset: 0,
          cursor: "grab",
        }}
      >
        <div style={BLOB_STYLE} />
      </LiquidDrag>
    </div>
  );
}

export default function LiquidDragPage() {
  const [elasticity, setElasticity] = useState(0.4);
  const [axis, setAxis] = useState<"free" | "x" | "y">("free");

  return (
    <PageLayout
      title="LiquidDrag"
      description="Wraps Motion's own drag gesture; velocity feeds a volume-preserving stretch that wobbles back to rest on release."
      hero={
        <>
          <Stage hint="drag the blob">
            <DragCell elasticity={elasticity} axis={axis === "free" ? undefined : axis} />
          </Stage>
          <Controls>
            <Slider label="elasticity" value={elasticity} set={setElasticity} min={0} max={1} step={0.05} />
            <Seg label="axis" value={axis} set={setAxis} options={AXES} />
          </Controls>
        </>
      }
      variants={
        <VariantGrid>
          <VariantCell label="free" hint="drag">
            <DragCell elasticity={0.4} inset={16} size={56} />
          </VariantCell>
          <VariantCell label="x-only" hint="drag sideways">
            <DragCell elasticity={0.4} axis="x" inset={16} size={56} />
          </VariantCell>
          <VariantCell label="y-only" hint="drag vertically">
            <DragCell elasticity={0.4} axis="y" inset={16} size={56} />
          </VariantCell>
          <VariantCell label="extra elastic · 0.9" hint="fling it">
            <DragCell elasticity={0.9} inset={16} size={56} />
          </VariantCell>
        </VariantGrid>
      }
      usage={
        <Snippet
          code={`const bounds = useRef<HTMLDivElement>(null);

<div ref={bounds} className="board">
  <LiquidDrag elasticity={${elasticity}}${axis !== "free" ? ` axis="${axis}"` : ""} dragConstraints={bounds}>
    <Blob />
  </LiquidDrag>
</div>`}
        />
      }
    />
  );
}
