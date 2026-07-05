# MeniscusDivider

A section divider rendered as a thin full-width bead of liquid. It measures the
available width, paints a static engine pill, and exposes `role="separator"` for
assistive tech.

Glass dividers use the same rim light and glow as the surface family. Flat
dividers stay unlit; the bead profile and shadow carry the read.

## Props

`MeniscusDivider` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `thickness` | `number` | `4` | Bead height in px. |

Plus the surface style pack: `material`, `tint`, `color`, `opacity`,
`intensity`, `light`, `reflection`, `refraction`, and `shadow`.

## Usage

```tsx
import { MeniscusDivider } from "fluidkit";

<section>
  <h2>Details</h2>
  <MeniscusDivider thickness={5} />
  <p>More content below the liquid rule.</p>
</section>
```

## Degrades to

- **Reduced motion:** the divider is static by design, so no animation frame is
  requested.
- **No `backdrop-filter` support:** glass renders as a frosted flat fill.
