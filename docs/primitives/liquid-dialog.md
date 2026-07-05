# LiquidDialog

A modal dialog on a liquid surface. Opening captures the trigger (or an explicit
`origin`) and springs the surface from that button-sized rect to the centered
dialog. Content fades in above the engine layer after the surface arrives.

The dialog portals to `document.body`, locks body scroll while open, focuses the
dialog, restores focus on close, and calls `onClose` for Escape or backdrop
click.

## Props

`LiquidDialog` extends `HTMLAttributes<HTMLDivElement>` except for `role`.

| Name | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | required | Controlled state. |
| `onClose` | `() => void` | `undefined` | Called on Escape or backdrop click. |
| `origin` | `HTMLElement \| null` | focused element on open | Element the dialog rises from. |
| `aria-label` | `string` | `undefined` | Accessible dialog name. Use it or label the dialog content. |
| `radius` | `number` | `24` | Corner radius in px. |
| `padding` | `number` | `28` | Content padding in px. |
| `children` | `ReactNode` | `undefined` | Dialog content. |

Plus the surface style pack: `material`, `tint`, `color`, `opacity`,
`intensity`, `light`, `reflection`, `refraction`, and `shadow`.

## Usage

```tsx
import { LiquidDialog } from "fluidkit";

<LiquidDialog open={open} onClose={() => setOpen(false)} aria-label="Confirm">
  <h2>Delete item?</h2>
  <p>This action cannot be undone.</p>
</LiquidDialog>
```

## Degrades to

- **Reduced motion:** no pop or travel; surface and content cross-fade.
  Content still renders, Escape closes, and focus behavior remains.
- **No `backdrop-filter` support:** glass renders as a frosted flat fill.
- **SSR:** nothing portals until a document exists.
