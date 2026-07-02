# Magnetic

A behavior wrapper (no liquid surface) that pulls its child toward the pointer while the pointer is within `radius` px of the element's center, and springs back to rest outside that radius. Like a fridge magnet, contact is not required: the pull starts before the pointer ever touches the element and grows as it gets closer (linear falloff, full `strength` at the center, zero at the radius edge).

## Props

`Magnetic` extends `HTMLAttributes<HTMLDivElement>` (minus the Motion-conflicting drag/animation event handlers, which `motion.div` redefines with gesture-aware signatures).

| Name | Type | Default | Description |
|---|---|---|---|
| `strength` | `number` | `0.3` | Fraction (0-1) of the pointer offset to travel toward at the element's center. Travel is hard-capped at `radius / 2` regardless of configuration. |
| `radius` | `number` | `120` | Attraction radius in px, measured from the element's center. |
| `spring` | `SpringConfig` | `{ stiffness: 200, damping: 20 }` | Spring override for the x/y motion values. |
| `children` | `ReactNode` | required | The content being attracted. |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { Magnetic } from "fluidkit";

<Magnetic strength={0.4} radius={140}>
  <button className="cta">Get started</button>
</Magnetic>
```

## Interaction

Tracking listens on `window` (attached only while the element is on screen, torn down on unmount), so the magnet feels the pointer approaching before contact. The pull is computed from the element's untranslated home center, so it stays stable while the element moves. Losing tracking context (pointer leaves the window, window blur, pointer cancel) springs the element back to rest.

## Degrades to

Under `prefers-reduced-motion` (or off-screen), no window listener is attached and the element never moves; if the preference flips on while displaced, the offset snaps straight home.
