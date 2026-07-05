# VoiceBall

A voice-assistant orb driven by a live `level` prop and a `mode`. The library
takes no microphone dependency; feed `level` from any audio stack. The value is
stored in a ref and smoothed inside the render loop, so frequent analyser
updates do not require React re-renders.

`mode="idle"` breathes slowly, `mode="listening"` responds lightly to the input
level, and `mode="speaking"` swells harder with edge undulation and fused
satellite beads at speech peaks.

## Props

`VoiceBall` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `level` | `number` | `0` | Live audio level, clamped to `0`-`1`. |
| `mode` | `"idle" \| "listening" \| "speaking"` | `"idle"` | Orb behavior. |
| `size` | `number` | `96` | Resting diameter in px. |

Plus the surface style pack: `material`, `tint`, `color`, `opacity`,
`intensity`, `light`, `reflection`, `refraction`, and `shadow`.

## Usage

```tsx
import { VoiceBall } from "fluidkit";

<VoiceBall mode="speaking" level={voiceLevel} aria-label="Assistant speaking" />
```

Decorative balls can be left without an accessible label.

## Degrades to

- **Reduced motion:** no loop, wobble, or satellites; a static circle renders
  at the current level's size.
- **Off-screen:** the render loop pauses.
- **No `backdrop-filter` support:** glass renders as a frosted flat fill.
