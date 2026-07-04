import { useEffect, useState } from "react";
import { LiquidButton, MorphSurface } from "fluidkit";

/**
 * Dynamic Island — a workout-timer live activity. The island is one
 * MorphSurface: a flat black pill that liquid-morphs into the expanded
 * card. Tap to toggle; the controls are LiquidButtons.
 */
const pad = (n: number) => String(n).padStart(2, "0");

export function DynamicIsland() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(8 * 60 + 24);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const time = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

  return (
    <MorphSurface
      open={open}
      onClick={() => setOpen((v) => !v)}
      material="flat"
      color="#0c0d12"
      satellites={false}
      closedSize={{ width: 132, height: 36 }}
      openSize={{ width: 252, height: 132 }}
      radius={34}
      style={{
        position: "absolute",
        left: "50%",
        top: -56,
        transform: `translateX(-50%) translateY(${open ? 44 : 0}px)`,
        transition: "transform 0.55s cubic-bezier(.34,1.3,.64,1)",
        cursor: "pointer",
      }}
      closedContent={
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 12.5, fontWeight: 650 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158" }} />
          Timer
          <span style={{ color: "#30d158", fontVariantNumeric: "tabular-nums" }}>{time}</span>
        </div>
      }
      openContent={
        <div style={{ width: "100%", height: "100%", padding: "16px 20px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 650, color: "#9a9aa3" }}>Workout Timer</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: running ? "#30d158" : "#ff9f0a" }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {time}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <LiquidButton
              material="flat"
              color="#2c2e38"
              width={100}
              height={34}
              onClick={(e) => {
                e.stopPropagation();
                setRunning((v) => !v);
              }}
              style={{ color: "#fff", fontSize: 12.5, fontWeight: 650 }}
            >
              {running ? "Pause" : "Resume"}
            </LiquidButton>
            <LiquidButton
              material="flat"
              color="#e0483f"
              width={72}
              height={34}
              onClick={(e) => {
                e.stopPropagation();
                setRunning(false);
                setSeconds(0);
                setOpen(false);
              }}
              style={{ color: "#fff", fontSize: 12.5, fontWeight: 650 }}
            >
              End
            </LiquidButton>
          </div>
        </div>
      }
    />
  );
}
