/**
 * A modal dialog on a liquid surface. Opening is a LIQUID MORPH from the
 * trigger: the engine geometry starts at the trigger's own rect — a
 * button-sized pill — and springs up to the centered dialog, width and
 * height expanding on the way with one taut overshoot. Only geometry
 * and translation animate; the content fades in on the unclipped layer
 * above once the surface has (mostly) arrived, never scaling (the
 * library's core principle). The backdrop is shallow water: a faint
 * white tint with a light backdrop blur, so the page underneath looks a
 * hand's depth under the surface.
 *
 * Rendered through a portal to `document.body`, so no ancestor clipping
 * or stacking context can trap it. The dialog box sizes to its content
 * (measured like LiquidCard); the shared rim ring + glow light the
 * border once at rest.
 *
 * The dialog RISES FROM ITS TRIGGER: at open the position of `origin`
 * (or, by default, the element that held focus — the button that was
 * just clicked) is captured, and the box springs from there up to
 * center while the surface pops — translate only, so content moves but
 * never scales. Close drops it back toward the trigger. With no origin
 * to be found it rises from just below center.
 *
 * Behavior: `open` is controlled; Escape and backdrop click call
 * `onClose`. While open, body scroll is locked and focus moves into the
 * dialog (restored on close). Exit keeps the portal mounted briefly so
 * the fade-out can finish. Reduced motion: no pop, no travel — surface
 * and content simply cross-fade.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAnimationFrame } from "motion/react";
import {
  LiquidRenderer,
  defaultLight,
  resolveMaterial,
  roundRectPath,
  specularPlacement,
} from "../liquid";
import type {
  LiquidMaterial,
  LiquidSceneHandle,
  SpecularSpot,
  Vec,
} from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { rimGlowStyle, rimStyle } from "./rim";

export interface LiquidDialogProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  /** Controlled state. */
  open: boolean;
  /** Called on Escape or backdrop click. */
  onClose?: () => void;
  /**
   * Element the dialog rises from. Defaults to the element focused at
   * the moment `open` flips true — normally the trigger button.
   */
  origin?: HTMLElement | null;
  /** Accessible dialog name. */
  "aria-label"?: string;
  material?: LiquidMaterial;
  tint?: string;
  color?: string;
  /**
   * How loudly the material reads: 0–1, or the presets `"whisper"`
   * (0.35) / `"present"` (0.7). Defaults to `"whisper"`.
   */
  intensity?: LiquidIntensity;
  /** Corner radius in px. Defaults to `24`. */
  radius?: number;
  /** Content padding in px. Defaults to `28`. */
  padding?: number;
  /** Scene light in dialog coordinates; null disables speculars. */
  light?: Vec | null;
  /** Paint specular reflections on glass. Defaults to `true`. */
  reflection?: boolean;
  /** Drop shadow under the surface. Defaults to `true`. */
  shadow?: boolean;
  children?: ReactNode;
}

/** Taut morph: one clear overshoot, settles fast. */
const POP_SPRING = { stiffness: 280, damping: 24 };
/** Drop-back: quicker and near-critically damped — liquid falling home
 * shouldn't bounce, and the portal unmount must not chop it mid-flight. */
const CLOSE_SPRING = { stiffness: 360, damping: 32 };
const SETTLE_MS = 900;
/** How long the portal lingers after `open` flips false — long enough
 * for the drop-back morph (~350ms) plus the trailing water drain. */
const EXIT_MS = 460;
/** Close fades: the box fades late (after it has mostly landed on the
 * trigger); content ducks out immediately. */
const EXIT_FADE_DELAY_MS = 160;
const EXIT_FADE_MS = 260;
/** Fallback origin when no trigger can be found: a small pill just below
 * center. */
const FALLBACK_ORIGIN = { x: 0, y: 80, w: 120, h: 44 };

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

/** Surface at the current morph size (pw × ph), centered in the box. */
function buildMorphScene(
  pw: number,
  ph: number,
  w: number,
  h: number,
  radius: number,
  light: Vec | null,
  intensity: number
): Scene {
  const rad = Math.min(radius, ph / 2, pw / 2);
  const path = roundRectPath({ x: w / 2, y: h / 2 }, pw, ph, rad);
  const speculars: SpecularSpot[] = [];
  if (light && pw > 12 && ph > 12) {
    speculars.push(
      specularPlacement(
        { x: w / 2, y: h / 2, r: Math.min(pw, ph) * 0.48 },
        light,
        0.4 * intensity
      )
    );
  }
  return { path, speculars };
}

export function LiquidDialog({
  open,
  onClose,
  origin,
  material = "glass",
  tint,
  color,
  intensity = "whisper",
  radius = 24,
  padding = 28,
  light,
  reflection = true,
  shadow = true,
  children,
  className,
  style,
  ...rest
}: LiquidDialogProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // The portal stays mounted for EXIT_MS after close so the fade-out
  // plays; `mounted` is the render gate, `open` drives the visuals.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // The portal mounts with `open` already true, so styles keyed on `open`
  // alone would paint in their FINAL state on the first frame — CSS
  // transitions only animate changes, and the backdrop/content enter
  // fades would never play. `entered` flips one frame after mount, so
  // the first paint is the hidden state and the transition runs.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!(open && mounted)) {
      setEntered(false);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, mounted]);

  // Escape closes; body scroll locks while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Focus moves into the dialog on open, back where it was on close.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  // Depends on `mounted` as well: the portal renders one commit after
  // `open` flips true, so the box doesn't exist until `mounted` follows.
  useEffect(() => {
    if (open && mounted) {
      restoreFocus.current =
        (document.activeElement as HTMLElement | null) ?? null;
      boxRef.current?.focus();
    } else if (!open) {
      restoreFocus.current?.focus?.();
      restoreFocus.current = null;
    }
  }, [open, mounted]);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (!mounted) return;
    const el = boxRef.current;
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
  }, [mounted]);

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const volume = resolveIntensity(intensity);
  const sceneLight = useMemo(() => {
    if (!reflection || light === null || !size) return null;
    return light ?? defaultLight(size.w, size.h);
  }, [reflection, light, size]);

  // Slots: [width, height, translateX, translateY]. Width/height carry
  // the expansion from trigger-size to dialog-size; translate carries the
  // rise from the trigger to center.
  const springs = useMotionSprings(4, (i) => (i < 2 ? 200 : 0), POP_SPRING);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animating = !prefersReducedMotion;

  // Trigger rect at the moment of open: x/y are the trigger center's
  // offset from the viewport center (the dialog's home), w/h its size.
  const originRect = useRef(FALLBACK_ORIGIN);
  // Opening is captured immediately, but the morph can only launch once
  // the dialog's final size has been measured (first open mounts the
  // portal a commit later).
  const pendingLaunch = useRef(false);

  const startSettle = () => {
    setSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
  };

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current !== open) {
      prevOpen.current = open;
      if (open) {
        const el =
          origin ??
          (document.activeElement instanceof HTMLElement &&
          document.activeElement !== document.body
            ? document.activeElement
            : null);
        if (el) {
          const r = el.getBoundingClientRect();
          originRect.current = {
            x: r.left + r.width / 2 - window.innerWidth / 2,
            y: r.top + r.height / 2 - window.innerHeight / 2,
            w: r.width,
            h: r.height,
          };
        } else {
          originRect.current = FALLBACK_ORIGIN;
        }
        pendingLaunch.current = true;
      } else {
        // Close: drop back toward the trigger, shrinking on the way.
        const o = originRect.current;
        if (animating) {
          springs.setTargets([o.w, o.h, o.x, o.y], CLOSE_SPRING);
          startSettle();
        } else {
          springs.snapTo([o.w, o.h, o.x, o.y]);
        }
      }
    }
    // Launch the rise as soon as the measured size exists.
    if (open && pendingLaunch.current && size) {
      pendingLaunch.current = false;
      const o = originRect.current;
      if (animating) {
        springs.snapTo([o.w, o.h, o.x, o.y]); // start AT the trigger
        springs.setTargets([size.w, size.h, 0, 0]);
        startSettle();
      } else {
        springs.snapTo([size.w, size.h, 0, 0]);
      }
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, size, animating, origin]);

  useEffect(() => {
    if (!animating) setSettling(false);
  }, [animating]);

  // While the spring is mid-flight, the declarative scene must paint the
  // CURRENT spring values, not the target — the portal mounts a commit
  // after `open` flips, and painting the target would show the dialog at
  // full size before the rAF loop's first write (the morph would be lost).
  const staticScene = useMemo(() => {
    if (!size) return null;
    const midFlight = animating && settling;
    const pw = midFlight
      ? springs.values[0].get()
      : open
        ? size.w
        : originRect.current.w;
    const ph = midFlight
      ? springs.values[1].get()
      : open
        ? size.h
        : originRect.current.h;
    return buildMorphScene(
      pw,
      ph,
      size.w,
      size.h,
      radius,
      resolved.specular ? sceneLight : null,
      volume
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, open, animating, settling, radius, resolved.specular, sceneLight, volume]);
  const renderer = useRef<LiquidSceneHandle>(null);
  useEffect(() => {
    if (!(animating && settling)) {
      if (staticScene) renderer.current?.setScene(staticScene);
      // At-rest transform: home for open, back at the trigger for closed
      // (invisible by then — the backdrop fade has finished).
      if (boxRef.current)
        boxRef.current.style.transform = open
          ? ""
          : `translate3d(${originRect.current.x}px, ${originRect.current.y}px, 0)`;
    }
  }, [animating, settling, staticScene, open]);

  useAnimationFrame(() => {
    if (!animating || !settling || !size) return;
    renderer.current?.setScene(
      buildMorphScene(
        springs.values[0].get(),
        springs.values[1].get(),
        size.w,
        size.h,
        radius,
        resolved.specular ? sceneLight : null,
        volume
      )
    );
    if (boxRef.current)
      boxRef.current.style.transform = `translate3d(${springs.values[2].get()}px, ${springs.values[3].get()}px, 0)`;
  });

  if (!mounted || typeof document === "undefined") return null;

  const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    // Shallow water: faint tint, light blur. The blur itself animates —
    // `backdrop-filter` ignores element opacity, so fading opacity alone
    // would leave the blur snapping in at full strength.
    background: "rgba(240, 243, 250, 0.45)",
    backdropFilter: entered
      ? "blur(6px) saturate(1.15)"
      : "blur(0px) saturate(1)",
    WebkitBackdropFilter: entered
      ? "blur(6px) saturate(1.15)"
      : "blur(0px) saturate(1)",
    opacity: entered ? 1 : 0,
    // Open: the water rises with the morph. Close: the fade WAITS while
    // the box drops back toward the trigger, then drains — fading at
    // t=0 would chop the drop-back morph off mid-flight.
    transition: open
      ? "opacity 320ms ease, backdrop-filter 320ms ease, -webkit-backdrop-filter 320ms ease"
      : `opacity ${EXIT_FADE_MS}ms ease ${EXIT_FADE_DELAY_MS}ms, backdrop-filter ${EXIT_FADE_MS}ms ease ${EXIT_FADE_DELAY_MS}ms, -webkit-backdrop-filter ${EXIT_FADE_MS}ms ease ${EXIT_FADE_DELAY_MS}ms`,
  };

  const contentStyle: CSSProperties = {
    position: "relative",
    opacity: entered ? 1 : 0,
    transform:
      entered || prefersReducedMotion ? "translateY(0)" : "translateY(6px)",
    // Content waits for the surface to (mostly) arrive — during the
    // morph the surface is smaller than the content box, and text
    // hanging past the liquid's edge breaks the read.
    transition: open
      ? "opacity 0.22s ease 0.18s, transform 0.3s cubic-bezier(.22,1,.36,1) 0.18s"
      : "opacity 0.1s ease, transform 0.1s ease",
  };

  return createPortal(
    <div
      data-fluidkit="liquid-dialog-backdrop"
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={className}
        style={{
          position: "relative",
          padding,
          outline: "none",
          // First mounted paint mid-rise: start at the current spring
          // position (≈ the trigger) — the rAF loop takes over next frame.
          transform:
            animating && settling
              ? `translate3d(${springs.values[2].get()}px, ${springs.values[3].get()}px, 0)`
              : undefined,
          ...style,
        }}
        data-fluidkit="liquid-dialog"
        data-state={open ? "open" : "closed"}
        data-animating={animating && settling}
        {...rest}
      >
        <span
          aria-hidden="true"
          data-fluidkit="liquid-dialog-surface"
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            pointerEvents: "none",
          }}
        >
          {staticScene && (
            <LiquidRenderer
              ref={renderer}
              path={staticScene.path}
              material={resolved}
              speculars={staticScene.speculars}
              specularSlots={resolved.specular && sceneLight ? 1 : 0}
              shadow={shadow}
            />
          )}
          {size && resolved.specular && sceneLight && volume > 0 && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "block",
                opacity: entered ? 1 : 0,
                transition: "opacity 0.2s ease 0.15s",
              }}
            >
              <span
                data-fluidkit="liquid-dialog-glow"
                style={rimGlowStyle(size.w, size.h, radius, volume)}
              />
              <span
                data-fluidkit="liquid-dialog-rim"
                style={rimStyle(size.w, size.h, radius, sceneLight, volume)}
              />
            </span>
          )}
        </span>
        <div data-fluidkit="liquid-dialog-content" style={contentStyle}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
