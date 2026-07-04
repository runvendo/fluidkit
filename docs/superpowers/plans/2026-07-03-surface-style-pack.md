# Surface Style Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Per repo owner preference this plan is high-level: no code snippets. Each task names the files, the behavior to test first (TDD), the commands, and the commit point. Spec: `docs/superpowers/specs/2026-07-03-surface-style-pack-design.md`.

**Goal:** Every fluidkit surface component accepts the same styling pack (material, tint, color, intensity, light, reflection, refraction, shadow) with identical names, scales, and meanings; defaults preserve today's rendering exactly.

**Architecture:** One shared `SurfaceStyleProps` contract that components extend (omitting only what physically can't apply), plus routing the three stragglers (Ripple, LiquidText, LiquidTabs) through the existing `resolveMaterial` so the glass recipe has one source. No mega-hook: per-component wiring stays.

**Tech Stack:** React + Motion, vitest + @testing-library/react (jsdom), tsup, existing showcase kit.

**Conventions for every task:** run the named test file first and watch the new cases fail before implementing; after implementing, run the full suite (`npx vitest run`) and `npm run typecheck`; commit with the message given. Breaking renames delete the old name — no aliases.

---

### Task 1: Shared contract + test helper

**Files:** create `src/components/surface.ts`; create `tests/components/surfacePack.tsx` (helper, no standalone tests); modify `src/components/index.ts` (export the props type).

- [ ] Define `SurfaceStyleProps` per the spec table (material, tint, color, intensity, light, reflection, refraction, shadow) with doc comments copied from the best existing per-component wording, so all later tasks extend one definition.
- [ ] Write the reusable conformance helper: given a rendered component, it can assert (a) `tint` reaches the `liquid-fill` background, (b) `color` fills flat, (c) `shadow={false}` removes the `liquid-shadow` layer, (d) `light={null}` renders zero specular ellipses, (e) `intensity` scales specular opacity between two renders. Mirrors assertions already used in `tests/components/Droplets.test.tsx` and `JellyButton.test.tsx`.
- [ ] Migrate one already-conformant component (LiquidCard) to extend `SurfaceStyleProps` and exercise the helper against it, proving the helper works before the gap-filling tasks rely on it.
- [ ] Full suite + typecheck green. Commit: `feat: shared SurfaceStyleProps contract + conformance helper`.

### Task 2: Silk material rename

**Files:** modify `src/components/Silk.tsx`, `tests/components/Silk.test.tsx`, `playground/showcase/pages/Silk.tsx`, `docs/primitives/silk.md` (if present).

- [ ] Test first: `material="flat"` renders the solid path; the string `"color"` is gone from the public type.
- [ ] Rename, update page seg + snippet. Commit: `feat!: Silk material "color" -> "flat"`.

### Task 3: LiquidText material rename + shared glass recipe

**Files:** modify `src/components/LiquidText.tsx`, `playground/showcase/pages/LiquidText.tsx`; create `tests/components/LiquidText.test.tsx` (none exists).

- [ ] Tests first: `"flat"` replaces `"ink"`; glass layer's background/backdrop-filter come from `resolveMaterial` (tint honored like every other component, replacing the hardcoded 0.38-alpha/blur(10px) recipe); keep a case pinning that sheen `angle`/`speed` still render.
- [ ] Implement; page seg/snippet updated; page's `intensity` seed corrected 0.5 → 0.35 here (it's this page's file). Commit: `feat!: LiquidText "ink" -> "flat", glass via resolveMaterial`.

### Task 4: LiquidTabs renames + shared glass recipe

**Files:** modify `src/components/tabs/LiquidTabs.tsx` (+ `tabs/tint.ts` if the tint plumbing lives there), `tests/components/tabs/LiquidTabs.test.tsx`, `playground/showcase/pages/LiquidTabs.tsx`, `docs/primitives/liquid-tabs.md` (if present).

- [ ] Tests first: `tint` replaces `glassTint`; material `"flat"` replaces `"ink"` (flat maps where ink mapped); container glass values come from `resolveMaterial`.
- [ ] Implement; page controls/snippet updated (drop its bespoke stripped ColorField usage for now — Task 12 consolidates). Commit: `feat!: LiquidTabs glassTint -> tint, "ink" -> "flat", glass via resolveMaterial`.

### Task 5: LiquidTabs indicator styling pack

**Files:** modify `src/components/tabs/LiquidTabs.tsx`, `tests/components/tabs/LiquidTabs.test.tsx`, `playground/showcase/pages/LiquidTabs.tsx`.

- [ ] Tests first via the Task-1 helper: `intensity`, `light`, `reflection`, `shadow` on the indicator behave per the pack (same inputs MeniscusDivider's engine pill takes); defaults reproduce today's rendering (no speculars/shadow appear that weren't there — defaults chosen accordingly, e.g. `reflection` default may need to be off-equivalent until the indicator gains speculars, matching current pixels).
- [ ] Implement. Commit: `feat: LiquidTabs indicator takes the surface style pack`.

### Task 6: Ripple tint + intensity

**Files:** modify `src/components/Ripple.tsx` (+ `src/hooks/useRipple.ts` if the fill lives there), `tests/components/Ripple.test.tsx`, `playground/showcase/pages/Ripple.tsx`.

- [ ] Tests first: glass ripple fill comes from `resolveMaterial` (tint honored); `intensity` scales how loudly it reads; defaults pixel-match the current 0.28-alpha/blur(5px) recipe.
- [ ] Implement. Commit: `feat: Ripple joins the surface style pack (tint, intensity)`.

### Task 7: JellyButton `intensity` -> `squash`, then the real pack

**Files:** modify `src/components/JellyButton.tsx`, `tests/components/JellyButton.test.tsx`, `playground/showcase/pages/JellyButton.tsx`, `docs/primitives/jelly-button.md`.

- [ ] Tests first: `squash` controls press depth with the old 0.12 default; `intensity` now means material volume and scales specular opacity; `shadow` prop (default true) can remove the shadow layer; default intensity maps the current hardcoded specular brightness so default rendering is unchanged.
- [ ] Implement rename before additions so the type never has two meanings at once. Page slider relabeled `squash`; snippet honest. Commit: `feat!: JellyButton intensity -> squash; gains material intensity + shadow`.

### Task 8: Droplets intensity + shadow

**Files:** modify `src/components/Droplets.tsx`, `tests/components/Droplets.test.tsx`, `playground/showcase/pages/Droplets.tsx`, `docs/primitives/droplets.md`.

- [ ] Tests first via helper: `shadow={false}` removes the layer; `intensity` scales specular opacity; defaults preserve the current constant (capture the current default specular opacity in a pinning assertion before wiring).
- [ ] Implement. Commit: `feat: Droplets gains intensity + shadow props`.

### Task 9: Thinking intensity + refraction + shadow

**Files:** modify `src/components/Thinking.tsx`, `tests/components/Thinking.test.tsx`, `playground/showcase/pages/Thinking.tsx`, `docs/primitives/thinking.md`.

- [ ] Tests first: same three behaviors; refraction wired exactly like Droplets (`useRefraction`, glass-only, default false — assert the filter defs mount only when enabled).
- [ ] Implement. Commit: `feat: Thinking gains intensity, refraction, shadow`.

### Task 10: MorphSurface intensity + shadow

**Files:** modify `src/components/MorphSurface.tsx`, `tests/components/MorphSurface.test.tsx`, `playground/showcase/pages/MorphSurface.tsx`, `docs/primitives/morph-surface.md`.

- [ ] Tests first: `shadow` prop; `intensity` scales the currently-hardcoded 0.28 specular; default = the intensity equivalent of 0.28 under the shared 0.4×volume rule ("present", 0.7) so defaults are pixel-identical.
- [ ] Implement. Commit: `feat: MorphSurface gains intensity + shadow props`.

### Task 11: Refraction for MeniscusDivider, LiquidTooltip, LiquidDialog, VoiceBall

**Files:** modify `src/components/MeniscusDivider.tsx`, `LiquidTooltip.tsx`, `LiquidDialog.tsx`, `VoiceBall.tsx`; extend `tests/components/LiquidDialog.test.tsx`; create test files for the other three (none exist — cover only the refraction behavior plus one pack-helper conformance run each, not full retro coverage).

- [ ] One sub-commit per component, identical pattern: test first (filter defs mount only when `refraction` on glass; silently absent otherwise), wire `useRefraction` the way LiquidPanel does, page toggle added.
- [ ] Commits: `feat: <Component> gains refraction` ×4.

### Task 12: Showcase kit ColorField + page knobs

**Files:** modify `playground/showcase/kit/controls.tsx`, `kit/index.ts`; modify pages `LiquidMetal.tsx`, `MeshGradient.tsx`, `Silk.tsx`, `GlassPanes.tsx`, `LiquidTabs.tsx` (delete the five local ColorField copies); add tint/color pickers + missing pack knobs to the surface-family pages; correct `intensity` seeds 0.5 → 0.35 in `LiquidDialog.tsx` and `VoiceBall.tsx` pages.

- [ ] Kit gains one `ColorField` (the richer variant with swatch); pages import it; `npx tsc --noEmit -p playground/tsconfig.json` green; snippets stay honest (non-default props only).
- [ ] Commit: `feat(showcase): shared ColorField, pack knobs on every page, honest intensity seeds`.

### Task 13: Docs + CHANGELOG

**Files:** modify `docs/primitives/*.md` prop tables not already touched (droplets, thinking, jelly-button, morph-surface done in their tasks; sweep the rest), `README.md` materials section (mention the pack once), `CHANGELOG.md`.

- [ ] CHANGELOG BREAKING entries with migration hints: `glassTint`→`tint`, JellyButton `intensity`→`squash`, `"ink"`/`"color"`→`"flat"`; one feature entry for the pack itself. LiquidText's exclusion rationale (sheen ≠ scene light) written into its docs/page description.
- [ ] Commit: `docs: surface style pack docs + changelog`.

### Task 14: Final verification

- [ ] `npx vitest run` (all green), `npm run typecheck`, `npx tsc --noEmit -p playground/tsconfig.json`, `npm run build`, `npm run size` (budget 26.1 kB — if the refraction wiring pushes past it, flag to the owner before re-pinning; do not silently re-pin).
- [ ] Grep sweep: `glassTint`, `"ink"`, `"color"` (as a material), old JellyButton `intensity` semantics — zero hits outside history docs.
- [ ] Live showcase sweep (dev server): every page's material seg shows glass/flat; new knobs render; defaults look unchanged next to `main` screenshots for Droplets/Thinking/MorphSurface/JellyButton (the default-preservation guarantee).
- [ ] Commit anything the sweep fixes: `fix: surface pack verification follow-ups`.
