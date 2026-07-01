export const HEUREKA_OPERATION_AUDIT_SCHEMA_REF = 'heureka.operation.audit.v1' as const;
export const ECOSYSTEM_OPERATION_AUDIT_SCHEMA_BLOCKER =
  '[MISSING: ecosystem-wide shared operation/audit schema package]' as const;

export type HeurekaOperationAuditEnvelope = {
  event_name: string;
  event_version: '1.0.0';
  occurred_at: string;
  source_service: 'heureka-service';
  source_component: string;
  environment: 'runtime';
  correlation_ref: string;
  idempotency_key: string;
  schema_ref: typeof HEUREKA_OPERATION_AUDIT_SCHEMA_REF;
};

export type HeurekaOperationAuditLoggingEvent = {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service: 'heureka-service';
  timestamp: string;
  correlation_id?: string;
  metadata: {
    schema_ref: typeof HEUREKA_OPERATION_AUDIT_SCHEMA_REF;
    event_name: string;
    event_version: '1.0.0';
    source_service: 'heureka-service';
    source_component: string;
    action: string;
    status: string;
    durability: string;
    feed_type: string | null;
    entity_type: string | null;
    has_product_ref: boolean;
    has_external_ref: boolean;
    redacted_context: Record<string, unknown>;
  };
};

export type HeurekaOperationAuditEvent = {
  id?: string | null;
  eventType: string;
  action: string;
  source: string;
  entityType?: string | null;
  entityId?: string | null;
  productId?: string | null;
  externalId?: string | null;
  status: string;
  timestamp: Date | string;
  summary: string;
  metadata?: Record<string, any>;
  actorId?: string | null;
  correlationId?: string | null;
  feedType?: string | null;
  idempotencyKey?: string | null;
  payloadHash?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  durability: 'durable_operation_event' | 'derived_from_existing_row';
  schemaRef?: typeof HEUREKA_OPERATION_AUDIT_SCHEMA_REF;
  auditEnvelope?: HeurekaOperationAuditEnvelope;
  loggingEvent?: HeurekaOperationAuditLoggingEvent;
};

export type HeurekaOperationAuditReadModel = {
  schemaRef: typeof HEUREKA_OPERATION_AUDIT_SCHEMA_REF;
  generatedAt: string;
  safety: {
    readOnly: true;
    returnsRawPayload: false;
    schemaRef: typeof HEUREKA_OPERATION_AUDIT_SCHEMA_REF;
  };
  counts: {
    total: number;
    byAction: Record<string, number>;
    byStatus: Record<string, number>;
  };
  latest: HeurekaOperationAuditEvent | null;
  items: HeurekaOperationAuditEvent[];
  pagination: { limit: number; returned: number };
};

export function buildHeurekaOperationAuditProjection(
  event: HeurekaOperationAuditEvent,
): Pick<HeurekaOperationAuditEvent, 'schemaRef' | 'auditEnvelope' | 'loggingEvent'> {
  const action = event.action || event.eventType || 'unknown_operation';
  const occurredAt = toIso(event.timestamp || event.completedAt || new Date());
  const sourceComponent = safeComponent(event.source || event.entityType || 'heureka_operation_events');
  const correlationRef = safeRef(event.correlationId || event.idempotencyKey || event.id || `${action}:${occurredAt}`);
  const idempotencyKey = safeRef(event.idempotencyKey || event.id || `${action}:${occurredAt}`);
  const status = String(event.status || 'unknown');
  const envelope: HeurekaOperationAuditEnvelope = {
    event_name: action,
    event_version: '1.0.0',
    occurred_at: occurredAt,
    source_service: 'heureka-service',
    source_component: sourceComponent,
    environment: 'runtime',
    correlation_ref: correlationRef,
    idempotency_key: idempotencyKey,
    schema_ref: HEUREKA_OPERATION_AUDIT_SCHEMA_REF,
  };

  const loggingEvent: HeurekaOperationAuditLoggingEvent = {
    level: logLevelForStatus(status),
    message: safeMessage(event.summary || `Heureka operation ${action}`),
    service: 'heureka-service',
    timestamp: occurredAt,
    ...(event.correlationId ? { correlation_id: safeRef(event.correlationId) } : {}),
    metadata: {
      schema_ref: HEUREKA_OPERATION_AUDIT_SCHEMA_REF,
      event_name: envelope.event_name,
      event_version: envelope.event_version,
      source_service: envelope.source_service,
      source_component: envelope.source_component,
      action,
      status,
      durability: event.durability,
      feed_type: event.feedType || null,
      entity_type: event.entityType || null,
      has_product_ref: Boolean(event.productId),
      has_external_ref: Boolean(event.externalId),
      redacted_context: redactedContext(event.metadata),
    },
  };

  return {
    schemaRef: HEUREKA_OPERATION_AUDIT_SCHEMA_REF,
    auditEnvelope: envelope,
    loggingEvent,
  };
}

export function buildHeurekaOperationAuditReadModel(
  events: HeurekaOperationAuditEvent[],
  limit: number,
): HeurekaOperationAuditReadModel {
  const byAction: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const event of events) {
    const action = event.action || event.eventType || 'unknown_operation';
    const status = event.status || 'unknown';
    byAction[action] = (byAction[action] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    schemaRef: HEUREKA_OPERATION_AUDIT_SCHEMA_REF,
    generatedAt: new Date().toISOString(),
    safety: {
      readOnly: true,
      returnsRawPayload: false,
      schemaRef: HEUREKA_OPERATION_AUDIT_SCHEMA_REF,
    },
    counts: { total: events.length, byAction, byStatus },
    latest: events[0] || null,
    items: events,
    pagination: { limit, returned: events.length },
  };
}

function logLevelForStatus(status: string): 'error' | 'warn' | 'info' | 'debug' {
  const normalized = status.toLowerCase();
  if (normalized.includes('fail') || normalized.includes('error')) return 'error';
  if (normalized.includes('block') || normalized.includes('skip') || normalized.includes('warn')) return 'warn';
  return 'info';
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
}

function safeComponent(value: unknown): string {
  return String(value || 'heureka_operation_events')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, '_')
    .slice(0, 120) || 'heureka_operation_events';
}

function safeRef(value: unknown): string {
  return String(value || 'unavailable')
    .trim()
    .replace(/[\s\r\n\t]+/g, ':')
    .slice(0, 160) || 'unavailable';
}

function safeMessage(value: unknown): string {
  const message = String(value || 'Heureka operation event')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  return message.slice(0, 500) || 'Heureka operation event';
}

function redactedContext(metadata: Record<string, any> | undefined): Record<string, unknown> {
  const context = metadata?.redactedContext;
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    return JSON.parse(JSON.stringify(context));
  }
  return {};
}
