import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertIncludes(values: readonly string[], expected: string): void {
  if (!values.includes(expected)) {
    throw new Error(`Expected ${expected} in ${values.join(',')}`);
  }
}

async function main(): Promise<void> {
  let stockBatchCalls = 0;
  let lastStockBatchIds: string[] = [];
  const pricingCalls: string[] = [];
  const mediaCalls: string[] = [];
  const marketplaceCalls: string[] = [];

  const catalogClient = {
    searchProducts: async () => ({
      items: [
        {
          id: 'catalog-product-1',
          sku: 'SKU-1',
          title: 'Dashboard Ready Product',
          description: 'Complete public description',
          ean: '8590000000011',
          brand: 'Alfares',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'catalog-product-2',
          sku: 'SKU-2',
          title: 'Dashboard Zero Stock Product',
          description: 'Complete public description',
          ean: '8590000000028',
          brand: 'Alfares',
          categoryText: 'Elektronika | Test',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    }),
    getProductPricing: async (productId: string) => {
      pricingCalls.push(productId);
      return { priceVat: '199.00' };
    },
    getProductMedia: async (productId: string) => {
      mediaCalls.push(productId);
      return [{ id: `media-${productId}`, url: `https://example.test/${productId}.jpg`, isPrimary: true }];
    },
    getHeurekaMarketplaceFields: async (productId: string) => {
      marketplaceCalls.push(productId);
      return productId === 'catalog-product-1'
        ? { profile: { overrides: { categoryText: 'Elektronika | Marketplace Override' } }, fields: [] }
        : { profile: { overrides: {} }, fields: [] };
    },
  };

  const warehouseClient = {
    getAvailabilityBatch: async (productIds: string[]) => {
      stockBatchCalls += 1;
      lastStockBatchIds = productIds;
      return [
        { productId: 'catalog-product-1', totalAvailable: 7 },
        { productId: 'catalog-product-2', totalAvailable: 0 },
      ];
    },
    getTotalAvailable: async () => {
      throw new Error('Dashboard product list should use Warehouse batch availability instead of N+1 total lookups.');
    },
  };

  const prisma = {
    heurekaProduct: {
      findMany: async () => ([{ productId: 'catalog-product-1', isIncluded: true, updatedAt: '2026-07-01T00:00:00.000Z' }]),
    },
    heurekaOffer: {
      findMany: async () => [],
    },
  };

  const logger = {
    setContext: () => undefined,
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  const service = new DashboardService(
    prisma as any,
    catalogClient as any,
    warehouseClient as any,
    {} as any,
    {} as any,
    logger as any,
  );

  const response = await service.listProducts(
    { id: 'user-1', email: 'user@example.test', roles: [] },
    { page: 1, limit: 20, feedType: 'heureka_cz' },
  );

  assertEqual(stockBatchCalls, 1);
  assertEqual(lastStockBatchIds.join(','), 'catalog-product-1,catalog-product-2');
  assertEqual(pricingCalls.join(','), 'catalog-product-1,catalog-product-2');
  assertEqual(mediaCalls.join(','), 'catalog-product-1,catalog-product-2');
  assertEqual(marketplaceCalls.join(','), 'catalog-product-1,catalog-product-2');
  assertEqual(response.products.length, 2);
  assertEqual(response.products[0].availableStock, 7);
  assertEqual(response.products[0].category, 'Elektronika | Marketplace Override');
  assertEqual(response.products[0].heurekaStatus, 'published');
  assertEqual(response.products[0].workflowStatus, 'included');
  assertEqual(response.products[0].nextAction, 'monitor_feed');
  assertEqual(response.products[0].canConfirmPublish, false);
  assertEqual(response.products[0].gaps.includes('category'), false);
  assertEqual(response.products[1].availableStock, 0);
  assertEqual(response.products[1].heurekaStatus, 'not_published');
  assertEqual(response.products[1].workflowStatus, 'blocked');
  assertEqual(response.products[1].nextAction, 'resolve_data_gaps');
  assertEqual(response.products[1].canIncludeInFeed, false);
  assertIncludes(response.products[1].gaps, 'stock');
  assertEqual(response.products[1].blockers[0].code, 'STOCK');

  const blockedResponse = await service.listProducts(
    { id: 'user-1', email: 'user@example.test', roles: [] },
    { page: 1, limit: 20, feedType: 'heureka_cz', workflowStatus: 'blocked' },
  );
  assertEqual(blockedResponse.products.length, 1);
  assertEqual(blockedResponse.products[0].id, 'catalog-product-2');
  assertEqual(blockedResponse.filters.returned, 1);

  let controllerQuery: any = null;
  const controller = new DashboardController({
    listProducts: async (_user: any, query: any) => {
      controllerQuery = query;
      return { products: [], total: 0, filters: query };
    },
  } as any);
  await controller.products(
    { user: { id: 'user-1', email: 'user@example.test', roles: [] } } as any,
    '',
    '1',
    '20',
    'heureka_cz',
    'excluded',
    'blocked',
    'stock',
  );
  assertEqual(controllerQuery.feedStatus, 'excluded');
  assertEqual(controllerQuery.workflowStatus, 'blocked');
  assertEqual(controllerQuery.gap, 'stock');

  console.log('PASS dashboard-list-products self-test');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
