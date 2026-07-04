/**
 * A voice-assistant orb: one liquid ball driven by the LIVE AUDIO LEVEL
 * the app feeds it (`level`, 0–1 — from any audio stack; the library
 * takes no microphone dependency) and a `mode` describing what the
 * assistant is doing:
 * - "idle": at rest — a slow ambient breathe (±2.5%, ~4s), level
 *   ignored. Alive, not attention-seeking.
 * - "listening": attentive — a quicker breathe plus a half-gain response
 *   to the level (the USER's voice rippling the surface). No satellites.
 * - "speaking": full output — the radius swells with the level, the edge
 *   undulates on two sine harmonics, and at speech peaks two satellite
 *   beads surface beside the ball, fused back through the engine's real
 *   surface-tension bridges.
 *
 * The level is smoothed inside the render loop (exponential approach),
 * so a raw, jittery analyser signal still reads as one body of liquid;
 * consumers can update `level` every frame — it lands in a ref, so no
 * React re-render is required for the ball to follow it.
 *
 * A continuous looper like `Droplets`/`Thinking`: the rAF loop runs only
 * while in view; off-screen it pauses. Reduced motion: no loop at all —
 * a static circle whose radius still reflects the current level. All
 * phases are deterministic functions of elapsed time (no randomness).
 * Decorative by default — pass `aria-label` if it should be announced.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  specularPlacement,
} from "../liquid";
import type {
  LiquidBody,
  LiquidMaterial,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useInView, usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { rimGlowStyle, rimStyle } from "./rim";

export type VoiceBallMode = "idle" | "listening" | "speaking";

export interface VoiceBallProps extends HTMLAttributes<HTMLDivElement> {
  /** Live audio level, 0–1. The ball smooths it internally. Default `0`. */
  level?: number;
  /** What the assistant is doing. Defaults to `"idle"`. */
  mode?: VoiceBallMode;
  /** Ball diameter at rest, px. Defaults to `96`. */
  size?: number;
  material?: LiquidMaterial;
  /** Glass tint (any CSS color, normally translucent). */
  tint?: string;
  color?: string;
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"`
   * (0.35) / `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidIntensity;
  /** Scene light in ball coordinates; null disables speculars. */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /** Drop shadow under the ball. Defaults to `true`. */
  shadow?: boolean;
}

/** Edge undulation amplitude at rest. */
const WOBBLE_IDLE = 0.012;
/** Per-frame smoothing factor for the incoming level (exponential). */
const SMOOTHING = 0.12;
/** Satellites surface above this smoothed level (speaking only). */
const SAT_THRESHOLD = 0.35;
/** Canvas margin: room for swell, wobble and satellites. */
const BLEED_FACTOR = 0.55;

interface ModeCharacter {
  /** Radius gain at full level. */
  swell: number;
  /** Ambient breathe: amplitude (fraction of radius) and angular speed. */
  breatheAmp: number;
  breatheSpeed: number;
  /** Edge undulation at full level (eases up from WOBBLE_IDLE). */
  wobbleFull: number;
  /** Time multiplier for the undulation harmonics (1 = ambient pace). */
  tempo: number;
  /** Per-frame level smoothing — higher tracks transients more eagerly. */
  smoothing: number;
  /** Whether satellite beads may surface at peaks. */
  satellites: boolean;
}

const MODE_CHARACTER: Record<VoiceBallMode, ModeCharacter> = {
  idle: {
    swell: 0,
    breatheAmp: 0.025,
    breatheSpeed: 0.0016,
    wobbleFull: WOBBLE_IDLE,
    tempo: 1,
    smoothing: SMOOTHING,
    satellites: false,
  },
  listening: {
    swell: 0.08,
    breatheAmp: 0.04,
    breatheSpeed: 0.0028,
    wobbleFull: 0.03,
    tempo: 1.3,
    smoothing: SMOOTHING,
    satellites: false,
  },
  // Speaking is the energetic one: deeper swell, stronger and quicker
  // undulation, eager level tracking so syllables punch through.
  speaking: {
    swell: 0.22,
    breatheAmp: 0,
    breatheSpeed: 0,
    wobbleFull: 0.085,
    tempo: 2.4,
    smoothing: 0.22,
    satellites: true,
  },
};

/** Blob outline: a circle of `points` samples, each radius modulated by
 * two slow sine harmonics, joined with smooth quadratic segments through
 * midpoints. Deterministic in (r, t, wobble). */
function blobPath(
  cx: number,
  cy: number,
  r: number,
  t: number,
  wobble: number,
  points = 20
): string {
  const pts: Vec[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rad =
      r *
      (1 +
        wobble * Math.sin(2 * a + t * 0.0011) +
        wobble * 0.7 * Math.sin(3 * a - t * 0.0017 + 1.7));
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  const mid = (a: Vec, b: Vec) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = "";
  for (let i = 0; i < points; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % points];
    const m = mid(p, next);
    if (i === 0) {
      const m0 = mid(pts[points - 1], p);
      d += `M ${m0.x.toFixed(2)} ${m0.y.toFixed(2)} `;
    }
    d += `Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)} `;
  }
  return d + "Z";
}

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildBallScene(
  smoothed: number,
  t: number,
  cx: number,
  cy: number,
  baseR: number,
  character: ModeCharacter,
  tension: TensionField | null,
  light: Vec | null,
  intensity: number
): Scene {
  const breathe = character.breatheAmp * Math.sin(t * character.breatheSpeed);
  const r = baseR * (1 + character.swell * smoothed + breathe);
  const wobble =
    WOBBLE_IDLE + (character.wobbleFull - WOBBLE_IDLE) * smoothed;
  let path = blobPath(cx, cy, r, t * character.tempo, wobble);

  const speculars: SpecularSpot[] = [];
  const ball: LiquidBody = { id: "ball", x: cx, y: cy, r };
  if (light) speculars.push(specularPlacement(ball, light, 0.5 * intensity));

  // Satellite beads surface at speech peaks and stay fused to the ball.
  const surface = character.satellites
    ? Math.max(0, (smoothed - SAT_THRESHOLD) / (1 - SAT_THRESHOLD))
    : 0;
  if (surface > 0.02) {
    const sats: LiquidBody[] = [0, 1].map((i) => {
      const dir = i === 0 ? 1 : -1;
      const angle = dir * (t * 0.00035 + i * 2.4);
      const dist = r * (1.02 + 0.18 * surface + 0.06 * Math.sin(t * 0.0019 + i * 3));
      return {
        id: `sat${i}`,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r: baseR * 0.16 * surface,
      };
    });
    for (const sat of sats) {
      if (sat.r <= 0.5) continue;
      path += circlePath(sat, sat.r);
      if (light) speculars.push(specularPlacement(sat, light, 0.4 * intensity));
    }
    if (tension) path += tension.bridges([ball, ...sats]);
  }
  return { path, speculars };
}

export function VoiceBall({
  level = 0,
  mode = "idle",
  size = 96,
  material = "glass",
  tint,
  color,
  intensity = "whisper",
  light,
  reflection = true,
  shadow = true,
  className,
  style,
  ...rest
}: VoiceBallProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const animating = !prefersReducedMotion && inView;

  const baseR = size / 2;
  const bleed = Math.ceil(baseR * BLEED_FACTOR);
  const canvas = size + bleed * 2;
  const cx = canvas / 2;
  const cy = canvas / 2;

  // The live level lands in a ref so 60fps updates cost nothing extra.
  const levelRef = useRef(0);
  levelRef.current = Math.min(Math.max(level, 0), 1);
  const smoothedRef = useRef(0);

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const volume = resolveIntensity(intensity);
  const sceneLight = useMemo(() => {
    if (!reflection || light === null) return null;
    return light
      ? { x: light.x + bleed, y: light.y + bleed }
      : defaultLight(canvas, canvas);
  }, [reflection, light, bleed, canvas]);

  const tension = useRef(new TensionField());
  const renderer = useRef<LiquidSceneHandle>(null);

  const character = MODE_CHARACTER[mode];

  // Static scene: reduced motion / off-screen / SSR. A plain circle at
  // the current level's size — no wobble, no satellites.
  const staticScene = useMemo<Scene>(() => {
    const r = baseR * (1 + character.swell * levelRef.current);
    const ball: LiquidBody = { id: "ball", x: cx, y: cy, r };
    return {
      path: circlePath(ball, r),
      speculars:
        resolved.specular && sceneLight
          ? [specularPlacement(ball, sceneLight, 0.5 * volume)]
          : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseR, cx, cy, level, character, resolved.specular, sceneLight, volume]);

  useEffect(() => {
    if (!animating) renderer.current?.setScene(staticScene);
  }, [animating, staticScene]);

  useAnimationFrame((t) => {
    if (!animating) return;
    smoothedRef.current +=
      (levelRef.current - smoothedRef.current) * character.smoothing;
    renderer.current?.setScene(
      buildBallScene(
        smoothedRef.current,
        t,
        cx,
        cy,
        baseR,
        character,
        tension.current,
        resolved.specular ? sceneLight : null,
        volume
      )
    );
  });

  const ballStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    display: "inline-block",
    ...style,
  };

  return (
    <div
      ref={ref}
      className={className}
      style={ballStyle}
      data-fluidkit="voice-ball"
      data-mode={mode}
      data-level={levelRef.current.toFixed(2)}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: -bleed,
          display: "block",
          pointerEvents: "none",
        }}
      >
        <LiquidRenderer
          ref={renderer}
          path={staticScene.path}
          material={resolved}
          speculars={staticScene.speculars}
          specularSlots={resolved.specular && sceneLight ? 3 : 0}
          shadow={shadow}
        />
      </span>
      {resolved.specular && sceneLight && volume > 0 && (
        <span
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}
        >
          <span
            data-fluidkit="voice-ball-glow"
            style={rimGlowStyle(size, size, baseR, volume)}
          />
          <span
            data-fluidkit="voice-ball-rim"
            style={rimStyle(
              size,
              size,
              baseR,
              { x: sceneLight.x - bleed, y: sceneLight.y - bleed },
              volume
            )}
          />
        </span>
      )}
    </div>
  );
}
