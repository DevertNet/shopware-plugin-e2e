# Plugin template

Copy these files into a plugin repository, replace `PluginName` and add the plugin's specs.

```
.github/workflows/test.yml     caller of the reusable workflow
playwright.config.ts
tsconfig.json
e2e/fixtures/shopware.ts       plugin config prefix and baseline config
e2e/tests/example.spec.ts
```

`package.json` needs these entries:

```json
{
  "scripts": {
    "test": "playwright test",
    "compare": "devert-compare-pdfs",
    "update-references": "devert-compare-pdfs --update"
  },
  "devDependencies": {
    "@devertnet/shopware-plugin-e2e": "github:DevertNet/shopware-plugin-e2e#v1",
    "@playwright/test": "^1.64.1",
    "@shopware-ag/acceptance-test-suite": "^12.25.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.6.0"
  }
}
```

Add `e2e/output/`, `e2e/results/` and `e2e/report/` to `.gitignore`.
