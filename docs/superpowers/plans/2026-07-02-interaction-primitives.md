# Interaction Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four v0.5 interaction primitives: `useSquish` + `JellyButton`, `Magnetic`, `LiquidDrag`, and `DripFuse`, with tests, demos, and docs.

**Architecture:** No new dependencies. `JellyButton` and `DripFuse` are engine components (LiquidRenderer + useMotionSprings + TensionField, per the Droplets/LiquidTabs patterns). `Magnetic` and `LiquidDrag` are behavior wrappers on Motion (per the FlowStagger/Ripple patterns). `useSquish` is a headless hook (per the useRipple pattern).

**Tech Stack:** React, Motion, the internal liquid engine, Vitest + Testing Library.

**Sub-project 2 of 5** in `docs/superpowers/specs/2026-07-01-fluidkit-v1-design.md`.

**Canonical patterns (implementers: read these files first):**
- Engine component recipe: `src/components/Droplets.tsx` (springs → per-frame imperative `setScene`, static-scene resync effect, pointer grab/tear, reduced-motion + useInView gating).
- State-transition engine flow with settle timer: `src/components/LiquidTabs.tsx` (drain → fly → fill via tension bridges; the closest analog to DripFuse).
- Behavior wrapper: `src/components/Ripple.tsx` + `src/hooks/useRipple.ts` (headless hook owns reduced-motion behavior; component composes handlers; Omit conflicting DOM handlers when spreading onto motion elements).
- Test conventions: `tests/components/Droplets.test.tsx` (vi.doMock of motion/react useReducedMotion; Profiler zero-commit constraint test; data-fluidkit queries).
- Demo registration: `playground/main.tsx` (Card/Slider/Toggle/Seg/Snippet; add to grid + Hero toc). Docs pages: `docs/primitives/<name>.md` (Props table, Usage, Degrades to).

**Hard constraints (enforced by existing tests and review):** text/content never scales on engine components; no setState inside animation loops; clip-path and backdrop-filter never share an element; no CSS blur(); reduced motion collapses to static and makes pointer interactivity inert; SSR-safe (feature detection stays lazy); stable body ids for tension hysteresis; bundle budget re-pinned deliberately at the end.

---

### Task 1: `useSquish` hook

**Files:**
- Create: `src/hooks/useSquish.ts`
- Modify: `src/hooks/index.ts` (export hook + option/result types)
- Test: `tests/hooks/useSquish.test.ts`

Decisions: headless, transform-based (for arbitrary elements; consumers accept that their element scales — JellyButton does the text-safe version in Task 2). API: `useSquish(options?)` with `intensity` (default 0.12, the fractional squash) and optional spring overrides; returns pointer/keyboard handlers (`onPointerDown/Up/Cancel/Leave`, `onKeyDown/Up` for Space/Enter so keyboard users get the same feedback), `style` containing `scaleX`/`scaleY` Motion values (volume-preserving: X widens as Y shrinks while pressed, both spring back with overshoot on release), and a `pressed` boolean. Reduced motion: handlers become no-ops and scales stay 1 (same pattern as useRipple's no-op).

- [ ] **Step 1:** Write failing tests: default state is unscaled; press retargets scales (X > 1, Y < 1, X·Y ≈ 1); release returns targets to 1; reduced motion means handlers do nothing; keyboard press mirrors pointer press.
- [ ] **Step 2:** Run `npx vitest run tests/hooks/useSquish.test.ts` — expect failure (module not found).
- [ ] **Step 3:** Implement the hook with Motion `motionValue` + `animate` springs (or `useMotionSprings`), no timers, no Date.now.
- [ ] **Step 4:** Tests pass; run the full suite `npm test`.
- [ ] **Step 5:** Export from `src/hooks/index.ts`. Commit (`feat(squish): useSquish headless press-squash hook`).

### Task 2: `JellyButton` component

**Files:**
- Create: `src/components/JellyButton.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/components/JellyButton.test.tsx`

Decisions: an engine pill that deforms via GEOMETRY, not CSS transform, so the label never scales (the library's core principle). Renders a real `<button>` for a11y (focus, Enter/Space, disabled) with the LiquidRenderer surface behind it and the label on the unclipped content overlay. Body: one `roundRectPath` whose width/height ride `useMotionSprings` slots; press retargets to wider/shorter (volume-preserving, `intensity` prop, default matching useSquish), release springs home with jiggle (settle-timer pattern from MorphSurface — loop only runs while settling). Props: `material` (default glass) / `tint` / `color` / `light` / `reflection` / `refraction` passthrough like Droplets, `intensity`, `disabled`, plus ButtonHTMLAttributes. Data attribute `data-fluidkit="jelly-button"`. Reduced motion: no deformation, instant visual press state only (opacity), pointer/keyboard still function as a normal button.

- [ ] **Step 1:** Write failing tests: renders a focusable `<button>` with the label; press (pointerdown) while animating starts geometry deformation (clipPath changes); reduced motion keeps `data-animating="false"` and clipPath static while click still fires; Profiler zero-commit constraint test during the settle loop; label sits on the content overlay (never inside the clipped fill).
- [ ] **Step 2:** Run tests — expect failure.
- [ ] **Step 3:** Implement per the MorphSurface settle-timer recipe (static scene memo, resync effect, per-frame imperative writes).
- [ ] **Step 4:** Full suite passes (`npm test`), `npm run typecheck` clean.
- [ ] **Step 5:** Export; commit (`feat(jelly): JellyButton engine pill with geometry squish`).

### Task 3: `Magnetic` component

**Files:**
- Create: `src/components/Magnetic.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/components/Magnetic.test.tsx`

Decisions: behavior wrapper, no surface. Wraps children in a `motion.div` driven by x/y springs. Listens for pointer movement on a window/document listener while hovered OR via an invisible padded hit area? Neither: use the simplest robust mechanism — pointermove on the wrapper itself plus `radius` extension via a documented limitation is NOT acceptable for a magnet (it must attract before contact), so attach a `pointermove` listener to `window` while the component is on screen (`useInView`), compute distance from pointer to element center via `getBoundingClientRect`, and when inside `radius` retarget x/y springs toward the pointer by `strength · falloff` (linear falloff to 0 at the radius edge); outside radius or on `pointerleave`/blur, spring back to 0. Props: `strength` (0-1, default 0.3, fraction of the offset toward the pointer, capped so the element never travels more than ~radius/2), `radius` (px, default 120), `spring` override, plus HTMLAttributes (Omit the conflicting DOM handlers per the FlowStagger gotcha). Reduced motion: no listener, no movement. SSR: listeners only in effects. Cleanup on unmount. `data-fluidkit="magnetic"`.

- [ ] **Step 1:** Write failing tests: renders children; window pointermove inside radius moves the wrapper (x/y targets nonzero); pointermove outside radius returns targets to 0; reduced motion attaches no window listener (spy on addEventListener); unmount removes the listener.
- [ ] **Step 2:** Run tests — expect failure.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Full suite + typecheck pass.
- [ ] **Step 5:** Export; commit (`feat(magnetic): pointer-attraction wrapper`).

### Task 4: `LiquidDrag` component

**Files:**
- Create: `src/components/LiquidDrag.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/components/LiquidDrag.test.tsx`

Decisions: behavior wrapper on Motion's own drag (`drag`, `dragConstraints`, `dragElastic`, `dragMomentum` passthrough — do not reimplement dragging). The liquid feel: derive stretch from drag velocity with Motion's `useVelocity` on the drag x/y motion values, mapped through `useTransform` to scaleX/scaleY (stretch along the dominant axis, compress the cross axis, volume-preserving, clamped to ±`elasticity`·0.25); springs smooth it so release settles with a wobble. Props: `elasticity` (0-1, default 0.4), `axis` (`"x" | "y" | undefined` → passed to `drag`), `dragConstraints` passthrough, `onDragStart/End` passthrough, HTMLAttributes minus conflicting handlers. Reduced motion: plain Motion drag with no deformation (scales pinned at 1). Content deforms with the wrapper by design (documented; consumers who care wrap non-text). `data-fluidkit="liquid-drag"`.

- [ ] **Step 1:** Write failing tests: renders draggable child (`drag` behavior present via Motion props); scales stay 1 at rest; reduced motion pins scales at 1 while drag props remain; elasticity 0 disables deformation; conflicting handler props are not forwarded to the DOM.
- [ ] **Step 2:** Run tests — expect failure.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Full suite + typecheck pass.
- [ ] **Step 5:** Export; commit (`feat(drag): LiquidDrag stretchy drag wrapper`).

### Task 5: `DripFuse` component

**Files:**
- Create: `src/components/DripFuse.tsx`
- Modify: `src/components/index.ts`
- Test: `tests/components/DripFuse.test.tsx`

Decisions: engine component, generalizing the LiquidTabs drain→fly→fill flow. It owns a positioned canvas of explicit `width`×`height` (defaults 240×80) with a source body (circle, radius `size`, default 18) anchored at the left end and a target body at the right end; `sourceContent`/`targetContent` slots render on the unclipped overlay at each anchor. Trigger: `fire` — a number; each increment runs one drip cycle (rising-edge detection via a prev ref, exactly the LiquidTabs `prevX` pattern; numbers make repeat fires trivial and avoid boolean reset dances). Cycle phases driven by springs + settle timer: swell (a drip body grows at the source edge, bridged to the source), tear (drip position springs toward target; the tension hysteresis snaps the bridge naturally past SNAP_STRETCH), fly, fuse (bridge forms on contact with target, drip radius drains to 0 as the target briefly swells), then `onComplete()` fires once (from a settle timeout, not the frame loop). Stable body ids (`src`, `tgt`, `drip`); `tension.clear` for the drip key between cycles. Material/tint/color/light/reflection/refraction passthrough like Droplets. Reduced motion: no animation — on `fire` change, `onComplete` fires immediately (microtask/effect) and the static scene renders both bodies untouched. Degradation for non-engine environments is inherited from `resolveMaterial` (flat fallback). `data-fluidkit="drip-fuse"`, `data-phase` attribute for observability and tests.

- [ ] **Step 1:** Write failing tests: static render shows exactly two bodies (two `Z` closures in clipPath); incrementing `fire` while animating starts a cycle (`data-phase` leaves `"idle"`, clipPath gains a third subpath); `onComplete` fires exactly once per increment; reduced motion fires `onComplete` immediately with static clipPath and `data-animating="false"`; Profiler zero-commit test during the cycle; content slots live on the unclipped overlay.
- [ ] **Step 2:** Run tests — expect failure.
- [ ] **Step 3:** Implement (read LiquidTabs.tsx first; reuse its spring choreography approach, not its tab semantics).
- [ ] **Step 4:** Full suite + typecheck pass.
- [ ] **Step 5:** Export; commit (`feat(drip): DripFuse drip-off-and-fuse primitive`).

### Task 6: Demos, docs, changelog, budget re-pin

**Files:**
- Modify: `playground/main.tsx` (four new demo cards + toc entries)
- Create: `docs/primitives/jelly-button.md`, `docs/primitives/magnetic.md`, `docs/primitives/liquid-drag.md`, `docs/primitives/drip-fuse.md`
- Modify: `README.md` (primitives table rows), `CHANGELOG.md` (Unreleased bullets), `package.json` (size-limit re-pin if needed)

- [ ] **Step 1:** Add four playground demo cards following the existing Card/controls pattern (JellyButton: material seg + intensity slider; Magnetic: strength/radius sliders; LiquidDrag: elasticity slider + axis seg; DripFuse: fire button + material seg). Verify visually with `npm run dev` (load the page, exercise each demo).
- [ ] **Step 2:** Write the four docs pages matching the existing structure (Props table, Usage, Degrades to). No em dashes.
- [ ] **Step 3:** README primitives table gains four rows; CHANGELOG Unreleased gains bold-lead bullets for the four primitives.
- [ ] **Step 4:** Run `npm run size`. If over 8.7 kB, re-pin the budget to new measured size + 20% in the same commit with the number in the commit message (the plan's infra rule: re-pin deliberately when new core primitives land).
- [ ] **Step 5:** Full local CI sequence passes (typecheck, test, build, size, check:gpu-leak, check:pack). Commit (`feat(v0.5): interaction primitives — demos, docs, changelog`), push, confirm the PR #3 run goes green on both Node legs.

### Task 7: Visual review rounds (user gate)

- [ ] **Step 1:** Start `npm run dev` and hand the user the playground URL with the four new demos.
- [ ] **Step 2:** Collect feedback and iterate (2-4 rounds expected per the established design workflow: restraint, one light source, light-mode-first). Tuning commits per round.
- [ ] **Step 3:** User signs off on all four primitives' feel.

---

**Done when:** all four primitives exported with green tests including constraint tests, CI green on both Node legs, demos live in the playground, docs pages written, budget re-pinned if needed, and the user has approved the visual feel.
