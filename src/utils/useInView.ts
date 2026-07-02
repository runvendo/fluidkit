/**
 * Off-screen pause detection.
 *
 * Looping primitives (Droplets, Thinking) should stop animating while
 * their element is scrolled out of view, to save CPU/GPU. This hook is the
 * shared mechanism: it watches a DOM node with IntersectionObserver and
 * reports whether it's currently intersecting the viewport.
 *
 * Default when IntersectionObserver is unavailable (SSR, old browsers) is
 * `true` (in view). We can't observe visibility there, and defaulting to
 * `false` would permanently freeze the animation — `true` is the safe
 * choice: worst case we animate when we didn't strictly need to, rather
 * than never animating at all.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseInViewResult<T extends Element> {
  /** Attach to the element that should be observed. */
  ref: (node: T | null) => void;
  /** Whether the observed element is currently in view. */
  inView: boolean;
}

export function useInView<T extends Element = Element>(
  options?: IntersectionObserverInit
): UseInViewResult<T> {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(true);

  // Ref callback: fires with the DOM node once it's mounted/unmounted, so
  // the observation effect below can (re)run whenever the target changes.
  const ref = useCallback((next: T | null) => {
    setNode(next);
  }, []);

  // Keep the latest options without re-triggering the effect on every
  // render if the caller passes a fresh object literal each time.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      // No observer available: stay in the safe "in view" default.
      setInView(true);
      return;
    }

    if (!node) {
      return;
    }

    // Not yet observed by this instance's observer.
    setInView(false);

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) {
        setInView(entry.isIntersecting);
      }
    }, optionsRef.current);

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node]);

  return { ref, inView };
}
