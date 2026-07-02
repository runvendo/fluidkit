# Infrastructure: CI + Bundle Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every push/PR runs typecheck, tests, build, a bundle-size budget check, a GPU-dependency leak check, and a pack dry-run, so all later sub-projects land on guarded rails.

**Architecture:** One GitHub Actions workflow calling existing npm scripts plus two new ones (`size`, `check:pack`). Bundle budget enforced by size-limit against the built ESM entry. The GPU-leak check is a small script that scans `dist` for the two GPU package names (trivially green today; meaningful once sub-project 4 lands).

**Tech Stack:** GitHub Actions, size-limit (+ small-lib preset), npm, tsup (existing).

**Sub-project 1 of 5** in `docs/superpowers/specs/2026-07-01-fluidkit-v1-design.md`. Plans for sub-projects 2–5 are written after their predecessors ship.

**Measured baseline (2026-07-01):** core ESM 43.7 kB raw, 11.5 kB gzipped → budget pinned at **14 kB gzipped** (baseline + ~20%). Re-pin deliberately, with a commit, when new core primitives land.

---

### Task 1: Bundle-size budget (size-limit)

**Files:**
- Modify: `package.json` (devDependencies, `size-limit` config block, `size` script)

- [ ] **Step 1:** Install `size-limit` and `@size-limit/preset-small-lib` as devDependencies.
- [ ] **Step 2:** Add a size-limit config entry in `package.json` targeting `dist/index.js`, limit `14 kB` (gzip is the preset default). Add script `size` = build then run size-limit.
- [ ] **Step 3:** Run `npm run size`. Expected: PASS, reporting ~11.5 kB.
- [ ] **Step 4:** Temporarily lower the limit to 10 kB and re-run to confirm it FAILS (proves the gate works), then restore 14 kB.
- [ ] **Step 5:** Commit (`chore: bundle-size budget via size-limit, 14 kB gzip core`).

### Task 2: GPU-dependency leak check

**Files:**
- Create: `scripts/check-no-gpu-deps.mjs`
- Modify: `package.json` (script `check:gpu-leak`)

Decision: the check greps built `dist/index.js` and `dist/index.cjs` for the literal strings `@paper-design/shaders` and `webgl-fluid-enhanced`; any hit exits nonzero with a message naming the offending file. This catches both accidental bundling and accidental import-from-core, and needs no knowledge of the (future) GPU wrappers.

- [ ] **Step 1:** Write a failing verification first: run the (not-yet-existing) script via `npm run check:gpu-leak`. Expected: fails because the script doesn't exist.
- [ ] **Step 2:** Write the script and wire up the npm script.
- [ ] **Step 3:** Run against a real build. Expected: PASS.
- [ ] **Step 4:** Prove it can fail: append one of the forbidden strings to a scratch copy of the dist file (or temporarily point the script at a fixture containing it) and confirm nonzero exit; remove the fixture.
- [ ] **Step 5:** Commit (`chore: guard core bundle against GPU dependency leaks`).

### Task 3: LICENSE file + pack verification

**Files:**
- Create: `LICENSE` (MIT, copyright Yousef Hindy 2026)
- Create: `scripts/check-pack.mjs`
- Modify: `package.json` (script `check:pack`)

Decision: `check:pack` runs `npm pack --dry-run --json` and asserts the tarball contains `package.json`, `README.md`, `LICENSE`, and at least the six `dist/` build artifacts — and nothing outside `dist/`, docs metadata, or the three root files. package.json `files` already restricts to `dist`; this check exists so a future `files`/exports mistake fails CI instead of npm.

- [ ] **Step 1:** Run `npm pack --dry-run` and note LICENSE is missing from the file list (the failing state).
- [ ] **Step 2:** Add the MIT `LICENSE` file.
- [ ] **Step 3:** Write `scripts/check-pack.mjs` and the `check:pack` script; run it. Expected: PASS with LICENSE present.
- [ ] **Step 4:** Commit (`chore: MIT LICENSE + npm pack verification script`).

### Task 4: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/ci.yml`

Decisions: trigger on push to `main` and on all PRs; Node matrix 20 and 24 (LTS + current, matching local dev); steps are `npm ci`, `typecheck`, `test`, `build`, `size` (reusing the existing build), `check:gpu-leak`, `check:pack`; npm cache enabled; no publish step ever (publishing is manual per the spec).

- [ ] **Step 1:** Write the workflow.
- [ ] **Step 2:** Validate locally as far as possible: run the exact script sequence the workflow runs (`npm ci && npm run typecheck && npm run test && npm run build && npm run size && npm run check:gpu-leak && npm run check:pack`). Expected: all PASS.
- [ ] **Step 3:** Commit (`ci: GitHub Actions — typecheck, test, build, size, leak + pack checks`) and push the branch.
- [ ] **Step 4:** Open the Actions run for this branch on GitHub and confirm both matrix jobs are green. If red, fix before proceeding — do not mark this plan done with a red pipeline.

### Task 5: Docs sync

**Files:**
- Modify: `README.md` (CI badge under the title; one line in a development section about `size`/`check:*` scripts)
- Modify: `CHANGELOG.md` (Unreleased section: CI, bundle budget, LICENSE)

- [ ] **Step 1:** Update README and CHANGELOG.
- [ ] **Step 2:** Commit (`docs: CI badge, dev scripts, changelog for infra work`).

---

**Done when:** the Actions run on this branch is green on both Node versions, `npm run size` reports under 14 kB, and the pack dry-run lists LICENSE + README + dist only.
