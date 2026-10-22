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
tag. The Publish workflow checks the package and publishes it with provenance.

First release only, once:

1. Create `github.com/krllb/figma-glass` and push `main`.
2. Publish 0.1.0 by hand from `packages/figma-glass`: `npm login`, then `npm publish` (2FA).
3. On npmjs.com, package settings → Trusted publishing: GitHub Actions, repository
   `krllb/figma-glass`, workflow `publish.yml`. From then on tags publish on their own.

## Site

Vercel project from this repository, no build: `vercel.json` serves the repo root and maps `/`,
`/playground`, `/diag` to `site/`. The pages import the package from `packages/figma-glass/src`.
Domain: add `glass.krllb.com` in the project's Domains. krllb.com's DNS is on Vercel, so no record is
needed by hand.
