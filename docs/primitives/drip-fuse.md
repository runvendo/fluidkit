# DripFuse

A one-shot liquid transfer on the engine: a drop swells off a source body, tears free (the tension bridge snaps naturally past the engine's stretch threshold), springs across to a target body, and fuses in while the target briefly swells to absorb the mass. Generalizes the `LiquidTabs` drain / fly / fill choreography into a single trigger-and-complete cycle: think "item added to cart", "file moved", "message sent".

The canvas holds two stable bodies, source (left) and target (right); `sourceContent`/`targetContent` render on the unclipped content overlay, centered on each anchor and never scaled.

## Props

`DripFuse` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `240` | Canvas width in px. |
| `height` | `number` | `80` | Canvas height in px. |
| `size` | `number` | `18` | Source/target body radius in px (clamped to fit the canvas height). |
| `fire` | `number` | `0` | Trigger: any change runs one cycle. Increment a counter to fire; firing mid-cycle restarts it (rapid fires coalesce into one completion). |
| `onComplete` | `() => void` | `undefined` | Called once per completed cycle, after the springs settle. Only the last cycle of a restart completes. |
| `sourceContent` | `ReactNode` | `undefined` | Rendered on the unclipped overlay, centered on the source anchor. |
| `targetContent` | `ReactNode` | `undefined` | Rendered on the unclipped overlay, centered on the target anchor. |
| `material` | `"glass" \| "mercury" \| "flat"` | `"glass"` | Rendered material. |
| `tint` | `string` | translucent white | Glass tint. |
| `color` | `string` | `currentColor` | Flat-material fill. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light in px (canvas coords). `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |

## Usage

```tsx
import { useState } from "react";
import { DripFuse } from "fluidkit";

function AddToCart() {
  const [fire, setFire] = useState(0);
  return (
    <>
      <button onClick={() => setFire((f) => f + 1)}>Add to cart</button>
      <DripFuse
        fire={fire}
        sourceContent={<BagIcon />}
        targetContent={<CartIcon />}
        onComplete={() => toast("Added!")}
      />
    </>
  );
}
```

## Interaction

One cycle runs three phases, observable via the `data-phase` attribute (`"idle" | "swell" | "fly" | "fuse"`):

1. **Swell**: a drop grows off the source's edge, bulging out of it.
2. **Tear / fly**: the drop springs toward the target; the engine's tension hysteresis snaps the bridge once the stretch passes the threshold (no special-cased tear).
3. **Fuse**: on contact the drop drains into the target, which briefly swells to absorb it, then settles. `onComplete` fires once.

## Degrades to

- **Reduced motion**: a `fire` change completes instantly; `onComplete` fires immediately and the scene stays the static two-body rest state.
- **No `backdrop-filter` support**: glass renders as a frosted flat fill (still lit).
