/**
 * A dropdown menu that POURS from its trigger: the engine surface is a
 * rounded rect anchored to the trigger's edge, growing across the menu box
 * on a spring (LiquidPanel's pour), with the items fading in on the
 * unclipped layer once the surface has (mostly) arrived. Dismissing drains
 * it back toward the trigger. Rendered through a portal on the shared
 * overlay layer (`--fluidkit-z-menu`), positioned against the trigger's
 * rect with flip-to-fit when the preferred side has no room.
 *
 * Follows the WAI-ARIA menu-button pattern: `aria-haspopup`/`aria-expanded`
 * on the trigger (Enter/Space/click open; ArrowDown focuses the first item,
 * ArrowUp the last), `role="menu"`/`role="menuitem"` inside with ArrowUp/
 * ArrowDown cycling (disabled items skipped), Home/End, Escape closing and
 * returning focus to the trigger. Outside pointerdown closes. Selecting an
 * item runs `onSelect`, closes, and returns focus.
 *
 * Reduced motion: open/close is an opacity fade over the fully-poured
 * geometry; no loop runs.
 */

import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  cloneElement,
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
import type { LiquidSceneHandle, SpecularSpot, Vec } from "../liquid";
import { useMotionSprings } from "../liquid/useMotionSprings";
import { usePrefersReducedMotion } from "../utils";
import { resolveIntensity } from "./intensity";
import { overlayRoot, overlayZ } from "./overlay";
import { rimGlowStyle, rimStyle } from "./rim";
import type { SurfaceStyleProps } from "./surface";

export type LiquidMenuItem =
  | {
      type?: "item";
      label: ReactNode;
      /** Runs on selection; the menu closes afterwards. */
      onSelect?: () => void;
      disabled?: boolean;
      icon?: ReactNode;
    }
  | { type: "separator" };

export type LiquidMenuSide = "bottom" | "top";
export type LiquidMenuAlign = "start" | "end";

export interface LiquidMenuProps extends SurfaceStyleProps {
  /** The trigger element; ARIA and open handlers are injected onto it. */
  trigger: ReactElement;
  items: LiquidMenuItem[];
  /** Which side of the trigger the menu pours on. Defaults to `"bottom"`. */
  side?: LiquidMenuSide;
  /** Which trigger edge the menu aligns to. Defaults to `"start"`. */
  align?: LiquidMenuAlign;
  /** Gap between trigger and menu in px. Defaults to `6`. */
  gap?: number;
  /** Corner radius in px. Defaults to `14`. */
  radius?: number;
}

const POUR_SPRING = { stiffness: 200, damping: 24 };
const SETTLE_MS = 900;
/** How long the portal lingers after close for the drain to finish. */
const EXIT_MS = 300;

interface Scene {
  path: string;
  speculars: SpecularSpot[];
}

/** Rounded rect covering fraction `f` of the box from the trigger's edge. */
function buildMenuScene(
  f: number,
  w: number,
  h: number,
  radius: number,
  fromTop: boolean,
  light: Vec | null,
  volume: number
): Scene {
  const fill = Math.max(f, 0.002);
  const fh = h * fill;
  const cy = fromTop ? fh / 2 : h - fh / 2;
  const rad = Math.min(radius, w / 2, fh / 2);
  const path = roundRectPath({ x: w / 2, y: cy }, w, fh, rad);
  const speculars: SpecularSpot[] = [];
  if (light && w > 12 && fh > 12) {
    speculars.push(
      specularPlacement(
        { x: w / 2, y: cy, r: Math.min(w, fh) * 0.48 },
        light,
        0.4 * volume
      )
    );
  }
  return { path, speculars };
}

export function LiquidMenu({
  trigger,
  items,
  side = "bottom",
  align = "start",
  gap = 6,
  radius = 14,
  material = "glass",
  tint,
  color,
  intensity = "whisper",
  light,
  reflection = true,
  refraction: _refraction, // reserved: edge lensing is not wired on menus yet
  shadow = true,
}: LiquidMenuProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animating = !prefersReducedMotion;

  /** null = closed, otherwise which item receives initial focus. */
  const [openState, setOpenState] = useState<{
    initialFocus: "first" | "last";
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const open = openState !== null && !closing;

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEl = () =>
    (wrapperRef.current?.firstElementChild ?? null) as HTMLElement | null;

  const openMenu = (initialFocus: "first" | "last") => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    setClosing(false);
    setOpenState({ initialFocus });
  };

  const closeMenu = (returnFocus: boolean) => {
    if (openState === null || closing) return;
    setClosing(true);
    if (returnFocus) triggerEl()?.focus();
    exitTimer.current = setTimeout(
      () => {
        setClosing(false);
        setOpenState(null);
        exitTimer.current = null;
      },
      animating ? EXIT_MS : 0
    );
  };
  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    []
  );

  /* ------------------------------ position ------------------------------ */

  const [menuSize, setMenuSize] = useState<{ w: number; h: number } | null>(
    null
  );
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || openState === null) return;
    const measure = () =>
      setMenuSize((prev) => {
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [openState]);

  const [pos, setPos] = useState<{ left: number; top: number; fromTop: boolean } | null>(null);
  useLayoutEffect(() => {
    if (openState === null || !menuSize) return;
    const place = () => {
      const anchor = wrapperRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const vh = window.innerHeight;
      // Flip-to-fit: fall back to the other side when the preferred side
      // lacks room and the other side has it.
      let below = side === "bottom";
      const fitsBelow = anchor.bottom + gap + menuSize.h <= vh;
      const fitsAbove = anchor.top - gap - menuSize.h >= 0;
      if (below && !fitsBelow && fitsAbove) below = false;
      if (!below && !fitsAbove && fitsBelow) below = true;
      const left =
        align === "start" ? anchor.left : anchor.right - menuSize.w;
      const top = below ? anchor.bottom + gap : anchor.top - gap - menuSize.h;
      setPos((prev) =>
        prev && prev.left === left && prev.top === top && prev.fromTop === below
          ? prev
          : { left, top, fromTop: below }
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [openState, menuSize, side, align, gap]);

  /* --------------------------- focus & dismiss --------------------------- */

  // Initial focus lands once the menu exists (a tick later, so the portal
  // subtree is in the document). Skipped if a close raced the timeout —
  // stealing focus mid-drain would strand it on an unmounting node.
  const closingRef = useRef(closing);
  closingRef.current = closing;
  useEffect(() => {
    if (openState === null) return;
    const focusables = () =>
      itemRefs.current.filter(
        (el): el is HTMLButtonElement =>
          !!el && el.getAttribute("aria-disabled") !== "true"
      );
    const t = setTimeout(() => {
      if (closingRef.current) return;
      const list = focusables();
      (openState.initialFocus === "last" ? list[list.length - 1] : list[0])?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [openState]);

  // Outside pointerdown closes (without stealing focus back).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (wrapperRef.current?.contains(target)) return;
      closeMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const moveFocus = (dir: 1 | -1 | "first" | "last") => {
    const list = itemRefs.current.filter(
      (el): el is HTMLButtonElement =>
        !!el && el.getAttribute("aria-disabled") !== "true"
    );
    if (!list.length) return;
    if (dir === "first") return list[0].focus();
    if (dir === "last") return list[list.length - 1].focus();
    const i = list.findIndex((el) => el === document.activeElement);
    list[(i + dir + list.length) % list.length].focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        e.preventDefault();
        moveFocus("first");
        break;
      case "End":
        e.preventDefault();
        moveFocus("last");
        break;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        closeMenu(false);
        break;
    }
  };

  /* ------------------------------- surface ------------------------------- */

  const resolved = useMemo(
    () => resolveMaterial(material, { tint, color }),
    [material, tint, color]
  );
  const volume = resolveIntensity(intensity);
  const sceneLight = useMemo(() => {
    if (!reflection || light === null || !menuSize) return null;
    return light ?? defaultLight(menuSize.w, menuSize.h);
  }, [reflection, light, menuSize]);

  const fromTop = pos?.fromTop ?? side === "bottom";
  const f = useMotionSprings(1, () => (animating ? 0 : 1), POUR_SPRING);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (openState === null) return;
    if (!animating) {
      f.snapTo([closing ? 0 : 1]);
      return;
    }
    f.setTargets([closing ? 0 : 1]);
    setSettling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openState, closing, animating]);

  const renderer = useRef<LiquidSceneHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const staticScene = useMemo(
    () =>
      menuSize
        ? buildMenuScene(
            closing ? 0 : 1,
            menuSize.w,
            menuSize.h,
            radius,
            fromTop,
            resolved.specular ? sceneLight : null,
            volume
          )
        : null,
    [menuSize, closing, radius, fromTop, resolved.specular, sceneLight, volume]
  );

  useEffect(() => {
    if (!(animating && settling) && staticScene)
      renderer.current?.setScene(staticScene);
  }, [animating, settling, staticScene]);

  useAnimationFrame(() => {
    if (!animating || !settling || !menuSize) return;
    const v = f.values[0].get();
    renderer.current?.setScene(
      buildMenuScene(
        v,
        menuSize.w,
        menuSize.h,
        radius,
        fromTop,
        resolved.specular ? sceneLight : null,
        volume
      )
    );
    if (listRef.current) {
      // Items rise in only once the surface has (mostly) poured.
      listRef.current.style.opacity = String(
        Math.max(0, Math.min(1, (v - 0.4) / 0.6))
      );
    }
  });

  /* ------------------------------- render -------------------------------- */

  const triggerProps = trigger.props as {
    onClick?: (e: React.MouseEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
  const wiredTrigger = cloneElement(
    trigger as ReactElement<Record<string, unknown>>,
    {
      "aria-haspopup": "menu",
      "aria-expanded": open,
      onClick: (e: React.MouseEvent) => {
        triggerProps.onClick?.(e);
        if (open) closeMenu(false);
        else openMenu("first");
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        triggerProps.onKeyDown?.(e);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          openMenu(e.key === "ArrowDown" ? "first" : "last");
        }
      },
    }
  );

  const root = overlayRoot();
  const menuStyle: CSSProperties = {
    position: "fixed",
    left: pos?.left ?? 0,
    top: pos?.top ?? 0,
    zIndex: overlayZ("menu"),
    // Hidden until measured and placed — never flash at (0,0).
    visibility: pos ? "visible" : "hidden",
    opacity: !animating && closing ? 0 : 1,
    transition: !animating ? "opacity 140ms ease" : undefined,
  };

  let itemIndex = -1;
  return (
    <>
      <span ref={wrapperRef} style={{ display: "inline-block" }}>
        {wiredTrigger}
      </span>
      {openState !== null &&
        root &&
        createPortal(
          <div
            ref={menuRef}
            data-fluidkit="liquid-menu"
            data-state={closing ? "closing" : "open"}
            data-animating={animating}
            style={menuStyle}
            onKeyDown={onMenuKeyDown}
          >
            <div
              aria-hidden
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
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
            </div>
            <div
              ref={listRef}
              role="menu"
              style={{
                position: "relative",
                display: "grid",
                gap: 2,
                minWidth: 160,
                maxWidth: 280,
                padding: 6,
                opacity: animating ? 0 : 1,
              }}
            >
              {/* Rim ring + inset glow (the Card/Dialog treatment) so glass
                  reads on a plain light page; fades in with the items. */}
              {menuSize && resolved.specular && sceneLight && volume > 0 && (
                <>
                  <span
                    aria-hidden
                    data-fluidkit="liquid-menu-glow"
                    style={rimGlowStyle(menuSize.w, menuSize.h, radius, volume)}
                  />
                  <span
                    aria-hidden
                    data-fluidkit="liquid-menu-rim"
                    style={rimStyle(menuSize.w, menuSize.h, radius, sceneLight, volume)}
                  />
                </>
              )}
              {items.map((item, i) => {
                if (item.type === "separator") {
                  return (
                    <div
                      key={`sep-${i}`}
                      role="separator"
                      aria-orientation="horizontal"
                      style={{
                        height: 1,
                        margin: "4px 8px",
                        background: "rgba(60, 70, 100, 0.14)",
                      }}
                    />
                  );
                }
                itemIndex += 1;
                const idx = itemIndex;
                const disabled = item.disabled ?? false;
                return (
                  <button
                    key={idx}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    role="menuitem"
                    aria-disabled={disabled || undefined}
                    tabIndex={-1}
                    onClick={() => {
                      if (disabled) return;
                      item.onSelect?.();
                      closeMenu(true);
                    }}
                    style={{
                      ...menuItemStyle,
                      ...(disabled ? { opacity: 0.45, cursor: "default" } : {}),
                    }}
                  >
                    {item.icon && (
                      <span aria-hidden style={{ display: "inline-flex", flex: "none" }}>
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>,
          root
        )}
    </>
  );
}

const menuItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "none",
  borderRadius: 9,
  padding: "8px 10px",
  font: "inherit",
  fontSize: 13,
  fontWeight: 500,
  textAlign: "left",
  color: "inherit",
  background: "transparent",
  cursor: "pointer",
};
