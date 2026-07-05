# LiquidCheckbox

The check is **liquid, not a tick**: on check the pool rises to fill the
box's well, settling with a wobble; on uncheck the liquid drains out.
`indeterminate` — a real capability of the native checkbox — reads as a
half-filled well with a flat meniscus.

The empty well reads as a crisp glass box — a neutral hairline edge and a
well-scaled shadow — never a faint smear.

A real (visually hidden) `<input type="checkbox">` powers it: keyboard,
screen readers, form submission, and label association are the browser's.
Keyboard focus shows the shared focus meniscus.

## Usage

```tsx
import { LiquidCheckbox } from "fluidkit";

// controlled
<LiquidCheckbox checked={v} onCheckedChange={setV} label="Remember me" />

// uncontrolled, inside a form
<LiquidCheckbox name="remember" defaultChecked label="Remember me" />

// mixed (e.g. "some rows selected")
<LiquidCheckbox indeterminate label="Select all" />
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `checked` | `boolean` | — | Controlled state. |
| `defaultChecked` | `boolean` | `false` | Uncontrolled initial state. |
| `onCheckedChange` | `(checked: boolean) => void` | — | Fires with the next state on every toggle. |
| `indeterminate` | `boolean` | `false` | Half-filled well; sets the native `indeterminate` property. |
| `label` | `ReactNode` | — | Label beside the box, natively associated. |
| `size` | `number` | `20` | Box size in px. |
| `disabled` | `boolean` | `false` | Forwarded to the input. |

Plus the surface style pack (`material`, `tint`, `color`, `intensity` —
defaults `"present"`, the pool carries Droplets' specular brightness —
`light`, `reflection`, `shadow`) and any native input prop (`name`, `value`,
`required`, …) forwarded to the hidden checkbox.

## Degrades to

- **Reduced motion:** fill level snaps between states; no wobble.
- **No backdrop-filter:** glass falls back to the flat fill (engine-wide rule).
