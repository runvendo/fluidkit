# Thinking

An organic "working" indicator: liquid droplets merging and splitting on the engine's surface-tension cycle, in one of three choreographies (`variant`). `role="status"` for assistive tech. Replaces the goo-based `ThinkingBlob`.

## Variants

Set the choreography with `variant`:

- `gather` (default): three drops snap together fast and drift apart lazily, slightly out of phase, while the whole formation turns a full 360°.
- `orbit`: two drops circle a center drop, alternately merging with it and pulling free, like a liquid spinner. Seeded incommensurate wobbles keep revolutions from ever visibly repeating (same `seed`, same motion).
- `wave`: a touching row of drops bobs in sequence; the traveling wave stretches and re-forms the necks, reading as a liquid typing indicator.

`gather` and `wave` are deterministic clean loops; motion is a pure function of time (no spring state), so drops land exactly where the curve says with no settle wobble.

## Props

`Thinking` extends the surface style pack (`material`, `tint`, `color`, `intensity`, `light`, `reflection`, `refraction`, `shadow`) and `HTMLAttributes<HTMLDivElement>`. It does not extend `DropletsProps`: it's built on the same engine but has its own prop surface (no `count`, `followPointer`, `interactive`, or pointer handlers).

| Name | Type | Default | Description |
|---|---|---|---|
| `variant` | `"gather" \| "orbit" \| "wave"` | `"gather"` | Choreography (see above). |
| `label` | `string` | `"Thinking"` | Accessible label announced to screen readers. |
| `size` | `number` | `18` | Base drop diameter in px; the canvas scales with it. |
| `speed` | `number` | `1` | Cycle speed multiplier. |
| `material` | `"glass" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `intensity` | `number \| "whisper" \| "present"` | `"present"` | Material volume (0-1): scales the specular's brightness. Defaults to `"present"` (0.7), not the surface family's `"whisper"` — Thinking's pre-pack speculars already rendered at `specularPlacement`'s own 0.7 default (nobody overrode it), and `intensity` maps straight through (unlike JellyButton/MorphSurface's `0.4 x volume`), so `"present"` reproduces it exactly. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (container coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |
| `shadow` | `boolean` | `true` | Drop shadow under the surface. |
| `seed` | `number` | `0` | Varies `orbit`'s wobble between instances (same seed, same motion); no effect on `gather`/`wave`. |

## Usage

```tsx
import { Thinking } from "fluidkit";

{isWorking && <Thinking label="Generating" />}
<Thinking variant="wave" label="Typing" />
```

## Degrades to

Reduced motion / off-screen: the variant's resting bodies render as separate static shapes, no bridges, no animation loop. The status role and label stay intact either way.
