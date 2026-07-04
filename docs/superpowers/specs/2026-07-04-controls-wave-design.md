# Controls wave — design

Date: 2026-07-04
Status: approved in conversation (pending spec review)

## What it is

Eight components that give fluidkit the control surface every production app needs,
all on the existing engine — no new engine mechanics, only new applications of
mechanics that already shipped:

| Component | One-line concept | Mechanic it reuses |
|---|---|---|
| `LiquidSwitch` | Thumb is a droplet that tears off one well and merges into the other through a real metaball bridge | `Droplets` tear/merge |
| `LiquidCheckbox` | The check is a droplet that lands and settles into the box's well | Switch's droplet + `LiquidTooltip` condense |
| `LiquidSlider` | Droplet thumb riding the meniscus edge of a part-filled channel | Switch thumb + Progress fill |
| `LiquidField` | Text input whose surface swells on focus; the focus ring is a meniscus, not an outline | Engine surface + focus meniscus |
| `LiquidProgress` | Determinate progress as a vessel filling, meniscus at the fill edge | `MeniscusDivider` edge + `LiquidPanel` pour fraction |
| `LiquidToast` | Notification droplet condenses at the screen edge, evaporates on dismiss | `LiquidTooltip` condense, reversed for dismiss |
| `LiquidMenu` | Dropdown pours from its trigger | `LiquidPanel` pour + `LiquidDialog` portal |
| `LiquidBadge` | Count increments absorb a new droplet through a metaball bridge | `Droplets` merge |

Plus one piece of shared infrastructure: an internal **overlay layer** (portal target +
z-index scale) that Toast, Menu, and a retrofitted `LiquidDialog` all sit on.

## How we got here

Brainstormed 2026-07-04. Yousef proposed Switch, Progress, Toast, Menu, Slider;
Field, Checkbox, and Badge were added as essentials (form-control credibility gap,
form trio completion, strongest-fit merge visual). Skipped deliberately: Skeleton
(`Thinking` owns loading), Accordion (`LiquidPanel`/`MorphSurface` cover it),
Select (a docs recipe composing Menu + Field, not a component).

Locked decisions:

- **Toast is a function**: `<LiquidToastProvider>` once at the root, then
  `toast("Saved")` from anywhere (sonner-style module dispatcher).
- **Form controls are real inputs**: Switch/Checkbox/Slider render a visually
  hidden native `<input>`; Field renders a visible one (text must stay crisp).
  Keyboard, screen readers, form submission, and form libraries come from the
  browser, not from us. Controlled and uncontrolled both work, like native React.
- **Execution is prototype-first** (Approach A): the three novel visuals — Switch
  tear/merge, Progress meniscus, Toast condense/evaporate — get playground lab
  prototypes and live review rounds before production code. The other five derive
  from approved mechanics and go straight to build.
- **Shared code is extracted at the second consumer**, not before: the overlay
  layer comes out of Toast+Menu (+Dialog retrofit), the droplet-thumb out of
  Switch→Checkbox→Slider.

## Shared foundation

**Overlay layer** (internal, `src/components/overlay.ts`): a portal helper and a
z-index scale exposed as CSS custom properties (`--fluidkit-z-dialog`,
`--fluidkit-z-menu`, `--fluidkit-z-toast`, `--fluidkit-z-tooltip`) with sane
defaults, so an app with its own z-index world overrides ours without forking.
Default order, bottom to top: dialog backdrop → dialog → menu → toast → tooltip
(exact values settled in review). `LiquidDialog` is retrofitted onto it; Toast and
Menu are born on it. Not a public export until something forces it.

**Focus meniscus** (internal): one shared focus-visible treatment for all four form
controls — the surface edge swells where it meets the page instead of a browser
outline ring. Must satisfy WCAG focus-visibility; if the swell alone is too subtle
in review, it gains a tinted edge line, still liquid-shaped.

**Style pack**: all eight extend `SurfaceStyleProps`, omitting only what physically
can't apply. All cross-cutting guarantees hold: reduced motion collapses to clean
static states (snap, no loops), SSR-safe, off-screen loops pause, feature detection
degrades rather than fails.

## The components

### LiquidSwitch

Track is one engine surface with two wells; the thumb droplet sits seated in one.
On toggle the droplet stretches toward the far well, the bridge necks and tears
(`Droplets` tension), and it merges into the far well with a settle wobble.
Checked/unchecked read as more than thumb position: the track fill tints on the
on side (color-blind safe, not color-only — position carries the state too).

- Hidden native `<input type="checkbox" role="switch">`.
- v1 is click/keyboard toggle. Pointer-drag of the droplet is out of scope this
  wave (revisit with Slider's drag learnings if wanted).
- Reduced motion: thumb cross-fades between wells, no bridge.

### LiquidCheckbox

The box is a small well. On check, a droplet condenses above and lands, settling
to fill the well (condense mechanics at Tooltip pace). Uncheck: the liquid drains
out (pour in reverse). `indeterminate` is supported (native checkboxes have it):
liquid sits at half-fill with a flat meniscus.

- Hidden native `<input type="checkbox">`; label association via wrapping or `id`.
- Reduced motion: filled/empty cross-fade.

### LiquidSlider

The track is a shallow channel filled with liquid up to the value — the same
vessel-fill read as Progress — and the thumb droplet rides the meniscus edge.
During drag the droplet stretches with velocity (surface tension) and settles on
release; the fill follows the thumb.

- Hidden native `<input type="range">` (min/max/step for free).
- Horizontal only in v1. No tick marks, no dual-thumb range (out of scope).
- Reduced motion: thumb and fill track the value with no stretch or wobble.

### LiquidField

The one control where the input is visible — text must stay crisp, so the liquid
is entirely the field's background surface. On focus the surface swells slightly
and the focus meniscus appears; on blur it relaxes. Single-line `<input>` and
`multiline` (`<textarea>`) variants share the surface.

- Native input styles reset; placeholder, autofill, and validation are native.
- No floating labels, no prefix/suffix slots in v1 — plain `label` prop rendered
  above, or bring your own.
- Reduced motion: focus state snaps (meniscus still appears — focus visibility is
  not motion).

### LiquidProgress

A horizontal vessel filling left to right. The fill edge is a live meniscus that
wobbles subtly while `value` is changing and settles flat when it stops — motion
communicates "still moving" without a loop running at idle. Determinate only:
`Thinking` owns indeterminate, and the docs say so.

- `value` / `max` props (native `<progress>` convention); surface carries
  `role="progressbar"` with `aria-valuenow`.
- Reduced motion: fill width tracks value with no wobble.

### LiquidToast

`<LiquidToastProvider>` mounts the overlay-layer viewport (default corner
`bottom-right`, configurable); `toast(message, options?)` is a module-level
function usable outside React. A toast condenses at the screen edge (Tooltip's
condense, scaled up), sits for `duration` (default ~5s, pausable on hover), then
evaporates — blur-out + lift + fade, condense played backward. Multiple toasts
stack with a FlowStagger-style rise; the stack is capped (oldest evaporates early).

- v1 options: `duration`, `dismissible` (close affordance), `id` (dedupe/update).
  No `toast.promise`, no action buttons, no swipe-to-dismiss (out of scope).
- `role="status"` (polite) on the viewport; hover pauses timers.
- Reduced motion: opacity-only in/out, timers unchanged.

### LiquidMenu

A dropdown that pours from its trigger edge (Panel's pour geometry) into an
overlay-layer portal. Items via an `items` array (the `LiquidTabs` convention):
label, optional icon, `onSelect`, `disabled`, plus separator entries. Selecting
or dismissing drains the menu back into the trigger.

- ARIA menu-button pattern: `aria-haspopup`/`aria-expanded` on the trigger,
  `role="menu"`/`menuitem` items, arrow-key navigation, Home/End, Escape closes,
  focus returns to the trigger. No submenus, no checkable items in v1.
- Placement: `side`/`align` props with flip-to-fit when there's no room.
- Reduced motion: open/close is an opacity fade, poured geometry only.

### LiquidBadge

Wraps a count (or renders standalone). When `count` increments, a small droplet
appears beside the badge and merges into its body through a metaball bridge; the
number cross-fades — the text never scales (house rule). Decrements just
cross-fade. `max` (e.g. `99+`) and `showZero` props; count of zero hides the badge
by default.

- Purely decorative motion on a text container — no live-region announcements by
  default (opt-in `aria-live` would be a follow-up if asked for).
- Reduced motion: count cross-fades, no droplet.

## Public API sketch

```tsx
<LiquidSwitch checked={on} onCheckedChange={setOn} label="Wi-Fi" />
<LiquidCheckbox defaultChecked label="Remember me" />
<LiquidSlider min={0} max={100} step={1} value={v} onValueChange={setV} aria-label="Volume" />
<LiquidField label="Email" placeholder="you@example.com" multiline={false} />
<LiquidProgress value={0.6} />   // or value={60} max={100}

<LiquidToastProvider position="bottom-right">…</LiquidToastProvider>
toast("Changes saved", { duration: 5000 });

<LiquidMenu
  trigger={<JellyButton>Options</JellyButton>}
  items={[
    { label: "Rename", onSelect: rename },
    { label: "Duplicate", onSelect: duplicate },
    { type: "separator" },
    { label: "Delete", onSelect: del, disabled: locked },
  ]}
/>

<LiquidBadge count={unread} max={99}><InboxIcon /></LiquidBadge>
```

All eight also accept the `SurfaceStyleProps` pack. Form controls forward refs to
their native input and spread unknown props onto it (`name`, `required`, etc.).

## Build order

1. **Prototype round** (playground lab pages, throwaway): Switch tear/merge,
   Progress meniscus wobble, Toast condense/evaporate. Live review, 2–4 rounds.
2. **Overlay layer** + `LiquidDialog` retrofit (pure refactor, no visual change).
3. **Toast**, then **Menu** (second consumer proves the layer).
4. **Switch**, then **Checkbox**, then **Slider** (droplet-thumb family, extracted
   at the second consumer).
5. **Progress**, **Field**, **Badge** (independent, any order).
6. Docs pages, showcase entries, changelog, size-budget re-pin.

Each component lands with its docs page (`docs/primitives/*.md`), showcase entry,
and tests before the next starts.

## Testing

Per component: jsdom render + a11y contract (roles, labels, keyboard), controlled/
uncontrolled behavior, reduced-motion branch, SSR render (no window at import).
Toast: dispatcher works before/after provider mount, dedupe by `id`, stack cap.
Menu: full keyboard walk, focus return, outside-click close. Overlay: z-var
override respected. Native-input forwarding: `name` participates in form submit.

## Out of scope (explicitly)

- Switch pointer-drag; Slider ticks, vertical, or dual-thumb range.
- `toast.promise`, toast action buttons, swipe-to-dismiss.
- Menu submenus and checkable items; Select (documented as a Menu+Field recipe).
- Field floating labels and prefix/suffix slots.
- Skeleton, Accordion (rejected — covered by `Thinking` / `LiquidPanel`).
- Making the overlay layer a public API.
