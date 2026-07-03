# Silk

An ambient CSS backdrop: smooth flowing silk — full-height diagonal gradient sheets that drift and breathe like slow-motion fabric, one sheet per color. The undulation is a `@keyframes` transform loop (injected once, shared across instances); zero per-frame JS once mounted.

Silk hangs its sheets across the full height on a single shared diagonal — one flow direction keeps the composition coherent, the same reasoning as `MeshGradient`'s single light direction.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, so you place it inside a positioned parent alongside your real content.

Sheet placement, fold, and phase are derived deterministically from each sheet's index (golden-ratio scheme, same as `MeshGradient`, no `Math.random`), so two renders with the same props produce byte-identical sheet styles.

## Props

`Silk` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `colors` | `string[]` | soft lilac/rose/sky | Sheet colors, cycled across sheets. |
| `count` | `number` | `colors.length` | Number of sheets, clamped to `1`-`12` — density scales independently of the palette. |
| `material` | `"color" \| "glass"` | `"color"` | `"color"` renders blurred color-gradient sheets; `"glass"` renders frosted, backdrop-blurring white-tinted sheets (degrades to the plain tint without `backdrop-filter` support). |
| `intensity` | `number` | `0.55` | Sheet opacity scale, `0`-`1`. |
| `speed` | `number` | `1` | Flow speed multiplier, higher divides the keyframe period down (faster). Clamped above `0`. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { Silk } from "fluidkit";

function Hero() {
  return (
    <div style={{ position: "relative" }}>
      <Silk />
      <YourContent />
    </div>
  );
}
```

Warmer, champagne-toned sheets, denser:

```tsx
<Silk colors={["#f2ddb8", "#f2c8ad", "#e6b8c2"]} count={8} intensity={0.5} />
```

Frosted glass sheets over a colored surface:

```tsx
<div style={{ position: "relative", background: "#e8ddf2" }}>
  <Silk material="glass" count={5} />
</div>
```

## Degrades to

- **Reduced motion**: the flow keyframes are dropped entirely (`animation-name: none`); sheets render at their static home position on the shared diagonal, `data-animating="false"`.
- **Off-screen**: keyframes stay attached but `animation-play-state` is paused rather than torn down, so the flow resumes in-phase when scrolled back into view.
- **No feature detection needed**: blurred linear gradients are universal CSS, nothing to degrade.
