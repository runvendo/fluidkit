# Fluid Animation Library — Project Brief

> Hand this file to a fresh Orca/Claude Code session. It is self-contained: it explains
> what to build, the decisions already made, the guardrails, and where the working
> prototypes are. Start by reading this file, then open the `prototypes/` HTML files in
> Chrome to see every technique running.

## Working name

`fluid` (working title — pick the real npm name early). Candidates: **liquidkit**, **fluidkit**,
**mercury** (the metaball/liquid-metal metaphor), **goo**, **liquid-motion**. Not decided —
choose one, check npm availability, and rename freely. **The library must NOT be named or
scoped after Flowlet.** It is a standalone, general-purpose, open-source project.

## One-line pitch

A React library of **fluid / liquid UI animations** — the organic, "flows from one another,"
liquid-glass, metaball, and morph effects that general animation engines don't ship — built
**on top of Motion**, degrading cleanly everywhere.

## Why it exists

Motion (formerly Framer Motion) already nails springs, layout/FLIP, enter-exit, and
shared-element morphs. What no single package gives you is the *fluid material and organic
motion* layer: gooey metaballs that merge like mercury, Apple-style liquid-glass refraction,
flowing mesh / liquid-metal backgrounds, "thinking" blobs, drip-and-fuse, and a disciplined
pattern for morphing one component into another **without warping text**. This library is that
layer. Flowlet (a separate product) will be its first consumer, but the library knows nothing
about Flowlet.

## Decisions already locked (do not relitigate)

- **Foundation:** built **on top of Motion**. Motion is a `peerDependency` (consumers bring
  their own, one shared copy). Use Motion for springs, `layout`/`layoutId` (FLIP + shared-element
  morph), and `AnimatePresence`. **Do not reinvent a spring/physics/layout engine** — that is
  explicitly out of scope.
- **Surface:** **React components + hooks.** e.g. `<LiquidGlass>`, `<Metaballs>`,
  `<MorphSurface>`, `useGoo()`, `useMesh()`. React-first. (A framework-agnostic core can come
  later if there's demand; not now.)
- **License / posture:** open-source-shaped from day one — clean public API, docs, examples,
  **zero coupling to any specific app or design system.** The library accepts colors, sizes,
  and behavior via props / CSS custom properties; it ships no opinionated brand.
- **TypeScript**, tree-shakeable ESM (+ CJS), SSR-safe.

## The one non-negotiable principle

**Animate the surface, never the text.**

Morphing a component by scaling a bitmap snapshot (the default View Transitions behavior)
stretches and ghosts glyphs — the single biggest "cheap-looking" failure mode. Every morph in
this library must separate the **surface layer** (the shape/glass/blob — free to scale, stretch,
merge) from the **content layer** (text/controls — only ever cross-fades or translates a few px,
never scales). Prefer Motion's `layout`/`layoutId` (animates real layout boxes → text reflows
crisp) over raw View Transitions. See `prototypes/04-no-text-warp.html` for the wrong-vs-right
demonstration — this is the library's core value proposition, not a detail.

## The animation catalog (scope)

Each item: what it is, the technique, browser support, and how it degrades. Build the **v0.1
core** first (marked ★), then the rest.

| Primitive | What it is | Technique | Support / cost | Degrades to |
|---|---|---|---|---|
| ★ `MorphSurface` / `useMorph` | One component grows/becomes another with no text warp | Motion `layoutId` + surface/content layer split | All browsers | instant swap + fade |
| ★ `Metaballs` / `useGoo` | Flat, borderless, same-color blobs that merge like mercury | SVG `feGaussianBlur` + `feColorMatrix` alpha-contrast goo filter | All browsers, cheap | separate circles |
| ★ `ThinkingBlob` | Organic "working" indicator — blobs merge/split | goo filter + looped transforms | All browsers | 3-dot pulse |
| ★ `LiquidGlass` | Frosted glass panel, optional real refraction | `backdrop-filter: blur()` baseline + SVG `feDisplacementMap` refraction | Blur: all; **refraction: Chromium-only** | plain frosted blur |
| `DripFuse` | An element drips off a source and fuses into a target | goo filter + Motion path/position | All browsers | fade-in at target |
| `MeshGradient` | Slow flowing blurred color-blob background | animated blurred radial blobs (CSS) | All browsers, cheap | static gradient |
| `LiquidMetal` | Shader-based liquid-metal / iridescent surface | WebGL shader (consider wrapping/【optional dep】Paper Shaders `@paper-design/shaders-react`) | WebGL; heavier | mesh gradient or static |
| `FlowStagger` / `useFlow` | Children rise + un-blur + settle, staggered; siblings glide on change | Motion springs + `layout` | All browsers | simple fade |
| `WaterField` (stretch/optional) | Interactive GPU fluid sim as a hero background | WebGL Navier–Stokes (wrap `webgl-fluid-enhanced`) | Heavy, opt-in only | static/mesh |

Cross-cutting requirements for every primitive:
- **`prefers-reduced-motion`**: every effect collapses to a clean fade / static state. Non-negotiable, a11y-critical.
- **Theming-agnostic**: accept color/size/radius/intensity via props and/or CSS custom properties. No hardcoded brand.
- **Graceful degradation**: feature-detect (`document.startViewTransition`, `CSS.supports('backdrop-filter …')`, WebGL context). Never hard-fail; always fall back per the table.
- **SSR-safe**: no window access at import; guard effects.
- **Tree-shakeable**: importing `Metaballs` must not pull in the WebGL/water code.
- **Performance**: pause off-screen animations (IntersectionObserver); cap/limit expensive filters.

## Package shape (suggested, refine in-session)

Start as a **single package** (`src/` with one entry re-exporting all primitives + hooks).
Split into a workspace only if/when a WebGL-heavy module warrants isolating its deps. Suggested
internal structure: `components/`, `hooks/`, `filters/` (shared SVG defs), `utils/`
(feature-detect, reduced-motion, color), `styles/`. Ship a single injectable SVG `<defs>` block
(goo, lens filters) mounted once. Provide a docs/examples site (Vite or a docs framework) that
mirrors the prototype demos.

## Build / tooling (suggested)

TypeScript + `tsup` (or Vite lib mode) → ESM + CJS + types. `peerDependencies`: `react`,
`react-dom`, `motion`. Optional `peerDependenciesMeta` for WebGL extras (`@paper-design/shaders-react`,
`webgl-fluid-enhanced`) so they're only pulled when those primitives are used. Vitest +
Testing Library. Storybook or a Vite playground for visual iteration. Follow TDD where it makes
sense (feature-detect, color/reduced-motion utils are unit-testable; the visual layer is verified
by rendering + screenshot).

## Milestones

- **v0.1 (core):** the ★ primitives — `MorphSurface`, `Metaballs`/`useGoo`, `ThinkingBlob`,
  `LiquidGlass`, plus `FlowStagger`. Docs page per primitive. Reduced-motion + degradation wired.
- **v0.5:** `DripFuse`, `MeshGradient`, `LiquidMetal`. Examples site. Bundle-size budget + CI.
- **v1.0:** stable API, a11y pass, SSR verified, `WaterField` opt-in, published to npm.

## Prototypes (living references — open in Chrome)

These are the exact demos this design was validated against. Match their feel; improve the code.

- `prototypes/02-fluid-techniques.html` — the four techniques side by side (spring/FLIP, goo
  metaballs, mesh gradient, liquid-glass refraction) with cost/support labels.
- `prototypes/03-one-liquid-surface.html` — launcher→panel morph, the flat borderless metaball
  "one liquid mass," and card→overlay morph.
- `prototypes/04-no-text-warp.html` — **the core principle**: wrong (snapshot scale, text warps)
  vs. right (surface morphs, text crisp). Study this one closely.
- `prototypes/05-integrated-flowlet.html` — everything composed on a real chat panel: launcher
  morph, goo thinking blob, drip-fuse connect, optional refraction, reduced-motion handling.
- `prototypes/01-theme-lab.html` — theming/token playground (Flowlet-specific styling; useful for
  seeing how tokens drive a surface, ignore the Flowlet branding).

## Non-goals

- No custom spring/physics/layout engine (that's Motion's job).
- No coupling to Flowlet, or to any design system / brand.
- Not a component kit (buttons, inputs, etc.) — only the *fluid animation* layer.
- Don't chase Safari/Firefox parity for refraction; ship Chromium-enhanced + graceful fallback.

## Key references

- Motion — Layout animations (`layout`, `layoutId`, FLIP, shared element): https://motion.dev/docs/react-layout-animations
- Motion for React (getting started): https://motion.dev/docs/react
- Liquid Glass in CSS/SVG (refraction technique): https://kube.io/blog/liquid-glass-css-svg/
- `samasante/liquid-glass` (headless React lens, prior art): https://github.com/samasante/liquid-glass
- Gooey effect (metaballs): https://css-tricks.com/gooey-effect/
- View Transitions API (and why we prefer Motion's layout for morphs): https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- WebGL fluid sim (optional hero): https://paveldogreat.github.io/WebGL-Fluid-Simulation/

## First consumer

Flowlet (separate repo) will incorporate this library for its Codex-styled agent UI —
launcher morph, thinking blob, drip-fuse connect, liquid-glass panels. Keep the API generic
enough that Flowlet is just one of many possible consumers.
