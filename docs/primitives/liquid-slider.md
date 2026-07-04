# LiquidSlider

A slider whose thumb is a **droplet riding the meniscus edge** of a
part-filled channel: the track is a shallow vessel filled with liquid up to
the value (the LiquidProgress read), and the thumb droplet sits fused to the
fill's leading edge, following it on a spring.

A real (visually hidden) `<input type="range">` covers the track — pointer
drag, keyboard steps, `min`/`max`/`step`, form submission, and screen readers
are all native browser behavior; fluidkit only paints from the input's value.
Keyboard focus shows the shared focus meniscus.

While the user is actively sliding (pointer held, or keyboard-stepping), the
channel liquid **saturates into the full fill tint**, relaxing back to the
quiet read on release — the liquid responds to being touched.

## Usage

```tsx
import { LiquidSlider } from "fluidkit";

// controlled
<LiquidSlider aria-label="Volume" value={v} onValueChange={setV} min={0} max={100} step={1} />

// uncontrolled, inside a form
<LiquidSlider name="volume" defaultValue={40} label="Volume" />
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `value` | `number` | — | Controlled value. |
| `defaultValue` | `number` | `min` | Uncontrolled initial value. |
| `onValueChange` | `(value: number) => void` | — | Fires on every change (drag, keyboard). |
| `min` / `max` / `step` | `number` | `0` / `100` / `1` | Native range semantics. |
| `label` | `ReactNode` | — | Label above the track, natively associated. |
| `width` | `number` | `240` | Track length in px. |
| `size` | `number` | `20` | Thumb diameter in px. |
| `fillTint` | `string` | quiet blue | The liquid in the channel. |
| `disabled` | `boolean` | `false` | Forwarded to the input. |

Plus the surface style pack (`material`, `tint`, `color`, `intensity` —
defaults `"present"`, the thumb carries Droplets' specular brightness —
`light`, `reflection`, `shadow`) and any native input prop forwarded to the
hidden range input. Horizontal only in v1; no tick marks, no dual-thumb range.

## Degrades to

- **Reduced motion:** thumb and fill track the value with no spring lag.
- **No backdrop-filter:** glass falls back to the flat fill (engine-wide rule).
