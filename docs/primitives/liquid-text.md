# LiquidText

Display text where the glyphs themselves are liquid material. In glass mode,
fluidkit masks a backdrop-blurred layer with an SVG copy of the same string,
while the real text stays in flow as invisible ink for layout, selection, and
screen readers. Flat mode uses solid glyph color plus the same sheen sweep.

Glass mode requires plain string children. Non-string children render through
the flat path.

## Props

`LiquidText` extends `HTMLAttributes<HTMLSpanElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `material` | `"glass" \| "flat"` | `"glass"` | Glyph material. |
| `color` | `string` | `"#23242c"` | Solid glyph color for `material="flat"`. |
| `tint` | `string` | translucent white | Glass tint. |
| `opacity` | `number` | `undefined` | Replaces the tint alpha where CSS relative color syntax is supported. |
| `intensity` | `number \| "whisper" \| "present"` | `"whisper"` | Sheen strength. |
| `sheenColor` | `string` | `"#ffffff"` | Color of the moving sheen. |
| `speed` | `number` | `1` | Sweep speed multiplier. |
| `angle` | `number` | `115` | CSS gradient angle for the sweep. |
| `children` | `ReactNode` | required | Text content. Glass masking only applies to string children. |

`LiquidText` does not take `light`, `reflection`, `refraction`, or `shadow`; its
lighting is the sheen sweep.

## Usage

```tsx
import { LiquidText } from "fluidkit";

<h1>
  <LiquidText>Liquid type</LiquidText>
</h1>
```

## Degrades to

- **Reduced motion:** the sheen keyframes are dropped and the sheen parks on
  the light-facing third.
- **No `backdrop-filter` or non-string children:** glass falls back to flat.
- **No background-clip support:** plain solid-color text renders.
