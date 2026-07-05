import type { CSSProperties, ReactNode } from "react";
import { PageLayout, Snippet } from "../kit";
import { PhoneFrame } from "../../demos/PhoneFrame";
import { DynamicIsland } from "../../demos/DynamicIsland";
import { MusicPlayer } from "../../demos/MusicPlayer";
import { LiquidDock } from "../../demos/LiquidDock";
import { GooButton } from "../../demos/GooButton";
import dynamicIslandSrc from "../../demos/DynamicIsland.tsx?raw";
import musicPlayerSrc from "../../demos/MusicPlayer.tsx?raw";
import liquidDockSrc from "../../demos/LiquidDock.tsx?raw";
import gooButtonSrc from "../../demos/GooButton.tsx?raw";

function DemoPhone({ title, desc, source, screenStyle, children }: {
  title: string; desc: string; source: string; screenStyle?: CSSProperties; children: ReactNode;
}) {
  return (
    <div className="demo-card">
      <PhoneFrame screenStyle={screenStyle}>{children}</PhoneFrame>
      <div className="demo-meta">
        <h3>{title}</h3>
        <p>{desc}</p>
        <details className="src">
          <summary>view source</summary>
          <Snippet code={source} />
        </details>
      </div>
    </div>
  );
}

/** Lock-screen chrome behind the Dynamic Island (site chrome, not part of the recipe). */
function LockScreen() {
  return (
    <div style={{ position: "absolute", inset: 0, color: "#23242c", textAlign: "center", pointerEvents: "none" }}>
      <div style={{ marginTop: 96, fontSize: 15, fontWeight: 600, opacity: 0.7 }}>Wednesday, July 2</div>
      <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>9:41</div>
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 88, background: "rgba(255,255,255,.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 18, padding: "11px 14px", textAlign: "left", boxShadow: "0 6px 18px rgba(46,44,72,.12)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>Messages</div>
        <div style={{ fontSize: 11.5, color: "#4b4c55" }}>Sam: the island demo is unreal</div>
      </div>
    </div>
  );
}

const WALL_BG = "linear-gradient(160deg, #dbe4ff 0%, #f3e3ff 45%, #ffe9f2 100%)";

export default function Demos() {
  return (
    <PageLayout
      title="Built with fluidkit"
      description={'Real app moments, live in the frame — each composed from the public API. Every "view source" is the exact code running on that phone.'}
      hero={
        <div className="phones">
          <DemoPhone title="Dynamic Island" desc="One MorphSurface: the pill liquid-morphs into a live-activity card; controls are LiquidButtons. Tap it."
            source={dynamicIslandSrc} screenStyle={{ background: WALL_BG }}>
            <LockScreen />
            <DynamicIsland />
          </DemoPhone>
          <DemoPhone title="Liquid Music Player" desc="A now-playing pill morphs into the full player sheet in glass. Play/pause is a LiquidButton."
            source={musicPlayerSrc} screenStyle={{ background: WALL_BG }}>
            <MusicPlayer />
          </DemoPhone>
          <DemoPhone title="Liquid Dock" desc="LiquidTabs as a tab bar: the active pill drains, flies a tension bridge, snaps in. Content re-enters with FlowStagger."
            source={liquidDockSrc}>
            <LiquidDock />
          </DemoPhone>
          <DemoPhone title="Goo Progress Button" desc="LiquidButton squashes on press, Thinking droplets churn while it downloads, the card ripples on tap."
            source={gooButtonSrc} screenStyle={{ background: WALL_BG }}>
            <GooButton />
          </DemoPhone>
        </div>
      }
    />
  );
}
