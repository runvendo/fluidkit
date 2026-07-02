/**
 * Keyboard + ARIA behavior for the tab strip.
 *
 * Automatic activation (WAI-ARIA tabs pattern): Arrow/Home/End change the
 * selection, skipping disabled tabs and wrapping at the ends. The selected tab
 * owns the roving tabindex (0); the rest are -1 so Tab enters/leaves the strip
 * as a single stop. Enter/Space are no-ops here — the selected tab is already
 * active — but are swallowed so the page doesn't scroll on Space.
 *
 * The hook never touches the DOM (no refs, no focus() calls). Keyboard moves
 * are reported via `onNavigate` so the caller (the LiquidTabs bar) can move
 * DOM focus to the newly-selected tab button.
 */

import type { KeyboardEvent } from "react";

export interface TabListItem {
  id: string;
  disabled?: boolean;
}

export interface UseTabListOptions {
  items: readonly TabListItem[];
  value: string;
  onChange: (id: string) => void;
  /**
   * Fires only on keyboard navigation (Arrow/Home/End) with the id of the
   * newly-selected enabled tab. The caller uses it to move DOM focus to that
   * tab's button — the hook itself never touches the DOM. Not called on click
   * (a native click already moves focus).
   */
  onNavigate?: (id: string) => void;
  orientation?: "horizontal" | "vertical";
}

export interface TabProps {
  role: "tab";
  tabIndex: 0 | -1;
  "aria-selected": boolean;
  "aria-disabled": true | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

export interface UseTabListResult {
  getTabProps(item: TabListItem, index: number): TabProps;
}

function enabledIndex(
  items: readonly TabListItem[],
  from: number,
  dir: 1 | -1
): number {
  const n = items.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function firstEnabled(items: readonly TabListItem[]): number {
  const i = items.findIndex((it) => !it.disabled);
  return i === -1 ? 0 : i;
}

function lastEnabled(items: readonly TabListItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (!items[i].disabled) return i;
  }
  return items.length - 1;
}

export function useTabList({
  items,
  value,
  onChange,
  onNavigate,
  orientation = "horizontal",
}: UseTabListOptions): UseTabListResult {
  const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
  const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";

  function select(index: number): void {
    const item = items[index];
    if (item && !item.disabled) {
      onChange(item.id);
      onNavigate?.(item.id);
    }
  }

  return {
    getTabProps(item, index) {
      return {
        role: "tab",
        tabIndex: item.id === value ? 0 : -1,
        "aria-selected": item.id === value,
        "aria-disabled": item.disabled ? true : undefined,
        onClick() {
          if (!item.disabled) onChange(item.id);
        },
        onKeyDown(event) {
          switch (event.key) {
            case nextKey:
              event.preventDefault();
              select(enabledIndex(items, index, 1));
              break;
            case prevKey:
              event.preventDefault();
              select(enabledIndex(items, index, -1));
              break;
            case "Home":
              event.preventDefault();
              select(firstEnabled(items));
              break;
            case "End":
              event.preventDefault();
              select(lastEnabled(items));
              break;
            case "Enter":
            case " ":
              event.preventDefault();
              break;
            default:
              break;
          }
        },
      };
    },
  };
}
