import { useEffect, useLayoutEffect } from "react";

/** Internal (not in the public utils barrel): `useLayoutEffect` in the
 * browser, `useEffect` during SSR — silences React's "useLayoutEffect does
 * nothing on the server" warning without changing client behavior. */
export const useIsomorphicLayoutEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;
