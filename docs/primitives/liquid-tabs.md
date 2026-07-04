# LiquidTabs

A tab strip whose active-tab indicator is a liquid engine body. On tab change the indicator flows between tabs instead of sliding, and each label's color tracks how much liquid currently covers it, so labels and indicator always move together.

It ships styled out of the box (its own frosted or glass container) and works with zero wrapper markup. Everything is overridable.

## Flows

Set the transition style with `flow`:

- `slide` (default): the indicator travels as one droplet with inertia. It squashes with speed, a small tail lags behind and re-merges through the engine's tension field, and it lands flat.
- `stretch`: one taffy pill that never splits. The leading edge lunges to the target while the trailing edge lags, so the pill stretches across the gap, then relaxes.

Both are spring-driven, so rapid clicks interrupt cleanly and retarget from the current position rather than restarting.

## Materials

Set the surface with `material`:

- `flat` (default): a solid dark indicator on a frosted container. Highest contrast, reads on any background. Use `color` to set the fill.
- `glass`: the indicator itself is liquid glass, translucent and blurring what sits behind it. `color` is ignored; use `tint` to tint both the container and the indicator. Falls back to a frosted flat fill where `backdrop-filter` is unsupported.

## Layering

Tab labels never sit inside a filtered or rasterized subtree (the library's non-negotiable: animate the surface, never the text). `LiquidTabs` renders two overlaid sibling layers inside the container:

1. Indicator layer: absolutely positioned, `pointer-events: none`, `aria-hidden`. Holds only the liquid body (engine geometry as a `clip-path` over the material fill). No text, no filters.
2. Buttons layer: the `role="tab"` buttons with their labels, on top, fully interactive.

Tab boxes are measured (`offsetLeft` / `offsetWidth`) in a layout effect (a ResizeObserver keeps them fresh); per-frame scenes are written imperatively to the DOM, so the animation never re-renders React.

## Accessibility

`role="tablist"` on the container, `role="tab"` on each button. Arrow keys (Left/Right), Home, and End move selection and focus, skipping disabled tabs and wrapping at the ends. The selected tab owns the roving tabindex. When used with `LiquidTabs.Group` and `LiquidTabs.Panel`, tabs and panels are wired with matching `aria-controls` / `aria-labelledby`.

## Props

`LiquidTabs` extends `HTMLAttributes<HTMLDivElement>` (minus `onChange` and `defaultValue`, redefined below). Controlled via `value` + `onChange`, or uncontrolled via `defaultValue`. Inside a `LiquidTabs.Group`, the group owns the value and these props are optional.

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | `LiquidTabsItem[]` | required | The tabs to render. |
| `value` | `string` | undefined | Controlled active id. |
| `defaultValue` | `string` | first enabled item | Uncontrolled initial active id. |
| `onChange` | `(id: string) => void` | undefined | Called when the active tab changes. |
| `flow` | `"slide" \| "stretch"` | `"slide"` | Transition style. |
| `material` | `"flat" \| "glass"` | `"flat"` | Indicator surface. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Padding, font size, and pill height. |
| `color` | `string` | `currentColor` | Flat fill color. Ignored by the glass material. |
| `tint` | `string` | engine glass tint | Glass tint for the container and indicator. Ignored by the flat material. |
| `className` | `string` | undefined | Applied to the container. |
| `style` | `CSSProperties` | undefined | Applied to the container. |

`LiquidTabsItem`:

| Name | Type | Description |
|---|---|---|
| `id` | `string` | Stable identity. |
| `label` | `ReactNode` | Text label. Optional for icon-only tabs. |
| `icon` | `ReactNode` | Leading icon. |
| `ariaLabel` | `string` | Accessible name for icon-only tabs. |
| `disabled` | `boolean` | Non-clickable, skipped by keyboard nav. |

## Usage

Uncontrolled, the simplest form:

```tsx
import { LiquidTabs } from "fluidkit";

function Tabs() {
  return (
    <LiquidTabs
      defaultValue="recent"
      items={[
        { id: "recent", label: "Recent" },
        { id: "starred", label: "Starred" },
      ]}
    />
  );
}
```

With panels, using the compound API. `LiquidTabs.Group` links the bar to its panels and owns the value:

```tsx
import { LiquidTabs } from "fluidkit";

function Tabs() {
  return (
    <LiquidTabs.Group defaultValue="chat">
      <LiquidTabs
        material="glass"
        flow="stretch"
        items={[
          { id: "chat", label: "Chat" },
          { id: "files", label: "Files", disabled: true },
        ]}
      />
      <LiquidTabs.Panel id="chat">Chat content</LiquidTabs.Panel>
      <LiquidTabs.Panel id="files">Files content</LiquidTabs.Panel>
    </LiquidTabs.Group>
  );
}
```

## Degrades to

Under `prefers-reduced-motion` the indicator snaps instantly to the active tab and labels switch at once: no springs, no flow. Panels hard-swap instead of cross-fading. Because the labels live on their own unfiltered sibling layer at all times, they stay crisp in every state.
