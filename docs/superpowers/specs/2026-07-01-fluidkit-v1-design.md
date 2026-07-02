# fluidkit v0.5 + v1.0 Umbrella Design

Scope: everything remaining through the 1.0 release, per the roadmap in
`2026-07-01-fluidkit-design.md`. Five sub-projects, each getting its own
implementation plan. Endpoint: the package is publish-ready and verified; Yousef runs
the final `npm publish` himself.

Decisions locked during brainstorming:

- Scope is v0.5 and v1.0 together, built in the order below.
- GPU tier wraps third-party libraries (both of them) rather than hand-rolling shaders.
- Publishing is manual by the user; CI verifies the tarball but never publishes.
- One umbrella spec (this file), one implementation plan per sub-project.

## Build order

1. Infrastructure (CI + bundle budget)
2. Interaction primitives (JellyButton/useSquish, Magnetic, LiquidDrag, DripFuse)
3. Ambient backgrounds (MeshGradient, Aurora)
4. GPU tier (LiquidMetal, WaterField)
5. 1.0 release readiness (API review, a11y pass, SSR verification, packaging)

## 1. Infrastructure

- GitHub Actions workflow on push/PR: typecheck, vitest, build, size-limit.
- Bundle budget via `size-limit` on the core entry. Measure the current built size
  first, pin the budget at that plus 20 percent headroom, and fail CI on regression.
  Re-pin deliberately (with a commit) when new core primitives land.
- A CI check asserts the core bundle contains zero bytes from the GPU dependencies.
- CI runs `npm pack --dry-run` and verifies the tarball file list.

## 2. Interaction primitives

No new dependencies; Motion plus the existing liquid engine. Two kinds.

Surface primitives (engine-rendered, take `material` like the rest of the library):

- `DripFuse`: a drop swells off a source body, the neck stretches and tears using the
  engine's existing tension hysteresis, the drop springs to the target and fuses
  through a real bridge. Degrades to fade-out at source / fade-in at target. Reduced
  motion: instant swap.
- `JellyButton` + `useSquish`: a pill surface that squashes on press
  (volume-preserving scaleX/scaleY spring) and jiggles on release. `useSquish`
  exposes handlers + transform values for arbitrary elements. Reduced motion: no
  deformation.

Behavior wrappers (wrap arbitrary children, no surface of their own):

- `Magnetic`: child is pulled toward the pointer inside a radius on a spring, snaps
  back on leave. Props: `strength`, `radius`. Reduced motion: off.
- `LiquidDrag`: draggable wrapper whose child stretches along drag velocity and
  settles with a wobble. Props: `elasticity`, drag-constraint passthrough. Reduced
  motion: plain drag, no deformation.

All four: reduced-motion collapse, SSR-safe, pause off-screen where a loop exists.
Visual tuning happens in the playground over 2 to 4 prototype review rounds.

## 3. Ambient backgrounds

CSS tier, cheap, in the core bundle. Both are pure decoration (`aria-hidden`), pause
off-screen via the existing `useInView`, and render their static frame under reduced
motion.

- `MeshGradient`: a handful of large blurred radial blobs drifting on long-period
  transforms. Props: `colors`, `speed`, `blur`. Degrades to a static gradient of the
  same colors. Deliberately the zero-dependency version (Paper Shaders' GPU mesh
  gradient is not used here).
- `Aurora`: same machinery, different composition: soft horizontal bands that drift
  and shimmer. Props: `colors`, `intensity`, `speed`. Same degradation story.

## 4. GPU tier

- `LiquidMetal` wraps `@paper-design/shaders-react` (its LiquidMetal shader). Pinned
  to an exact version: upstream ships breaking changes under 0.0.x.
- `WaterField` wraps `webgl-fluid-enhanced` (pointer-interactive fluid simulation as
  a hero background). MIT, TypeScript, zero-dependency.
- Both live behind subpath exports, `fluidkit/liquid-metal` and
  `fluidkit/water-field`, with the wrapped libraries declared as optional peer
  dependencies (`peerDependenciesMeta`). Importing the core entry never resolves
  them; installing fluidkit without them never warns.
- The wrappers add the fluidkit contract the raw libraries lack: WebGL feature
  detection with graceful fallback (LiquidMetal falls back to a static gradient,
  WaterField to a static/mesh background), reduced-motion collapse to a static
  frame, off-screen pausing, SSR safety (no window access until mounted), and prop
  names consistent with the rest of the library.

## 5. 1.0 release readiness

- Stable API review: one pass over every exported component, hook, and prop for
  consistent naming (`material`, `light`, `refraction`, `speed`, `colors`),
  consistent defaults, and no accidental exports of engine internals. Engine
  internals stay private for 1.0. Breaking renames are allowed in this pass; each
  gets a CHANGELOG entry.
- A11y pass: decorative surfaces `aria-hidden`; `Thinking` keeps `role="status"`;
  interactive primitives (JellyButton, LiquidTabs, Droplets interactive mode,
  LiquidDrag) keyboard-reachable with visible focus; constraint tests prove no
  animation loop starts under `prefers-reduced-motion`.
- SSR verification: a Node test that imports the built package (`dist`, not `src`)
  and `renderToString`s every component including both GPU wrappers. Runs in CI.
- Packaging: exports map gains the two GPU subpaths (ESM + CJS + types each);
  `peerDependenciesMeta` marks GPU libraries optional; README covers the full 1.0
  catalog; CHANGELOG 1.0.0; version bump; `npm pack --dry-run` verified in CI.
- Endpoint: everything green; Yousef runs `npm publish`. The name `fluidkit` was
  confirmed unclaimed on npm on 2026-07-01.

## Testing strategy

Same pattern as v0.2/v0.3:

- TDD the pure logic (squish math, drip state machine, feature detects).
- Render tests per component, including every degradation path.
- Constraint tests for the rendering rules (clip-path vs backdrop-filter separation,
  no CSS blur for glows, reduced-motion never animates).
- Visual truth: playground prototypes reviewed live over 2 to 4 rounds per primitive.

## Non-goals

- No hand-rolled WebGL shaders or fluid simulation.
- No Safari/Firefox parity chase for refraction or GPU effects; graceful fallback.
- No automated npm publishing from CI.
- No new v0.5 primitives beyond the six listed.
