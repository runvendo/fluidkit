# Component Showcase — Design

**Date:** 2026-07-02
**Branch:** `yousefh409/component-showcase`
**Status:** Approved by Yousef 2026-07-02

## Goal

Restructure the playground into a per-component showcase site. Each fluidkit
primitive gets its own page showing the component with its different options,
so each one can be judged (and later refreshed) in isolation. After this lands,
Yousef settles central pieces and spawns one child session per component; the
file layout must guarantee those sessions never conflict.

## What it replaces

The current `playground/main.tsx` is a single 574-line page of cards. It goes
away. The showcase reuses the same vite entry, dev server, and `fluidkit`
alias setup (public-API imports only, GPU tier via its subpaths).

## Architecture

- **Shell** (`playground/main.tsx`): fixed sidebar listing every page + a tiny
  hand-rolled hash router (`#/jelly-button`, `#/demos`). No routing dependency.
  Only the active page mounts, so 14 live animation components never run at
  once and GPU pages only create WebGL contexts when routed to.
- **Registry** (`playground/showcase/registry.ts`): ordered list of all pages
  (slug, title, component). Pre-populated with all 15 pages up front.
- **Kit** (`playground/showcase/kit/`): shared UI — `PageLayout`, `Stage`,
  `VariantGrid`, control primitives (`Slider`, `Toggle`, `Seg`), `Snippet`
  (copy button), `MountOnView`. Ported from today's main.tsx where they exist.
- **Pages** (`playground/showcase/pages/`): one self-contained file per
  component, plus `Demos.tsx`.

## Child-session contract

Each child session owns exactly one `pages/*.tsx` file. `main.tsx`,
`registry.ts`, and `kit/` are central: settled once, then read-only for child
sessions. Because the registry is pre-populated, no child session ever edits a
shared file — zero merge conflicts by construction.

## Pages

One page per public primitive (14): Aurora, DripFuse, Droplets, FlowStagger,
JellyButton, LiquidDrag, LiquidTabs, Magnetic, MeshGradient, MorphSurface,
Ripple, Thinking, LiquidMetal (GPU), WaterField (GPU). Plus **Demos**: the four
existing phone-frame recipes (Dynamic Island, Music Player, Liquid Dock, Goo
Button) moved over as-is with their view-source `?raw` snippets.

Every component page has three parts:

1. **Hero stage** — full-width interactive stage with live controls covering
   the component's meaningful props. Ported and extended from today's cards.
2. **Variants grid** — static side-by-side renders of the key prop
   permutations (e.g. JellyButton: glass/mercury/flat × two sizes; Aurora:
   three blends; Magnetic: strength steps) for at-a-glance comparison during
   refresh reviews.
3. **Usage snippet** — the copyable code snippet, kept from today.

GPU pages cap the variants grid at ~3–4 cells and lazy-boot each cell via
`MountOnView` to respect browser WebGL context limits.

## Taste constraints

Light mode. Restraint over wobble. One coherent light source across a page's
variants. `prefers-reduced-motion` respected (components already handle it;
pages must not fight it).

## Error handling

- Unknown hash → redirect to the first registry entry.
- GPU pages keep their existing feature-detect fallbacks; the page renders a
  plain note when WebGL is unavailable.

## Verification

Typecheck and build must pass. Then drive the dev server in the browser, walk
every route, and screenshot each page for a visual pass with Yousef. No new
test infra — the playground is dev-only and stays out of the published
package.

## Out of scope

- Any change to `src/` (component APIs, visuals, defaults) — that's the child
  sessions' job.
- New dependencies.
- Publishing/deploying the showcase.
