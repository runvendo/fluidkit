# LiquidSwitch

A toggle whose thumb is a **droplet**. On flip it stretches toward the far
well, the neck tears through a real metaball bridge (leaving a satellite
droplet at the pinch-off — the Droplets recipe), and it settles into the far
seat with a wobble. The wells hold no visible resting liquid: a transit bead
materializes under the departing thumb and the residue drains away after the
tear. The track tints on the on side, so state reads by position and color.

A real (visually hidden) `<input type="checkbox" role="switch">` powers it —
keyboard, screen readers, form submission, and label association are the
browser's job. Keyboard focus shows the shared focus meniscus, not a browser
outline.

## Usage

```tsx
import { LiquidSwitch } from "fluidkit";

// controlled
<LiquidSwitch checked={on} onCheckedChange={setOn} label="Wi-Fi" />

// uncontrolled, inside a form
<form>
  <LiquidSwitch name="wifi" defaultChecked label="Wi-Fi" />
</form>
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `checked` | `boolean` | — | Controlled state. |
| `defaultChecked` | `boolean` | `false` | Uncontrolled initial state. |
| `onCheckedChange` | `(checked: boolean) => void` | — | Fires with the next state on every toggle. |
| `label` | `ReactNode` | — | Label beside the track, natively associated. |
| `size` | `number` | `24` | Thumb diameter in px; the track scales with it. |
| `checkedTint` | `string` | quiet green | Track tint while on. |
| `disabled` | `boolean` | `false` | Forwarded to the input. |

Plus the surface style pack (`material`, `tint`, `color`, `intensity` —
defaults `"present"`, the droplet carries Droplets' specular brightness —
`light`, `reflection`, `shadow`), and any native input prop (`name`, `value`,
`required`, …) forwarded to the hidden checkbox.

## Degrades to

- **Reduced motion:** the thumb snaps between seats — no bridge, no satellite.
  The tint still flips; state never depends on motion.
- **No backdrop-filter:** glass falls back to the flat fill (engine-wide rule).
