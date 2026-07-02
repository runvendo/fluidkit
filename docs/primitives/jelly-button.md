# JellyButton

A pill-shaped engine button that squashes on press via geometry, not a CSS transform, so the label never scales (the library's core principle). It renders a real `<button>` (focus, Enter/Space, `disabled` all work natively); the liquid surface is the button's fill, and the label lives on the unclipped content overlay. Press retargets the pill wider and shorter (volume-preserving: width and height scale by inverse factors), and release springs back home with the spring's natural overshoot supplying the jiggle.

## Props

`JellyButton` extends `ButtonHTMLAttributes<HTMLButtonElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `material` | `"glass" \| "mercury" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (button coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |
| `intensity` | `number` | `0.12` | Fractional squash at full press (volume-preserving), same default as `useSquish`. |
| `width` | `number` | `160` | Resting pill width in px. |
| `height` | `number` | `48` | Resting pill height in px. |
| `disabled` | `boolean` | `false` | Disables the button; also releases any press in flight. |
| `children` | `ReactNode` | `undefined` | The label, rendered on the unclipped overlay (never scaled). |

## Usage

```tsx
import { JellyButton } from "fluidkit";

<JellyButton material="glass" onClick={save}>
  Save changes
</JellyButton>
```

The press geometry paints on a bleed canvas that extends past the button's border box, so the widened shape never gets sliced; the button's layout box stays exactly `width` x `height`.

## Headless escape hatch: `useSquish()`

`useSquish({ intensity?, spring? })` gives you the same press-squash feel for arbitrary elements, via CSS transform instead of geometry (so the element's content scales with it, a trade-off you accept). It returns:

- `handlers`: pointer and keyboard handlers (`onPointerDown/Up/Cancel/Leave`, `onKeyDown/Up` for Space/Enter, `onBlur`), spread onto your own target element.
- `style`: `scaleX`/`scaleY` Motion values, usable directly in a `motion.div`'s `style`.
- `pressed`: whether the element is currently pressed.

## Degrades to

- **Reduced motion**: no deformation; the button still presses, clicks, and focuses like a normal button, with a slight opacity dip as the only visual feedback.
- **No `backdrop-filter` support**: glass renders as a frosted flat fill (still lit).
