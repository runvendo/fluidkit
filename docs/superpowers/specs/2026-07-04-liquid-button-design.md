# LiquidButton — design

Date: 2026-07-04
Status: approved (design conversation in session)

## Goal

`JellyButton` becomes `LiquidButton`: one liquid pill button whose `variant`
selects the press feel. The jelly physics stop being the component's identity
and become one of two options.

## API

- Breaking rename, no alias: `JellyButton` -> `LiquidButton`,
  `JellyButtonProps` -> `LiquidButtonProps`.
- New prop `variant?: "jelly" | "still"`, default `"jelly"`.
  - `"jelly"`: exactly today's behavior. Volume-preserving squash, point-aware
    dent (`deformPress`), release jiggle, optional `releaseWave`.
  - `"still"`: the same pill, zero geometry deformation on press. Press
    feedback is the existing non-geometric polish: fill deepening
    (`pressFeedback`) and the expanding press glint on glass (`pressGlint`).
    Functionally the reduced-motion presentation promoted to a first-class
    choice (reduced motion itself still wins over `variant="jelly"`).
- `squash`, `spring`, `releaseWave`, `deformPress` are jelly-only; documented
  as inert on `"still"`. Everything else (surface style pack, width/height,
  a11y, real `<button>` semantics) is shared.

## Defaults preserve today's feel

Default `variant="jelly"` means the rename alone changes nothing for existing
usage. A pinning test captures the still variant's press producing no
geometry change while the fill still deepens.

## Mechanical scope

Rename file, exports (`src/components/index.ts`), tests, showcase page +
`registry.ts` entry (sidebar reads LiquidButton), docs page
(`jelly-button.md` -> `liquid-button.md`), any demo usage
(`playground/demos/`). Showcase page gains a variant seg. CHANGELOG BREAKING
entry with migration hint (`JellyButton` -> `LiquidButton`; jelly is the
default so no other change needed).

## Non-goals

- No exposure of the button through other components (explicitly dropped).
- `useSquish` unchanged.
- No new press physics; "still" composes existing feedback, adds nothing new.
