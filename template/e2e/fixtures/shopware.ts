import { createTest, createTestProduct, expect } from '@devertnet/shopware-plugin-e2e/fixtures';

export const test = createTest({
  configPrefix: 'PluginName.config.',
  // known baseline of the plugin config (without prefix); tests override only what they check
  defaultConfig: {
    active: 1,
  },
});

export { expect, createTestProduct };
