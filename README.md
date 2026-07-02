# fluidkit

[![CI](https://github.com/yousefh409/fluidkit/actions/workflows/ci.yml/badge.svg)](https://github.com/yousefh409/fluidkit/actions/workflows/ci.yml)

A React library of liquid UI animations built on one idea: **one liquid engine, swappable materials.** Shapes are real metaball geometry (computed bezier bridges applied as a live `clip-path`), motion is spring-driven with surface tension (drops connect on touch, stretch, and snap), and the same shape renders as clear glass, mercury, or a flat fill via a `material` prop. Built on top of [Motion](https://motion.dev).

## The core principle

**Animate the surface, never the text.** Every morph separates a surface layer (the liquid shape, free to scale, stretch, or merge) from a content layer (text / controls, which only cross-fades, never scales). Text always stays crisp.

## Install

```bash
npm install fluidkit react react-dom motion
```

`react`, `react-dom`, and `motion` are peer dependencies (bring your own shared copy).

## Quick start

```tsx
import { useState } from "react";
import { MorphSurface, Thinking } from "fluidkit";

function App() {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen((v) => !v)}>
      <MorphSurface
        open={open}
        closedContent={<span>Ask fluidkit</span>}
        openContent={open && <ChatPanel />}
      />
      {loading && <Thinking />}
    </div>
  );
}
```

## Primitives (v0.3)

| Primitive | What it does | Degrades to |
|---|---|---|
| [`MorphSurface`](docs/primitives/morph-surface.md) | One liquid body: pill morphs into panel, satellite droplets absorbed through real bridges | Instant snap + opacity-only face fade |
| [`Droplets`](docs/primitives/droplets.md) | Drop cluster with surface tension; grab / drag / tear / re-merge with the pointer (`interactive`) | Separate static dots |
| [`Thinking`](docs/primitives/thinking.md) | Working indicator: droplets merge and split (`role="status"`) | Three static dots |
| [`FlowStagger`](docs/primitives/flow-stagger.md) | Staggered rise + un-blur entrance for list items, FLIP on reorder | Simple simultaneous fade |
| [`LiquidTabs`](docs/primitives/liquid-tabs.md) | Flagship tab strip: the indicator flows between tabs (slide or stretch), ink or glass material, labels tint by liquid coverage | Plain pill, snaps instantly |
| [`Ripple`](docs/primitives/ripple.md) | Pointer-origin water ripple on tap/click | No ripple, children render normally |
| [`JellyButton`](docs/primitives/jelly-button.md) | Engine pill button that squashes on press via geometry; the label never scales | Normal button with an opacity press dip |
| [`Magnetic`](docs/primitives/magnetic.md) | Pulls its child toward the pointer inside a radius, springs back outside it | No listener, element never moves |
| [`LiquidDrag`](docs/primitives/liquid-drag.md) | Motion drag with velocity-driven volume-preserving stretch; wobbles back on release | Plain drag, scales pinned at 1 |
| [`DripFuse`](docs/primitives/drip-fuse.md) | A drop tears off a source body, flies, and fuses into a target; one cycle per `fire` | Static bodies, `onComplete` fires instantly |

### Materials

`MorphSurface`, `Droplets`, and `Thinking` take `material`:

- `glass` — white tint + backdrop blur/saturation, specular highlights from one configurable scene light (`light` prop), toggleable via `reflection`. Opt-in `refraction` adds Chromium-only edge lensing (SVG displacement inside `backdrop-filter`; degrades silently). A drop of water is liquid glass.
- `mercury` — solid liquid metal; no gradient, no painted highlight.
- `flat` — plain color; also the automatic fallback when `backdrop-filter` is unsupported.

## Cross-cutting guarantees

- **Reduced motion**: `prefers-reduced-motion` collapses every effect to a clean static state; animation loops never run.
- **SSR-safe**: nothing touches `window` at import time or during render.
- **Tree-shakeable**: named exports from a single entry point (`sideEffects: false`).
- **Theming**: colors, tint, light position, and physics via props. No brand shipped.
- **Graceful degradation**: feature detection picks the best available path; never hard-fails.
- **Performance**: animation loops pause off-screen (IntersectionObserver) and under reduced motion.

## Roadmap

- **v0.2**: the liquid engine + `Droplets`, `Thinking`, `MorphSurface` in glass/mercury/flat.
- **v0.3 (this release)**: `LiquidTabs` on the engine, grab/tear/re-merge pointer interactions, opt-in refraction, per-frame DOM writes (no React commits in animation loops), docs site.
- **v1.0**: stable API, a11y pass, npm publish.

## Docs site

The playground doubles as the public docs site: hero, live demos, controls, and copy-paste snippets for every primitive.

- Develop: `npm run dev`
- Build: `npm run build:site` → static bundle in `dist-site/`, deployable to any static host (GitHub Pages, Netlify, Vercel — no server needed).

## More

- Design spec: [`docs/superpowers/specs/2026-07-01-liquid-engine-design.md`](docs/superpowers/specs/2026-07-01-liquid-engine-design.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Development

- `npm test`: run tests
- `npm run typecheck`: type check the library
- `npm run size`: check bundle size (11.6 kB brotli budget on the core entry via size-limit)
- `npm run check:gpu-leak`: guard against GPU dependencies
- `npm run check:pack`: verify npm pack contents

All guards run in CI (Node 20 and 24).

## License

MIT
