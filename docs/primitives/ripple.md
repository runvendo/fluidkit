# Ripple

A Material-style water ripple that expands from the pointer's tap/click position and fades out, clipped to the surface's box (including its border-radius).

## Props

`Ripple` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | `currentColor` | Ripple color. |
| `duration` | `number` | `600` | Ripple lifetime in ms. |
| `material` | `"flat" \| "glass"` | `"flat"` | `glass` renders a frosted water lens (backdrop blur + rim) instead of a color wash. |
| `children` | `ReactNode` | required | The surface content the ripple overlays. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { Ripple } from "fluidkit";

function Button({ children }: { children: React.ReactNode }) {
  return (
    <Ripple color="rgba(255,255,255,0.5)" className="btn">
      {children}
    </Ripple>
  );
}
```

## Headless escape hatch: `useRipple()`

`useRipple({ color?, duration? })` returns:

- `handlers`: `{ onPointerDown }`, spread onto your own target element to spawn ripples.
- `ripples`: the currently active ripples (`{ id, x, y, size }`), oldest first, for you to render.
- `remove`: call with a ripple's `id` once its exit animation finishes.
- `color` / `duration`: the resolved values, for you to render with.

## Degrades to

Under `prefers-reduced-motion`, `onPointerDown` no-ops: no ripple ever spawns, and the wrapper renders its children normally with no visual substitute.
