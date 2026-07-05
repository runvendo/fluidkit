# Release Prep Notes

## What changed

- Removed internal planning artifacts: `BRIEF.md`, `docs/superpowers/`, and
  `prototypes/`.
- Cleaned dead references in README and source comments while leaving runtime
  behavior untouched.
- Updated README for the 0.5.0 surface: copy-pasteable quick start, current
  primitive table, current bundle-size budget, release status, and contributing
  link.
- Added missing primitive docs for `LiquidCard`, `MeniscusDivider`,
  `LiquidPanel`, `LiquidTooltip`, `LiquidText`, `LiquidDialog`, and
  `VoiceBall`.
- Added OSS scaffolding: contributing, security policy, code of conduct, issue
  templates, and PR template.
- Added tag-triggered npm publish workflow with provenance and package-version
  tag guard.
- Added GitHub Pages deploy workflow for the playground docs site.

## Decisions

- The README primitive table follows the public component exports and keeps the
  optional `LiquidMetal` subpath in the same table.
- New primitive docs use the existing concise structure: overview, props,
  usage, and degradation.
- The Pages workflow builds with `GITHUB_PAGES=true`; `playground/vite.config.ts`
  uses that env var to set `base: "/fluidkit/"` only for GitHub Pages builds, so
  local `npm run dev` still serves from `/`.
- The release workflow mirrors CI's guard order and runs `npx size-limit` after
  `npm run build` to avoid rebuilding.

## Maintainer follow-up

- Add `NPM_TOKEN` in GitHub repository secrets before pushing a release tag.
- Enable GitHub Pages for this repository and select GitHub Actions as the
  source.
- Push the `v0.5.0` tag when ready to publish. Do not publish manually unless
  intentionally bypassing the workflow.
