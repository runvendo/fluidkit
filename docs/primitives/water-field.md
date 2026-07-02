# WaterField

An optional GPU tier primitive: a real WebGL fluid simulation from [`webgl-fluid-enhanced`](https://www.npmjs.com/package/webgl-fluid-enhanced), wrapped with the fluidkit contract: WebGL capability detection, `prefers-reduced-motion` gating, off-screen pause/resume, and teardown on unmount.

Unlike the core primitives, `WaterField` ships behind its own subpath export so the core `fluidkit` entry never pulls in a GPU dependency. It is an optional peer: install it only if you want this component.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden`, so you place it inside a positioned parent alongside your real content. Unlike fluidkit's purely decorative ambient backgrounds (`MeshGradient`, `Aurora`), `WaterField` is meant to be touched: the canvas itself (not the wrapper) gets pointer events when `interactive` is on.

## Install

```bash
npm i webgl-fluid-enhanced
```

fluidkit's peer range is `^0.8.0`. Note: the package's own README documents an outdated pre-0.7 free-function API. fluidkit's wrapper is written against the real, current class-based `0.8.0` API, not the stale README.

```tsx
import { WaterField } from "fluidkit/water-field";
```

Importing from the core `fluidkit` entry never resolves `webgl-fluid-enhanced`; only importing this subpath does.

## Props

`WaterField` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `colors` | `string[]` | library default (random per-splat) | Splat color palette, each entry passed through `resolveColor`. Maps to `colorPalette`. Omitted entirely (not set to `[]`) when undefined, so the library's own random-per-splat behavior applies. |
| `intensity` | `number` | `0.6` | Splat strength, `0`-`1`. Maps to `splatRadius` and `splatForce`, linearly scaled and anchored so the default `0.6` reproduces the library's own defaults exactly. |
| `interactive` | `boolean` | `true` | Whether the field responds to pointer input. Maps to `hover` in the sim config AND `pointer-events` on the canvas, two separate mechanisms, both required. |
| `config` | `FluidConfig` | `undefined` | Escape hatch, see below. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { WaterField } from "fluidkit/water-field";

function Hero() {
  return (
    <div style={{ position: "relative" }}>
      <WaterField />
      <YourContent />
    </div>
  );
}
```

A softer, non-interactive ambient field:

```tsx
<WaterField colors={["#ffb37a", "#6a0572"]} intensity={0.3} interactive={false} />
```

## Interactive semantics

`interactive` (default `true`) controls whether the field responds to the pointer, via two mechanisms that both matter:

1. **`hover` in the sim config**: when `true`, plain pointer movement over the canvas triggers splats (no mousedown/drag required).
2. **`pointer-events` on the `<canvas>`**: fluidkit's wrapper keeps `pointer-events: none` on the outer div (consistent with every other fluidkit ambient primitive), but the `<canvas>` child gets an explicit `pointer-events: auto` override when `interactive` is true. A child's explicit `pointer-events` value always wins over an ancestor's `none`, so this re-enables hit-testing on just the canvas without touching the wrapper's own contract. `aria-hidden` stays on the wrapper regardless: it is still decorative to assistive tech, splats or not.

Because the interactive canvas accepts pointer events, sibling content layered over the field needs `position: relative` (or any positioning that lifts it into a stacking context above the canvas) so it paints and hit-tests above the field; otherwise the canvas steals clicks meant for your content.

## The `config` escape hatch

`config` forwards raw options directly to `webgl-fluid-enhanced`'s `setConfig()`, applied after `colors`/`intensity`/`interactive` above, so any key set there wins:

```tsx
<WaterField config={{ bloom: false }} />
```

`config` can never defeat gating, not by a runtime override but by construction: whether the sim boots at all (capability + reduced motion) and whether it is paused (off-screen) are both decided by imperative calls (`new WebGLFluidEnhanced()`, `.start()`, `.togglePause()`) that `config` never reaches. `config` only ever flows into `setConfig()`, and the library's config type has no key representing "booted" or "paused" state.

`config`'s type is derived from the installed package's own (unexported) `setConfig` parameter type, so it cannot silently drift from upstream. It is advanced and unstable, mirroring the upstream package's own shape.

## Degrades to

- **No WebGL**: a static, cool-water gradient fallback (`data-fallback="true"`, the sim is never constructed) using the same colors the live sim would use.
- **Reduced motion**: the same static fallback. A WebGL simulation never boots under reduced motion, even if WebGL is available.
- **Off-screen**: the sim pauses (`togglePause()`) rather than tearing down, and resumes when scrolled back into view. Pausing stops physics stepping and pointer splats, though the sim's own render call keeps re-blitting the current static frame every tick until full teardown.

Capability is read once per mount, not at module import time (SSR-safe) and not on every render.

## Known limitations

- **No real dispose API**: `webgl-fluid-enhanced@0.8.0` exposes no `dispose()`/`destroy()` that releases the WebGL context, GPU textures, or compiled shader programs. On unmount, fluidkit calls `.stop()` (cancels the render loop, removes event listeners) and removes the `<canvas>` from the DOM, which drops the last strong reference to its WebGL context and makes it eligible for garbage collection, but nothing forces immediate reclamation via `WEBGL_lose_context`. On browsers or situations where GC is slow to run, the context and its GPU-side resources may outlive the component branch momentarily. This is an upstream limitation, not something fluidkit can work around.
