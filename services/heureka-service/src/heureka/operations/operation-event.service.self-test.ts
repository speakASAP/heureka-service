import { HEUREKA_OPERATION_AUDIT_SCHEMA_REF } from './operation-event.schema';
import { HeurekaOperationEventService } from './operation-event.service';

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

async function main(): Promise<void> {
  const created: any[] = [];
  const now = new Date('2026-07-01T13:00:00.000Z');
  const prisma = {
    heurekaOperationEvent: {
      create: async ({ data }: any) => {
        created.push(data);
        return { id: 'event-1', createdAt: now, updatedAt: now, ...data };
      },
      findMany: async () => created.map((data, index) => ({ id: `event-${index + 1}`, createdAt: now, updatedAt: now, ...data })),
    },
  };
  const logger = { setContext: () => undefined, warn: () => undefined };
  const service = new HeurekaOperationEventService(prisma as any, logger as any);

  await service.append({
    feedType: 'heureka_cz',
    action: 'order_forwarded',
    status: 'success',
    entityType: 'orders_service',
    entityId: 'local-order-1',
    actorId: 'actor-1',
    externalId: 'H-1001',
    requestSummary: { itemCount: 1, customerEmail: 'buyer@example.test' },
    redactedContext: { phone: '+420000000000', safe: 'kept' },
  });

  assertEqual(created[0].requestSummary.customerEmail, '[REDACTED]');
  assertEqual(created[0].redactedContext.phone, '[REDACTED]');
  assertEqual(created[0].redactedContext.safe, 'kept');

  const list = await service.list('heureka_cz', 10);
  assertEqual(list.missing.length, 0);
  assertEqual(list.events.length, 1);
  assertEqual(list.events[0].eventType, 'order_forwarded');
  assertEqual(list.events[0].durability, 'durable_operation_event');
  assertEqual(list.events[0].schemaRef, HEUREKA_OPERATION_AUDIT_SCHEMA_REF);
  assertEqual(list.events[0].auditEnvelope.schema_ref, HEUREKA_OPERATION_AUDIT_SCHEMA_REF);
  assertEqual(list.events[0].auditEnvelope.source_service, 'heureka-service');
  assertEqual(list.events[0].loggingEvent.service, 'heureka-service');
  assertEqual(list.events[0].loggingEvent.metadata.has_external_ref, true);
  assertEqual(list.readModel.schemaRef, HEUREKA_OPERATION_AUDIT_SCHEMA_REF);
  assertEqual(list.readModel.safety.readOnly, true);
  assertEqual(list.readModel.safety.returnsRawPayload, false);
  assertEqual(list.readModel.safety.schemaRef, HEUREKA_OPERATION_AUDIT_SCHEMA_REF);
  assertEqual(list.readModel.counts.byAction.order_forwarded, 1);
  console.log('PASS operation-event service self-test');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
