import { test, expect } from '../fixtures/shopware';

test('plugin output on the product page', async ({ page, shop, catalog }) => {
  await shop.configure({ active: 1 });

  await shop.openProduct(catalog.product.id);
  await expect(page.locator('.product-detail-buy')).toBeVisible();
});
