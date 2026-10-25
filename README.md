# shopware-plugin-e2e

Shared Playwright setup for the Devert Shopware plugins. Built on the
[Shopware acceptance-test-suite](https://developer.shopware.com/docs/guides/development/testing/e2e-playwright/):
every run gets its own sales channel, customer and test data, so the tests need no demo data and work with any
Shopware instance.

| Part | Where | What |
| --- | --- | --- |
| Reusable workflow | `.github/workflows/e2e.yml` | Installs Shopware (6.6 + 6.7 matrix or one explicit version), the plugin, starts PHP and the queue worker, runs Playwright, uploads reports |
| Playwright config | `@devertnet/shopware-plugin-e2e/config` | `createConfig({ projects })`: timeouts, `APP_URL`, projects |
| Fixtures | `@devertnet/shopware-plugin-e2e/fixtures` | `createTest({ configPrefix, defaultConfig })` → `shop`, `catalog`, `layoutProduct`, theme warm-up, `createTestProduct` |
| PDF comparison | `devert-compare-pdfs` | Renders reference and generated PDFs, marks differences red (`index.html` + `report.png`) |
| Template | `template/` | Files for a new plugin |

## Use in a plugin

1. Copy `template/` into the plugin (see `template/README.md`), the workflow file goes to `.github/workflows/test.yml`.
2. Add the dependency `github:DevertNet/shopware-plugin-e2e#v1` and `npm install`.
3. Write specs in `e2e/tests`. Plugin specific parts (config prefix, baseline config, specs, reference PDFs) stay in the plugin.

Run locally: `APP_URL=https://shop.ddev.site/ npx playwright test`

## Private repository

If this repository is private, plugins need two things:

- Settings → Actions → General → Access: allow access from repositories of the owner, so plugins can call the workflow.
- npm needs a token to fetch the git dependency in CI: create a fine-grained personal access token with read-only
  *Contents* access to this repository and save it in the plugin repositories as `E2E_REPO_TOKEN`.

While the repository is public, neither is needed (the secret is optional).

## Versions

Plugins reference `@v1` (workflow and package). Compatible changes go into `v1` (the tag is moved), breaking changes get `v2`.
Release: `git tag -f v1 && git push -f origin v1` (plus the exact version tag, e.g. `v1.0.0`).
