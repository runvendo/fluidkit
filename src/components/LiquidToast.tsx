/**
 * Toast notifications as liquid: each toast CONDENSES at the screen edge
 * (the pill geometry grows from a droplet while the canvas un-blurs —
 * LiquidTooltip's condense, scaled up) and EVAPORATES on dismiss (blur +
 * lift + fade, the condense played backward). Toasts stack from a screen
 * corner on the shared overlay layer; dismissing one collapses the stack
 * beneath it.
 *
 * Fired imperatively: mount `<LiquidToastProvider>` once, then call
 * `toast("Saved")` from anywhere — event handlers, async code, outside
 * React. Toasts fired before the provider mounts are queued and flushed
 * on mount. Classic controls: `duration` auto-dismiss (0 = sticky, hover
 * pauses the clock), a close button (`dismissible`, default on), an
 * `action` button, and `id` for dedupe/update. The toast body itself is
 * not click-to-dismiss.
 *
 * Reduced motion: opacity-only in/out, geometry static; timers unchanged.
 * SSR-safe: the viewport portals only when a document exists.
 */

import type { CSSProperties, ReactNode } from "react";
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
import type { LiquidSceneHandle, SpecularSpot } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import type { LiquidIntensity } from "./intensity";
import { overlayRoot, overlayZ } from "./overlay";
import type { SurfaceStyleProps } from "./surface";

/* ------------------------------ dispatcher ------------------------------ */

export interface ToastAction {
  label: ReactNode;
  onClick: () => void;
}

export interface ToastOptions {
  /** Stable identity: firing again with the same id UPDATES that toast. */
  id?: string | number;
  /** Auto-dismiss delay in ms; `0` keeps the toast until dismissed. */
  duration?: number;
  /** Show the close button. */
  dismissible?: boolean;
  /** One action button; the toast dismisses after it runs. */
  action?: ToastAction;
}

interface ToastPayload extends ToastOptions {
  id: string | number;
  message: ReactNode;
}

let toastCounter = 0;
let dispatch: ((payload: ToastPayload) => void) | null = null;
let dismissDispatch: ((id?: string | number) => void) | null = null;
const pending: ToastPayload[] = [];

/**
 * Show a toast. Works from anywhere once a `<LiquidToastProvider>` is
 * mounted; calls made earlier are queued and flushed on mount. Returns the
 * toast id (pass it back with the same `id` option to update in place).
 */
export function toast(
  message: ReactNode,
  options: ToastOptions = {}
): string | number {
  const payload: ToastPayload = {
    ...options,
    id: options.id ?? `fluidkit-toast-${++toastCounter}`,
    message,
  };
  if (dispatch) dispatch(payload);
  else pending.push(payload);
  return payload.id;
}

/** Dismiss one toast by id, or every toast when called with no argument. */
toast.dismiss = (id?: string | number): void => {
  dismissDispatch?.(id);
};

/* ------------------------------- provider ------------------------------- */

export type LiquidToastPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export interface LiquidToastProviderProps extends SurfaceStyleProps {
  /** Screen corner the toasts condense in. Defaults to `"bottom-right"`. */
  position?: LiquidToastPosition;
  /** Default auto-dismiss delay in ms (`0` = sticky). Defaults to `5000`. */
  duration?: number;
  /** Default close-button visibility. Defaults to `true`. */
  dismissible?: boolean;
  /**
   * How loudly the material reads. Defaults to `"present"` — a documented
   * divergence from the pack's usual `"whisper"`: 0.7 reproduces the
   * approved prototype's glint brightness exactly (0.4 × 0.7 = 0.28).
   */
  intensity?: LiquidIntensity;
  children?: ReactNode;
}

interface ToastRecord extends ToastPayload {
  /** Bumped on dedupe-update so the item resets its auto-dismiss clock. */
  nonce: number;
  leaving: boolean;
}

/** Non-leaving toasts beyond this cap push the oldest out early. */
const MAX_VISIBLE = 3;
/** How long a leaving toast stays mounted for its evaporate to finish. */
const EXIT_MS = 520;
/** Stack gap in px (approved prototype value). */
const GAP = 10;

export function LiquidToastProvider({
  position = "bottom-right",
  duration = 5000,
  dismissible = true,
  material = "glass",
  tint,
  color,
  intensity = "present",
  light,
  reflection = true,
  refraction: _refraction, // reserved: edge lensing is not wired on toasts yet
  shadow = true,
  children,
}: LiquidToastProviderProps) {
  // The canonical list lives in a ref and mutates SYNCHRONOUSLY — the
  // dispatcher is called from outside React (often several times in one
  // tick), so state updaters alone would read stale snapshots under
  // batching. State is a render mirror of the ref.
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const listRef = useRef<ToastRecord[]>([]);
  const exitTimers = useRef(new Map<string | number, ReturnType<typeof setTimeout>>());

  const commitRef = useRef(() => setToasts([...listRef.current]));

  const dismissToast = (id: string | number) => {
    const record = listRef.current.find((t) => t.id === id);
    if (!record || record.leaving) return;
    record.leaving = true;
    commitRef.current();
    exitTimers.current.set(
      id,
      setTimeout(() => {
        exitTimers.current.delete(id);
        listRef.current = listRef.current.filter((t) => t.id !== id);
        commitRef.current();
      }, EXIT_MS)
    );
  };
  const dismissRef = useRef(dismissToast);
  dismissRef.current = dismissToast;

  useEffect(() => {
    const add = (payload: ToastPayload) => {
      const existing = listRef.current.find(
        (t) => t.id === payload.id && !t.leaving
      );
      if (existing) {
        // Dedupe: same id updates in place and resets the clock.
        Object.assign(existing, payload);
        existing.nonce += 1;
        commitRef.current();
        return;
      }
      // Cap the stack: the oldest live toast evaporates early.
      const live = listRef.current.filter((t) => !t.leaving);
      if (live.length >= MAX_VISIBLE) dismissRef.current(live[0].id);
      listRef.current = [
        ...listRef.current.filter((t) => t.id !== payload.id),
        { ...payload, nonce: 0, leaving: false },
      ];
      commitRef.current();
    };
    const dismiss = (id?: string | number) => {
      if (id !== undefined) dismissRef.current(id);
      else
        [...listRef.current].forEach((t) => dismissRef.current(t.id));
    };
    dispatch = add;
    dismissDispatch = dismiss;
    pending.splice(0).forEach(add);
    const timers = exitTimers.current;
    return () => {
      if (dispatch === add) dispatch = null;
      if (dismissDispatch === dismiss) dismissDispatch = null;
      timers.forEach(clearTimeout);
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const surface: ItemSurfaceProps = {
    material,
    tint,
    color,
    volume: resolveIntensity(intensity),
    lightOverride: light,
    reflection,
    shadow,
  };

  const top = position.startsWith("top");
  const viewportStyle: CSSProperties = {
    position: "fixed",
    zIndex: overlayZ("toast"),
    display: "flex",
    flexDirection: top ? "column" : "column-reverse",
    alignItems: position.endsWith("right") ? "flex-end" : "flex-start",
    [top ? "top" : "bottom"]: 16,
    [position.endsWith("right") ? "right" : "left"]: 16,
    pointerEvents: "none",
  };

  const root = overlayRoot();
  return (
    <>
      {children}
      {root &&
        createPortal(
          <div
            data-fluidkit="liquid-toast-viewport"
            role="status"
            aria-live="polite"
            style={viewportStyle}
          >
            {toasts.map((t) => (
              <ToastItem
                key={t.id}
                record={t}
                top={top}
                defaultDuration={duration}
                defaultDismissible={dismissible}
                surface={surface}
                onDismiss={() => dismissToast(t.id)}
              />
            ))}
          </div>,
          root
        )}
    </>
  );
}

/* -------------------------------- item ---------------------------------- */

/** Condense spring at the approved prototype pace. */
const CONDENSE_SPRING = { stiffness: 260, damping: 20 };
/** Evaporate: the same character at 1.3× (stiffness ×pace², damping ×pace). */
const EVAPORATE_SPRING = { stiffness: 260 * 1.69, damping: 20 * 1.3 };
/** Canvas margin: room for shadow, blur, and spring overshoot. */
const BLEED = 24;
const RADIUS = 16;
/** Evaporate blur and lift (approved prototype values). */
const BLUR_PX = 14;
const LIFT_PX = 26;
/** The geometry never collapses below this — the canvas fades out under it. */
const GROW_FLOOR = 0.3;

interface ItemSurfaceProps {
  material: NonNullable<SurfaceStyleProps["material"]>;
  tint?: string;
  color?: string;
  volume: number;
  lightOverride?: SurfaceStyleProps["light"];
  reflection: boolean;
  shadow: boolean;
}

function ToastItem({
  record,
  top,
  defaultDuration,
  defaultDismissible,
  surface,
  onDismiss,
}: {
  record: ToastRecord;
  top: boolean;
  defaultDuration: number;
  defaultDismissible: boolean;
  surface: ItemSurfaceProps;
  onDismiss: () => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animating = !prefersReducedMotion;
  const { leaving, nonce } = record;
  const durationMs = record.duration ?? defaultDuration;
  const showClose = record.dismissible ?? defaultDismissible;

  /* Auto-dismiss clock, paused while hovered. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const remaining = useRef(durationMs);
  const hovered = useRef(false);
  useEffect(() => {
    if (leaving || durationMs <= 0) return;
    remaining.current = durationMs;
    if (!hovered.current) {
      startedAt.current = Date.now();
      timer.current = setTimeout(onDismiss, remaining.current);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    // Re-arm on dedupe-update (nonce) or duration change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, durationMs, leaving]);

  const pauseClock = () => {
    hovered.current = true;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      remaining.current -= Date.now() - startedAt.current;
    }
  };
  const resumeClock = () => {
    hovered.current = false;
    if (leaving || durationMs <= 0 || timer.current) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(onDismiss, Math.max(remaining.current, 0));
  };

  /* The content defines the pill's size (LiquidTooltip's pattern). */
  const overlayRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = overlayRef.current;
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
    () =>
      resolveMaterial(surface.material, {
        tint: surface.tint,
        color: surface.color,
      }),
    [surface.material, surface.tint, surface.color]
  );
  const sceneLight = useMemo(() => {
    if (!surface.reflection || surface.lightOverride === null || !size)
      return null;
    const w = size.w + BLEED * 2;
    const h = size.h + BLEED * 2;
    return surface.lightOverride
      ? { x: surface.lightOverride.x + BLEED, y: surface.lightOverride.y + BLEED }
      : defaultLight(w, h);
  }, [surface.reflection, surface.lightOverride, size]);

  const buildScene = (grow: number): { path: string; speculars: SpecularSpot[] } => {
    if (!size) return { path: "", speculars: [] };
    const cx = BLEED + size.w / 2;
    const cy = BLEED + size.h / 2;
    const pw = size.w * grow;
    const ph = size.h * grow;
    const path = roundRectPath(
      { x: cx, y: cy },
      pw,
      ph,
      Math.min(RADIUS, ph / 2, pw / 2)
    );
    const speculars =
      resolved.specular && sceneLight && pw > 12 && ph > 12
        ? [
            specularPlacement(
              { x: cx, y: cy, r: Math.min(pw, ph) * 0.48 },
              sceneLight,
              0.4 * surface.volume
            ),
          ]
        : [];
    return { path, speculars };
  };

  /* Condense fraction: 0 = droplet mist, 1 = seated. */
  const f = useMotionSprings(1, () => (animating ? 0 : 1), CONDENSE_SPRING);
  useEffect(() => {
    if (!animating) {
      f.snapTo([leaving ? 0 : 1]);
      return;
    }
    f.setTargets([leaving ? 0 : 1], leaving ? EVAPORATE_SPRING : CONDENSE_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, animating]);

  const renderer = useRef<LiquidSceneHandle>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const staticScene = useMemo(
    () => buildScene(1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, resolved.specular, sceneLight, surface.volume]
  );

  // When the loop isn't running the declarative (static) rendering wins.
  useEffect(() => {
    if (!animating) renderer.current?.setScene(staticScene);
  }, [animating, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !size) return;
    const v = f.values[0].get();
    renderer.current?.setScene(buildScene(Math.max(v, GROW_FLOOR)));
    if (canvasRef.current) {
      const s = canvasRef.current.style;
      s.opacity = String(Math.max(0, Math.min(1, v / GROW_FLOOR)));
      s.filter = `blur(${((1 - v) * BLUR_PX).toFixed(1)}px)`;
      // Condensing settles into place; evaporating lifts away from the edge.
      const away = top ? -1 : 1;
      const dy = leaving ? -away * (1 - v) * LIFT_PX : away * (1 - v) * LIFT_PX * 0.35;
      s.transform = `translateY(${dy.toFixed(1)}px)`;
    }
    if (overlayRef.current) {
      // Text never scales — it cross-fades in once the pill has formed.
      overlayRef.current.style.opacity = String(
        Math.max(0, Math.min(1, (v - 0.55) / 0.45))
      );
    }
  });

  /* Stack collapse: the wrapper's height animates to 0 while leaving. */
  const wrapperStyle: CSSProperties = {
    height: leaving ? 0 : size ? size.h + GAP : "auto",
    transition: "height 320ms ease",
    display: "flex",
    alignItems: top ? "flex-start" : "flex-end",
    overflow: "visible",
    pointerEvents: leaving ? "none" : "auto",
  };

  const reducedStyle: CSSProperties = animating
    ? {}
    : {
        opacity: leaving ? 0 : 1,
        transition: "opacity 180ms ease",
      };

  return (
    <div style={wrapperStyle}>
      <div
        data-fluidkit="liquid-toast"
        data-state={leaving ? "leaving" : "open"}
        data-animating={animating}
        onPointerEnter={pauseClock}
        onPointerLeave={resumeClock}
        style={{ position: "relative", ...reducedStyle }}
      >
        <div
          ref={canvasRef}
          aria-hidden
          style={{ position: "absolute", inset: -BLEED, pointerEvents: "none" }}
        >
          {staticScene.path && (
            <LiquidRenderer
              ref={renderer}
              path={staticScene.path}
              material={resolved}
              speculars={staticScene.speculars}
              specularSlots={resolved.specular && sceneLight ? 1 : 0}
              shadow={surface.shadow}
            />
          )}
        </div>
        <div
          ref={overlayRef}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 340,
            minWidth: 200,
            padding: "12px 12px 12px 18px",
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.4,
            opacity: animating ? 0 : 1,
          }}
        >
          <span style={{ flex: 1, position: "relative" }}>{record.message}</span>
          {record.action && (
            <button
              type="button"
              onClick={() => {
                record.action?.onClick();
                onDismiss();
              }}
              style={actionButtonStyle}
            >
              {record.action.label}
            </button>
          )}
          {showClose && (
            <button
              type="button"
              aria-label="Close"
              onClick={onDismiss}
              style={closeButtonStyle}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const actionButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 600,
  font: "inherit",
  color: "inherit",
  background: "rgba(60, 70, 100, 0.12)",
  cursor: "pointer",
  flex: "none",
};

const closeButtonStyle: CSSProperties = {
  border: "none",
  width: 22,
  height: 22,
  borderRadius: 11,
  display: "grid",
  placeItems: "center",
  fontSize: 13,
  lineHeight: 1,
  color: "inherit",
  background: "rgba(60, 70, 100, 0.10)",
  cursor: "pointer",
  flex: "none",
  padding: 0,
};
