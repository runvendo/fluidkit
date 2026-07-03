# LiquidMetal

An optional GPU tier primitive: a real WebGL liquid-metal shader from [`@paper-design/shaders-react`](https://www.npmjs.com/package/@paper-design/shaders-react), wrapped with the fluidkit contract the raw shader lacks: WebGL capability detection, `prefers-reduced-motion` gating, and off-screen pausing.

Unlike the core primitives, `LiquidMetal` ships behind its own subpath export so the core `fluidkit` entry never pulls in a GPU dependency. It is an optional peer: install it only if you want this component.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, so you place it inside a positioned parent alongside your real content, the same as `MeshGradient` and `Silk`. By default it fills that parent edge-to-edge with the flowing metal pattern (the shader's own "Backdrop" preset), not a floating shape.

## Install

```bash
npm i @paper-design/shaders-react@0.0.76
```

The version is pinned exact, not a range. `@paper-design/shaders-react` ships breaking changes across `0.0.x` releases, so fluidkit locks to the exact version it was verified against rather than a caret range that could silently pull in an incompatible shader API.

```tsx
import { LiquidMetal } from "fluidkit/liquid-metal";
```

Importing from the core `fluidkit` entry never resolves `@paper-design/shaders-react`; only importing this subpath does.

## Props

`LiquidMetalProps` extends `HTMLAttributes<HTMLDivElement>` **and the shader's own param surface** (`LiquidMetalParams`): every knob the shader exposes is a top-level prop with its upstream name and range. No renamed aliases, no escape-hatch object.

| Name | Type | Default | Description |
|---|---|---|---|
| `colorBack` | `string` | `"#AAAAAC"` | Base color behind the metal. Accepts CSS custom properties (`"var(--brand)"`). |
| `colorTint` | `string` | `"#ffffff"` | Overlay color (color-burn blended). Accepts CSS custom properties. |
| `speed` | `number` | `1` | Animation speed multiplier, clamped above `0`. Forced to `0` while off-screen. |
| `repetition` | `number` | `1.5` | Density of pattern stripes (`1`–`10`). |
| `softness` | `number` | `0.05` | Color transition sharpness (`0` hard edge – `1` smooth gradient). |
| `distortion` | `number` | `0.1` | Noise distortion over the stripe pattern (`0`–`1`). |
| `contour` | `number` | `0.4` | Distortion strength on shape edges (`0`–`1`). |
| `shiftRed` / `shiftBlue` | `number` | `0.3` / `0.3` | R/B channel dispersion (`-1`–`1`). |
| `angle` | `number` | `90` | Pattern animation direction in degrees (`0`–`360`). |
| `shape` | `"none" \| "circle" \| "daisy" \| "diamond" \| "metaballs"` | `"none"` | Mask shape when no `image` is provided. `"none"` fills the canvas. |
| `image` | `HTMLImageElement \| string` | `undefined` | Image mask: the metal effect is applied inside the image's shape. |
| `fit`, `scale`, `rotation`, `originX/Y`, `offsetX/Y`, `worldWidth/Height` | — | preset | Standard shader sizing params, forwarded as-is (`scale` defaults to `1`). |
| `frame` | `number` | `undefined` | Fixed animation frame. |
| `className` / `style` | — | `undefined` | Applied to the wrapper div. |

Defaults mirror the shader's own `fullScreenPreset` ("Backdrop"), verified against the installed `0.0.76` package by a pin-bump canary test. The upstream `defaultPreset` (a small floating diamond) is deliberately **not** the fluidkit default — a background component should fill its container.

## Usage

```tsx
import { LiquidMetal } from "fluidkit/liquid-metal";

function Hero() {
  return (
    <div style={{ position: "relative" }}>
      <LiquidMetal />
      <YourContent />
    </div>
  );
}
```

Denser, softer stripes:

```tsx
<LiquidMetal repetition={4} softness={0.6} distortion={0.3} />
```

Mask it back down to an object:

```tsx
<LiquidMetal shape="metaballs" scale={0.7} />
```

## Degrades to

- **No WebGL**: a static metallic-gradient fallback (`data-fallback="true"`, the shader never mounts) using the same `colorBack`/`colorTint` values the live shader would use.
- **Reduced motion**: the same static fallback. A WebGL shader never boots under reduced motion, even if WebGL is available.
- **Off-screen**: the shader stays mounted (tearing down and recreating a WebGL context on every scroll is more expensive than leaving it parked), but its `speed` is forced to `0`, which stops the shader's internal render loop entirely. The pause gate always wins — no prop combination can keep the shader animating off-screen.

Capability is read once per mount, not at module import time (SSR-safe) and not on every render.

## Known limitations

- **Context loss**: the underlying `ShaderMount` registers no `webglcontextlost`/`webglcontextrestored` handlers. If the browser evicts the WebGL context at runtime (GPU pressure, tab backgrounding on some platforms), the canvas goes blank until the component remounts. Capability detection only gates boot-time capability; it cannot protect against a context lost after mount. This is an upstream limitation, not something fluidkit can work around.
