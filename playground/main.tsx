import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Snippet } from "./showcase/kit";
import { REGISTRY } from "./showcase/registry";
import "./showcase/styles.css";

/* ------------------------- shell: sidebar + hash router ------------------------- */
// The registry is static, so each page's lazy wrapper is created exactly once
// here — recreating it per render would remount the page on every state change.
const PAGES = REGISTRY.map((entry) => ({ ...entry, Page: lazy(entry.load) }));

/** Slug from `#/<slug>`; empty string for anything else. */
function slugFromHash(hash: string): string {
  return hash.startsWith("#/") ? hash.slice(2) : "";
}

function useHashSlug(): string {
  const [slug, setSlug] = useState(() => slugFromHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setSlug(slugFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return slug;
}

function Sidebar({ activeSlug }: { activeSlug?: string }) {
  const core = PAGES.filter((p) => !p.isGpu);
  const gpu = PAGES.filter((p) => p.isGpu);
  const navLink = (p: (typeof PAGES)[number]) => (
    <a key={p.slug} href={`#/${p.slug}`} className={p.slug === activeSlug ? "on" : ""}>{p.title}</a>
  );
  return (
    <nav className="sc-sidebar">
      <a className="sc-wordmark" href={PAGES.length ? `#/${PAGES[0].slug}` : "#"}>fluidkit</a>
      <div className="sc-install">
        <Snippet code="npm install fluidkit react react-dom motion" />
      </div>
      <div className="sc-nav">
        {core.map(navLink)}
        {gpu.length ? <div className="sc-nav-label">GPU tier</div> : null}
        {gpu.map(navLink)}
      </div>
      <div className="sc-side-foot">
        MIT · <a href="https://github.com/yousefh409/fluidkit">github.com/yousefh409/fluidkit</a>
      </div>
    </nav>
  );
}

function App() {
  const slug = useHashSlug();
  // Unknown or empty hash falls back to the first registry entry.
  const active = PAGES.find((p) => p.slug === slug) ?? PAGES[0];
  useEffect(() => {
    // Keep the URL honest after a fallback (replace, so Back still works).
    if (active && active.slug !== slug) window.location.replace(`#/${active.slug}`);
  }, [active, slug]);
  return (
    <>
      <Sidebar activeSlug={active?.slug} />
      <main className="sc-main">
        {active ? (
          <Suspense fallback={null}>
            <active.Page />
          </Suspense>
        ) : null}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
