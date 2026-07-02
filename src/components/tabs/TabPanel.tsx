/**
 * Content panel bound to a tab by id, via the enclosing TabsGroup context.
 *
 * Only the active panel renders. On switch the content cross-fades (opacity
 * only — text is never scaled, per the library's core principle); under
 * `prefers-reduced-motion` it hard-swaps. Panels wire `role="tabpanel"`, an id
 * matching the tab's `aria-controls`, and `aria-labelledby` back to the tab.
 *
 * Rendering nothing (returns null) when used outside a Group is intentional —
 * the panel has no value source to bind to.
 */

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "../../utils";
import { useTabsContext } from "./TabsGroup";

export interface TabPanelProps {
  /** Must match a tab item id. */
  id: string;
  children: ReactNode;
}

export function TabPanel({ id, children }: TabPanelProps) {
  const ctx = useTabsContext();
  const prefersReducedMotion = usePrefersReducedMotion();
  if (!ctx) return null;
  if (ctx.value !== id) return null;

  const panelId = `${ctx.namespace}-panel-${id}`;
  const labelledBy = `${ctx.namespace}-tab-${id}`;

  if (prefersReducedMotion) {
    return (
      <div role="tabpanel" id={panelId} aria-labelledby={labelledBy} data-fluidkit="liquid-tab-panel">
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        role="tabpanel"
        id={panelId}
        aria-labelledby={labelledBy}
        data-fluidkit="liquid-tab-panel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
