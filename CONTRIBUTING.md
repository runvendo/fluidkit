# Contributing

Thanks for working on fluidkit. Keep changes focused and match the existing
style: React + TypeScript, Vitest tests, tsup for the library build, and the
Vite playground as the docs site.

## Setup

```bash
npm ci
```

## Local checks

Run the checks that match your change:

```bash
npm test
npm run typecheck
npm run build
npm run size
npm run check:gpu-leak
npm run check:pack
```

Run the docs/playground locally:

```bash
npm run dev
```

Build the static docs site:

```bash
npm run build:site
```

## Pull requests

- Keep PRs scoped to one behavior or documentation change.
- Add or update tests for behavior changes. Degradation behavior belongs in
  `tests/degradation/`.
- Update `CHANGELOG.md` or add a changeset/release note for user-facing API,
  behavior, or packaging changes.
- Make sure tests, typecheck, build, size, GPU leak, and pack checks pass.
- Use commit subjects in the existing style, such as `fix: ...`,
  `feat(component): ...`, or `chore: ...`.

Do not publish, tag, or create GitHub releases from a PR branch.
