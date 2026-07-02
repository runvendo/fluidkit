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
| `speed` | `number` | `1` | Merge/split cycle speed multiplier. Clamped above `0`. |
| `material` | `"glass" \| "mercury" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (container coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |
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
<Droplets material="mercury" />
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

## Accessibility

`interactive` and `followPointer` are pointer-first physics toys with no keyboard equivalent. That's a deliberate trade-off, not an oversight: a drag gesture has no discrete key-press analog. The wrapper never sets a `tabindex` or steals focus, so it doesn't trap keyboard users, it's simply not operable without a pointer.

By default (not `interactive`) the cluster is marked `aria-hidden` as pure decoration. Passing your own `role` (as `Thinking` does with `role="status"`) opts it back into the accessibility tree and suppresses the default `aria-hidden`.

## Degrades to

- **Reduced motion / off-screen**: separate static dots, no bridges, no animation loop.
- **No `backdrop-filter` support**: glass renders as a frosted flat fill (still lit).
