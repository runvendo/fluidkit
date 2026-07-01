/**
 * React entry point for the shared filter defs singleton.
 *
 * Mount this hook in any primitive that relies on `fluidkit-goo` /
 * `fluidkit-lens` (referenced via `gooFilterUrl()` / `lensFilterUrl()`) so
 * the hidden defs node exists in the DOM for as long as at least one such
 * primitive is mounted, and is cleaned up once none remain.
 *
 * Effect-only by design: acquire/release run inside `useEffect`, which never
 * executes during server rendering, so this is SSR-safe on its own — on top
 * of the injector's own `document` guard.
 */

import { useEffect } from "react";
import { acquireDefs, releaseDefs } from "./injectDefs";

export function useFilterDefs(): void {
  useEffect(() => {
    acquireDefs();
    return () => {
      releaseDefs();
    };
  }, []);
}
