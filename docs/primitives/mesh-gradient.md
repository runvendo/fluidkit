# MeshGradient

An ambient CSS backdrop: a handful of large, softly blurred radial-gradient blobs drift slowly behind your content. The drift is a single `@keyframes` transform loop per blob (injected once, shared across instances), so there is zero per-frame JS once mounted.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, so you place it inside a positioned parent alongside your real content.

Blob placement and drift phase are derived deterministically from each color's index (golden-angle spread, same scheme as `Droplets`' `dropAngle`, no `Math.random`), so two renders with the same `colors` produce byte-identical blob styles.

## Props

`MeshGradient` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `colors` | `string[]` | soft pastel blue/violet/pink | Blob colors, one blob per entry. |
| `speed` | `number` | `1` | Drift speed multiplier, higher divides the keyframe period down (faster). Clamped above `0`. |
| `blur` | `number` | `60` | Blob blur radius in px. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { MeshGradient } from "fluidkit";

function Dashboard() {
  return (
    <div style={{ position: "relative" }}>
      <MeshGradient />
      <YourContent />
    </div>
  );
}
```

Pick a warmer or cooler set for the occasion:

```tsx
<MeshGradient colors={["#ffe8b8", "#ffd0a8", "#ffb8c8"]} speed={0.7} blur={80} />
```

## Degrades to

- **Reduced motion**: the drift keyframes are dropped entirely (`animation-name: none`); blobs render at their static home position, `data-animating="false"`.
- **Off-screen**: keyframes stay attached but `animation-play-state` is paused rather than torn down, so drift resumes in-phase when scrolled back into view.
- **No feature detection needed**: radial-gradient blobs are universal CSS, nothing to degrade.
