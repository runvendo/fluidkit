# LiquidTabs

A tab strip whose active-tab indicator is a liquid engine body. On tab change the indicator doesn't slide — it flows: the old tab's pill drains while the new one fills, a tension bridge (the engine's metaball neck) stretches between them, snaps free past the snap distance, and the new pill settles on a taut, slightly-overshooting spring.

## Layering

Tab labels must never sit inside a filtered or rasterized subtree (the library's non-negotiable: animate the surface, never the text). `LiquidTabs` renders two overlaid but sibling layers inside the container:

1. **Indicator layer**: absolutely positioned, `pointer-events: none`, `aria-hidden`. Contains only the liquid body — engine geometry applied as a `clip-path` over a flat material fill. Never any text, no filters anywhere.
2. **Buttons layer**: the `role="tab"` buttons with their labels, on top, fully interactive.

Tab boxes are measured (`offsetLeft` / `offsetWidth`) in a layout effect (with a ResizeObserver keeping them fresh); the engine geometry is driven from those measurements, and per-frame scenes are written imperatively to the DOM — the animation never re-renders React.

## Props

`LiquidTabs` extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`, which is redefined below). Renders with `role="tablist"`.

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | `{ id: string; label: ReactNode }[]` | required | The tabs to render. |
| `value` | `string` | required | Id of the currently active item. |
| `onChange` | `(id: string) => void` | required | Called when a tab is clicked. |
| `color` | `string` | `currentColor` | Indicator color. |
| `className` | `string` | `undefined` | Applied to the container. |
| `style` | `CSSProperties` | `undefined` | Applied to the container. |

## Usage

```tsx
import { useState } from "react";
import { LiquidTabs } from "fluidkit";

function Tabs() {
  const [value, setValue] = useState("recent");

  return (
    <LiquidTabs
      items={[
        { id: "recent", label: "Recent" },
        { id: "starred", label: "Starred" },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}
```

## Degrades to

Under `prefers-reduced-motion` the indicator snaps instantly to the active tab: no springs, no bridge, a single static pill. Because the labels live on their own unfiltered sibling layer at all times, they stay crisp in every state.
