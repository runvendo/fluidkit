# LiquidPanel

A drawer, sheet, or sidebar surface that pours in from one edge. The consumer
sizes the panel box; fluidkit measures it and grows an anchored engine surface
across that box when `open` is true. Content lives on an unclipped layer above
the surface and fades in after the pour arrives.

## Props

`LiquidPanel` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | required | Controlled state: `true` pours the panel in, `false` drains it out. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Edge the liquid pours from. |
| `radius` | `number` | `20` | Corner radius in px. |
| `padding` | `number` | `20` | Content padding in px. |
| `children` | `ReactNode` | `undefined` | Panel content, rendered above the liquid layer. |

Plus the surface style pack: `material`, `tint`, `color`, `opacity`,
`intensity`, `light`, `reflection`, `refraction`, and `shadow`.

## Usage

```tsx
import { LiquidPanel } from "fluidkit";

<LiquidPanel open={open} side="left" style={{ width: 320, minHeight: 420 }}>
  <nav>Panel content</nav>
</LiquidPanel>
```

## Degrades to

- **Reduced motion or off-screen:** the surface snaps between poured and
  drained; content cross-fade is the only motion left.
- **No `backdrop-filter` support:** glass renders as a frosted flat fill.
