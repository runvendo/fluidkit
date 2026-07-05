# LiquidMenu

A dropdown that **pours from its trigger**: the engine surface grows from the
trigger's edge across the menu box on a spring (LiquidPanel's pour), items
fading in once the surface has arrived. Dismissing drains it back. Rendered
through a portal on the shared overlay layer (`--fluidkit-z-menu`, default
`1100`), positioned against the trigger with flip-to-fit when the preferred
side has no room.

## Usage

```tsx
import { JellyButton, LiquidMenu } from "fluidkit";

<LiquidMenu
  trigger={<JellyButton>Options</JellyButton>}
  items={[
    { label: "Rename", onSelect: rename },
    { label: "Duplicate", onSelect: duplicate },
    { type: "separator" },
    { label: "Delete", onSelect: del, disabled: locked },
  ]}
/>
```

The trigger is any focusable element; `aria-haspopup`/`aria-expanded` and the
open handlers are injected onto it.

## Props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `trigger` | `ReactElement` | required | The element that opens the menu. |
| `items` | `LiquidMenuItem[]` | required | Items (`label`, `onSelect?`, `disabled?`, `icon?`) and `{ type: "separator" }` entries. |
| `side` | `"bottom" \| "top"` | `"bottom"` | Which side of the trigger the menu pours on; flips when there's no room. |
| `align` | `"start" \| "end"` | `"start"` | Which trigger edge the menu aligns to. |
| `gap` | `number` | `6` | Gap between trigger and menu in px. |
| `radius` | `number` | `14` | Corner radius in px. |

Plus the surface style pack: `material`, `tint`, `color`, `intensity`, `light`,
`reflection`, `shadow`. `refraction` is omitted — not physically wired on menus.

## Keyboard

WAI-ARIA menu-button pattern: Enter/Space/click opens; ArrowDown opens focusing
the first item, ArrowUp the last. Inside: ArrowUp/ArrowDown cycle (disabled
items skipped), Home/End jump, Escape closes and returns focus to the trigger,
Tab closes. Outside pointerdown closes. Selecting runs `onSelect`, closes, and
returns focus.

## Degrades to

- **Reduced motion:** open/close is an opacity fade over the fully-poured
  geometry; no loop runs.
- **SSR:** nothing portals until a document exists.

Not in v1 (by design): submenus, checkable items, typeahead. A select control
is a recipe — LiquidMenu for the list, LiquidField for the value.
