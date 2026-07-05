# LiquidField

A text field on a liquid surface — the one control where the input stays
**visible**: text must remain crisp, real, and selectable, so the liquid is
entirely the field's background (the LiquidCard construction: the input lives
in normal flow above the surface, never clipped by it). On focus the surface
swells slightly and the focus meniscus appears; on blur it relaxes.

Everything text-related is native: placeholder, autofill, validation,
selection, IME. `multiline` swaps the `<input>` for a `<textarea>`.

## Usage

```tsx
import { LiquidField } from "fluidkit";

<LiquidField label="Email" placeholder="you@example.com" name="email" />
<LiquidField label="Notes" multiline />
```

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `label` | `ReactNode` | — | Rendered above the field, associated via `htmlFor`. |
| `multiline` | `boolean` | `false` | Render a `<textarea>`. |
| `radius` | `number` | `12` | Corner radius in px. |

Plus the surface style pack (`material`, `tint`, `color`, `intensity`,
`light`, `reflection`, `shadow`) and every native input/textarea prop
(`placeholder`, `name`, `required`, `type`, `rows`, …) forwarded to the real
element. No floating labels or prefix/suffix slots in v1 — by design.

## Degrades to

- **Reduced motion:** the swell is dropped; the focus meniscus still shows —
  focus visibility is not motion.
- **No backdrop-filter:** glass falls back to the flat fill (engine-wide rule).
