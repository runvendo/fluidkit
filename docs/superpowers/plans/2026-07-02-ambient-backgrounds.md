# Ambient Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two v0.5 ambient background primitives, `MeshGradient` and `Aurora`, with tests, demos, and docs.

**Architecture:** Pure CSS/DOM decoration in the core bundle: large blurred radial blobs (MeshGradient) and soft drifting horizontal bands (Aurora) animated with long-period Motion springs or CSS keyframe transforms (implementer picks per component; CSS keyframes preferred for zero-JS-per-frame ambient loops). No engine, no clip-path, no WebGL. Both are `aria-hidden` decoration that pause off-screen and render a static frame under reduced motion.

**Tech Stack:** React, CSS animations (or Motion for the drift), useInView, usePrefersReducedMotion, Vitest.

**Sub-project 3 of 5** in `docs/superpowers/specs/2026-07-01-fluidkit-v1-design.md`.

**Canonical patterns:** behavior/decoration component conventions from `src/components/Ripple.tsx` (wrapper + overlay, resolveColor); reduced-motion and useInView gating from `src/components/Droplets.tsx`; test conventions from `tests/components/` (globals OFF, vi.doMock motion/react loader). One deliberate divergence from the engine components: these render decorative CHILDREN-BEHIND backgrounds, so each fills its parent (`position:absolute; inset:0`) and needs a positioned parent, OR accepts className/style for explicit sizing — follow MeshGradient prior art: the component IS the background layer, consumers position it.

**Hard constraints:** no CSS `filter: blur()` is FORBIDDEN ONLY on clipped/engine layers (Chromium seam bug applies to filtered clip regions); for these standalone background layers CSS blur on the blob elements is acceptable and is the standard technique — but keep blur radii moderate and blobs few (4-6) for paint cost. `prefers-reduced-motion` must stop all animation (static frame, not hidden). Both components must be cheap: no per-frame JS when using CSS keyframes; if Motion springs are used, they must pause when off-screen via useInView. SSR-safe. `pointer-events: none` on everything.

---

### Task 1: `MeshGradient` component

**Files:**
- Create: `src/components/MeshGradient.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/components/MeshGradient.test.tsx`

Decisions: props `colors?: string[]` (default a tasteful 3-4 hue light-mode set; resolveColor applied), `speed?: number` (default 1, multiplies drift period), `blur?: number` (px, default 60), plus HTMLAttributes. Renders `data-fluidkit="mesh-gradient"` wrapper (absolute inset 0, overflow hidden, pointer-events none, aria-hidden) containing one blob element per color: large radial-gradient circles (60-80% of the container's max dimension) positioned at deterministic spread points (golden-angle placement like Droplets' dropAngle — NO Math.random), drifting on long-period (20-60s / speed) CSS keyframe transform loops with per-blob phase offsets. Keyframes injected once via a shared <style> tag with a stable id (idempotent, ref-counted or presence-checked). Reduced motion: no animation (animation: none), blobs render at their home positions — the static frame. Off-screen: animation-play-state paused via useInView. Degrades: nothing to detect — CSS gradients are universal.

- [ ] **Step 1:** Failing tests: renders one blob per color with radial-gradient backgrounds; aria-hidden + pointer-events none; deterministic placement (two renders produce identical styles); reduced motion sets animation none (blobs static) with data-animating="false"; off-screen (inView false) pauses animation; style/className passthrough; SSR import safety.
- [ ] **Step 2:** Run tests, expect failure.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Full suite + typecheck green.
- [ ] **Step 5:** Export; commit (`feat(mesh): MeshGradient ambient background`).

### Task 2: `Aurora` component

**Files:**
- Create: `src/components/Aurora.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/components/Aurora.test.tsx`

Decisions: props `colors?: string[]` (default 2-3 cool hues), `intensity?: number` (0-1, default 0.6, maps to band opacity), `speed?: number` (default 1), plus HTMLAttributes. Same wrapper contract as MeshGradient (absolute inset 0, aria-hidden, pointer-events none). Bands: one skewed, heavily-blurred horizontal gradient strip per color, stacked in the upper portion, drifting horizontally with subtle vertical sway on long-period keyframes with phase offsets; `mix-blend-mode: screen` between bands for the aurora glow (works on light and dark; intensity scales opacity). Shares the keyframe-injection helper with MeshGradient if extraction is natural (small shared module under src/utils/ is acceptable — name it `injectKeyframes.ts`); do not force it if the keyframes differ enough. Same reduced-motion/off-screen/determinism rules.

- [ ] **Step 1:** Failing tests: same shape as MeshGradient's list (bands per color, intensity → opacity mapping, reduced motion static, pause off-screen, determinism, passthrough, SSR).
- [ ] **Step 2:** Run tests, expect failure.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Full suite + typecheck green.
- [ ] **Step 5:** Export; commit (`feat(aurora): Aurora ambient background`).

### Task 3: Demos, docs, changelog

**Files:**
- Modify: `playground/main.tsx` (two demo cards + toc; use them as card stage backdrops so their ambient nature reads)
- Create: `docs/primitives/mesh-gradient.md`, `docs/primitives/aurora.md`
- Modify: `README.md` (two table rows), `CHANGELOG.md` (Unreleased bullets)

- [ ] **Step 1:** Demo cards (MeshGradient: speed/blur sliders + a color-set seg; Aurora: intensity/speed sliders). Verify in the browser: both animate, pause when scrolled out (check via animation-play-state), no console errors.
- [ ] **Step 2:** Docs pages (existing structure, no em dashes). README rows + CHANGELOG bullets.
- [ ] **Step 3:** `npm run size` — expect little growth (CSS strings); re-pin only if over 11.6 kB.
- [ ] **Step 4:** Full local CI sequence green; commit (`feat(v0.5): ambient backgrounds — demos, docs, changelog`); push; new PR from touch-up to main (PR #3 merged, so open a fresh draft PR titled "v0.5+v1.0 continued: ambient backgrounds onward"); confirm CI green both legs.

### Task 4: Visual review round (user gate)

- [ ] **Step 1:** Hand the user the playground URL; ambient components are visual-direction-heavy (memory: restraint, one light source, light-mode-first). Collect feedback, iterate, sign-off. Fold the deferred SP2 interaction-tuning round in here if the user wants.

---

**Done when:** both components exported with green tests, demos and docs live, CI green on the new PR, size within budget, and the user has reviewed the visual direction (or explicitly deferred again).
