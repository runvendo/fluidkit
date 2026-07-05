# LiquidButton

A liquid pill button whose `variant` picks the press feel. It renders a real `<button>` (focus, Enter/Space, `disabled` all work natively); the liquid surface is the button's fill, and the label lives on the unclipped content overlay, so it never scales (the library's core principle).

The default `variant="jelly"` squashes on press via geometry, not a CSS transform: press retargets the pill wider and shorter (volume-preserving: width and height scale by inverse factors), and release springs back home with the spring's natural overshoot supplying the jiggle. The press is point-aware by default: the outline dents around the pointer and the displaced mass bulges away from it, so pressing an edge reads like pressing actual jelly (keyboard presses stay symmetric). On glass, a specular glint expands from the press point, and every material deepens its fill while pressed — quick fade in, slow fade out.

`variant="still"` keeps the same pill rigid — zero geometry deformation on press. It presses only through the non-geometric polish that jelly also has: the fill deepening (`pressFeedback`) and the press glint (`pressGlint`). It is the reduced-motion presentation for geometry promoted to a first-class choice, minus the opacity dip. `squash`, `spring`, `releaseWave`, and `deformPress` are jelly-only and inert on `"still"`. Reduced motion still wins over `"jelly"`.

## Props

`LiquidButton` extends `ButtonHTMLAttributes<HTMLButtonElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `variant` | `"jelly" \| "still"` | `"jelly"` | Press feel. `"jelly"` deforms geometry on press; `"still"` holds the pill rigid and presses only through the fill deepening and glint. Reduced motion overrides `"jelly"`. |
| `material` | `"glass" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `intensity` | `number \| "whisper" \| "present"` | `"present"` | Material volume (0-1): scales the specular's brightness. Defaults to `"present"` (0.7), not the surface family's `"whisper"` — the button's glint was designed brighter, and `0.4 x 0.7` reproduces its previous constant exactly. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (button coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |
| `shadow` | `boolean` | `true` | Drop shadow under the surface. |
| `squash` | `number` | `0.12` | Fractional squash at full press (volume-preserving), same default as `useSquish`. Jelly-only (inert on `variant="still"`). |
| `width` | `number` | `160` | Resting pill width in px. |
| `height` | `number` | `48` | Resting pill height in px. |
| `spring` | `{stiffness, damping}` | `useSquish`'s default | Press/release spring. The settle window is derived from it. Jelly-only (inert on `variant="still"`). |
| `deformPress` | `boolean` | `true` | Press-point-aware squash: dent around the pointer, bulge away from it. `false` restores the uniform squash. Jelly-only (inert on `variant="still"`). |
| `pressGlint` | `boolean` | `true` | Expanding specular glint from the press point. Glass only; off when `reflection` is `false` or `light` is `null`. Applies to both variants. |
| `releaseWave` | `boolean` | `false` | On release, a single decaying ripple radiates through the outline from the press point. Jelly-only (inert on `variant="still"`). |
| `pressFeedback` | `boolean` | `true` | Deepens the fill while pressed (glass frosts up, flat darkens), fading in 180ms / out 420ms. Applies to both variants. |
| `pressColor` | `string` | derived | Pressed fill (any CSS color), replacing the derived deepening. Acts as the pressed tint on glass, so translucent colors read best there. |
| `disabled` | `boolean` | `false` | Disables the button; also releases any press in flight. |
| `children` | `ReactNode` | `undefined` | The label, rendered on the unclipped overlay (never scaled). |

## Usage

```tsx
import { LiquidButton } from "fluidkit";

<LiquidButton material="glass" onClick={save}>
  Save changes
</LiquidButton>
```

The press geometry paints on a bleed canvas that extends past the button's border box, so the widened shape never gets sliced; the button's layout box stays exactly `width` x `height`.

## Headless escape hatch: `useSquish()`

`useSquish({ intensity?, spring? })` gives you the same press-squash feel for arbitrary elements, via CSS transform instead of geometry (so the element's content scales with it, a trade-off you accept). The hook's `intensity` option is the press depth — it corresponds to LiquidButton's `squash`, not its material `intensity`. It returns:

- `handlers`: pointer and keyboard handlers (`onPointerDown/Up/Cancel/Leave`, `onKeyDown/Up` for Space/Enter, `onBlur`), spread onto your own target element.
- `style`: `scaleX`/`scaleY` Motion values, usable directly in a `motion.div`'s `style`.
- `pressed`: whether the element is currently pressed.

## Degrades to

- **Reduced motion**: no deformation, wave, or glint; the button still presses, clicks, and focuses like a normal button, with a slight opacity dip plus the pressed fill deepening (color, not motion) as feedback. (`variant="still"` differs: it keeps the glint and adds no opacity dip.)
- **No `backdrop-filter` support**: glass renders as a frosted flat fill (still lit).
