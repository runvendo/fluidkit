# Droplets

A cluster of liquid drops driven by the liquid engine: real metaball geometry (bezier bridge curves applied as a live `clip-path`), spring motion, and surface tension with hysteresis. Drops connect only when they actually touch (the neck starts at a real minimum width, never a hairline), stretch while joined, and snap apart while the neck is still chunky.

The material is a prop, not a separate component: the same shapes render as clear glass (backdrop blur + saturation, lit by one shared light source), mercury (solid liquid metal, no gradient, no highlight), or a flat fill.

## Props

`Droplets` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `3` | Number of drops in the cluster. |
| `size` | `number` | `36` | Base drop diameter in px. |
| `spread` | `number` | `100` | Px extent the cluster spreads across. |
| `speed` | `number` | `1` | Merge/split cycle speed multiplier. |
| `material` | `"glass" \| "mercury" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (container coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `followPointer` | `boolean` | `false` | An extra drop chases the pointer and merges with the cluster. |
| `seed` | `number` | `0` | Deterministic per-instance layout offset. |

## Usage

```tsx
import { Droplets } from "fluidkit";

<Droplets followPointer material="glass" />
<Droplets material="mercury" />
```

Glass needs something colorful behind it to refract; place it over an image or gradient backdrop.

## Degrades to

- **Reduced motion / off-screen**: separate static dots, no bridges, no animation loop.
- **No `backdrop-filter` support**: glass renders as a frosted flat fill (still lit).
