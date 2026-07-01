import { ECOSYSTEM_OPERATION_AUDIT_SCHEMA_BLOCKER, HEUREKA_OPERATION_AUDIT_SCHEMA_REF } from '../operations/operation-event.schema';
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

function assertNotIncludes(values: readonly string[], expected: string): void {
  if (values.includes(expected)) {
    throw new Error(`Did not expect ${expected} in ${values.join(',')}`);
  }
}

async function main(): Promise<void> {
  const now = new Date('2026-07-01T12:00:00.000Z');
  const earlier = new Date('2026-07-01T11:00:00.000Z');
  const prisma = {
    heurekaFeed: {
      findMany: async () => ([{ id: 'feed-1', feedType: 'heureka_cz', feedUrl: 'https://heureka.test/feed.xml', productCount: 7, status: 'completed', generatedAt: now, createdAt: earlier, updatedAt: now }]),
    },
    heurekaOrder: {
      findMany: async () => ([{ id: 'order-1', accountId: 'account-1', heurekaOrderId: 'H-1', orderId: null, customerEmail: 'buyer@example.test', customerPhone: null, total: '99.00', currency: 'CZK', status: 'pending', forwarded: false, createdAt: earlier, updatedAt: earlier }]),
    },
    heurekaOffer: {
      findMany: async () => ([{ id: 'offer-1', productId: 'product-1', title: 'Offer one', price: '199.00', stockQuantity: 5, isActive: true, createdAt: earlier, updatedAt: now }]),
    },
    heurekaProduct: {
      findMany: async () => ([{ id: 'feed-product-1', productId: 'product-1', isIncluded: true, createdAt: earlier, updatedAt: now }]),
    },
    heurekaSettings: {
      findMany: async () => ([{ id: 'settings-1', feedType: 'heureka_cz', shopName: 'Shop', shopUrl: 'https://shop.test', contactEmail: 'ops@example.test', contactPhone: null, deliveryDays: 2, deliveryPrice: '0', freeDeliveryThreshold: null, currency: 'CZK', isActive: true, createdAt: earlier, updatedAt: now }]),
    },
  };
  const logger = { setContext: () => undefined, log: () => undefined, warn: () => undefined, error: () => undefined };
  const operationEvents = {
    list: async () => ({
      events: [{
        eventType: 'settings_updated',
        action: 'settings_updated',
        source: 'dashboard',
        entityId: 'audit-1',
        status: 'active',
        timestamp: new Date('2026-07-01T12:30:00.000Z'),
        summary: 'Dashboard updated feed settings',
        metadata: { changedFields: ['deliveryDays'] },
        durability: 'durable_operation_event',
        schemaRef: HEUREKA_OPERATION_AUDIT_SCHEMA_REF,
      }],
      missing: [],
      readModel: { schemaRef: HEUREKA_OPERATION_AUDIT_SCHEMA_REF, generatedAt: now.toISOString(), safety: { readOnly: true, returnsRawPayload: false, schemaRef: HEUREKA_OPERATION_AUDIT_SCHEMA_REF }, counts: { total: 1, byAction: { settings_updated: 1 }, byStatus: { active: 1 } }, latest: null, items: [], pagination: { limit: 50, returned: 1 } },
    }),
  };
  const service = new DashboardService(prisma as any, {} as any, {} as any, {} as any, {} as any, logger as any, operationEvents as any);
  const result = await service.getOperationsHistory({ id: 'user-1', email: 'user@example.test', roles: [] }, 'heureka_cz');
  assertEqual(result.feeds.length, 1);
  assertEqual(result.orders.length, 1);
  assertEqual(result.offers.length, 1);
  assertEqual(result.products.length, 1);
  assertEqual(result.settings.length, 1);
  assertEqual(result.operationEvents.length, 6);
  assertEqual(result.operationEventLog.schemaRef, HEUREKA_OPERATION_AUDIT_SCHEMA_REF);
  assertEqual(result.operationEventLog.safety.readOnly, true);
  assertEqual(result.operationEvents[0].durability, 'durable_operation_event');
  assertIncludes(result.operationEvents.map((event: any) => event.eventType), 'feed_generation');
  assertIncludes(result.operationEvents.map((event: any) => event.eventType), 'order_received');
  assertIncludes(result.operationEvents.map((event: any) => event.eventType), 'settings_updated');
  assertNotIncludes(result.missing, '[MISSING: durable operation/audit log contract]');
  assertNotIncludes(result.missing, '[MISSING: Heureka typed operation event writer]');
  assertNotIncludes(result.missing, '[MISSING: shared operation/audit event schema]');
  assertIncludes(result.missing, ECOSYSTEM_OPERATION_AUDIT_SCHEMA_BLOCKER);
  console.log('PASS dashboard-operations-history self-test');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
