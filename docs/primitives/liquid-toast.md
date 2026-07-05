# LiquidToast

Toast notifications as liquid. Each toast **condenses** at a screen corner — the
pill geometry grows from a droplet while the canvas un-blurs — and **evaporates**
on dismiss (blur + lift + fade, the condense played backward). Toasts stack from
the corner; dismissing one collapses the stack beneath it. Rendered on the shared
overlay layer (`--fluidkit-z-toast`, default `1200`).

## Usage

Mount the provider once, near the root:

```tsx
import { LiquidToastProvider } from "fluidkit";

<LiquidToastProvider position="bottom-right">
  <App />
</LiquidToastProvider>
```

Then fire toasts from anywhere — event handlers, async code, outside React:

```tsx
import { toast } from "fluidkit";

await save();
toast("Changes saved");

toast("Message deleted", {
  action: { label: "Undo", onClick: restore },
  duration: 8000,
});

const id = toast("Uploading…", { duration: 0 });   // sticky
toast("Upload complete", { id });                   // updates in place
toast.dismiss(id);                                  // or dismiss it
```

Calls made before the provider mounts are queued and flushed on mount.

## Provider props

| Prop | Type | Default | What it does |
|---|---|---|---|
| `position` | `"bottom-right" \| "bottom-left" \| "top-right" \| "top-left"` | `"bottom-right"` | Screen corner the toasts condense in. |
| `duration` | `number` | `5000` | Default auto-dismiss delay in ms; `0` = sticky. Hover pauses the clock. |
| `dismissible` | `boolean` | `true` | Default close-button visibility. |
| `visibleToasts` | `number` | `3` | Live toasts beyond this cap push the oldest out early. |
| `gap` | `number` | `10` | Vertical gap between stacked toasts in px. |
| `offset` | `number` | `16` | Distance from the screen edges in px. |
| `minWidth` / `maxWidth` | `number` | `200` / `340` | Toast width bounds; content sizes within. |

Plus the surface style pack: `material`, `tint`, `color`, `intensity` (defaults
to `"present"`, matching the approved prototype's glint), `light`, `reflection`,
`shadow`. `refraction` is omitted — not physically wired on toasts.

`tint` defaults to a **near-solid white** (`rgba(255,255,255,0.82)`) — a
notification sits over unknown content and must stay readable. Lower the
tint's alpha for more see-through toasts, raise it for fully solid ones.

## `toast(message, options?)`

| Option | Type | What it does |
|---|---|---|
| `id` | `string \| number` | Stable identity: firing again with the same id updates that toast and resets its clock. |
| `duration` | `number` | Per-toast auto-dismiss override; `0` = sticky. |
| `dismissible` | `boolean` | Per-toast close-button override. |
| `action` | `{ label, onClick }` | One action button; the toast dismisses after it runs. |

Returns the toast id. `toast.dismiss(id?)` dismisses one toast, or all of them
when called with no argument. The toast body itself is not click-to-dismiss.

## Behavior

- The viewport is `role="status"` / `aria-live="polite"`; new toasts are
  announced without interrupting.
- Override stacking from a stylesheet: `:root { --fluidkit-z-toast: 60; }`.

## Degrades to

- **Reduced motion:** opacity-only in/out, static geometry; timers unchanged.
- **SSR:** the viewport portals only once a document exists; `toast()` calls
  during SSR are queued, never crash.
