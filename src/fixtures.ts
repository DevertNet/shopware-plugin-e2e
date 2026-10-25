import { test as base, expect, isThemeCompiled, clearDelayedCache, type TestDataService } from '@shopware-ag/acceptance-test-suite';
import type { Page, TestType } from '@playwright/test';

export { expect };

/** Fixed names keep generated PDFs comparable between runs. */
export const PRODUCT_NAME = 'Test Product';
export const CATEGORY_NAME = 'Test Category';

export interface FixtureOptions {
  /** Prefix of the plugin's system config keys, e.g. `DevertPdfExport.config.` */
  configPrefix: string;
  /** Known baseline of the plugin config (without prefix). Tests override only what they check. */
  defaultConfig?: Record<string, string | number>;
}

/**
 * Creates a product with a fixed name, product number and image, so generated documents are identical
 * between runs. The number must be unique, therefore a leftover product of an aborted run is removed first.
 */
export async function createTestProduct(
  data: TestDataService,
  overrides: Record<string, unknown> = {},
  productNumber = 'TEST-000001',
) {
  const response = await data.AdminApiClient.post('search/product', {
    data: { filter: [{ type: 'equals', field: 'productNumber', value: productNumber }], limit: 10 },
  });
  expect(response.ok()).toBeTruthy();
  for (const { id } of (await response.json()).data ?? []) {
    await data.AdminApiClient.delete(`product/${id}`);
  }
  const product = await data.createBasicProduct({ name: PRODUCT_NAME, productNumber, ...overrides });
  // a solid-colour image, identical in every run
  const media = await data.createMediaPNGSolid(400, 400, [0, 64, 160]);
  await data.assignProductMedia(product.id, media.id);
  return product;
}

/**
 * Storefront helpers on top of the Shopware acceptance-test-suite. The suite creates an isolated sales
 * channel with its own customer and removes everything it created afterwards, so the tests run against
 * any Shopware instance without demo data.
 */
export class Shop {
  constructor(
    private readonly page: Page,
    private readonly data: { setSystemConfig(configs: Record<string, unknown>): Promise<void> },
    private readonly salesChannelUrl: string,
    private readonly options: FixtureOptions,
  ) {}

  /** Absolute URL inside the test sales channel (its domain has a path prefix). */
  url(path = ''): string {
    return this.salesChannelUrl.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  /** Resets the plugin config to the baseline for the test sales channel and applies the overrides. */
  async configure(overrides: Record<string, string | number> = {}) {
    const config = { ...this.options.defaultConfig, ...overrides };
    await this.data.setSystemConfig({
      // the wishlist is disabled on fresh installations
      'core.cart.wishlistEnabled': true,
      ...Object.fromEntries(Object.entries(config).map(([key, value]) => [this.options.configPrefix + key, value])),
    });
  }

  async acceptCookies() {
    await this.page.locator('.js-cookie-configuration-button > .btn').click();
    await this.page.locator('#cookie_Comfort\\ features, #cookie_comfort-features').check();
    await this.page.locator('.js-offcanvas-cookie-submit').click();
  }

  async login(customer: { email: string; password: string }) {
    await this.page.goto(this.url('account/login'));
    await this.page.locator('#loginMail').fill(customer.email);
    await this.page.locator('#loginPassword').fill(customer.password);
    await this.page.locator('.login-submit > .btn').click();
    await expect(this.page.locator('.account-welcome')).toBeVisible();
  }

  async openProduct(productId: string) {
    await this.page.goto(this.url(`detail/${productId}`));
  }

  /** Adds the product to the cart and waits until the offcanvas cart is open. */
  async addProductToCart(productId: string) {
    await this.openProduct(productId);
    await this.page.locator('.product-detail-buy .btn-buy').click();
    await expect(this.page.locator('.offcanvas-cart')).toBeVisible();
  }

  async addProductToWishlist(productId: string) {
    await this.openProduct(productId);
    const action = this.page.locator('.product-wishlist-action');
    await expect(action).toBeVisible();
    if (!(await action.evaluate((el) => el.classList.contains('product-wishlist-added')))) {
      await action.click();
      await expect(action).toHaveClass(/product-wishlist-added/);
    }
  }
}

interface TestFixtures {
  page: Page;
  shop: Shop;
  /** A product with its own product-detail layout (CMS page with a buy box), removed afterwards. */
  layoutProduct: { id: string };
  /** A category containing one product, both created for the test and removed afterwards. */
  catalog: { category: { id: string }; product: { id: string } };
}
interface WorkerFixtures {
  themeReady: void;
}

/** The suite's `test` extended by the fixtures of this package. */
export type ShopwareTest = typeof base extends TestType<infer T, infer W>
  ? TestType<Omit<T, keyof TestFixtures> & TestFixtures, W & WorkerFixtures>
  : never;

/** Creates the Playwright `test` with the fixtures `shop`, `catalog` and `layoutProduct`. */
export function createTest(options: FixtureOptions): ShopwareTest {
  return base.extend<TestFixtures, WorkerFixtures>({
    // The theme of the isolated sales channel is compiled asynchronously and can take minutes on a fresh
    // installation. Wait for it once, before the first test, with a timeout of its own.
    themeReady: [
      async ({ DefaultSalesChannel, SalesChannelBaseConfig, AdminApiContext, StoreApiContext }, use) => {
        if (!(await isThemeCompiled(StoreApiContext, DefaultSalesChannel.url))) {
          const assign = await AdminApiContext.post(
            `./_action/theme/${SalesChannelBaseConfig.defaultThemeId}/assign/${DefaultSalesChannel.salesChannel.id}`,
          );
          expect(assign.ok(), 'theme assignment').toBeTruthy();
          await expect
            .poll(
              async () => {
                await clearDelayedCache(AdminApiContext);
                return isThemeCompiled(StoreApiContext, DefaultSalesChannel.url);
              },
              { timeout: 5 * 60_000, intervals: [4_000], message: 'theme compilation' },
            )
            .toBe(true);
        }
        await use();
      },
      { scope: 'worker', auto: true, timeout: 6 * 60_000 },
    ],
    // The suite's storefront page assigns and compiles the theme for the isolated sales channel.
    page: async ({ StorefrontPage }: { StorefrontPage: Page }, use: (page: Page) => Promise<void>) => {
      await use(StorefrontPage);
    },
    shop: async ({ page, TestDataService, DefaultSalesChannel }, use) => {
      await use(new Shop(page, TestDataService, DefaultSalesChannel.url, options));
    },
    layoutProduct: async ({ TestDataService }, use) => {
      const layout = await TestDataService.createBasicPageLayout('product_detail', {
        name: `Layout ${Date.now()}`,
        sections: [
          {
            position: 0,
            type: 'default',
            sizingMode: 'boxed',
            blocks: [
              {
                type: 'gallery-buybox',
                position: 0,
                sectionPosition: 'main',
                slots: [
                  { type: 'image-gallery', slot: 'left', config: {} },
                  { type: 'buy-box', slot: 'right', config: {} },
                ],
              },
            ],
          },
        ],
      } as never);
      await use(await createTestProduct(TestDataService, { cmsPageId: layout.id }, 'TEST-000002'));
    },
    catalog: async ({ TestDataService }, use) => {
      const category = await TestDataService.createCategory({ name: CATEGORY_NAME });
      const product = await createTestProduct(TestDataService, { categories: [{ id: category.id }] });
      await use({ category, product });
    },
  }) as unknown as ShopwareTest;
}
