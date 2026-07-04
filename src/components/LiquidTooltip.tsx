/**
 * A tooltip as a droplet of liquid: the label pill CONDENSES beside the
 * trigger on a spring — engine geometry growing into place, overshoot
 * supplying the settle — with a small tail bead bridged to the pill
 * through the engine's real surface tension, reaching back toward the
 * anchor. The bead overlaps the pill at rest, so the meniscus neck is
 * permanent, not a hover artifact.
 *
 * The label text lives in normal flow ON TOP of the engine subtree (it
 * defines the tooltip's size; a ResizeObserver feeds the geometry), and
 * only ever fades in after the droplet forms — text never scales. The
 * shared rim ring + glow (rim.ts) light the pill's border once at rest.
 *
 * Positioning is plain CSS absolute relative to the trigger wrapper (no
 * portal): fine for stages, cards and toolbars; clipping ancestors with
 * `overflow: hidden` will crop it — a portal variant can come later if
 * needed. Accessibility: the wrapper is described by the label
 * (`role="tooltip"` + `aria-describedby`), focus shows it without delay,
 * Escape dismisses. Reduced motion: no geometry spring — the droplet
 * appears at full size and simply fades.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  TensionField,
  circlePath,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type {
  LiquidBody,
  LiquidMaterial,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { useInView, usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { rimGlowStyle, rimStyle } from "./rim";

export type LiquidTooltipPlacement = "top" | "bottom" | "left" | "right";

export interface LiquidTooltipProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "content"> {
  /** Tooltip label. */
  content: ReactNode;
  /** Which side of the trigger the droplet condenses on. Default `"top"`. */
  placement?: LiquidTooltipPlacement;
  material?: LiquidMaterial;
  tint?: string;
  color?: string;
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"`
   * (0.35) / `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidIntensity;
  /** Scene light in label coordinates; null disables speculars. */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /** Drop shadow under the droplet. Defaults to `true`. */
  shadow?: boolean;
  /** Gap between trigger and droplet in px. Defaults to `6`. */
  gap?: number;
  /** Hover delay before the droplet condenses, ms. Defaults to `100`. */
  delay?: number;
  /**
   * Condense speed multiplier: 1 is the default pace, 2 twice as fast,
   * 0.5 syrupy. Scales the spring uniformly (stiffness by speed², damping
   * by speed) so the motion keeps its character at any pace.
   */
  speed?: number;
  /** The trigger element(s). */
  children: ReactNode;
}

const CONDENSE_SPRING = { stiffness: 260, damping: 20 };
const SETTLE_MS = 800;

/** The condense spring at `speed`: same damping ratio, `speed`× the pace. */
function condenseSpring(speed: number) {
  return {
    stiffness: CONDENSE_SPRING.stiffness * speed * speed,
    damping: CONDENSE_SPRING.damping * speed,
  };
}
/** Canvas margin: room for the tail bead plus spring overshoot. */
const BLEED = 24;
/** Pill corner radius cap (full pill for short labels). */
const RADIUS = 12;
/** Tail bead radius at rest. */
const TAIL_R = 4;

/** Unit vector from the pill center toward the trigger. */
const TOWARD_TRIGGER: Record<LiquidTooltipPlacement, Vec> = {
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

function buildDropletScene(
  f: number,
  labelW: number,
  labelH: number,
  placement: LiquidTooltipPlacement,
  tension: TensionField,
  light: Vec | null,
  intensity: number
): Scene {
  // The pill never collapses fully — the canvas fades out below ~0.3 —
  // so the geometry always has a valid shape.
  const grow = Math.max(f, 0.3);
  const cx = BLEED + labelW / 2;
  const cy = BLEED + labelH / 2;
  const pw = labelW * grow;
  const ph = labelH * grow;
  const rad = Math.min(RADIUS, ph / 2, pw / 2);
  let path = roundRectPath({ x: cx, y: cy }, pw, ph, rad);

  const d = TOWARD_TRIGGER[placement];
  const edge = d.y !== 0 ? ph / 2 : pw / 2;
  // Phantom anchors the bridge to the pill edge; the tail bead sits in
  // DEEP overlap with it (stretch ≈ 0.7 at rest), so the neck is short
  // and chunky — a bead clinging to the pill, not a stretched filament.
  const phantom: LiquidBody = {
    id: "pill-edge",
    x: cx + d.x * (edge - 6),
    y: cy + d.y * (edge - 6),
    r: 8 * grow,
  };
  const tail: LiquidBody = {
    id: "tail",
    x: cx + d.x * (edge + 2.5 * f),
    y: cy + d.y * (edge + 2.5 * f),
    r: TAIL_R * f,
  };
  if (tail.r > 0.5) {
    path += circlePath(tail, tail.r);
    path += tension.bridges([phantom, tail]);
  }

  const speculars: SpecularSpot[] = [];
  if (light) {
    speculars.push(
      specularPlacement(
        { x: cx, y: cy, r: Math.min(pw, ph) * 0.48 },
        light,
        0.4 * intensity
      )
    );
    if (tail.r > 1.5) {
      speculars.push(specularPlacement(tail, light, 0.5 * intensity));
    }
  }
  return { path, speculars };
}

/** Container position beside the trigger, per placement. */
function placementStyle(
  placement: LiquidTooltipPlacement,
  gap: number
): CSSProperties {
  switch (placement) {
    case "top":
      return { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: gap };
    case "bottom":
      return { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: gap };
    case "left":
      return { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: gap };
    case "right":
      return { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: gap };
  }
}

export function LiquidTooltip({
  content,
  placement = "top",
  material = "glass",
  tint,
  color,
  intensity = "whisper",
  light,
  reflection = true,
  shadow = true,
  gap = 6,
  delay = 100,
  speed = 1,
  children,
  className,
  style,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: LiquidTooltipProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { ref: inViewRef, inView } = useInView<HTMLSpanElement>();
  const animating = !prefersReducedMotion && inView;
  const labelId = useId();

  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (immediate = false) => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (immediate || delay <= 0) setVisible(true);
    else showTimer.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    setVisible(false);
  };
  useEffect(
    () => () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    },
    []
  );

  // The label defines the droplet's size.
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) => {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const volume = resolveIntensity(intensity);

  // Consumer light arrives in label coordinates; the canvas is inset by
  // the bleed.
  const sceneLight = useMemo(() => {
    if (!reflection || light === null || !size) return null;
    return light
      ? { x: light.x + BLEED, y: light.y + BLEED }
      : defaultLight(size.w + BLEED * 2, size.h + BLEED * 2);
  }, [reflection, light, size]);

  const springs = useMotionSprings(1, () => (visible ? 1 : 0), CONDENSE_SPRING);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tension = useRef(new TensionField());

  const pace = Math.max(speed, 0.1);
  const prevVisible = useRef(visible);
  useEffect(() => {
    if (prevVisible.current !== visible) {
      if (animating) {
        springs.setTargets([visible ? 1 : 0], condenseSpring(pace));
        setSettling(true);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(
          () => setSettling(false),
          SETTLE_MS / pace
        );
      } else {
        springs.snapTo([visible ? 1 : 0]);
      }
    }
    prevVisible.current = visible;
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, animating]);

  useEffect(() => {
    if (!animating) setSettling(false);
  }, [animating]);

  const staticScene = useMemo(
    () =>
      size
        ? buildDropletScene(
            visible ? 1 : 0,
            size.w,
            size.h,
            placement,
            new TensionField(),
            resolved.specular ? sceneLight : null,
            volume
          )
        : null,
    [size, visible, placement, resolved.specular, sceneLight, volume]
  );

  const renderer = useRef<LiquidSceneHandle>(null);
  useEffect(() => {
    if (!(animating && settling) && staticScene)
      renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling || !size) return;
    renderer.current?.setScene(
      buildDropletScene(
        springs.values[0].get(),
        size.w,
        size.h,
        placement,
        tension.current,
        resolved.specular ? sceneLight : null,
        volume
      )
    );
  });

  // Droplet fade: quick, so the condensing geometry (not opacity) reads
  // as the show animation; label text waits a beat longer.
  const dropletStyle: CSSProperties = {
    position: "absolute",
    ...placementStyle(placement, gap),
    opacity: visible ? 1 : 0,
    visibility: !visible && !settling ? "hidden" : undefined,
    transition: "opacity 0.15s ease",
    pointerEvents: "none",
  };
  const labelStyle: CSSProperties = {
    position: "relative",
    display: "inline-block",
    padding: "7px 11px",
    fontSize: 12.5,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    color: "#23242c",
    opacity: visible ? 1 : 0,
    transition: visible
      ? "opacity 0.2s ease 0.1s"
      : "opacity 0.1s ease",
  };

  return (
    <span
      ref={inViewRef}
      className={className}
      style={{ position: "relative", display: "inline-block", ...style }}
      data-fluidkit="liquid-tooltip"
      data-state={visible ? "open" : "closed"}
      data-animating={animating && settling}
      aria-describedby={visible ? labelId : undefined}
      onPointerEnter={(e) => {
        show();
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        hide();
        onPointerLeave?.(e);
      }}
      onFocus={(e) => {
        show(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        hide();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
        onKeyDown?.(e);
      }}
      {...rest}
    >
      {children}
      <span data-fluidkit="liquid-tooltip-droplet" style={dropletStyle}>
        {/* Engine canvas, bled past the label for tail + overshoot. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -BLEED,
            display: "block",
          }}
        >
          {staticScene && (
            <LiquidRenderer
              ref={renderer}
              path={staticScene.path}
              material={resolved}
              speculars={staticScene.speculars}
              specularSlots={resolved.specular && sceneLight ? 2 : 0}
              shadow={shadow}
            />
          )}
        </span>
        {size && resolved.specular && sceneLight && volume > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              opacity: visible ? 1 : 0,
              transition: visible
                ? "opacity 0.2s ease 0.1s"
                : "opacity 0.1s ease",
            }}
          >
            <span
              data-fluidkit="liquid-tooltip-glow"
              style={rimGlowStyle(size.w, size.h, RADIUS, volume)}
            />
            <span
              data-fluidkit="liquid-tooltip-rim"
              style={rimStyle(
                size.w,
                size.h,
                RADIUS,
                { x: sceneLight.x - BLEED, y: sceneLight.y - BLEED },
                volume
              )}
            />
          </span>
        )}
        <span ref={labelRef} role="tooltip" id={labelId} style={labelStyle}>
          {content}
        </span>
      </span>
    </span>
  );
}
