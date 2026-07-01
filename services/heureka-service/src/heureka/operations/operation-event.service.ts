import { Injectable } from '@nestjs/common';
import { LoggerService, PrismaService } from '@heureka/shared';
import {
  buildHeurekaOperationAuditProjection,
  buildHeurekaOperationAuditReadModel,
  HeurekaOperationAuditEvent,
  HeurekaOperationAuditReadModel,
} from './operation-event.schema';

type JsonObject = Record<string, unknown>;

export type HeurekaOperationEventInput = {
  feedType?: string | null;
  accountId?: string | null;
  action?: string | null;
  eventType?: string | null;
  status?: string | null;
  idempotencyKey?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  productId?: string | null;
  externalId?: string | null;
  correlationId?: string | null;
  payloadHash?: string | null;
  requestSummary?: JsonObject | null;
  responseSummary?: JsonObject | null;
  policySnapshot?: JsonObject | null;
  blockedReasons?: unknown[] | JsonObject | null;
  errorSummary?: string | null;
  redactedContext?: JsonObject | null;
  metadata?: JsonObject | null;
  source?: string | null;
  summary?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type HeurekaOperationEventListResult = {
  events: HeurekaOperationAuditEvent[];
  missing: string[];
  readModel: HeurekaOperationAuditReadModel;
};

@Injectable()
export class HeurekaOperationEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('HeurekaOperationEventService');
  }

  async append(input: HeurekaOperationEventInput): Promise<any | null> {
    const client = (this.prisma as any).heurekaOperationEvent;
    if (!client) {
      this.logger.warn('Heureka operation event Prisma model is unavailable');
      return null;
    }

    const action = this.requiredString(input.action || input.eventType, 'action');
    const now = new Date();
    try {
      return await client.create({
        data: {
          feedType: this.optionalString(input.feedType),
          accountId: this.uuidOrNull(input.accountId),
          action: action.slice(0, 120),
          status: this.optionalString(input.status)?.slice(0, 50) || null,
          idempotencyKey: this.optionalString(input.idempotencyKey)?.slice(0, 160) || null,
          actorId: this.optionalString(input.actorId)?.slice(0, 120) || null,
          entityType: this.optionalString(input.entityType || input.source)?.slice(0, 80) || null,
          entityId: this.optionalString(input.entityId)?.slice(0, 120) || null,
          productId: this.uuidOrNull(input.productId),
          externalId: this.optionalString(input.externalId)?.slice(0, 160) || null,
          correlationId: this.optionalString(input.correlationId)?.slice(0, 120) || null,
          payloadHash: this.optionalString(input.payloadHash)?.slice(0, 128) || null,
          requestSummary: this.jsonOrNull(input.requestSummary),
          responseSummary: this.jsonOrNull(input.responseSummary),
          policySnapshot: this.jsonOrNull(input.policySnapshot),
          blockedReasons: this.jsonOrNull(input.blockedReasons),
          errorSummary: this.optionalString(input.errorSummary || input.summary)?.slice(0, 1000) || null,
          redactedContext: this.jsonOrNull({
            ...(input.redactedContext || {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
          }),
          startedAt: this.dateOrNull(input.startedAt),
          completedAt: this.dateOrNull(input.completedAt) || now,
        },
      });
    } catch (error: any) {
      if (this.isMissingOperationEventTable(error)) {
        this.logger.warn('Heureka operation event table is unavailable');
        return null;
      }
      if (String(error?.code || '') === 'P2002') {
        this.logger.warn(`Heureka operation event idempotency conflict for action ${action}`);
        return null;
      }
      this.logger.warn(`Heureka operation event append failed: ${error.message}`);
      return null;
    }
  }

  async list(feedType = 'heureka_cz', take = 50): Promise<HeurekaOperationEventListResult> {
    const limit = this.clampTake(take);
    const client = (this.prisma as any).heurekaOperationEvent;
    if (!client) {
      return this.emptyResult(limit, [
        '[MISSING: durable operation/audit log contract]',
        '[MISSING: Heureka typed operation event writer]',
      ]);
    }

    try {
      const rows = await client.findMany({
        where: feedType ? { OR: [{ feedType }, { feedType: null }] } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const events = rows.map((row: any) => this.serialize(row));
      return { events, missing: [], readModel: this.buildReadModel(events, limit) };
    } catch (error: any) {
      if (this.isMissingOperationEventTable(error)) {
        return this.emptyResult(limit, [
          '[MISSING: durable operation/audit log contract]',
          '[MISSING: Heureka typed operation event writer]',
        ]);
      }
      this.logger.warn(`Heureka operation event list failed: ${error.message}`);
      return this.emptyResult(limit, ['[UNKNOWN: Heureka operation event log unavailable]']);
    }
  }

  serialize(row: any): HeurekaOperationAuditEvent {
    const event: HeurekaOperationAuditEvent = {
      id: row.id,
      eventType: row.action,
      action: row.action,
      source: row.entityType || 'heureka_operation_events',
      entityType: row.entityType || null,
      entityId: row.entityId || null,
      productId: row.productId || null,
      externalId: row.externalId || null,
      status: row.status || 'unknown',
      timestamp: row.completedAt || row.createdAt,
      summary: row.errorSummary || this.actionSummary(row),
      metadata: {
        requestSummary: row.requestSummary || {},
        responseSummary: row.responseSummary || {},
        policySnapshot: row.policySnapshot || {},
        blockedReasons: row.blockedReasons || [],
        redactedContext: row.redactedContext || {},
      },
      actorId: row.actorId || null,
      correlationId: row.correlationId || null,
      feedType: row.feedType || null,
      idempotencyKey: row.idempotencyKey || null,
      payloadHash: row.payloadHash || null,
      startedAt: row.startedAt || null,
      completedAt: row.completedAt || null,
      durability: 'durable_operation_event',
    };
    return { ...event, ...buildHeurekaOperationAuditProjection(event) };
  }

  private buildReadModel(events: HeurekaOperationAuditEvent[], limit: number): HeurekaOperationAuditReadModel {
    return buildHeurekaOperationAuditReadModel(events, limit);
  }

  private emptyResult(limit: number, missing: string[]): HeurekaOperationEventListResult {
    const readModel = this.buildReadModel([], limit);
    return { events: [], missing, readModel };
  }

  private actionSummary(row: any): string {
    const entity = row.entityType && row.entityId ? `${row.entityType} ${row.entityId}` : row.entityType || 'Heureka operation';
    return `${entity} recorded ${row.action}`;
  }

  private jsonOrNull(value: unknown): JsonObject | unknown[] | null {
    if (value === undefined || value === null) return null;
    try {
      return JSON.parse(JSON.stringify(this.sanitizeValue(value)));
    } catch {
      return { serialization: 'failed' };
    }
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item));
    if (value && typeof value === 'object') {
      const result: JsonObject = {};
      for (const [key, item] of Object.entries(value as JsonObject)) {
        const lowered = key.toLowerCase();
        if (lowered.includes('email') || lowered.includes('phone') || lowered.includes('token') || lowered.includes('secret') || lowered.includes('customer')) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.sanitizeValue(item);
        }
      }
      return result;
    }
    if (typeof value === 'string' && value.includes('@')) return '[REDACTED]';
    return value;
  }

  private requiredString(value: unknown, field: string): string {
    const text = this.optionalString(value);
    if (!text) throw new Error(`Heureka operation event ${field} is required`);
    return text;
  }

  private optionalString(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private uuidOrNull(value: unknown): string | null {
    const text = this.optionalString(value);
    if (!text) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
  }

  private dateOrNull(value: unknown): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  private clampTake(value: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 50;
    return Math.max(1, Math.min(Math.floor(numeric), 100));
  }

  private isMissingOperationEventTable(error: any): boolean {
    const message = String(error?.message || '');
    return error?.code === 'P2021'
      || message.includes('heureka_operation_events')
      || message.includes('HeurekaOperationEvent');
  }
}
