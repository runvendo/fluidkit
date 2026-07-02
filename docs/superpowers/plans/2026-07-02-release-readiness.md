# 1.0 Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fluidkit 1.0.0, publish-ready: stable API reviewed, accessibility audited, SSR verified against the built package, packaging final. Yousef runs the final `npm publish` himself.

**Architecture:** No new features. Four hardening passes (API, a11y, SSR, backlog warts) followed by version/packaging finalization. Breaking renames are allowed in the API pass (pre-1.0); each gets a CHANGELOG entry.

**Sub-project 5 of 5** in `docs/superpowers/specs/2026-07-01-fluidkit-v1-design.md`.

**Backlog items folded in (logged during sub-projects 2-4):**
- MorphSurface settle-timer wart: `animating` flip mid-settle kills the timer, `settling` sticks true, rAF loop spins on a settled scene. JellyButton has the fix pattern (`if (!animating) setSettling(false)` effect).
- LiquidTabs + DripFuse PRM-mid-cycle gap: PRM flipping on mid-cycle without a new trigger lets the cycle animate to its natural end while `data-animating` reads false. Fix family-wide: stop frames + resync static when PRM flips.
- Playground not typechecked: demo code (the public examples) never sees tsc. Add a `typecheck:site` script (tsc -p playground or extended include) + CI step; fix surfaced errors.
- Consolidate `supportsWebGL` into `featureDetect.ts` (same contract, fragmented location); rename its test file accordingly.

---

### Task 1: Backlog warts (engine hygiene family fixes)

**Files:**
- Modify: `src/components/MorphSurface.tsx`, `src/components/LiquidTabs.tsx`, `src/components/DripFuse.tsx` (PRM-mid-cycle only; its fire-path is already clean)
- Tests: extend `tests/components/MorphSurface.test.tsx`, `LiquidTabs.test.tsx`, `DripFuse.test.tsx`

- [ ] **Step 1:** Failing tests first, one per wart: MorphSurface — flip `animating` off mid-settle (mutable motion mock), assert settling clears and the static scene is resynced; LiquidTabs and DripFuse — flip PRM on mid-cycle WITHOUT a new trigger, assert frames stop (data-animating false AND no further clipPath mutations) and static scene resyncs.
- [ ] **Step 2:** Apply the JellyButton hygiene pattern to each; keep diffs minimal.
- [ ] **Step 3:** Full suite + typecheck green. Commit (`fix(engine): settle/PRM hygiene across MorphSurface, LiquidTabs, DripFuse`).

### Task 2: Stable API review

**Files:**
- Review scope: `src/index.ts`, `src/components/index.ts`, `src/hooks/index.ts`, `src/utils/index.ts`, both GPU subpath entries, every exported Props type
- Modify: whatever the review demands (renames, default alignment, JSDoc gaps)
- Create: `docs/superpowers/notes/2026-07-02-api-review.md` (the review record: every export, verdict, action)

Review criteria (from the umbrella spec): same names for the same concepts everywhere (`material`, `tint`, `color`, `light`, `reflection`, `refraction`, `speed`, `colors`, `intensity`, `spring`); consistent defaults for shared concepts; no engine internals exported from the public barrels (utils barrel: is exporting `resolveColor`/feature detects/`useInView` intended API? Decide and record); every public export has JSDoc; Props types all exported; data-fluidkit attribute names consistent.

- [ ] **Step 1:** Produce the review record listing EVERY public export with verdict (keep / rename / fix default / document).
- [ ] **Step 2:** Apply the actions. Breaking changes each get a CHANGELOG "Breaking" bullet.
- [ ] **Step 3:** Full suite + typecheck + build + size green (renames may shift size slightly; budget headroom is ~2.5 kB). Commit (`refactor(api): 1.0 stable API pass` + record).

### Task 3: A11y pass

**Files:**
- Review scope: every component; Modify as needed; extend tests

Checklist (from the umbrella spec): decorative surfaces aria-hidden (Droplets, Thinking already carry role="status" — verify semantics, MeshGradient/Aurora/GPU wrappers verified); interactive primitives (JellyButton, LiquidTabs, Droplets interactive, LiquidDrag, DripFuse trigger buttons in demos) keyboard-reachable with visible focus; no keyboard traps; constraint tests prove no animation loop starts under PRM for EVERY animated component (extend the existing pattern to any component missing it); pointer interactions have keyboard or programmatic equivalents where the primitive's contract implies control (LiquidTabs arrows already? verify roving tabindex/arrow keys per WAI-ARIA tabs pattern — fix if missing).

- [ ] **Step 1:** Audit + failing tests for gaps.
- [ ] **Step 2:** Fix; document intentional exceptions in JSDoc.
- [ ] **Step 3:** Suite green. Commit (`fix(a11y): 1.0 accessibility pass`).

### Task 4: SSR verification against dist + playground typecheck

**Files:**
- Create: `tests/ssr/ssr-dist.test.tsx` (or a standalone `scripts/check-ssr.mjs` — decide: it must import the BUILT package (`dist`), not `src`, and therefore run AFTER build; a script wired into CI after the build step is the natural shape)
- Modify: `.github/workflows/ci.yml` (SSR check after build; playground typecheck step), `package.json` (scripts `check:ssr`, `typecheck:site`), playground tsconfig as needed
- Modify: `scripts/check-pack.mjs` only if the SSR script shape demands nothing — otherwise untouched

- [ ] **Step 1:** SSR script: Node imports `./dist/index.js` + both GPU subpath bundles, `renderToString`s EVERY exported component with minimal props (GPU wrappers included — their peers are devDeps here), asserts non-empty markup and zero window/document access breakage. Prove it fails by temporarily adding a top-level `window` touch to a built file (scratch), then green on a clean build.
- [ ] **Step 2:** `typecheck:site` (tsc -p playground with a small tsconfig extending the root one, jsx react-jsx, noEmit); fix any surfaced demo errors.
- [ ] **Step 3:** Wire both into CI after the build step. Full local CI sequence green. Commit (`ci: SSR-against-dist check + playground typecheck`).
- [ ] **Step 4:** Push; confirm the PR run green on both legs.

### Task 5: 1.0.0 packaging

**Files:**
- Modify: `package.json` (version 1.0.0), `CHANGELOG.md` (1.0.0 section from Unreleased, dated), `README.md` (final catalog check, remove any stale "v0.x" phrasing), `docs/primitives/*` (final consistency skim)

- [ ] **Step 1:** Version bump, CHANGELOG 1.0.0 (move Unreleased under a dated 1.0.0 heading; write a short headline paragraph), README final pass.
- [ ] **Step 2:** `npm pack --dry-run` + `check:pack` + full local CI sequence green; `npm publish --dry-run` output captured as evidence (no actual publish).
- [ ] **Step 3:** Commit (`chore: v1.0.0`), push, open the final draft PR ("v1.0.0: release readiness"), CI green both legs.

### Task 6: Final gate (user)

- [ ] **Step 1:** Hand the user: the PR, the publish checklist (`npm login` state, `npm publish` command, provenance flag recommendation `npm publish --provenance` if publishing from CI later — here plain publish), and the deferred visual-tuning summary (SP2 feel constants, Aurora blend default) as an explicit "tune now or ship" decision.
- [ ] **Step 2:** User merges + publishes (their action). Arc complete.

---

**Done when:** all four passes are green in CI on the final PR, version reads 1.0.0, `npm publish --dry-run` is clean, and the user has everything needed to run the real publish.
