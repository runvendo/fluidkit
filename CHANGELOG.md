# Changelog

## Unreleased

- **CI on GitHub Actions.** Runs `typecheck`, `test`, `build`, `size` (bundle budget), `check:gpu-leak` (core-bundle guard), and `check:pack` (verify npm contents) on Node 20 and 24.
- **Bundle-size budget.** 8.7 kB brotli on the core entry via size-limit; enforced in CI.
- **GPU dependency guard.** Core bundle verified free of GPU dependencies to support the upcoming optional GPU tier.
- **npm pack verification.** Guard ensures pack contents match expectations; runs in CI.
- **MIT LICENSE file added.**

## 0.3.0

- **LiquidTabs on the liquid engine.** The indicator is now an engine body: on tab change the old pill drains while the new one fills, a metaball tension bridge stretches between them, snaps free past the snap distance, and the new pill settles on a taut spring. Labels stay on an unfiltered sibling layer; reduced motion snaps instantly.
- **Pointer interaction API.** `Droplets` gains `interactive` plus `onGrab` / `onTear` / `onRelease`: grab a drop, drag it out (the neck stretches), tear it off past the snap distance, and it springs back and re-merges on release. The physics are the engine's normal tension hysteresis.
- **Performance pass.** `LiquidRenderer` exposes an imperative `LiquidSceneHandle`; `Droplets`, `MorphSurface`, and the tabs indicator write per-frame clip-path strings and specular ellipse attributes straight to the DOM — animation loops no longer commit React updates.
- **Morph polish.** Satellites ride their own softer spring (`stiffness 150 / damping 14`) instead of sharing the body spring; `useMotionSprings` supports per-slot configs and single-slot retargeting.
- **Opt-in refraction.** `refraction?: boolean` (default off) on `Droplets`, `Thinking`, and `MorphSurface`: Chromium-only edge lensing via an SVG `feDisplacementMap` inside `backdrop-filter`, gated on feature detection; degrades silently to plain glass blur.
- **Goo stack deleted.** `useGoo` and `src/filters/*` are gone — nothing uses the blur+contrast filter anymore.
- **Docs site.** The playground is now the public site: hero, per-component sections with live demos, controls, and copy-paste snippets; `npm run build:site` produces a deployable static bundle.

## 0.2.0

- **The liquid engine.** Real metaball geometry (circle / rounded-rect subpaths plus bezier bridge curves) applied per frame as a live `clip-path`; spring-driven motion via Motion; surface tension with hysteresis (connect on touch, stretch, snap past ~1.3x combined radii; the neck never thins to a hairline).
- **Materials as a prop.** The same shape renders as `glass` (white tint + backdrop blur/saturation, specular highlights from one shared, configurable scene light, toggleable via `reflection`), `mercury` (solid liquid metal — no gradient, no painted highlight), or `flat` (plain color; automatic fallback when `backdrop-filter` is unsupported).
- **Primitives rebuilt on the engine.** `Droplets` (tension cluster + optional pointer-chasing drop), `Thinking` (merge/split status indicator), `MorphSurface` (pill → panel with satellite absorption; content faces only cross-fade — text never scales, never rasterizes).
- **Rendering constraints encoded as tests.** clip-path and backdrop-filter never share an element; no CSS blur() for decorative glows; inline svg overlays carry explicit sizes; glass never backdrop-samples its own shadow.
- Light-mode-first playground rebuilt around the engine.
