import { useState } from "react";
import { FlowStagger, LiquidTabs } from "fluidkit";

/**
 * Liquid Dock — a mobile tab bar where the active pill is engine mass:
 * it drains from the old tab, flies across a tension bridge, and snaps
 * into the new one. The page content re-enters through FlowStagger.
 */
function Icon({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d={d} />
    </svg>
  );
}

const TABS = [
  { id: "home", label: <Icon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { id: "search", label: <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-3.8-3.8" /> },
  { id: "library", label: <Icon d="M4 4h6v16H4zM14 4h6v10h-6z" /> },
  { id: "profile", label: <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" /> },
];

const FEED: Record<string, { title: string; rows: string[] }> = {
  home: { title: "Good morning", rows: ["Daily mix ready", "3 new drops from artists you follow", "Continue: Deep Focus"] },
  search: { title: "Search", rows: ["Trending: liquid glass", "Genre: ambient", "Genre: electronic"] },
  library: { title: "Your library", rows: ["Liked songs · 214", "Deep Focus · playlist", "Late Night Drive · playlist"] },
  profile: { title: "Profile", rows: ["Listening stats", "Devices", "Settings"] },
};

export function LiquidDock() {
  const [tab, setTab] = useState("home");
  const feed = FEED[tab];

  return (
    <>
      <div style={{ position: "absolute", inset: "0 0 78px", padding: "58px 20px 0" }}>
        <FlowStagger key={tab} stagger={0.06} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 21, letterSpacing: "-0.02em", color: "#1c1d23" }}>{feed.title}</h3>
          {feed.rows.map((row) => (
            <div key={row} style={{ background: "rgba(255,255,255,.72)", borderRadius: 14, padding: "13px 15px", fontSize: 12.5, color: "#3a3b44", boxShadow: "0 1px 2px rgba(24,25,36,.06)" }}>
              {row}
            </div>
          ))}
        </FlowStagger>
      </div>
      <LiquidTabs
        items={TABS}
        value={tab}
        onChange={setTab}
        color="#23242c"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 16,
          transform: "translateX(-50%)",
          display: "flex",
          gap: 4,
          padding: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,.55)",
          backdropFilter: "blur(14px) saturate(1.6)",
          WebkitBackdropFilter: "blur(14px) saturate(1.6)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 10px 28px rgba(46,44,72,.16)",
        }}
      />
    </>
  );
}
