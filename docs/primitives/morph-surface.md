# MorphSurface

The flagship primitive. One liquid body morphs between a closed (pill) and open (panel) shape on the liquid engine: a spring-driven rounded rect, plus optional satellite droplets that park beside the closed pill and get absorbed through real liquid bridges on open.

## Core principle

`MorphSurface` structurally enforces fluidkit's one non-negotiable rule: **animate the surface, never the text.** The surface is engine geometry (a `clip-path` over the material layer); the closed and open content faces live on an unclipped overlay and only ever cross-fade. Nothing that resizes the surface can touch a glyph.

## Props

`MorphSurface` extends `HTMLAttributes<HTMLDivElement>` (minus `children`).

| Name | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | required | Controlled state: `false` = pill, `true` = panel. |
| `closedSize` | `{width, height}` | `150x46` | Pill geometry. |
| `openSize` | `{width, height}` | `250x200` | Panel geometry. |
| `radius` | `number` | `24` | Panel corner radius (the pill is always fully rounded). |
| `material` | `"glass" \| "flat"` | `"glass"` | Rendered material. |
| `tint` / `color` | `string` | — | Glass tint / flat fill. |
| `light` | `{x, y} \| null` | above, 30% from left | Scene light; `null` disables highlights. |
| `reflection` | `boolean` | `true` | Paint specular reflections on glass. |
| `refraction` | `boolean` | `false` | Edge lensing on glass (SVG displacement inside `backdrop-filter`, Chromium-only; degrades silently to plain glass blur). |
| `satellites` | `boolean` | `true` | Droplets absorbed into the surface on open. |
| `closedContent` | `ReactNode` | — | Face shown on the pill. |
| `openContent` | `ReactNode` | — | Face shown on the panel. |

The container reserves horizontal margin for the parked satellites, so it is larger than `openSize`.

## Usage

```tsx
import { useState } from "react";
import { MorphSurface } from "fluidkit";

function Launcher() {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen((v) => !v)}>
      <MorphSurface
        open={open}
        closedContent={<PillLabel />}
        openContent={<ChatPanel />}
      />
    </div>
  );
}
```

## Degrades to

- **Reduced motion / off-screen**: the surface snaps to the target shape instantly; faces still cross-fade (opacity only).
- **No `backdrop-filter` support**: glass renders as a frosted flat fill.
