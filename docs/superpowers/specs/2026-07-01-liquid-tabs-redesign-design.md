# LiquidTabs Redesign — Design

Date: 2026-07-01
Status: Approved (brainstorming)

## Goal

Turn `LiquidTabs` from a weak, unstyled component into the flagship showcase of
fluidkit: gorgeous with zero props, physically smooth motion, and a real tabs
feature set (sizes, disabled tabs, icons, panels, keyboard nav). It stays
theming-agnostic — opinionated defaults with full escape hatches — per the
library brief.

## Motion

Two flows ship as options via a `flow` prop. Both are spring-driven so rapid
clicks interrupt cleanly (retarget from current position, never snap or
restart).

- **`slide` (default)** — droplet slide. The pill travels as one droplet with
  inertia: squashes with velocity (height divided by root of stretch, capped
  around 22%), a small tail blob lags and re-merges through the tension field,
  lands dead-flat. Near-critically damped: one soft settle, no bounce.
- **`stretch`** — taffy. Two edge springs; the leading edge is eager, the
  trailing edge lags, so the body stretches across the gap and relaxes. Volume
  conserved by squashing height, floored at 72% so the pill stays readable.

An earlier "bridge-flow" direction (mass splits into a flying drop) was
prototyped and dropped: it read as gimmicky and hard to keep smooth.

### Coverage-driven label color

Label color is driven by how much liquid currently covers each tab, never by
click state. Each flow reports the x-intervals its ink covers; a label's color
is a smoothstep of its overlap, mixed from base to active. This is the fix for
the "old label fades out the instant you click" disconnect — selection styling
is a consequence of where the mass is, so labels and liquid always move
together.

## Materials

Two materials, mapped onto the existing liquid engine's `resolveMaterial`:

- **`ink` (default)** — solid dark liquid on a frosted-glass container. High
  contrast, reads on any background. Uses the engine `flat` material with the
  `color` prop.
- **`glass`** — the indicator itself is liquid glass: translucent, blurs what's
  beneath it, top highlight. Uses the engine `glass` material, which already
  degrades to frosted-flat where `backdrop-filter` is unsupported.

Mercury and a chrome-less "soft tint" look were prototyped and cut to keep the
default composed.

## Public API

```tsx
<LiquidTabs
  items={[
    { id: "chat", label: "Chat", icon: <ChatIcon /> },
    { id: "files", label: "Files", disabled: true },
  ]}
  defaultValue="chat"        // or value + onChange for controlled
  flow="slide"               // "slide" (default) | "stretch"
  material="ink"             // "ink" (default) | "glass"
  size="md"                  // "sm" | "md" | "lg"
  color="#23242c"            // ink color override; ignored by glass
/>

<LiquidTabs.Group defaultValue="chat">
  <LiquidTabs items={...} />
  <LiquidTabs.Panel id="chat">…</LiquidTabs.Panel>
  <LiquidTabs.Panel id="files">…</LiquidTabs.Panel>
</LiquidTabs.Group>
```

Decisions:

- **Uncontrolled by default** (`defaultValue`), controlled still supported. The
  current component is controlled-only, which is friction for copy-paste use.
- **Ships styled.** The component renders its own container (frosted pill for
  ink, minimal ring for glass) — the playground's wrapper styling moves into the
  component. Overridable via `className` / `style` and `--fluidkit-tabs-*` CSS
  custom properties.
- **Icons** are a first-class per-item slot: icon+label or icon-only. Icon-only
  requires `aria-label`. The ink colors both icon and text via coverage.
- **Disabled tabs** are per-item: skipped by keyboard nav, non-clickable, dimmed.
- **Panels are optional.** The bar alone stays valid. Existing usage
  (`items` / `value` / `onChange` / `color`) keeps working unchanged.
- **Inside a `Group`**, the bar reads value and setter from context; its own
  `value` / `defaultValue` / `onChange` props are then optional. Standalone, it
  owns its own state.

## Module structure

Replace the single 350-line file with a focused module:

```
src/components/tabs/
  index.ts          — public exports
  LiquidTabs.tsx    — the bar: layers, measurement, spring orchestration
  flows.ts          — PURE scene math for slide + stretch:
                      (rects, springValues, size) → { path, inkIntervals }.
                      No DOM. Unit-testable.
  tint.ts           — ink intervals → per-tab coverage (smoothstep) → color mix.
                      Pure.
  useTabList.ts     — keyboard nav + ARIA: roving tabindex, arrows / Home / End,
                      disabled skipping
  TabsGroup.tsx     — context provider (value, setValue, id namespace)
  TabPanel.tsx      — role=tabpanel, aria wiring, content cross-fade
```

`src/components/index.ts` re-exports so the package API stays
`import { LiquidTabs } from "fluidkit"`.

## Accessibility, degradation, SSR

- **Keyboard / ARIA:** `role="tablist"`, roving tabindex, Left/Right (Home/End)
  move focus, Enter/Space activate, disabled tabs skipped. Panels get
  `role="tabpanel"` + `aria-controls` / `aria-labelledby`.
- **`prefers-reduced-motion`:** no springs, no flow — pill snaps to the active
  tab, labels switch instantly, panels hard-swap.
- **Degradation:** `glass` falls back to frosted-flat where `backdrop-filter` is
  unsupported (engine handles this). Text is never scaled — panels cross-fade
  only, honoring the library's "animate the surface, never the text" principle.
- **SSR-safe:** measurement runs in a layout effect; degenerate path until first
  real layout pass.

## Testing

- `flows.ts` and `tint.ts` are pure → Vitest unit tests: path geometry at
  drain / mid / settle, coverage math at tab boundaries.
- `useTabList` → Testing Library: arrow navigation, Home/End, disabled skipping,
  activation.
- Visual motion verified by rendering in the playground + screenshots.

## Playground & docs

The `#liquid-tabs` demo card gains controls: flow toggle (slide/stretch),
material toggle (ink/glass), size selector, and a "disable a tab" toggle, so the
showcase exercises every prop. The docs snippet updates to the uncontrolled
default form.
