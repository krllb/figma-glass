# figma-glass

A browser library that reproduces Figma's Glass effect, plus its landing page. Read `docs/SPEC.md`
before changing the math or an engine: it records what was measured and why the code is the way it is.

## Layout

| Path | What |
| --- | --- |
| `packages/figma-glass/src/index.js` | the whole library, plain ESM, published as is (no build) |
| `packages/figma-glass/src/index.d.ts` | hand-written types; keep them in step with the runtime |
| `packages/figma-glass/llms.txt` | the usage guide for agents; ships in the package, served at `/llms.txt` |
| `site/` | landing page, playground, Safari diagnostics; they import the package through an import map |
| `docs/SPEC.md` | math, engines, calibration, browser findings |
| `research/calib/` | calibration scripts against Figma's exports |
| `research/safari/` | stands for real Safari through `safaridriver` |

## Commands

- `pnpm site`, then http://localhost:8080/site/ — the site against the package source.
- `pnpm check` — `publint` and `attw` on the package.
- Safari: see `research/safari/README.md` (one-time "Allow remote automation", then `safaridriver`).

## Rules

- Everything in the repo is in English: code, comments, docs, commit messages.
- The module must touch no browser API at import time: it is imported during server rendering.
- Chromium's `backdrop` engine is the reference: a change to the math or the filter graph is checked
  against it in pixels (`research/calib/`); a change to `mirror` is checked in real Safari
  (`research/safari/`), not in a headless WebKit.
- Measured browser behaviour goes into `docs/SPEC.md` with the numbers.
- Comments explain why, in the voice of the surrounding code; no comment for what the code already says.
- Public API changes: update `index.d.ts`, the package README, `llms.txt` and `CHANGELOG.md` together.

## Release

Bump `version` in `packages/figma-glass/package.json`, add a `CHANGELOG.md` entry, push a
`v<version>` tag. `.github/workflows/publish.yml` checks the package and publishes it with provenance
through npm trusted publishing.
