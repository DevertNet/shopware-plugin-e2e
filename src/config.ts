import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

export interface ConfigOptions {
  /**
   * Names of the sub folders of `e2e/tests` that become Playwright projects (e.g. `['buttons', 'pdf']`).
   * Default: one project for the whole `e2e/tests` folder.
   */
  projects?: string[];
  /** Playwright options that override the defaults. */
  overrides?: PlaywrightTestConfig;
}

/**
 * Playwright config for Shopware plugin tests. The Shopware acceptance-test-suite reads APP_URL
 * (with trailing slash) and the admin credentials from the environment.
 */
export function createConfig({ projects, overrides = {} }: ConfigOptions = {}): PlaywrightTestConfig {
  process.env.APP_URL ??= process.env.BASE_URL ?? 'http://127.0.0.1/';
  if (!process.env.APP_URL.endsWith('/')) {
    process.env.APP_URL += '/';
  }
  process.env.SHOPWARE_ADMIN_USERNAME ??= 'admin';
  process.env.SHOPWARE_ADMIN_PASSWORD ??= 'shopware';

  const desktop = { ...devices['Desktop Chrome'] };
  return defineConfig({
    testDir: './e2e/tests',
    outputDir: './e2e/results',
    // All tests change the shared shop configuration, so they must not run in parallel.
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    forbidOnly: !!process.env.CI,
    // The tests only do a few page loads and API calls. Playwright triples the timeout of the first
    // test, which may have to wait for the theme compilation (test.slow()).
    timeout: 60_000,
    expect: { timeout: 5_000 },
    globalTimeout: process.env.CI ? 15 * 60_000 : undefined,
    maxFailures: process.env.CI ? 8 : undefined,
    reporter: process.env.CI
      ? [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]]
      : [['list']],
    use: {
      baseURL: process.env.APP_URL,
      ignoreHTTPSErrors: true, // local DDEV uses its own CA
      actionTimeout: 10_000,
      navigationTimeout: 15_000,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    projects: projects
      ? projects.map((name) => ({ name, testDir: `./e2e/tests/${name}`, use: desktop }))
      : [{ name: 'e2e', use: desktop }],
    ...overrides,
  });
}
