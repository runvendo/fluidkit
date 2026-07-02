# 1.0 Stable API Review (2026-07-02)

Task 2 of `docs/superpowers/plans/2026-07-02-release-readiness.md`. Every public export of the core entry (`fluidkit`) and both GPU subpaths (`fluidkit/liquid-metal`, `fluidkit/water-field`), with a verdict and rationale. Verdicts: **keep** (frozen as-is), **document** (JSDoc/docs gap fixed, no API change), **fix default** (behavior aligned, no rename), **add** (type made importable), **remove** (dropped from the public surface, breaking).

## Cross-cutting findings

- **Prop vocabulary is already consistent.** `material` / `tint` / `color` / `light` / `reflection` / `refraction` mean the same thing on every engine component (Droplets, Thinking, MorphSurface, JellyButton, DripFuse), with the same defaults everywhere: `material="glass"`, `reflection=true`, `refraction=false`, `light` defaulting to `defaultLight()` and `null` disabling speculars. No renames needed.
- **`speed` contract unified.** Default `1` everywhere it exists (Thinking's `1.2` is a preset over Droplets, intentional). MeshGradient, Aurora, and LiquidMetal clamp with the shared `MIN_SPEED` floor; Droplets did not. Fixed: Droplets now clamps too, so `speed={0}` / negative values behave the same family-wide (effectively frozen, never wedged).
- **Types referenced by public props were not importable.** `LiquidMaterial` (5 components), `Vec` (the `light` prop), and `SpringConfig` (Magnetic / LiquidDrag / useSquish, already named in docs prop tables) appeared in public prop types but could not be imported by consumers. Added as type re-exports from the core entry. The engine itself (LiquidRenderer, TensionField, geometry, materials resolver) stays internal; these three are the only liquid-module types a public prop mentions.
- **`data-fluidkit` naming is consistent.** Kebab-case, root value matches the component name; child parts are prefixed (`jelly-canvas`, `drip-fuse-source`, `aurora-band`, ...). `Thinking` renders `data-fluidkit="droplets"` because it IS a Droplets preset; documented in its JSDoc rather than special-cased. `data-animating` on every rAF/CSS-loop component; `FlowStagger` and `LiquidTabs` expose `data-motion` (variant name) instead because their state is a mode, not a boolean; kept, both documented.
- **JSDoc.** Every component/hook had a thorough file-level doc, but many exported symbols had no attached JSDoc (nothing on IDE hover). Added a concise attached JSDoc to every exported function and to prop/type members that lacked one.
- **`size` units differ between Droplets (diameter) and DripFuse (radius).** Considered a rename (`radius` on DripFuse); rejected as confusion-for-confusion (`radius` already means corner radius on MorphSurface and attraction radius on Magnetic). Both JSDoc and docs tables state units explicitly. Document, not rename.

## Core entry: components

| Export | Verdict | Rationale |
|---|---|---|
| `Droplets` | **fix default** + document | `speed` now clamps with the shared `MIN_SPEED` floor like the other `speed` carriers. Attached JSDoc added. |
| `DropletsProps` | keep | Fully JSDoc'd, extends `HTMLAttributes`, consistent vocabulary. |
| `Thinking` | document | Preset over Droplets; JSDoc notes it renders `data-fluidkit="droplets"` with `role="status"`. |
| `ThinkingProps` | keep | `Omit<DropletsProps, "count" \| "followPointer">` + `label`; correct surface for a preset. |
| `MorphSurface` | document | Attached JSDoc added. |
| `MorphSurfaceProps` | document | `closedSize` / `openSize` / `material` / `tint` / `color` lacked JSDoc; added. |
| `MorphSize` | document | JSDoc added. Object size type is justified here (two sizes per instance); JellyButton/DripFuse's flat `width`/`height` stay flat (one size each). |
| `FlowStagger` | document | Attached JSDoc added. |
| `FlowStaggerProps` | keep | `stagger` (seconds) and `transition` are Motion-native vocabulary. |
| `LiquidTabs` (+ `.Group`, `.Panel`) | keep | Compound-component statics; bar works standalone. `useTabList` stays internal (behavior detail of the bar, no consumer contract). |
| `LiquidTabsProps` | document | `items` / `onChange` / `flow` / `material` / `size` lacked JSDoc; added. |
| `LiquidTabsItem` | document | `disabled` JSDoc added. |
| `LiquidTabsMaterial` | keep + document | `"ink" \| "glass"`: deliberately narrower than `LiquidMaterial` (an ink indicator is not a liquid body material). JSDoc added. |
| `LiquidTabsSize` | keep + document | `"sm" \| "md" \| "lg"` t-shirt sizes; the only component with discrete sizing, fine as a component-scoped type. JSDoc added. |
| `TabsGroupProps` | keep | `value` / `defaultValue` / `onChange` mirrors the bar; consistent controlled/uncontrolled contract. |
| `TabPanelProps` | keep | Minimal by design (`id`, `children`). |
| `FlowName` | keep + document | `"slide" \| "stretch"`. JSDoc added at the definition. |
| `Ripple` | document | Attached JSDoc added; `material` here is the 2-value subset `"flat" \| "glass"` (no mercury ripple), same word, narrower domain, documented. |
| `RippleProps` | keep | `color` default `currentColor` matches the library-wide theming posture. |
| `JellyButton` | document | Attached JSDoc added. Shares `DEFAULT_INTENSITY` / `DEFAULT_SPRING` / `ACTIVATION_KEYS` with `useSquish` via module import (constants are not public API). |
| `JellyButtonProps` | keep | `intensity` default 0.12 = `useSquish`'s, on purpose. |
| `Magnetic` | document | Attached JSDoc added. |
| `MagneticProps` | keep | `spring` now importable as `SpringConfig` (see adds). |
| `LiquidDrag` | document | Attached JSDoc added. `velocityToStretch` is module-exported for unit tests only, `@internal`-tagged, and not re-exported from the barrel: verified not public. |
| `LiquidDragProps` | keep | Drag props are deliberately Motion passthrough vocabulary (`dragConstraints`, `dragSnapToOrigin`). |
| `DripFuse` | document | Attached JSDoc added. `size` is a radius (stated in JSDoc + docs table); see cross-cutting note. |
| `DripFuseProps` | keep | `fire` counter trigger + `onComplete` is the established one-shot contract. |
| `MeshGradient` | document | Attached JSDoc added. |
| `MeshGradientProps` | keep | `colors` / `speed` / `blur`; `speed` clamped with `MIN_SPEED`. |
| `Aurora` | document | Attached JSDoc added. |
| `AuroraProps` | keep | `intensity` (0-1 opacity scale) + `blend`; `blur` intentionally absent (bands must stay soft), documented in-file. |

## Core entry: hooks

| Export | Verdict | Rationale |
|---|---|---|
| `useFlow` | document | Attached JSDoc added. Headless primitive behind FlowStagger; prop-bag contract is stable. |
| `UseFlowOptions`, `UseFlowResult`, `UseFlowContainerProps`, `UseFlowItemProps` | keep | All JSDoc'd. |
| `useRipple` | document | Attached JSDoc added. |
| `UseRippleOptions`, `UseRippleResult`, `UseRippleHandlers`, `RippleData` | keep | All JSDoc'd. |
| `useSquish` | document | Attached JSDoc added. |
| `UseSquishOptions`, `UseSquishResult`, `UseSquishHandlers`, `UseSquishStyle` | keep | All JSDoc'd. `DEFAULT_INTENSITY` / `DEFAULT_SPRING` / `ACTIVATION_KEYS` are module-level shares with JellyButton, not in the public barrel: intended internal, verified. |

## Core entry: utils (each DECIDED, per plan)

| Export | Verdict | Rationale |
|---|---|---|
| `resolveColor` | keep (intended public) | The theming contract in function form: consumers building custom primitives get the same trim + `currentColor` fallback the built-ins use. Trivial to freeze, already JSDoc'd. |
| `supportsBackdropFilter` | keep (intended public) | Pairs with the glass material's documented degradation; lets consumers branch chrome the same way `resolveMaterial` does. |
| `supportsRefraction` | keep (intended public) | Pairs directly with the public `refraction` prop (Chromium-only); consumers can gate the prop on it. |
| `supportsViewTransition` | **remove** (breaking) | Gated nothing: no fluidkit primitive or code path consumed it (only its own tests). Speculative surface from the v0.1 scaffold; freezing an unused generic detector at 1.0 means supporting it forever. Dropped from `featureDetect.ts`, the barrel, and tests. |
| `resolvePrefersReducedMotion` | keep (intended public) | The pure resolver that encodes the SSR-safe "unknown means reduced" default; useful for consumers resolving Motion's nullable `useReducedMotion()` identically outside a hook context. |
| `usePrefersReducedMotion` | keep (intended public) | The library-wide motion gate; consumers coordinating their own animation with fluidkit's posture need exactly this (README documents the reduced-motion guarantee). |
| `useInView` / `UseInViewResult` | keep (intended public) | The off-screen pause gate, with the documented SSR/no-observer `true` default. Attached JSDoc added to the hook. |
| `supportsWebGL` (not exported) | keep internal + consolidate | Correctly absent from the barrel: the GPU wrappers self-gate and render their own fallback, so consumers never need it. Backlog item applied: moved into `featureDetect.ts` (same contract, cache preserved), `src/utils/supportsWebGL.ts` deleted, tests merged into `featureDetect.test.ts`. |

## Core entry: type adds

| Export | Verdict | Rationale |
|---|---|---|
| `LiquidMaterial` | **add** (type re-export) | Referenced by 5 component props; consumers writing `useState<LiquidMaterial>` (the playground itself does) had no public import. |
| `Vec` | **add** (type re-export) | The shape of every `light` prop. JSDoc added at the definition. |
| `SpringConfig` | **add** (type re-export) | Referenced by `MagneticProps` / `LiquidDragProps` / `UseSquishOptions` and already named in docs prop tables. JSDoc added. |

Nothing else from `src/liquid` leaks: `LiquidRenderer`, `TensionField`, geometry helpers, `resolveMaterial`, refraction, and `useMotionSprings` stay internal (checked every component prop type against the liquid barrel).

## GPU subpaths

| Export | Verdict | Rationale |
|---|---|---|
| `LiquidMetal` (`fluidkit/liquid-metal`) | document | Attached JSDoc added. `color`/`backgroundColor` kept over `tint`: the wrapper has no material system, and the pair reads as a self-consistent foreground/background contract; renaming to `tint` would drag half the engine vocabulary into a component that has no `material` prop. |
| `LiquidMetalProps` | keep | `speed` default 1 + `MIN_SPEED` clamp; `intensity` default mirrors the shader's own preset (0.07), documented. |
| `WaterField` (`fluidkit/water-field`) | document | Attached JSDoc added. No `speed` prop by design (the sim is interaction-driven, not clocked). |
| `WaterFieldProps` | keep | `colors` / `intensity` / `interactive` / `config`; `intensity` default 0.6 anchored to upstream defaults, documented. |

## Verdict counts

- keep: 34
- document (JSDoc/docs fixes applied): 20
- fix default: 1 (`Droplets.speed` MIN_SPEED clamp)
- add: 3 (`LiquidMaterial`, `Vec`, `SpringConfig` type re-exports)
- remove: 1 (`supportsViewTransition`)

## Breaking changes

1. `supportsViewTransition` removed from the `fluidkit` entry (unused by any primitive; CHANGELOG bullet added).
