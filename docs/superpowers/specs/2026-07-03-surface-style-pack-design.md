# Surface style pack — design

Date: 2026-07-03
Status: approved (design conversation in session)

## Goal

Every fluidkit component accepts the same styling knobs, with the same names,
types, scales, and meanings, wherever they physically apply. A consumer who
learns `tint` on one component can use it on all of them. Defaults preserve
today's rendering exactly — nothing changes visually until a knob is touched.

## Background

The v-next audit found the styling API drifted as components landed:

- `shadow` is a prop on 6 components but hardcoded-on in Droplets, Thinking,
  MorphSurface, JellyButton.
- `intensity` means material volume in the surface family but squash physics
  in JellyButton; Droplets/Thinking/MorphSurface/LiquidTabs have no material
  intensity at all.
- `refraction` exists on 5 glass components, missing on 5 equally-glass ones.
- LiquidTabs names the glass tint `glassTint`; everything else says `tint`.
- The solid material is `"flat"` in the shared enum but `"ink"` in
  LiquidTabs/LiquidText and `"color"` in Silk. (Mercury was already removed.)
- The glass recipe (tint alpha + blur + saturate) is centralized in
  `resolveMaterial`, but Ripple, LiquidText, and LiquidTabs hardcode their own
  divergent values (glass-white alpha 0.28 / 0.38 / 0.28–0.62 vs the shared 0.3).

Breaking changes are acceptable: pre-1.0, and this release wave already ships
`feat!` removals.

## The pack

New `src/components/surface.ts` defines one shared props contract:

| Prop | Type | Meaning |
|---|---|---|
| `material` | `"glass" \| "flat"` | Rendered material (shared `LiquidMaterial`). |
| `tint` | `string` | Glass tint (any CSS color). |
| `color` | `string` | Flat fill. |
| `intensity` | `number \| "whisper" \| "present"` | How loudly the material reads (0–1). Always this meaning, never physics. |
| `light` | `Vec \| null` | Scene light in component coordinates; `null` disables speculars. |
| `reflection` | `boolean` | Paint specular reflections on glass. |
| `refraction` | `boolean` | Chromium-only edge lensing via `useRefraction`; degrades silently. |
| `shadow` | `boolean` | Drop shadow under the surface. |

Components extend the interface and `Omit<>` only what physically can't apply.
`speed` stays per-component (only animated primitives have it) but keeps its
existing "1 = designed pace" multiplier convention.

## Per-component changes

| Component | Adds | Renames / breaking | Notes |
|---|---|---|---|
| Droplets | `intensity`, `shadow` | — | Specular opacity routes through the shared intensity rule. |
| Thinking | `intensity`, `refraction`, `shadow` | — | Refraction wired like Droplets. |
| MorphSurface | `intensity`, `shadow` | — | Its hardcoded 0.28 specular maps to an equivalent default intensity. |
| JellyButton | `intensity` (material), `shadow` | `intensity` → `squash` | `squash` keeps the 0.12 default and 0–1 fractional meaning. |
| MeniscusDivider | `refraction` | — | |
| LiquidTooltip | `refraction` | — | |
| LiquidDialog | `refraction` | — | |
| VoiceBall | `refraction` | — | |
| LiquidTabs | `intensity`, `light`, `reflection`, `shadow` | `glassTint` → `tint`; material `"ink"` → `"flat"` | Indicator is an engine pill: gets the same specular/rim inputs as MeniscusDivider. Container glass routes through `resolveMaterial`. |
| LiquidText | — | material `"ink"` → `"flat"`; glass recipe via `resolveMaterial` | Keeps `angle`/`speed` sheen. No `light`/`reflection`/`refraction`/`shadow`: its lighting IS the sheen sweep, not the scene light — documented. |
| Ripple | `tint`, `intensity` | glass recipe via `resolveMaterial` | |
| Silk | — | material `"color"` → `"flat"` | Already routes glass through `resolveMaterial`. |
| FlowStagger | — | — | Pure motion primitive, no surface. Excluded. |
| MeshGradient / GlassPanes | — | — | Backgrounds already expose free color arrays + intensity. Excluded. |

## Defaults preserve today's look

- `shadow` defaults `true` on the four components where it was hardcoded on.
- Components gaining `intensity` default to whatever value reproduces their
  current constant brightness (e.g. a hardcoded 0.28 specular becomes the
  equivalent intensity under the shared `0.4 × volume` rule → default 0.7
  "present"), so default rendering is pixel-identical.
- New `refraction` defaults `false` everywhere (matches the existing five).
- Tint/color defaults are unchanged.

## Showcase and docs

- The five copy-pasted local `ColorField` controls collapse into one shared
  kit control (`playground/showcase/kit`); pages use it for `tint`/`color`.
- Every affected page exposes the new knobs where sensible, and generated
  snippets stay honest (only non-default props appear).
- The three pages seeding `intensity` at 0.5 (Dialog, VoiceBall, LiquidText)
  are corrected to the component default (0.35 "whisper").
- `docs/primitives/*` prop tables updated; CHANGELOG gains BREAKING entries
  for `squash`, `tint`, and the `"flat"` unification with migration hints.

## Testing

TDD per component, mirroring existing test patterns:

- Shared: a surface-pack conformance test asserting each participating
  component accepts the pack props and applies them (tint reaches the fill,
  `shadow={false}` removes the shadow layer, `light={null}` paints no
  speculars, intensity scales specular opacity).
- Renames: old prop names gone from types; behavior reachable via new names.
- Default-preservation: components gaining `intensity` render the same
  specular opacity as before at default props.

## Non-goals

- No `useSurface` mega-hook: per-component wiring stays, only names, types,
  defaults, and the material resolver are shared.
- No new visual features (no new materials, no shadow customization beyond
  on/off).
- No changes to spring/settle timing (separate audit finding).
