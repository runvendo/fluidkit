# LiquidTooltip

A tooltip as a liquid droplet. The label pill condenses beside the trigger on a
spring, with a small tail bead bridged back toward the anchor. The tooltip label
defines the droplet size; text renders above the engine layer and never scales.

Positioning is local to the trigger wrapper, not portaled. Ancestors with
`overflow: hidden` can crop it.

## Props

`LiquidTooltip` extends `HTMLAttributes<HTMLSpanElement>` except for the
native `content` attribute.

| Name | Type | Default | Description |
|---|---|---|---|
| `content` | `ReactNode` | required | Tooltip label. |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Side of the trigger where the droplet condenses. |
| `gap` | `number` | `6` | Gap between trigger and droplet in px. |
| `delay` | `number` | `100` | Hover delay before showing, in ms. Focus shows immediately. |
| `speed` | `number` | `1` | Condense speed multiplier; `2` is twice as fast, `0.5` slower. |
| `children` | `ReactNode` | required | Trigger element or content. |

Plus the surface style pack: `material`, `tint`, `color`, `opacity`,
`intensity`, `light`, `reflection`, `refraction`, and `shadow`.

## Usage

```tsx
import { LiquidButton, LiquidTooltip } from "fluidkit";

<LiquidTooltip content="Save your work" placement="bottom">
  <LiquidButton>Save</LiquidButton>
</LiquidTooltip>
```

## Degrades to

- **Reduced motion:** no geometry spring; the droplet appears at full size and
  fades. Focus still shows immediately, and Escape dismisses.
- **No `backdrop-filter` support:** glass renders as a frosted flat fill.
