# Thinking

An organic "working" indicator: three liquid droplets merging and splitting on the engine's surface-tension cycle. A preset over [`Droplets`](droplets.md) with `role="status"` for assistive tech. Replaces the goo-based `ThinkingBlob`.

## Props

`Thinking` extends `DropletsProps` minus `count` and `followPointer`.

| Name | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | `"Thinking"` | Accessible label announced to screen readers. |
| `size` | `number` | `18` | Drop diameter in px. |
| `spread` | `number` | `44` | Cluster extent in px. |
| `speed` | `number` | `1.2` | Cycle speed multiplier. |
| `material` | `"glass" \| "flat"` | `"glass"` | Rendered material. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (Chromium-only; degrades silently to plain glass blur). |

## Usage

```tsx
import { Thinking } from "fluidkit";

{isWorking && <Thinking label="Generating" />}
```

## Degrades to

Reduced motion / off-screen: three static dots, no animation loop. The status role and label stay intact either way.
