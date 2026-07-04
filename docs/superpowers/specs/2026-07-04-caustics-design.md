# Caustics — design

Date: 2026-07-04
Status: approved (pending spec review) · v2 — reshaped from standalone background to engine material

## What it is

Caustics — the webbed light patterns sunlight makes through water ("poolside light") —
ships as a **first-class liquid-engine material**, joining `glass`, `mercury`, and
`flat`. Every surface component that takes the engine `material` prop gets
`material="caustics"` natively: LiquidCard, LiquidPanel, LiquidDialog, LiquidTooltip,
JellyButton, MorphSurface, Droplets, Thinking, VoiceBall, MeniscusDivider.

A thin `Caustics` background component (sibling to `Silk` / `MeshGradient`) wraps the
same layer for whole-surface backdrops, using the established backgrounds contract
(`position: absolute; inset: 0; pointer-events: none` inside a `position: relative`
parent).

## How we got here

Judged live across five prototype rounds (water lab):

- Water direction narrowed to ambient caustic light. Interactive water (fluid cursor,
  water-glass card, wave simulation) was prototyped through a real Navier–Stokes pass
  and **dropped for now**; lab pages preserved for a future revisit.
- Look: warm, quiet, light-mode; light as a material, not blue paint. Slow drift,
  light concentrated in a soft diagonal sunbeam band.
- Engine: **WebGL**, chosen over a purpose-built CSS/SVG twin in a side-by-side
  face-off (shader light continuously *reforms*; CSS can only drift fixed patterns).
- Shipping shape: **engine material** (user decision), with the background component
  layered on top of the same internals.

## Architecture

One new engine piece, one hook point, one thin component:

1. **`CausticsLayer`** (internal, `src/liquid/caustics.tsx`) — the WebGL canvas:
   fullscreen-triangle fragment shader, absolute-inset, pointer-events none. Owns
   boot, resize, visibility gating, fallback, and cleanup. Shared by both consumption
   modes. ~2–3 kB min+gz, no dependencies.
2. **Material system** (`src/liquid/materials.ts`) — `LiquidMaterial` gains
   `"caustics"`. `resolveMaterial("caustics", …)` returns:
   - `fillStyle`: the plaster-gradient CSS base — this is also the SSR / no-WebGL
     rendering, so the surface never flashes or blacks out;
   - `kind: "caustics"` as the renderer's signal to mount the layer;
   - `specular: false` — the caustic light *is* the highlight; painting the glass
     speculars on top would double the light sources (house rule: one light).
3. **`LiquidRenderer`** (`src/liquid/LiquidRenderer.tsx`) — when
   `material.kind === "caustics"`, renders `<CausticsLayer/>` inside the existing
   clipped fill div, above `fillStyle`. The surface's `clipPath` clips the canvas for
   free. **No surface component changes** — all ten pick the material up through the
   renderer.
4. **`Caustics` component** (`src/components/Caustics.tsx`) — backgrounds-family
   wrapper: plaster base + `CausticsLayer`, exposing the raw knobs.

## Public API

Surfaces (no new props on components):

```tsx
<LiquidCard material="caustics" />
<JellyButton material="caustics" />
```

Material-level tuning reuses the two color options every surface already forwards —
no new options, no new component props:

- `color` → wall/base color (default: soft plaster);
- `tint` → the light's color (default: warm ivory) — consistent with glass, where
  `tint` already means "the material's optical color".

```tsx
<LiquidCard material="caustics" tint="#dbeaff" color="#10161a" />  // moonlit dark card
```

Motion knobs are engine defaults on surfaces — surfaces should look right out of the
box, not sprout six props.

Backdrop (raw params, backgrounds house rule):

```ts
export interface CausticsProps extends HTMLAttributes<HTMLDivElement> {
  /** Light color. Defaults to warm ivory. */
  color?: string;
  /** Wall color: one color or a [top, bottom] pair. Defaults to soft plaster. */
  background?: string | [string, string];
  /** Brightness of the light webs, 0-1. Defaults to 0.5. */
  intensity?: number;
  /** Size of the light pattern; higher = larger webs. Defaults to 1. */
  scale?: number;
  /** Drift rate; 1 is the quiet default rate. */
  speed?: number;
  /** Strength of the diagonal sunbeam the light lives in, 0-1 (0 = uniform light). Defaults to 0.55. */
  band?: number;
}
```

## Rendering

- WebGL1, one fullscreen triangle, one fragment shader.
- **The shader must be an original clean-room implementation.** The prototype adapted
  the "Tileable Water Caustic" Shadertoy (CC BY-NC-SA); that code cannot ship in an
  MIT library. Reimplement the look with our own math (iterative domain-warped sine
  accumulation or Voronoi-ridge extraction), tuned by eye against the approved
  prototype.
- All knobs are uniforms; prop changes never recompile the program.
- Canvas resolution tracks element size via `ResizeObserver`, DPR capped at 1.5.
- rAF gated by `IntersectionObserver` (offscreen surfaces render nothing per frame);
  browser rAF throttling covers hidden tabs.
- Small surfaces (buttons, tooltips) get the same shader at tiny cost — resolution
  scales with the element.

## Degradation & lifecycle

- No WebGL / context or compile failure → the layer renders nothing; the material's
  CSS `fillStyle` beneath it is the design's own fallback. Never throw, never black.
- `prefers-reduced-motion: reduce` → render one still frame, no loop.
- `webglcontextlost` → prevent default, one restore attempt; on failure remove the
  canvas.
- SSR-safe: no `window`/GL at module scope; GL boots in an effect post-mount.
- Unmount: cancel rAF, disconnect observers, `WEBGL_lose_context` when available.
- Many caustic surfaces on one page each own a small context; browsers cap contexts
  (~8–16) — document the guidance (a page should have a handful, not dozens) and
  degrade gracefully to the CSS base when context creation is refused.

## Files

- `src/liquid/caustics.tsx` — `CausticsLayer` + shader (new).
- `src/liquid/materials.ts` — `"caustics"` kind + `light` option.
- `src/liquid/LiquidRenderer.tsx` — mount hook for the layer.
- `src/components/Caustics.tsx` — background component (new).
- `src/components/index.ts`, `src/index.ts`, `src/liquid/index.ts` — exports.
- Tests: `tests/liquid/materials.test.ts` (resolve + fallback contract),
  `tests/liquid/caustics.test.tsx` (layer lifecycle in jsdom → fallback branch,
  reduced motion, cleanup), `tests/components/Caustics.test.tsx` (backgrounds
  contract, prop passthrough), plus one surface smoke test
  (`LiquidCard material="caustics"` renders content + base fill in jsdom).
- `docs/primitives/caustics.md` — both consumption modes.
- `playground/showcase` — registry entry + page: backdrop hero, card/button/panel
  with `material="caustics"`.
- `CHANGELOG.md`; size budget re-pinned.

## Out of scope (explicitly)

- Interactive water (fluid cursor, water-glass, ripple sim) — parked; own spec if revived.
- Components with their own material enums (`Silk`, `Ripple`, `LiquidText`,
  `LiquidTabs`) — unchanged this round.
- Dark-mode tuning beyond raw color props.
- Framework-agnostic core.
