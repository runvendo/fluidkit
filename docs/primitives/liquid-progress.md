# LiquidProgress

Determinate progress as a **vessel filling**: the track is a shallow channel
and the fill's leading edge is a meniscus bead that wobbles subtly while the
value moves and settles flat when it stops. The wobble envelope is driven by
the fill spring's velocity, so idle progress never animates — motion means
"still moving", stillness means "waiting".

Determinate only, by design: `Thinking` owns indeterminate/working states.

## Usage

```tsx
import { LiquidProgress } from "fluidkit";

<LiquidProgress value={progress} max={100} aria-label="Upload" />
<LiquidProgress value={0.6} aria-label="Upload" />   // max defaults to 1
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `value` | `number` | required | Current progress, `0..max` (native `<progress>` convention; clamped). |
| `max` | `number` | `1` | The value that means done. |
| `width` | `number` | `240` | Track length in px. |
| `height` | `number` | `12` | Channel thickness in px. |
| `fillTint` | `string` | quiet blue | The liquid in the vessel. |

Plus the surface style pack (`material`, `tint` — the track's glass —
`color`, `intensity` — defaults `"present"`, the meniscus bead carries
Droplets' specular brightness — `light`, `reflection`, `shadow`) and any div
prop. The surface carries `role="progressbar"` with `aria-valuenow/min/max`;
give it an `aria-label`.

## Degrades to

- **Reduced motion:** fill width tracks the value; no wobble, no loop.
- **Off-screen:** the settle loop pauses (IntersectionObserver).
