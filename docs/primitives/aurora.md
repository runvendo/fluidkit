# Aurora

An ambient CSS backdrop: slow-drifting, heavily blurred horizontal bands stacked in the upper portion of the container. Like `MeshGradient`, the drift is a single `@keyframes` transform loop per band, so there is zero per-frame JS once mounted.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, so you place it inside a positioned parent alongside your real content.

Band placement and drift phase are derived deterministically from each color's index (the same golden-angle/golden-ratio scheme as `MeshGradient` and `Droplets`' `dropAngle`, no `Math.random`), so two renders with the same `colors` produce byte-identical band styles.

## Props

`Aurora` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `colors` | `string[]` | cool teal/green/violet | Band colors, one band per entry. |
| `intensity` | `number` | `0.6` | Band opacity scale, `0`-`1`. |
| `speed` | `number` | `1` | Drift speed multiplier, higher divides the keyframe period down (faster). Clamped above `0`. |
| `blend` | `"screen" \| "normal" \| "multiply"` | `"screen"` | How bands composite onto the surface behind them. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { Aurora } from "fluidkit";

function Hero() {
  return (
    <div style={{ position: "relative", background: "#0c0d12" }}>
      <Aurora />
      <YourContent />
    </div>
  );
}
```

## Blending on light surfaces

The default `blend="screen"` gives the classic aurora-glow read on dark and mid-tone surfaces, but screen compositing mathematically washes out toward white: on a pure `#fff` background bands are exactly invisible (`screen(b, white) = white`), and on near-white surfaces they're heavily attenuated, no matter the palette.

For light surfaces, prefer `blend="normal"` (opacity-only compositing; `Aurora` bumps the effective opacity slightly so the same `intensity` keeps a comparable presence) or `blend="multiply"` (darkens the surface, an ink-wash look).

```tsx
<Aurora blend="normal" intensity={0.5} />
```

`mix-blend-mode` composites against whatever is actually painted behind the band, so a transparent parent lets bands blend with arbitrary page content behind it. Give the parent an opaque background if you want predictable, self-contained compositing.

## Degrades to

- **Reduced motion**: the drift keyframes are dropped entirely (`animation-name: none`); bands render at their static home position, `data-animating="false"`.
- **Off-screen**: keyframes stay attached but `animation-play-state` is paused rather than torn down, so drift resumes in-phase when scrolled back into view.
- **No feature detection needed**: `mix-blend-mode` and blurred gradients are universal CSS, nothing to degrade.
