import { useEffect, useState } from "react";
import { JellyButton, MorphSurface } from "fluidkit";

/**
 * Liquid Music Player — a now-playing mini-pill that liquid-morphs into
 * the full player sheet. One MorphSurface in glass over the wallpaper;
 * the play/pause control is a JellyButton.
 */
export function MusicPlayer() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(32);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress((p) => (p + 0.4) % 100), 300);
    return () => clearInterval(id);
  }, [playing]);

  const eqBar = (delay: string, height: number) => (
    <span
      className="fk-eq"
      style={{
        width: 3,
        height,
        borderRadius: 2,
        background: "#4a6cf7",
        animationDelay: delay,
        animationPlayState: playing ? "running" : "paused",
      }}
    />
  );

  return (
    <>
      <style>{`
        .fk-eq { display: inline-block; transform-origin: bottom; animation: fk-eq .9s ease-in-out infinite alternate; }
        @keyframes fk-eq { from { transform: scaleY(.35); } to { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .fk-eq { animation: none; } }
      `}</style>
      <MorphSurface
        open={open}
        onClick={open ? undefined : () => setOpen(true)}
        material="glass"
        satellites={false}
        closedSize={{ width: 218, height: 44 }}
        openSize={{ width: 252, height: 236 }}
        radius={26}
        style={{
          position: "absolute",
          left: "50%",
          top: 330,
          transform: `translateX(-50%) translateY(${open ? 0 : 96}px)`,
          transition: "transform 0.55s cubic-bezier(.34,1.3,.64,1)",
          cursor: open ? "default" : "pointer",
        }}
        closedContent={
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#23242c", fontSize: 12.5, fontWeight: 650, whiteSpace: "nowrap" }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: "linear-gradient(135deg, #ff8ccb, #7c9bff)" }} />
            Solar Waves
            <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
              {eqBar("0s", 14)}
              {eqBar("-.3s", 10)}
              {eqBar("-.6s", 13)}
            </span>
          </div>
        }
        openContent={
          <div style={{ width: "100%", height: "100%", padding: "18px 20px", color: "#23242c", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ width: 92, height: 92, borderRadius: 18, background: "linear-gradient(135deg, #ff8ccb, #7c9bff)", boxShadow: "0 8px 20px rgba(124,110,255,.35)" }} />
              <button
                aria-label="Collapse player"
                onClick={() => setOpen(false)}
                style={{ border: 0, background: "rgba(35,36,44,.08)", borderRadius: 999, width: 26, height: 26, cursor: "pointer", color: "#3a3b44", fontSize: 12 }}
              >
                ▾
              </button>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Solar Waves</div>
              <div style={{ fontSize: 12, color: "#6b6c75" }}>Aqua Drift</div>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(35,36,44,.12)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, borderRadius: 3, background: "#4a6cf7" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <button aria-label="Previous" style={{ border: 0, background: "none", fontSize: 15, color: "#3a3b44", cursor: "pointer" }}>⏮</button>
              <JellyButton
                material="flat"
                color="#23242c"
                width={62}
                height={40}
                onClick={() => setPlaying((v) => !v)}
                style={{ color: "#fff", fontSize: 13 }}
              >
                {playing ? "❚❚" : "►"}
              </JellyButton>
              <button aria-label="Next" style={{ border: 0, background: "none", fontSize: 15, color: "#3a3b44", cursor: "pointer" }}>⏭</button>
            </div>
          </div>
        }
      />
    </>
  );
}
