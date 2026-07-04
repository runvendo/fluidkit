# Droplets

A cluster of liquid drops driven by the liquid engine: real metaball geometry (bezier bridge curves applied as a live `clip-path`), spring motion, and surface tension with hysteresis. Drops connect only when they actually touch (the neck starts at a real minimum width, never a hairline), stretch while joined, and snap apart while the neck is still chunky.

The material is a prop, not a separate component: the same shapes render as clear glass (backdrop blur + saturation, lit by one shared light source) or a flat fill (solid color, unlit).

## Props

`Droplets` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `3` | Number of drops in the cluster. |
| `size` | `number` | `36` | Base drop diameter in px. |
| `spread` | `number` | `100` | Px extent the cluster spreads across. |
| `bleed` | `number` | `0` | Extra canvas padding in px on every side of the cluster (room to drag drops and chase the pointer beyond the cluster's own footprint). |
| `speed` | `number` | `1` | Merge/split cycle speed multiplier. |
| `material` | `"glass" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `intensity` | `number \| "whisper" \| "present"` | `"present"` | Material volume (0-1): scales the specular's brightness. Defaults to `"present"` (0.7), not the surface family's `"whisper"` — Droplets' pre-pack speculars already rendered at `specularPlacement`'s own 0.7 default (nobody overrode it), and `intensity` maps straight through (unlike LiquidButton/MorphSurface's `0.4 x volume`), so `"present"` reproduces it exactly. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (container coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |
| `shadow` | `boolean` | `true` | Drop shadow under the surface. |
| `followPointer` | `boolean` | `false` | An extra drop chases the pointer and merges with the cluster. |
| `interactive` | `boolean` | `false` | Drops can be grabbed, dragged, torn off, and re-merged (see below). |
| `onGrab` | `(index: number) => void` | — | The pointer picked up a drop. |
| `onTear` | `(index: number) => void` | — | The dragged drop's last bridge snapped (it tore off the cluster). |
| `onRelease` | `(index: number) => void` | — | The pointer let go; the drop springs home. |
| `seed` | `number` | `0` | Deterministic per-instance layout offset. |

## Usage

```tsx
import { Droplets } from "fluidkit";

<Droplets followPointer material="glass" />
<Droplets material="flat" color="#8d94a1" />
```

Glass needs something colorful behind it to refract; place it over an image or gradient backdrop.

## Interaction

With `interactive`, drops become tangible:

1. **Grab** — pointer-down on a drop picks it up (`onGrab`); it follows the pointer on a tight spring.
2. **Drag** — while it's still touching the cluster, the surface-tension neck stretches between them.
3. **Tear** — past the snap distance the neck breaks (`onTear`) and the drop travels free.
4. **Release** — on pointer-up (`onRelease`) the drop springs back to its home and re-merges on touch.

The tear/re-merge physics are the engine's normal tension hysteresis — nothing special-cased. Under reduced motion `interactive` is inert (the cluster renders as static dots).

```tsx
<Droplets interactive onTear={(i) => console.log(`drop ${i} tore off`)} />
```

## Degrades to

- **Reduced motion / off-screen**: separate static dots, no bridges, no animation loop.
- **No `backdrop-filter` support**: glass renders as a frosted flat fill (still lit).
