import { useEffect, useRef, useState } from "react";
import { JellyButton, Ripple, Thinking } from "fluidkit";

/**
 * Goo Progress Button — a download flow built from three primitives:
 * JellyButton squashes on press, Thinking droplets churn while the
 * liquid progress track fills, and the whole card is a Ripple surface.
 */
type Phase = "idle" | "working" | "done";

export function GooButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const start = () => {
    if (phase !== "idle") return;
    setPhase("working");
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 1 + Math.random() * 2.4);
        if (next >= 100) {
          clearInterval(timer.current);
          setPhase("done");
          setTimeout(() => {
            setPhase("idle");
            setProgress(0);
          }, 2200);
        }
        return next;
      });
    }, 40);
  };

  return (
    <Ripple
      material="glass"
      duration={700}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: 246,
        borderRadius: 22,
        padding: "22px 22px 24px",
        background: "rgba(255,255,255,.6)",
        backdropFilter: "blur(14px) saturate(1.6)",
        WebkitBackdropFilter: "blur(14px) saturate(1.6)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 12px 30px rgba(46,44,72,.16)",
        color: "#23242c",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #7c9bff, #b98cff)", display: "grid", placeItems: "center", color: "#fff", fontSize: 15, fontWeight: 700 }}>
          zip
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 650 }}>fluidkit-assets.zip</div>
          <div style={{ fontSize: 11.5, color: "#6b6c75", fontVariantNumeric: "tabular-nums" }}>
            {phase === "working" ? `${Math.round(progress)}% of 24.3 MB` : "24.3 MB"}
          </div>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(35,36,44,.1)", marginBottom: 18, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${phase === "done" ? 100 : progress}%`,
            borderRadius: 3,
            background: "linear-gradient(90deg, #4a6cf7, #7c9bff)",
            transition: "width 0.15s linear",
          }}
        />
      </div>
      <JellyButton
        material="flat"
        color={phase === "done" ? "#2fa46a" : "#4a6cf7"}
        width={202}
        height={46}
        onClick={start}
        style={{ display: "block", margin: "0 auto", color: "#fff", fontSize: 13.5, fontWeight: 650, transition: "color .2s" }}
      >
        {phase === "idle" && "Download"}
        {phase === "working" && <Thinking material="flat" color="#fff" size={8} label="Downloading" />}
        {phase === "done" && "Saved ✓"}
      </JellyButton>
    </Ripple>
  );
}
