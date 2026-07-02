# LiquidMetal

An optional GPU tier primitive: a real WebGL liquid-metal shader from [`@paper-design/shaders-react`](https://www.npmjs.com/package/@paper-design/shaders-react), wrapped with the fluidkit contract the raw shader lacks: WebGL capability detection, `prefers-reduced-motion` gating, off-screen pausing, and fluidkit-consistent prop names.

Unlike the core primitives, `LiquidMetal` ships behind its own subpath export so the core `fluidkit` entry never pulls in a GPU dependency. It is an optional peer: install it only if you want this component.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, so you place it inside a positioned parent alongside your real content, the same as `MeshGradient` and `Aurora`.

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

`LiquidMetal` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | `"#ffffff"` | Metal highlight/overlay color. Maps to the shader's `colorTint`. |
| `backgroundColor` | `string` | `"#AAAAAC"` | Base color behind the metal. Maps to the shader's `colorBack`. |
| `speed` | `number` | `1` | Animation speed multiplier, forwarded 1:1 to the shader's `speed`, clamped above `0`. |
| `intensity` | `number` | `0.07` | Effect strength, `0`-`1`. Maps to the shader's `distortion`, the closest analog it exposes to an overall "how pronounced is the effect" knob (the upstream API has no prop literally named `intensity`). |
| `shaderProps` | `Partial<LiquidMetalShaderProps>` | `undefined` | Escape hatch, see below. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

Defaults for `color`, `backgroundColor`, and `intensity` mirror the shader's own `defaultPreset`, so fluidkit's defaults render identically to the upstream default look.

## Usage

```tsx
import { LiquidMetal } from "fluidkit/liquid-metal";

function Loading() {
  return (
    <div style={{ position: "relative" }}>
      <LiquidMetal />
      <YourContent />
    </div>
  );
}
```

Pick a warmer tone with a slower drift:

```tsx
<LiquidMetal color="#fff4d6" backgroundColor="#8a6a2f" speed={0.6} intensity={0.12} />
```

## The `shaderProps` escape hatch

`shaderProps` forwards raw props directly to the underlying `@paper-design/shaders-react` `LiquidMetal` shader (its own `LiquidMetalProps`), applied after the mapped props above, so any key set there wins over `color`, `backgroundColor`, `speed`, and `intensity`:

```tsx
<LiquidMetal shaderProps={{ shape: "circle", repetition: 4 }} />
```

Two exceptions to "shaderProps always wins":

- `style` is merged (not replaced) with the fill-parent default, so the shader keeps sizing to its wrapper even if `shaderProps.style` only sets unrelated properties.
- `speed` wins over the mapped `speed` prop only while the component is in view. The off-screen pause gate (speed forced to `0`) always takes precedence, so `shaderProps.speed` can never keep the shader animating while scrolled out of view. This is the one place gating overrides the escape hatch, on purpose.

`shaderProps` is advanced and unstable: the upstream shader is pinned to `0.0.76` and its param set may change between versions.

## Degrades to

- **No WebGL**: a static metallic-gradient fallback (`data-fallback="true"`, the shader never mounts) using the same `color`/`backgroundColor` values the live shader would use.
- **Reduced motion**: the same static fallback. A WebGL simulation never boots under reduced motion, even if WebGL is available.
- **Off-screen**: the shader stays mounted (tearing down and recreating a WebGL context on every scroll is more expensive than leaving it parked), but its `speed` is forced to `0`, which stops the shader's internal render loop entirely.

Capability is read once per mount, not at module import time (SSR-safe) and not on every render.

## Known limitations

- **Context loss**: the underlying `ShaderMount` registers no `webglcontextlost`/`webglcontextrestored` handlers. If the browser evicts the WebGL context at runtime (GPU pressure, tab backgrounding on some platforms), the canvas goes blank until the component remounts. Capability detection only gates boot-time capability; it cannot protect against a context lost after mount. This is an upstream limitation, not something fluidkit can work around.
