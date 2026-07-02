# LiquidDrag

A behavior wrapper around Motion's own drag gesture (dragging itself is never reimplemented). The liquid feel is a stretch layered on top: drag velocity maps to a volume-preserving scale (`scaleX * scaleY` stays ~1), stretching along the drag direction and compressing across it, clamped to at most `1 + elasticity * 0.25`. A spring smooths the target, so a hard release wobbles back to rest instead of snapping.

Content deforms with the wrapper by design (it stretches the element directly). Wrap a non-text visual (an icon, a swatch, a card face) if you need scale-sensitive content to stay crisp.

## Props

`LiquidDrag` extends `HTMLAttributes<HTMLDivElement>` (minus the Motion-conflicting drag/animation event handlers; `onDragStart`/`onDragEnd` come back below with Motion's `PanInfo` signature, not the DOM's).

| Name | Type | Default | Description |
|---|---|---|---|
| `elasticity` | `number` | `0.4` | Fraction (0-1) of how strongly drag velocity stretches the shape. `0` disables the deformation entirely; the element still drags. |
| `axis` | `"x" \| "y"` | both axes | Restricts dragging to one axis; passed straight through to Motion's `drag`. |
| `dragConstraints` | Motion `dragConstraints` | `undefined` | Passthrough to Motion (ref or `{ top, right, bottom, left }`). |
| `dragSnapToOrigin` | `boolean` | `false` | Passthrough to Motion: spring back to the start point on release. |
| `onDragStart` | Motion `onDragStart` | `undefined` | Passthrough (Motion `PanInfo` signature). |
| `onDragEnd` | Motion `onDragEnd` | `undefined` | Passthrough (Motion `PanInfo` signature). |
| `spring` | `SpringConfig` | `{ stiffness: 300, damping: 12 }` | Smooths the velocity-driven scale; underdamped on purpose so release visibly wobbles. |
| `children` | `ReactNode` | required | The draggable content. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { useRef } from "react";
import { LiquidDrag } from "fluidkit";

function Board() {
  const bounds = useRef<HTMLDivElement>(null);
  return (
    <div ref={bounds} className="board">
      <LiquidDrag elasticity={0.5} dragConstraints={bounds}>
        <div className="chip" />
      </LiquidDrag>
    </div>
  );
}
```

## Degrades to

Under `prefers-reduced-motion` (or `elasticity={0}`), the deformation is bypassed outright: scales are pinned at exactly `1`, never mid-stretch. Dragging itself is not gated; Motion's drag stays fully functional either way.
