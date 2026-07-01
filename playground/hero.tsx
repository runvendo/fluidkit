import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "motion/react";
import { useMorph, useGoo, FlowStagger, ThinkingBlob, Ripple } from "../src/index";

/* Vibrant direction, "extreme" fluid morph.
 *
 * The surface is a LIQUID MASS: a main body blob plus satellite blobs, all the
 * same saturated fill, fused by the goo filter so their edges merge and detach
 * like mercury. The body morphs size (useMorph -> Motion layout) with an
 * underdamped spring (overshoot), while an 8-value border-radius and the
 * satellites animate on several different periods so it never looks periodic
 * and is never a crisp rectangle. Text is a separate crisp layer on top. */

const BLOB_RADII = [
  "38% 62% 63% 37% / 41% 44% 56% 59%",
  "62% 38% 41% 59% / 59% 56% 44% 41%",
  "45% 55% 52% 48% / 63% 38% 62% 37%",
  "55% 45% 57% 43% / 38% 63% 37% 62%",
];

const FILL = "linear-gradient(150deg, #ff6ec4 0%, #7b5cff 55%, #33d9c9 120%)";
const SPRING = { type: "spring" as const, stiffness: 230, damping: 15, mass: 1.15 };

function Satellite({
  cx, cy, size, dx, dy, dur, delay,
}: { cx: number; cy: number; size: number; dx: number; dy: number; dur: number; delay: number }) {
  return (
    <motion.div
      style={{
        position: "absolute", left: cx, top: cy, width: size, height: size,
        marginLeft: -size / 2, marginTop: -size / 2, borderRadius: "50%", background: FILL,
      }}
      animate={{ x: [0, dx, 0], y: [0, dy, 0], scale: [1, 1.15, 0.9, 1] }}
      transition={{ duration: dur, delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    />
  );
}

function AssistantPanel() {
  const [open, setOpen] = useState(true);
  const [thinking, setThinking] = useState(true);
  const { surfaceProps, contentProps, prefersReducedMotion } = useMorph({ open, transition: SPRING });
  const { key: contentKey, ...restContent } = contentProps;
  const goo = useGoo();

  useEffect(() => {
    const t = setTimeout(() => setThinking(false), 2800);
    return () => clearTimeout(t);
  }, [open]);

  const W = open ? 372 : 210;
  const H = open ? 300 : 56;

  return (
    <div style={{ position: "relative", width: W, height: H, transition: "width .55s cubic-bezier(.34,1.3,.4,1), height .55s cubic-bezier(.34,1.3,.4,1)" }}>
      {/* LIQUID MASS (goo-fused, morphs). No text here. */}
      <div style={{ position: "absolute", inset: -40, ...goo.style }}>
        <div style={{ position: "absolute", inset: 40 }}>
          {/* body */}
          <motion.div
            {...surfaceProps}
            style={{ position: "absolute", inset: 0, background: FILL, borderRadius: 32, boxShadow: "0 30px 80px rgba(60,10,90,.45)" }}
            animate={prefersReducedMotion ? {} : { borderRadius: BLOB_RADII }}
            transition={{ ...SPRING, borderRadius: { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } }}
          />
          {/* satellites merge/detach on the edges (mercury) */}
          {open && !prefersReducedMotion && (
            <>
              <Satellite cx={W * 0.16} cy={H * 0.12} size={78} dx={-34} dy={-22} dur={5.2} delay={0} />
              <Satellite cx={W * 0.9} cy={H * 0.28} size={64} dx={30} dy={18} dur={6.1} delay={0.6} />
              <Satellite cx={W * 0.82} cy={H * 0.92} size={70} dx={26} dy={30} dur={5.7} delay={0.3} />
              <Satellite cx={W * 0.1} cy={H * 0.8} size={58} dx={-28} dy={26} dur={6.6} delay={0.9} />
            </>
          )}
        </div>
      </div>

      {/* CONTENT (crisp, only cross-fades) */}
      <div style={{ position: "absolute", inset: 0, padding: 22, color: "#fff" }}>
        <motion.div key={contentKey} {...restContent}>
          {open ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,.9)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)" }} />
                <div style={{ fontWeight: 650, fontSize: 14, textShadow: "0 1px 8px rgba(60,10,90,.4)" }}>Assistant</div>
              </div>
              <FlowStagger style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 132 }}>
                <div key="u" style={{ alignSelf: "flex-end", maxWidth: "78%", padding: "9px 13px", borderRadius: "15px 15px 5px 15px", background: "rgba(255,255,255,.92)", color: "#3a1140", fontSize: 13, fontWeight: 600 }}>
                  Move $500 to savings
                </div>
                <div key="a" style={{ alignSelf: "flex-start", maxWidth: "90%", fontSize: 13, lineHeight: 1.55, textShadow: "0 1px 8px rgba(60,10,90,.35)" }}>
                  Done, scheduled for tomorrow. Want a reminder the day it clears?
                </div>
                {thinking ? (
                  <div key="t" style={{ alignSelf: "flex-start" }}><ThinkingBlob size={17} color="#fff" /></div>
                ) : (
                  <div key="a2" style={{ alignSelf: "flex-start", maxWidth: "90%", fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,.82)", textShadow: "0 1px 8px rgba(60,10,90,.3)" }}>
                    You spent $142.97 on subscriptions in May.
                  </div>
                )}
              </FlowStagger>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 14px", borderRadius: 16, background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)" }}>
                <div style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,.8)" }}>Ask for a change</div>
                <Ripple color="#3a1140" onClick={() => setThinking(true)} style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", color: "#3a1140", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>↑</Ripple>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 9, height: "100%", paddingLeft: 8, fontWeight: 650, fontSize: 13, whiteSpace: "nowrap", color: "#fff" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#fff" }} />
              Ask fluidkit
            </div>
          )}
        </motion.div>
      </div>

      <button onClick={() => setOpen((v) => !v)} style={{ position: "absolute", left: 0, bottom: -42, font: "inherit", fontSize: 11.5, background: "rgba(255,255,255,.16)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Toggle morph</button>
    </div>
  );
}

function App() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "conic-gradient(from 210deg at 35% 25%, #7c5cff, #ff5aa8, #ff9a5a, #2ad6c0, #7c5cff)" }}>
      <AssistantPanel />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
