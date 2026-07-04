# Controls Wave Implementation Plan

> **For agentic workers:** Execute phase by phase. Phase 1 ends at a hard review
> gate — do not start production component code until the prototype round is
> approved. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 8-component controls wave (Switch, Checkbox, Slider, Field,
Progress, Toast, Menu, Badge) plus the internal overlay layer, per
`docs/superpowers/specs/2026-07-04-controls-wave-design.md`.

**Architecture:** No new engine mechanics — every component is a new application
of shipped mechanics (Droplets tear/merge, Tooltip condense, Panel pour, Dialog
portal, MeniscusDivider edge). Form controls wrap real native inputs. Toast/Menu/
Dialog share one internal overlay layer. Novel visuals are prototyped and
review-approved before production code exists.

**Tech Stack:** React + Motion on the existing liquid engine; vitest + jsdom;
playground (vite) for prototypes and showcase.

**House rules that bind every task:** animate the surface, never the text;
reduced motion collapses to static states; SSR-safe; style pack
(`SurfaceStyleProps`) on every surface; docs page + showcase entry + tests land
in the same commit as the component; changelog entry per component.

---

## Phase 1 — Prototype lab (throwaway) → REVIEW GATE

Three lab pages in the playground, registered at the bottom of the showcase
sidebar under `Lab:` titles. They import engine internals directly, expose raw
parameter knobs, and are deleted (or parked) before the wave merges. Goal:
Yousef approves the motion of the three novel visuals in 2–4 live rounds.

- [x] **Switch lab** (`playground/showcase/pages/labs/SwitchLab.tsx`): two-well
  track, droplet thumb; knobs for well spacing, bridge neck/tear threshold,
  travel spring, settle wobble; toggle by click. Show 2–3 sizes side by side.
- [x] **Progress lab** (`playground/showcase/pages/labs/ProgressLab.tsx`):
  vessel fill with live meniscus edge; knobs for wobble amplitude/frequency,
  settle time, fill spring; scripted value playback (0→100 at varying rates)
  plus a manual scrub.
- [x] **Toast lab** (`playground/showcase/pages/labs/ToastLab.tsx`): condense-in
  at a screen corner, evaporate-out (blur + lift + fade); knobs for condense
  pace, evaporate pace, blur amount, stack spacing; buttons to fire/dismiss
  several toasts.
- [x] Register the three pages in `playground/showcase/registry.ts`; commit as
  one prototype commit.
- [x] **REVIEW GATE:** approved 2026-07-04 after two rounds. Round-1 feedback:
  no resting bead in the switch's empty well; calmer progress wobble; toast
  needs the classic controls. **Approved values:**
  - *Switch*: transit bead 0.32× thumb, travel spring 210/16, satellite
    0.28× smaller body over 420ms, bead drain ease τ≈90ms, no resting liquid
    in wells, on-side tint fades with thumb position.
  - *Progress*: fill spring 90/14, wobble amplitude 0.08, frequency 1.6 Hz,
    full wobble at velocity ≥0.6/s, envelope decay τ≈260ms, meniscus bead
    1.15× half-height.
  - *Toast*: condense spring 260/20 (pace 1×), evaporate pace 1.3×, blur
    14px, lift 26px, stack gap 10px, geometry grow floor 0.3, content fade
    in over grow 0.55→1, auto-dismiss default 5s (0 = sticky, hover pauses),
    close button default on, body click does not dismiss.

## Phase 2 — Overlay layer + Dialog retrofit

Pure refactor, zero visual change.

- [x] Write tests first: z-var override respected; portal target creation is
  SSR-safe; Dialog renders identically (existing Dialog tests keep passing).
- [x] Create internal `src/components/overlay.ts`: portal helper + z-index scale
  as CSS custom properties (`--fluidkit-z-dialog|menu|toast|tooltip`) with
  defaults ordered dialog backdrop → dialog → menu → toast → tooltip.
- [x] Retrofit `LiquidDialog` onto it. Not a public export.
- [x] Verify: full test suite + typecheck green; visual spot-check Dialog page.
  Commit. (Done 2026-07-04: 381 tests, computed z unchanged at 1000.)

## Phase 3 — Toast, then Menu (overlay consumers)

- [x] **LiquidToast**: tests first (dispatcher before/after provider mount,
  dedupe by `id`, stack cap, hover pause, reduced-motion branch, `role="status"`).
  Then `LiquidToastProvider` + module-level `toast()` per spec, using approved
  Phase-1 condense/evaporate values. Docs page, showcase entry, changelog.
  Commit. (Done: 11 tests.)
- [x] **LiquidMenu**: tests first (full keyboard walk, focus return,
  outside-click close, `aria-haspopup`/`expanded`, disabled items, flip-to-fit).
  Then the component: pour-from-trigger via Panel geometry, `items` array per
  spec. Docs, showcase, changelog. Commit. (Done: 9 tests. Flip-to-fit is
  viewport-math inside the placement effect; jsdom rects are 0 so it's
  exercised in the browser, not unit-tested.)
- [ ] After Menu lands, extract whatever Toast and Menu duplicated into the
  overlay module (second-consumer rule). Commit. (Reviewed: both share only
  overlayRoot/overlayZ, already extracted; their measure-content and
  settle-loop shapes match Tooltip/Panel precedent but differ in details —
  no forced abstraction yet. Revisit after the form family lands.)

## Phase 4 — Droplet-thumb family: Switch → Checkbox → Slider

- [x] **LiquidSwitch**: tests first (hidden native checkbox with switch role,
  controlled + uncontrolled, keyboard toggle, form participation via `name`,
  label association, reduced-motion branch). Then the component with approved
  Phase-1 tear/merge values. Docs, showcase, changelog. Commit. (Done: 8
  tests; new shared `focus.ts` — modality-tracked focus meniscus.)
- [x] **LiquidCheckbox**: same test contract plus `indeterminate` (half-fill
  meniscus). Docs, showcase, changelog. Commit. (Done: 7 tests. The shared
  extraction turned out to be the form-control shell — `formControl.ts`,
  hidden-input recipe + checked-state pattern — not droplet mechanics; the
  checkbox's motion is a fall-and-fill, not a tear.)
- [x] **LiquidSlider**: tests first (hidden native range input, min/max/step,
  controlled + uncontrolled, change updates value, reduced-motion branch).
  Fill read reuses Progress's vessel; the hidden native range input covers
  the track so drag/keyboard are browser-native. Docs, showcase, changelog.
  Commit. (Done: 7 tests.)

## Phase 5 — Independents: Progress, Field, Badge

- [x] **LiquidProgress**: tests first (`role="progressbar"` + `aria-valuenow`,
  value/max clamping, wobble only while value changes — no idle loop,
  reduced-motion branch). Approved Phase-1 meniscus values. Docs, showcase,
  changelog. Commit. (Done: 4 tests.)
- [x] **LiquidField**: tests first (visible native input/textarea, `multiline`
  switch, label association, focus meniscus appears on focus-visible, native
  props forwarded, reduced-motion keeps focus visibility). Docs, showcase,
  changelog. Commit. (Done: 5 tests.)
- [x] **LiquidBadge**: tests first (count text, `max` overflow (`99+`),
  `showZero`, increment triggers droplet only when motion allowed, text
  cross-fades). Docs, showcase, changelog. Commit. (Done: 6 tests; badge is
  aria-hidden by contract — the real count belongs on the anchor.)

## Phase 6 — Wave close-out

- [ ] Shared focus-meniscus audit: identical treatment across the four form
  controls; WCAG focus-visibility check (contrast of the focus indication).
- [x] Delete or park the Phase-1 lab pages; clean the registry. (Deleted
  2026-07-04 per live review; values live in this plan, code in git history.)
- [x] README primitives table + materials note updated. (Seven entries —
  **LiquidBadge was CUT in live review**, all its files removed.)
- [x] Live-review round on the production components (2026-07-04): badge cut;
  toast default tint now near-solid 0.82 white + opacity knob on its page;
  checkbox is a pure pour (no falling droplet); slider saturates into the
  fill tint while being slid.
- [ ] `CHANGELOG.md` release section; size budget re-pinned with rationale.
  (Provisionally bumped 27.3 → 33 kB mid-wave when Switch crossed the old
  budget by 130 B; the close-out re-pin replaces this with measured +20%.)
- [ ] Full verification: `npm test`, `npm run typecheck`, `npm run size`,
  `npm run check:gpu-leak`, `npm run check:pack`.
- [ ] Code review pass (requesting-code-review), fix findings.
- [ ] PR: branch `yousefh409/new-components` → `main`, spec + plan linked.

## Verification contract (every component)

jsdom render + a11y roles/labels/keyboard; controlled/uncontrolled; reduced-motion
branch renders the static state with no loop; SSR import safety (no `window` at
module scope); form controls appear in `FormData` under their `name`.
