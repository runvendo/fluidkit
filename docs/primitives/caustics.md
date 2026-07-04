# Caustics

Caustic "poolside light": the webbed light patterns sunlight makes through water, drifting slowly across a plaster-toned wall. The light is a self-contained WebGL fragment shader (an original fluidkit construction — no GPU dependencies); the wall is plain CSS.

Two ways to use it:

**As a background** — the component IS the background layer (`position: absolute; inset: 0; overflow: hidden; pointer-events: none`), placed inside a positioned parent alongside your real content.

**As a surface material** — every liquid-engine surface takes `material="caustics"`: LiquidCard, LiquidPanel, LiquidDialog, LiquidTooltip, JellyButton, MorphSurface, Droplets, Thinking, VoiceBall, MeniscusDivider. The surface's `tint` prop recolors the light, `color` recolors the wall. Caustic surfaces paint no glass speculars — the caustic light is the highlight.

Degradation: without WebGL (old browsers, SSR, context-starved pages) only the wall renders — a quiet plaster gradient, never a black box. Under `prefers-reduced-motion` the light renders one still frame. Browsers cap live WebGL contexts (roughly 8-16 per page): use a handful of caustic surfaces per view, not dozens; beyond the cap, extra surfaces quietly show the wall.

## Props

`Caustics` extends `HTMLAttributes<HTMLDivElement>`.

| Name | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | warm white | Light color. |
| `background` | `string \| [string, string]` | soft plaster | Wall color: one color or a `[top, bottom]` gradient pair. |
| `intensity` | `number` | `0.5` | Brightness of the light webs, `0`-`1`. |
| `scale` | `number` | `1` | Size of the light pattern; higher = larger webs. |
| `speed` | `number` | `1` | Drift rate. |
| `band` | `number` | `0.55` | Strength of the diagonal sunbeam the light lives in, `0`-`1` (`0` = uniform light). |
| `className` | `string` | `undefined` | Applied to the wrapper. |
| `style` | `CSSProperties` | `undefined` | Applied to the wrapper. |

## Usage

```tsx
import { Caustics } from "fluidkit";

function Hero() {
  return (
    <div style={{ position: "relative" }}>
      <Caustics />
      <YourContent />
    </div>
  );
}
```

Moonlit — cool light on a dark wall:

```tsx
<Caustics color="#dbeaff" background={["#141a20", "#0c1014"]} intensity={0.6} />
```

On surfaces:

```tsx
<LiquidCard material="caustics" />
<JellyButton material="caustics" tint="#dbeaff" color="#10161a" />
```
