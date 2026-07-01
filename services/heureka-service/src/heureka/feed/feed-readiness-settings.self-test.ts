import { FeedService } from "./feed.service";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertIncludes(values: readonly string[], expected: string): void {
  if (!values.includes(expected)) {
    throw new Error(`Expected ${expected} in ${values.join(",")}`);
  }
}

async function main(): Promise<void> {
  const warnings: string[] = [];
  let stockBatchCalls = 0;
  let lastStockBatchIds: string[] = [];
  const missingSettingsTable = new Error("The table public.heureka_settings does not exist in the current database.") as any;
  missingSettingsTable.code = "P2021";
  missingSettingsTable.meta = { table: "public.heureka_settings" };

  const prisma = {
    heurekaSettings: {
      findUnique: async () => {
        throw missingSettingsTable;
      },
    },
  };

  const catalogClient = {
    getProductById: async () => ({
      id: "synthetic-product-1",
      title: "Synthetic Trail Shoe",
      description: "Synthetic public description.",
      status: "active",
      categoryText: "Sport | Running shoes",
    }),
    getProductPricing: async () => ({ priceVat: "1299.00" }),
    getProductMedia: async () => ([{ url: "https://example.test/images/synthetic-trail-shoe.jpg", isPrimary: true }]),
    getHeurekaFeedSnapshot: async () => ({ feedFields: {} }),
  };

  const warehouseClient = {
    getAvailabilityBatch: async (productIds: string[]) => {
      stockBatchCalls += 1;
      lastStockBatchIds = productIds;
      return productIds.map((productId) => ({
        productId,
        totalQuantity: productId === "synthetic-product-1" ? 60 : 0,
        totalReserved: 0,
        totalAvailable: productId === "synthetic-product-1" ? 60 : 0,
        warehouses: [],
      }));
    },
    getTotalAvailable: async () => {
      throw new Error("Readiness should use Warehouse batch availability instead of N+1 total lookups.");
    },
  };

  const logger = {
    setContext: () => undefined,
    log: () => undefined,
    warn: (message: string) => warnings.push(message),
    error: () => undefined,
  };

  const service = new FeedService(prisma as any, catalogClient as any, warehouseClient as any, logger as any);
  const response = await service.getProductFeedReadiness("synthetic-product-1", "heureka_cz");
  assertEqual(response.summary.total, 1);
  assertEqual(response.summary.blocked, 1);
  assertEqual(response.items[0].availableStock, 60);
  assertEqual(response.items[0].settingsActive, false);
  assertEqual(stockBatchCalls, 1);
  assertEqual(lastStockBatchIds.join(","), "synthetic-product-1");
  assertEqual(warnings.length, 1);
  const blockerCodes = response.items[0].blockers.map((blocker) => blocker.code);
  assertIncludes(blockerCodes, "SETTINGS_INACTIVE");
  if (blockerCodes.includes("STOCK_UNKNOWN") || blockerCodes.includes("ZERO_STOCK")) {
    throw new Error(`Expected stock to remain known and positive, received blockers ${blockerCodes.join(",")}`);
  }

  const bulkResponse = await service.getBulkFeedReadiness(["synthetic-product-1", "synthetic-product-2"], "heureka_cz");
  assertEqual(bulkResponse.summary.total, 2);
  assertEqual(stockBatchCalls, 2);
  assertEqual(lastStockBatchIds.join(","), "synthetic-product-1,synthetic-product-2");
  assertEqual(bulkResponse.items[0].availableStock, 60);
  assertEqual(bulkResponse.items[1].availableStock, 0);
  const secondBlockerCodes = bulkResponse.items[1].blockers.map((blocker) => blocker.code);
  assertIncludes(secondBlockerCodes, "ZERO_STOCK");

  console.log("PASS feed-readiness-settings self-test");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
