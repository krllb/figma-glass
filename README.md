# figma-glass

| Path | What |
| --- | --- |
| `packages/figma-glass` | the npm package |
| `site` | the landing page (glass.krllb.com), playground and Safari diagnostics |
| `docs/SPEC.md` | the math and the calibration against Figma |
| `research` | calibration scripts and the WebKit simulator |

Run the site: `pnpm site`, then open http://localhost:8080/site/. Rules for working in the repo, for
people and coding agents alike: `AGENTS.md`.

## Release

Bump `version` in `packages/figma-glass/package.json`, add a `CHANGELOG.md` entry, push a `v<version>`
tag. The Publish workflow checks the package and stages it on npm with provenance; approve it on
npmjs.com with a passkey and it goes live.

## Site

Vercel project from this repository, no build: `vercel.json` serves the repo root and maps `/`,
`/playground`, `/diag` to `site/`. The pages import the package from `packages/figma-glass/src`.
Domain: add `glass.krllb.com` in the project's Domains. krllb.com's DNS is on Vercel, so no record is
needed by hand.
