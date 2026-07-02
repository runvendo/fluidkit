# Component Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the playground into a sidebar-navigated showcase site with one page per fluidkit component (hero stage + variants grid + usage snippet), so each component can be judged and later refreshed in an isolated child session.

**Architecture:** Same vite entry and `fluidkit` aliases as today. `main.tsx` becomes a thin shell (sidebar + hash router); shared UI moves to `playground/showcase/kit/`; each component gets a self-contained page in `playground/showcase/pages/`; a pre-populated `registry.ts` wires them up so child sessions never touch shared files.

**Tech Stack:** React, vite, hand-rolled hash router (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-07-02-component-showcase-design.md`

---

### Task 1: Shared kit

**Files:** create `playground/showcase/kit/` (controls, snippet, layout, stage, variant grid, mount-on-view; one focused file each plus an index).

- [ ] Port the existing control primitives (Slider, Toggle, Seg), Snippet (copy button), and MountOnView out of `main.tsx` unchanged in behavior.
- [ ] Add PageLayout (page title, description, and the three sections: hero, variants, usage), Stage (the framed demo surface, including the current "wall" background + orbs option and hint label), and VariantGrid + VariantCell (labeled side-by-side cells for fixed-prop renders).
- [ ] Typecheck, commit.

### Task 2: Shell, registry, styles

**Files:** create `playground/showcase/registry.ts` and `playground/showcase/styles.css`; rewrite `playground/main.tsx`; trim `playground/index.html`.

- [ ] Registry: ordered list of all 15 pages (slug, title, lazy component import) — Demos first, then the 12 core primitives in the current site order, then the 2 GPU components last.
- [ ] Shell: fixed sidebar (fluidkit wordmark, install snippet link, one nav entry per registry item, GPU entries visually grouped) + hash router that renders only the active page. Unknown or empty hash falls back to the first entry. Sidebar marks the active page.
- [ ] Move the inline CSS out of index.html into styles.css and rework it for the sidebar + single-page layout (light mode, same visual language as today). Old grid/hero styles that no longer apply are deleted.
- [ ] Registry grows incrementally: this task lands it with only the entries whose pages exist so far; each page task in 3–5 adds its own registry line in the same commit as the page. By the end of Task 5 all 15 are registered (the pre-populated end state the spec requires before child sessions spawn). No stubs ever committed.
- [ ] Typecheck, dev-server smoke check, commit.

### Task 3: Core component pages, batch 1 (engine components)

**Files:** create `playground/showcase/pages/` — Droplets, MorphSurface, Thinking, JellyButton, DripFuse (one file each).

Each page follows the same shape: hero stage with the existing card's controls carried over, a variants grid, and the usage snippet. Variant cells render the real component with fixed props (still interactive), sharing one light source per page.

- [ ] Droplets — hero: existing controls (material, interactive, reflection, refraction, count, size, spread, speed). Variants: glass / mercury / flat, plus refraction-on glass.
- [ ] MorphSurface — hero: click-to-toggle with existing controls (material, reflection, refraction, satellites). Variants: the three materials, each independently toggleable.
- [ ] Thinking — hero: material, size, speed. Variants: three materials at default size.
- [ ] JellyButton — hero: material, intensity. Variants: three materials × soft/strong intensity.
- [ ] DripFuse — hero: Fire button, material, fired/completed counters. Variants: three materials with their own Fire buttons.
- [ ] Typecheck after each page; commit per page.

### Task 4: Core component pages, batch 2 (interaction + layout + ambient)

**Files:** create pages for LiquidTabs, FlowStagger, Ripple, Magnetic, LiquidDrag, MeshGradient, Aurora (one file each).

- [ ] LiquidTabs — hero: flow, material, size, disabled-item toggle. Variants: slide/stretch × ink/glass, plus the three sizes.
- [ ] FlowStagger — hero: stagger slider + Add/Remove. Variants: three stagger values with their own Add/Remove.
- [ ] Ripple — hero: duration slider. Variants: short / default / long duration surfaces.
- [ ] Magnetic — hero: strength, radius. Variants: weak / medium / strong pull.
- [ ] LiquidDrag — hero: elasticity, axis, constrained stage. Variants: free / x-only / y-only, plus a high-elasticity cell.
- [ ] MeshGradient — hero: palette, speed, blur (existing pastel/citrus/mint presets). Variants: the three palettes.
- [ ] Aurora — hero: intensity, speed, blend, with the existing dark/light split stage. Variants: three blends, each shown on dark and light.
- [ ] Typecheck after each page; commit per page.

### Task 5: GPU pages + Demos page

**Files:** create pages for LiquidMetal, WaterField, and Demos.

- [ ] LiquidMetal — hero: preset (mercury/gold/obsidian), speed, intensity, behind MountOnView with the optional-peer install note. Variants: the three presets, max 3 cells, each cell behind its own MountOnView.
- [ ] WaterField — hero: preset (lagoon/sunset/ember), intensity, interactive toggle, behind MountOnView with the optional-peer note. Variants: the three presets, max 3 cells, each behind MountOnView.
- [ ] Demos — the four phone-frame recipes (Dynamic Island, Music Player, Liquid Dock, Goo Button) moved from main.tsx as-is, keeping `?raw` view-source, LockScreen chrome, and descriptions. `playground/demos/*` recipe files are untouched.
- [ ] Typecheck after each page; commit per page.

### Task 6: Cleanup + verification

- [ ] Confirm nothing from the old main.tsx remains unreferenced (Hero, Examples, Card, demo functions all replaced); delete leftovers.
- [ ] Full check: typecheck, unit tests, `build:site`.
- [ ] Drive the dev server in the browser: walk all 15 routes via the sidebar, confirm hash deep-links and the unknown-hash fallback, confirm GPU pages boot only when visited, screenshot every page.
- [ ] Send screenshots to Yousef for the visual pass; apply his feedback rounds.
- [ ] Update CHANGELOG (site-only entry) and commit.

---

## Decisions locked during design

- Sidebar + hash routing, zero new dependencies; only the active page mounts.
- `kit/`, `registry.ts`, `main.tsx`, `styles.css` are central — settled in this arc, read-only for future child sessions; child sessions each own exactly one `pages/*.tsx`.
- Variant cells are real live components with fixed props, not screenshots.
- GPU variant grids cap at 3 cells, every GPU mount goes through MountOnView.
- Taste: light mode, restraint, one light source per page, reduced-motion never fought.
- No changes to `src/` — component refreshes happen in the child sessions afterward.
