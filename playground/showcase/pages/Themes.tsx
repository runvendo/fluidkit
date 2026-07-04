import { useState } from "react";
import {
  FluidThemeProvider,
  LiquidButton,
  LiquidCard,
  LiquidTabs,
  MeniscusDivider,
  Thinking,
} from "fluidkit";
import type { FluidTheme } from "fluidkit";
import { PageLayout, Stage, Controls, Seg, Snippet } from "../kit";

/**
 * Three contrasting brands prove the same semantic theme drives coherent,
 * different-looking apps: a chromatic light brand, a monochrome one, and a
 * dark one. Each sets colors only — material/intensity stay per-component
 * unless the knobs below are engaged (the "only set tokens derive" rule).
 */
const BRANDS: Record<string, { theme: FluidTheme; stageBg?: string; ink: string; sub: string }> = {
  Coastal: {
    theme: { accent: "#0A7CFF", surface: "#FFFFFF", text: "#14151A", radius: 14, mode: "light" },
    ink: "#14151A",
    sub: "#5a6070",
  },
  Graphite: {
    theme: { accent: "#1B1C22", surface: "#F4F3F0", text: "#14151A", radius: 8, mode: "light" },
    ink: "#14151A",
    sub: "#6a6b70",
  },
  Nocturne: {
    theme: { accent: "#8B7CFF", surface: "#23242E", text: "#F2F3F7", radius: 18, mode: "dark" },
    stageBg: "linear-gradient(155deg, #17181f 0%, #101116 60%, #1a1523 100%)",
    ink: "#F2F3F7",
    sub: "#9a9db0",
  },
};
type BrandName = keyof typeof BRANDS;

const MATERIAL_OPTIONS = ["theme-off", "glass", "flat"] as const;
const INTENSITY_OPTIONS = ["theme-off", "whisper", "present"] as const;

function BrandScene({ brand }: { brand: BrandName }) {
  const { ink, sub } = BRANDS[brand];
  return (
    <div style={{ display: "grid", gap: 18, justifyItems: "center", padding: "8px 0", color: ink }}>
      <LiquidTabs
        items={[{ id: "overview", label: "Overview" }, { id: "activity", label: "Activity" }, { id: "settings", label: "Settings" }]}
      />
      <LiquidCard>
        <div style={{ maxWidth: 300 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 650, color: ink }}>One theme, every surface</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: sub }}>
            The provider carries semantic tokens; each component derives its own
            tint, fill, and radius from them — nothing is styled per callsite.
          </p>
        </div>
      </LiquidCard>
      <MeniscusDivider />
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <LiquidButton>Continue</LiquidButton>
        <Thinking />
      </div>
    </div>
  );
}

export default function ThemesPage() {
  const [brand, setBrand] = useState<BrandName>("Coastal");
  const [material, setMaterial] = useState<(typeof MATERIAL_OPTIONS)[number]>("theme-off");
  const [intensity, setIntensity] = useState<(typeof INTENSITY_OPTIONS)[number]>("theme-off");

  const { theme, stageBg } = BRANDS[brand];
  const active: FluidTheme = {
    ...theme,
    ...(material === "theme-off" ? {} : { material }),
    ...(intensity === "theme-off" ? {} : { intensity }),
  };

  const snippet = [
    `<FluidThemeProvider theme={${JSON.stringify(active)}}>`,
    "  <LiquidCard>…</LiquidCard>  {/* derives its tint from accent */}",
    "</FluidThemeProvider>",
  ].join("\n");

  return (
    <PageLayout
      title="Themes"
      description="FluidThemeProvider: brand tokens in, coherent liquid surfaces out. Only explicitly-set tokens derive — leave material/intensity off and each component keeps its own character."
      hero={
        <>
          <Stage wall={!stageBg} hint="switch brands — same components, different identity">
            <div style={stageBg ? { background: stageBg, borderRadius: 16, padding: "28px 22px", width: "100%" } : undefined}>
              <FluidThemeProvider theme={active}>
                <BrandScene brand={brand} />
              </FluidThemeProvider>
            </div>
          </Stage>
          <Controls>
            <Seg label="brand" value={brand} set={setBrand} options={Object.keys(BRANDS) as BrandName[]} />
            <Seg label="material" value={material} set={setMaterial} options={[...MATERIAL_OPTIONS]} />
            <Seg label="intensity" value={intensity} set={setIntensity} options={[...INTENSITY_OPTIONS]} />
          </Controls>
        </>
      }
      usage={<Snippet code={snippet} />}
    />
  );
}
