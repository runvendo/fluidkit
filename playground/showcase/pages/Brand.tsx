import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  GlassPanes,
  LiquidCard,
  LiquidSwitch,
  LiquidTabs,
  MeshGradient,
  MorphSurface,
  Thinking,
} from "fluidkit";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
const LOOP_MS = 8000;
const TAB_SEQUENCE = ["home", "docs", "about", "docs"];
const MORPH_OPEN_SIZE = { width: 214, height: 156 };

function useLoopClock() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      setElapsed((now - start) % LOOP_MS);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return elapsed;
}

function BrandBackdrop({
  paneCount = 4,
  paneIntensity = 0.45,
}: {
  paneCount?: number;
  paneIntensity?: number;
}) {
  return (
    <>
      <MeshGradient colors={["#96acff", "#ffb69e", "#8cd7ff"]} />
      <GlassPanes
        colors={["#aac2ff", "#cfaaf0"]}
        count={paneCount}
        intensity={paneIntensity}
        speed={0.5}
      />
    </>
  );
}

function Wordmark({
  size,
  taglineSize,
  style,
}: {
  size: number;
  taglineSize: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        ...style,
      }}
    >
      <LiquidCard
        material="glass"
        radius={999}
        padding={0}
        intensity="present"
        style={{ display: "inline-flex", borderRadius: 999 }}
      >
        <span
          style={{
            display: "block",
            padding: "0.35em 1.1em",
            fontFamily: FONT_STACK,
            fontSize: size,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "#14151A",
            whiteSpace: "nowrap",
          }}
        >
          fluidkit
        </span>
      </LiquidCard>
      <div
        style={{
          marginTop: Math.round(taglineSize * 0.85),
          fontFamily: FONT_STACK,
          fontSize: taglineSize,
          fontWeight: 500,
          lineHeight: 1.2,
          color: "rgba(20, 21, 26, 0.6)",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        Liquid UI animations for React
      </div>
    </div>
  );
}

function Stage({
  id,
  width,
  height,
  children,
}: {
  id: string;
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background:
          "linear-gradient(135deg, #f7f6f3 0%, #edeaf5 55%, #e5edf3 100%)",
      }}
    >
      {children}
    </section>
  );
}

function ChatPanel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 14,
        fontFamily: FONT_STACK,
        color: "#14151A",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Assistant</div>
      <div style={chatLineStyle}>Try a glass tab strip</div>
      <div style={{ ...chatLineStyle, marginLeft: "auto", background: "#14151A", color: "#fff" }}>
        Morph it open
      </div>
      <div style={chatLineStyle}>Ready.</div>
    </div>
  );
}

const chatLineStyle: CSSProperties = {
  width: "72%",
  marginTop: 7,
  padding: "7px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.66)",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.25,
};

function Vignette({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      style={{
        width: 220,
        height: 260,
        display: "grid",
        gridTemplateRows: "1fr auto",
        justifyItems: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 208,
          display: "grid",
          placeItems: "center",
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontFamily: FONT_STACK,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          color: "rgba(20, 21, 26, 0.45)",
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function MorphVignette({ open }: { open: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        width: MORPH_OPEN_SIZE.width,
        height: MORPH_OPEN_SIZE.height,
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <MorphSurface
          open={open}
          material="glass"
          closedSize={{ width: 154, height: 46 }}
          openSize={MORPH_OPEN_SIZE}
          closedContent={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontFamily: FONT_STACK,
                fontSize: 13,
                fontWeight: 700,
                color: "#14151A",
              }}
            >
              Ask fluidkit
            </div>
          }
          openContent={<ChatPanel />}
        />
      </div>
    </div>
  );
}

function ReelStage() {
  const elapsed = useLoopClock();
  const phase = elapsed % LOOP_MS;
  const activeTab = TAB_SEQUENCE[Math.floor(phase / 2000)] ?? "home";
  const morphOpen = phase >= 4000;
  const switchOn = (phase >= 2000 && phase < 4000) || phase >= 6000;

  return (
    <Stage id="stage-reel" width={1200} height={480}>
      <BrandBackdrop paneCount={3} paneIntensity={0.3} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 80,
        }}
      >
        <Vignette label="MorphSurface">
          <MorphVignette open={morphOpen} />
        </Vignette>
        <Vignette label="LiquidTabs">
          <LiquidTabs
            value={activeTab}
            material="glass"
            flow="slide"
            size="md"
            reflection
            tint="rgba(255,255,255,0.48)"
            activeLabelColor="#14151A"
            items={[
              { id: "home", label: "Home" },
              { id: "docs", label: "Docs" },
              { id: "about", label: "About" },
            ]}
          />
        </Vignette>
        <Vignette label="LiquidSwitch">
          <LiquidSwitch
            checked={switchOn}
            onCheckedChange={() => undefined}
            aria-label="Reel toggle"
            size={38}
            material="glass"
            checkedTint="rgba(150, 172, 255, 0.5)"
          />
        </Vignette>
        <Vignette label="Thinking">
          <Thinking size={34} material="glass" label="Thinking" />
        </Vignette>
      </div>
    </Stage>
  );
}

export default function BrandPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "max-content",
        minWidth: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        padding: 40,
        background: "#fff",
      }}
    >
      <Stage id="stage-banner" width={1600} height={400}>
        <BrandBackdrop />
        <Wordmark
          size={72}
          taglineSize={20}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 48,
            transform: "translateX(-50%)",
          }}
        />
      </Stage>
      <Stage id="stage-social" width={1280} height={640}>
        <BrandBackdrop />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "80%",
            height: "100%",
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Wordmark size={110} taglineSize={24} />
        </div>
      </Stage>
      <ReelStage />
    </main>
  );
}
