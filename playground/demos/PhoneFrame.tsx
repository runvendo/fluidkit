import type { CSSProperties, ReactNode } from "react";

/**
 * Site chrome (not a fluidkit component): an iPhone-style shell the
 * showcase recipes run inside. The screen is a positioned, clipped canvas
 * so demos can pin content to its edges.
 */
export function PhoneFrame({ children, screenStyle }: {
  children: ReactNode;
  screenStyle?: CSSProperties;
}) {
  return (
    <div className="phone-shell">
      <div className="phone-screen" style={screenStyle}>{children}</div>
    </div>
  );
}
