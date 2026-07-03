# GlassPanes

A glass-native ambient backdrop: frosted glass panes — tall rounded rectangles on a shared slight diagonal, sliding past each other in slow motion. Each pane composites the page behind it through its own `backdrop-filter`, and each pane gets a different blur strength, so overlaps read as physical depth: the near pane frosts more than the far one. The slide is pure CSS `@keyframes` (injected once, shared across instances); zero per-frame JS once mounted.

The panes tile the **full surface**: widths and slot spacing are derived from `count` with overlap margins sized to absorb the drift, the per-pane jitter, and the shared rotation's edge shift — so every point of the container is behind at least one pane at all times. Higher counts mean narrower panes and more depth seams, never gaps.

The component IS the background layer, not a child overlay: it renders `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, so you place it inside a positioned parent alongside your real content. Glass needs something behind it — layer GlassPanes over color or the frost has nothing to show.

Pane placement, depth, and phase are derived deterministically from each pane's index (golden-ratio scheme, same as `MeshGradient`, no `Math.random`), so two renders with the same props produce byte-identical pane styles.

## Props

`GlassPanes` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `colors` | `string[]` | untinted glass | Pane tints, cycled across panes — folded into the glass white so panes stay glass-first. Accepts CSS custom properties. |
| `count` | `number` | `3` | Pane count, clamped to `1`-`8`. Coverage is always full; count controls how many depth seams cross the surface. |
| `intensity` | `number` | `0.35` | Tint strength, `0`-`1` — how much of each pane's color survives the frost. |
| `speed` | `number` | `1` | Slide speed multiplier, higher divides the keyframe period down (faster). Clamped above `0`. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { GlassPanes, MeshGradient } from "fluidkit";

function Gallery() {
  return (
    <div style={{ position: "relative" }}>
      <MeshGradient />   {/* something worth frosting */}
      <GlassPanes />
      <YourContent />
    </div>
  );
}
```

Denser, tinted:

```tsx
<GlassPanes colors={["#aac2ff", "#cfaaf0"]} count={6} intensity={0.6} />
```

## Degrades to

- **No `backdrop-filter`**: each pane falls back to a frosted flat fill (the engine's own glass fallback color, tinted) with `data-fallback="true"` — still layered panes, no longer live blur.
- **Reduced motion**: slide keyframes are dropped entirely (`animation-name: none`); panes sit at their static home positions, `data-animating="false"`.
- **Off-screen**: `animation-play-state` is paused rather than torn down, so the slide resumes in-phase when scrolled back into view.
