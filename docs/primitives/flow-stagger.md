# FlowStagger

A list of children rise, un-blur, and settle in a viscous cascade — the entrance gaps grow slightly down the list, and each item lands on a soft spring with a whisper of overshoot. Because every item carries Motion's `layout`, siblings glide (FLIP) to their new positions whenever the list is added to, removed from, or reordered — and the glides ripple outward from the change point (~24ms per list position, capped at 150ms) instead of everything moving at once.

Removals submerge: the row sinks, blurs back out, and shrinks slightly while its space closes over it (height collapses on an ease-out during the exit). The container itself carries `layout` too, so any background or border it wears grows and shrinks with the list instead of snapping.

## Props

`FlowStagger` extends `HTMLAttributes<HTMLDivElement>` (minus the Motion-conflicting drag/animation event handlers, which `motion.div` redefines with gesture-aware signatures).

| Name | Type | Default | Description |
|---|---|---|---|
| `stagger` | `number` | `0.02` | Base seconds between each entering child's animation start. Successive gaps grow ~5% (capped at 1.3x). |
| `transition` | `Transition` (Motion) | spring on `y` (`stiffness 560, damping 28, mass 0.7`), 0.3s ease-out fade/un-blur | Overrides each item's rise/settle transition. |
| `children` | `ReactNode` | required | The list items. Each is wrapped individually and keyed off its own `key` for identity across reorders. |
| `className` | `string` | `undefined` | Applied to the container. |
| `style` | `CSSProperties` | `undefined` | Applied to the container. |

## Usage

```tsx
import { FlowStagger } from "fluidkit";

function MessageList({ messages }: { messages: string[] }) {
  return (
    <FlowStagger>
      {messages.map((m) => (
        <div key={m}>{m}</div>
      ))}
    </FlowStagger>
  );
}
```

Spacing tip: put row spacing *inside* each child (e.g. a padded wrapper) rather than using the container's `gap` or child margins. Gap and margins live outside the exiting item's collapsing wrapper, so they pop out one frame after an otherwise smooth removal.

## Headless escape hatch: `useFlow()`

`useFlow({ stagger?, transition? })` returns:

- `containerProps`: spread onto your own `motion.[tag]` list wrapper (`initial`, `animate`, `variants`, plus `layout` + the glide spring so the container's bounds animate with the list).
- `getItemProps({ entranceRank?, glideDistance? })`: call per child, spread the result onto that child's `motion.div` wrapper. `entranceRank` is the item's position among items entering in the same commit (drives the viscous cascade); `glideDistance` is its whole-number distance from the index where the list changed (drives the ripple delay). `<FlowStagger>` computes both by diffing child keys against the previously committed list.
- `prefersReducedMotion`: the resolved boolean.

## Degrades to

Under `prefers-reduced-motion`, item variants collapse to opacity-only (no rise, no blur, no sink, no shrink), every delay drops to `0`, and layout tweening is disabled on both items and container. The whole list reads as a simple, simultaneous fade.
