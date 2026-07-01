/**
 * Imperative, ref-counted singleton that keeps the shared filter defs (see
 * `defs.ts`) mounted in the DOM for as long as at least one consumer needs
 * them, and removes them once the last consumer is gone.
 *
 * `acquireDefs()` / `releaseDefs()` are the only two entry points; nothing
 * here runs at module import time (no top-level DOM work), and both
 * functions no-op safely when `document` is unavailable (SSR). The public
 * surface for components is `useFilterDefs.ts`, which drives these from a
 * React effect.
 */

import { createFilterDefsElement, DEFS_CONTAINER_ID } from "./defs";

// Module-level ref count of active consumers. Lives only in memory (not on
// the DOM node) so it survives independently of any stray/HMR-leftover node.
let refCount = 0;

/**
 * Registers one consumer of the shared defs. Mounts the singleton `<svg>`
 * the first time it's needed. Idempotent: if the node is already present
 * (including a stray one left over from HMR) it is never duplicated.
 */
export function acquireDefs(): void {
  if (typeof document === "undefined") {
    return;
  }

  refCount += 1;

  if (!document.getElementById(DEFS_CONTAINER_ID)) {
    document.body.appendChild(createFilterDefsElement(document));
  }
}

/**
 * Unregisters one consumer. Removes the singleton `<svg>` once the last
 * consumer releases it. The count never goes negative — an unmatched
 * release is a no-op rather than corrupting future acquires.
 */
export function releaseDefs(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (refCount === 0) {
    return;
  }

  refCount -= 1;

  if (refCount === 0) {
    document.getElementById(DEFS_CONTAINER_ID)?.remove();
  }
}
