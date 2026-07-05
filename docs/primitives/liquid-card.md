# LiquidCard

A content-bearing liquid surface. Children stay in normal flow above the engine
layer, so text stays crisp and the card sizes to its content. A
`ResizeObserver` measures the box and rebuilds the static rounded-rect liquid
geometry behind it.

`variant` supplies callout tints for common states. The tint goes through the
same glass or flat material path as the rest of the surface family.

## Props

`LiquidCard` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `variant` | `"default" \| "info" \| "success" \| "warning"` | `"default"` | Accent preset for the surface. |
| `radius` | `number` | `20` | Corner radius in px. |
| `padding` | `number` | `20` | Content padding in px. |
| `children` | `ReactNode` | `undefined` | Card content, rendered above the liquid layer. |

Plus the surface style pack: `material`, `tint`, `color`, `opacity`,
`intensity`, `light`, `reflection`, `refraction`, and `shadow`.

## Usage

```tsx
import { LiquidCard } from "fluidkit";

<LiquidCard variant="info" padding={24}>
  <h2>Live preview</h2>
  <p>The content is regular layout above the liquid surface.</p>
</LiquidCard>
```

## Degrades to

- **Reduced motion:** the card is static by design, so no animation frame is
  requested and the content renders normally.
- **No `backdrop-filter` support:** glass renders as a frosted flat fill, with
  content still on top.
