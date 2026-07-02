/**
 * Injects a `<style>` tag into `<head>` exactly once per `id`, per document.
 *
 * Shared by ambient background components (`MeshGradient`, `Aurora`, ...)
 * that each need a small, content-free `@keyframes` block available before
 * their animated elements can reference it. Guarded by a presence check
 * rather than a ref-count: cheap and idempotent across many instances of the
 * same component. The tradeoff is that the `<style>` tag outlives every
 * unmounted instance (never removed) — an acceptable cost for a few bytes of
 * shared CSS.
 *
 * SSR-safe: a no-op when `document` doesn't exist. Callers must only invoke
 * this from an effect (never at module scope or render time), so it never
 * runs during server rendering.
 */
export function injectStyleOnce(id: string, css: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
