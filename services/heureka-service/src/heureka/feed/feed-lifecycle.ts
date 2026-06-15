export const HEUREKA_FEED_GENERATION_SLA_MS = 60_000;
export const HEUREKA_FEED_STALE_AFTER_MS = 60 * 60 * 1000;
export const HEUREKA_FEED_POLICY_VERSION = 'heureka-feed-validation-policy.v1';

export type FeedLifecycleStage = 'prepare' | 'validate' | 'persist' | 'expose' | 'failed';
export type FeedLifecycleStatus = 'valid' | 'invalid' | 'stale' | 'generating' | 'failed' | 'missing';
export type FeedPolicyDecision = 'persist_and_expose' | 'block_publication';

export interface FeedValidationInput {
  feedType: string;
  xml: string;
  generatedAt: Date;
  generationMs: number;
  includedProductCount: number;
  zeroStockExcludedCount: number;
  zeroStockIncludedCount?: number;
  failedFetchCount: number;
  feedId?: string;
}

export interface FeedPolicyIssue {
  code: string;
  message: string;
}

export interface FeedValidationPolicyResult {
  policyVersion: string;
  decision: FeedPolicyDecision;
  snapshotHash: string;
  blockers: FeedPolicyIssue[];
  warnings: FeedPolicyIssue[];
}

export interface FeedValidationSnapshot {
  feedId?: string;
  feedType: string;
  status: FeedLifecycleStatus;
  stage: FeedLifecycleStage;
  generatedAt: string;
  generationMs: number;
  includedProductCount: number;
  zeroStockExcludedCount: number;
  failedFetchCount: number;
  snapshotHash: string;
  idempotencyKey: string;
  checks: {
    validXmlEnvelope: boolean;
    escapedXmlText: boolean;
    zeroStockExcluded: boolean;
    productCountMatches: boolean;
    generationWithinSla: boolean;
    sensitiveFieldsExcluded: boolean;
  };
  policy: FeedValidationPolicyResult;
  errors: string[];
}

export interface FeedStatusSummary {
  feedType: string;
  status: FeedLifecycleStatus;
  latestFeedId?: string;
  feedUrl?: string;
  productCount: number;
  generatedAt?: string;
  feedAgeSeconds?: number;
  reason?: string;
  latestValidation?: FeedValidationSnapshot;
}

const SENSITIVE_FIELD_TAG_PATTERN = /<\/?[^>]*(?:COST|MARGIN|PROFIT|SUPPLIER|WHOLESALE|PAYMENT_API_KEY|API_KEY|SECRET|TOKEN|PASSWORD)[^>]*>/i;
const UNESCAPED_AMPERSAND_PATTERN = /&(?!amp;|lt;|gt;|quot;|apos;)/;

export function validateHeurekaFeed(input: FeedValidationInput): FeedValidationSnapshot {
  const snapshotHash = buildSnapshotHash(input);
  const checks = {
    validXmlEnvelope: hasValidXmlEnvelope(input.xml),
    escapedXmlText: !UNESCAPED_AMPERSAND_PATTERN.test(input.xml),
    zeroStockExcluded: input.zeroStockExcludedCount >= 0 && (input.zeroStockIncludedCount || 0) === 0,
    productCountMatches: countShopItems(input.xml) === input.includedProductCount,
    generationWithinSla: input.generationMs <= HEUREKA_FEED_GENERATION_SLA_MS,
    sensitiveFieldsExcluded: !SENSITIVE_FIELD_TAG_PATTERN.test(input.xml),
  };

  const blockers: FeedPolicyIssue[] = [];
  if (!checks.validXmlEnvelope) blockers.push({ code: 'XML_ENVELOPE_INVALID', message: 'Feed XML must include XML declaration and SHOP root element.' });
  if (!checks.escapedXmlText) blockers.push({ code: 'XML_TEXT_UNESCAPED', message: 'Feed XML contains unescaped ampersand text.' });
  if (!checks.zeroStockExcluded) blockers.push({ code: 'ZERO_STOCK_INCLUDED', message: 'Zero-stock products must not be exposed in the public feed.' });
  if (!checks.productCountMatches) blockers.push({ code: 'PRODUCT_COUNT_MISMATCH', message: 'Feed SHOPITEM count must match included product evidence.' });
  if (!checks.generationWithinSla) blockers.push({ code: 'GENERATION_SLA_EXCEEDED', message: 'Feed generation exceeded 60 second SLA.' });
  if (!checks.sensitiveFieldsExcluded) blockers.push({ code: 'SENSITIVE_FIELD_EXPOSED', message: 'Feed XML contains forbidden internal commercial or secret field tags.' });

  const warnings: FeedPolicyIssue[] = [];
  if (input.failedFetchCount > 0) warnings.push({ code: 'CATALOG_FETCH_PARTIAL', message: 'Some included products could not be fetched and were omitted from this feed snapshot.' });

  const policy: FeedValidationPolicyResult = {
    policyVersion: HEUREKA_FEED_POLICY_VERSION,
    decision: blockers.length ? 'block_publication' : 'persist_and_expose',
    snapshotHash,
    blockers,
    warnings,
  };

  return {
    feedId: input.feedId,
    feedType: input.feedType,
    status: blockers.length ? 'invalid' : 'valid',
    stage: blockers.length ? 'failed' : 'expose',
    generatedAt: input.generatedAt.toISOString(),
    generationMs: input.generationMs,
    includedProductCount: input.includedProductCount,
    zeroStockExcludedCount: input.zeroStockExcludedCount,
    failedFetchCount: input.failedFetchCount,
    snapshotHash,
    idempotencyKey: `${input.feedType}:${snapshotHash}`,
    checks,
    policy,
    errors: blockers.map((blocker) => blocker.message),
  };
}

export function summarizeFeedStatus(feedType: string, latestFeed?: any, latestValidation?: FeedValidationSnapshot, now: Date = new Date()): FeedStatusSummary {
  if (!latestFeed) return { feedType, status: 'missing', productCount: 0, reason: 'No feed generation record exists.' };

  if (latestFeed.status === 'generating') {
    return { feedType, status: 'generating', latestFeedId: latestFeed.id, feedUrl: latestFeed.feedUrl || undefined, productCount: latestFeed.productCount || 0, generatedAt: latestFeed.generatedAt ? latestFeed.generatedAt.toISOString() : undefined, reason: 'Feed generation is in progress.', latestValidation };
  }

  if (latestFeed.status === 'failed') {
    return { feedType, status: 'failed', latestFeedId: latestFeed.id, feedUrl: latestFeed.feedUrl || undefined, productCount: latestFeed.productCount || 0, generatedAt: latestFeed.generatedAt ? latestFeed.generatedAt.toISOString() : undefined, reason: 'Latest feed generation failed validation or execution.', latestValidation };
  }

  if (!latestFeed.generatedAt) {
    return { feedType, status: 'missing', latestFeedId: latestFeed.id, productCount: latestFeed.productCount || 0, reason: 'Latest feed record has no generatedAt evidence.', latestValidation };
  }

  const feedAgeSeconds = Math.max(0, Math.floor((now.getTime() - latestFeed.generatedAt.getTime()) / 1000));
  const isStale = now.getTime() - latestFeed.generatedAt.getTime() > HEUREKA_FEED_STALE_AFTER_MS;
  return { feedType, status: isStale ? 'stale' : latestValidation?.status || 'valid', latestFeedId: latestFeed.id, feedUrl: latestFeed.feedUrl || undefined, productCount: latestFeed.productCount || 0, generatedAt: latestFeed.generatedAt.toISOString(), feedAgeSeconds, reason: isStale ? 'Latest feed is older than the freshness threshold.' : undefined, latestValidation };
}

function hasValidXmlEnvelope(xml: string): boolean {
  const trimmed = (xml || '').trim();
  if (!trimmed.startsWith('<?xml') || !trimmed.endsWith('</SHOP>')) return false;
  if (!/^<\?xml\s+version="1\.0"\s+encoding="UTF-8"\?>/.test(trimmed)) return false;

  const shopOpen = trimmed.match(/<SHOP>/g)?.length || 0;
  const shopClose = trimmed.match(/<\/SHOP>/g)?.length || 0;
  const itemOpen = countShopItems(trimmed);
  const itemClose = trimmed.match(/<\/SHOPITEM>/g)?.length || 0;
  return shopOpen === 1 && shopClose === 1 && itemOpen === itemClose;
}

function countShopItems(xml: string): number {
  return (xml || '').match(/<SHOPITEM>/g)?.length || 0;
}

function buildSnapshotHash(input: FeedValidationInput): string {
  const stablePayload = JSON.stringify({
    feedType: input.feedType,
    xml: input.xml,
    includedProductCount: input.includedProductCount,
    zeroStockExcludedCount: input.zeroStockExcludedCount,
    zeroStockIncludedCount: input.zeroStockIncludedCount || 0,
    failedFetchCount: input.failedFetchCount,
  });
  return fnv1a64(stablePayload);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}
