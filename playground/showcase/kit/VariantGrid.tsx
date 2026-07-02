import type { ReactNode } from "react";
import { Stage } from "./Stage";

/** Responsive grid of variant cells for at-a-glance prop-permutation comparison. */
export function VariantGrid({ children }: { children: ReactNode }) {
  return <div className="sc-variant-grid">{children}</div>;
}

/** One labeled cell: a mini stage surface (same wall/hint/onClick treatment as the hero) plus a caption. */
export function VariantCell({ label, wall, hint, onClick, children }: {
  label: string; wall?: boolean; hint?: string; onClick?: () => void; children: ReactNode;
}) {
  return (
    <div className="sc-variant-cell">
      <Stage mini wall={wall} hint={hint} onClick={onClick}>{children}</Stage>
      <div className="sc-variant-caption">{label}</div>
    </div>
  );
}
