import type { ReactNode } from "react";

/**
 * The framed demo surface. Hero-sized by default (`.sc-stage-hero`) — it's
 * the page centerpiece; `VariantCell` reuses it at mini size
 * (`.sc-stage-mini`). `wall` adds the gradient wall background plus the
 * three orb decorations; `hint` floats a label over the surface.
 */
export function Stage({ wall, hint, onClick, mini, children }: {
  wall?: boolean; hint?: string; onClick?: () => void; mini?: boolean; children: ReactNode;
}) {
  const cls = `stage ${mini ? "sc-stage-mini" : "sc-stage-hero"}${wall ? " wall" : ""}`;
  return (
    <div className={cls} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      {hint ? <div className="hint">{hint}</div> : null}
      {wall ? <><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /></> : null}
      {children}
    </div>
  );
}
