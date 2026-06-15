export const HEUREKA_FEED_VALIDATION_POLICY_VERSION = 'heureka.feed.validation.policy.v1';
export const HEUREKA_FEED_POLICY_GENERATION_SLA_MS = 60_000;

export type FeedValidationPolicyStatus = 'valid' | 'warning' | 'blocked';
export type FeedValidationPolicyDecision = 'persist_and_expose' | 'reject';
export type FeedValidationPolicySeverity = 'info' | 'warning' | 'error' | 'critical';
export type FeedValidationPolicyOwner = 'heureka-service' | 'catalog-service' | 'warehouse-service' | 'configuration';
export type FeedValidationPolicyResultCode = 'HEUREKA_FEED_VALID' | 'HEUREKA_FEED_VALID_WITH_WARNINGS' | 'HEUREKA_FEED_BLOCKED';

export type FeedValidationPolicyFindingCode =
  | 'FEED_TYPE_UNSUPPORTED'
  | 'XML_ENVELOPE_INVALID'
  | 'XML_TEXT_UNESCAPED'
  | 'PRODUCT_COUNT_MISMATCH'
  | 'ZERO_STOCK_INCLUDED'
  | 'ZERO_STOCK_EVIDENCE_INVALID'
  | 'GENERATION_SLA_EXCEEDED'
  | 'SENSITIVE_FIELD_EXPOSED'
  | 'PRODUCT_ELIGIBILITY_EVIDENCE_INVALID'
  | 'CATALOG_FETCH_PARTIAL';

export type FeedValidationPolicyBlockerCode = Exclude<FeedValidationPolicyFindingCode, 'CATALOG_FETCH_PARTIAL'>;

export interface FeedValidationPolicyInput {
  feedType: string;
  xml: string;
  generatedAt: Date | string;
  generationMs: number;
  includedProductCount: number;
  zeroStockExcludedCount: number;
  failedFetchCount?: number;
  feedId?: string;
  sourceSnapshotHash?: string;
  zeroStockIncludedCount?: number;
  eligibleProductCount?: number;
}

export interface FeedValidationPolicyFinding {
  code: FeedValidationPolicyFindingCode;
  passed: boolean;
  severity: FeedValidationPolicySeverity;
  blocking: boolean;
  owner: FeedValidationPolicyOwner;
  message: string;
  remediation: string;
}

export interface FeedValidationPolicyResult {
  policyVersion: typeof HEUREKA_FEED_VALIDATION_POLICY_VERSION;
  resultCode: FeedValidationPolicyResultCode;
  status: FeedValidationPolicyStatus;
  decision: FeedValidationPolicyDecision;
  maxSeverity: FeedValidationPolicySeverity;
  canPersist: boolean;
  canServe: boolean;
  canHandoff: boolean;
  policySnapshotHash: string;
  sourceSnapshotHash?: string;
  feedId?: string;
  feedType: string;
  generatedAt: string;
  blockerCodes: FeedValidationPolicyBlockerCode[];
  findings: FeedValidationPolicyFinding[];
  blockers: FeedValidationPolicyFinding[];
  warnings: FeedValidationPolicyFinding[];
  metrics: {
    shopItemCount: number;
    generationMs: number;
    includedProductCount: number;
    zeroStockExcludedCount: number;
    zeroStockIncludedCount: number;
    failedFetchCount: number;
    eligibleProductCount?: number;
  };
}

interface FindingDefinition {
  severity: FeedValidationPolicySeverity;
  blocking: boolean;
  owner: FeedValidationPolicyOwner;
  message: string;
  remediation: string;
}

export const FEED_VALIDATION_POLICY_FINDINGS: Record<FeedValidationPolicyFindingCode, FindingDefinition> = Object.freeze({
  FEED_TYPE_UNSUPPORTED: {
    severity: 'error',
    blocking: true,
    owner: 'configuration',
    message: 'Feed type is not supported by the Heureka validation policy.',
    remediation: 'Use an approved Heureka feed type and settings record before publication.',
  },
  XML_ENVELOPE_INVALID: {
    severity: 'critical',
    blocking: true,
    owner: 'heureka-service',
    message: 'Feed XML envelope is invalid for Heureka publication.',
    remediation: 'Regenerate XML with the XML declaration, SHOP root element, and closing SHOP element before publication.',
  },
  XML_TEXT_UNESCAPED: {
    severity: 'critical',
    blocking: true,
    owner: 'heureka-service',
    message: 'Feed XML contains unescaped text that can break parsing.',
    remediation: 'Escape feed text fields before serialization and rerun XML validation before publication.',
  },
  PRODUCT_COUNT_MISMATCH: {
    severity: 'error',
    blocking: true,
    owner: 'heureka-service',
    message: 'Policy product count does not match SHOPITEM output.',
    remediation: 'Reconcile included product count evidence with generated SHOPITEM elements.',
  },
  ZERO_STOCK_INCLUDED: {
    severity: 'critical',
    blocking: true,
    owner: 'warehouse-service',
    message: 'Feed eligibility evidence reports zero-stock products in public output.',
    remediation: 'Remove zero-stock products from feed output and regenerate from the current stock snapshot.',
  },
  ZERO_STOCK_EVIDENCE_INVALID: {
    severity: 'error',
    blocking: true,
    owner: 'warehouse-service',
    message: 'Zero-stock exclusion evidence is missing or invalid.',
    remediation: 'Regenerate validation from a catalog and stock snapshot that reports included and excluded product counts.',
  },
  GENERATION_SLA_EXCEEDED: {
    severity: 'error',
    blocking: true,
    owner: 'heureka-service',
    message: 'Feed generation exceeded the 60 second policy SLA.',
    remediation: 'Reduce generation latency or split publication work so the feed completes within 60000 ms.',
  },
  SENSITIVE_FIELD_EXPOSED: {
    severity: 'critical',
    blocking: true,
    owner: 'heureka-service',
    message: 'Feed XML contains a forbidden private or secret field tag.',
    remediation: 'Remove forbidden private field tags from public XML serialization and rerun the sensitive-field scan.',
  },
  PRODUCT_ELIGIBILITY_EVIDENCE_INVALID: {
    severity: 'error',
    blocking: true,
    owner: 'catalog-service',
    message: 'Product eligibility evidence is internally inconsistent.',
    remediation: 'Regenerate product eligibility evidence from the same deterministic snapshot used to build the feed.',
  },
  CATALOG_FETCH_PARTIAL: {
    severity: 'warning',
    blocking: false,
    owner: 'catalog-service',
    message: 'Some upstream product reads failed during feed validation input assembly.',
    remediation: 'Review upstream fetch failures and rerun validation when source availability is restored.',
  },
});

const SUPPORTED_FEED_TYPES = new Set(['heureka_cz', 'heureka_sk']);
const SENSITIVE_FIELD_TAG_PATTERN = /<(?:COST|COST_VAT|MARGIN|PROFIT|SUPPLIER_COST|SUPPLIER_PRICE|WHOLESALE_PRICE|PAYMENT_API_KEY|PAYMENT_TOKEN|INTERNAL_ONLY|CUSTOMER_ID|CUSTOMER_EMAIL|SECRET|TOKEN|PASSWORD)(?:\s[^>]*)?>/i;
const UNESCAPED_AMPERSAND_PATTERN = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/;
const SEVERITY_RANK: Record<FeedValidationPolicySeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };

export function evaluateFeedValidationPolicy(input: FeedValidationPolicyInput): FeedValidationPolicyResult {
  const generatedAt = normalizeDate(input.generatedAt);
  const shopItemCount = countShopItems(input.xml);
  const failedFetchCount = normalizeCount(input.failedFetchCount);
  const zeroStockIncludedCount = normalizeCount(input.zeroStockIncludedCount);
  const includedProductCount = normalizeCount(input.includedProductCount);
  const zeroStockExcludedCount = normalizeCount(input.zeroStockExcludedCount);

  const findings: FeedValidationPolicyFinding[] = [
    finding('FEED_TYPE_UNSUPPORTED', SUPPORTED_FEED_TYPES.has(input.feedType)),
    finding('XML_ENVELOPE_INVALID', hasValidXmlEnvelope(input.xml)),
    finding('XML_TEXT_UNESCAPED', !UNESCAPED_AMPERSAND_PATTERN.test(input.xml || '')),
    finding('PRODUCT_COUNT_MISMATCH', shopItemCount === input.includedProductCount),
    finding('ZERO_STOCK_INCLUDED', zeroStockIncludedCount === 0),
    finding('ZERO_STOCK_EVIDENCE_INVALID', isValidCount(input.zeroStockExcludedCount)),
    finding('GENERATION_SLA_EXCEEDED', Number.isFinite(input.generationMs) && input.generationMs <= HEUREKA_FEED_POLICY_GENERATION_SLA_MS),
    finding('SENSITIVE_FIELD_EXPOSED', !SENSITIVE_FIELD_TAG_PATTERN.test(input.xml || '')),
    finding('PRODUCT_ELIGIBILITY_EVIDENCE_INVALID', hasConsistentEligibilityEvidence(input)),
    finding('CATALOG_FETCH_PARTIAL', failedFetchCount === 0),
  ];

  const blockers = findings.filter((item) => !item.passed && item.blocking);
  const warnings = findings.filter((item) => !item.passed && !item.blocking);
  const blockerCodes = blockers.map((item) => item.code as FeedValidationPolicyBlockerCode);
  const status: FeedValidationPolicyStatus = blockers.length ? 'blocked' : warnings.length ? 'warning' : 'valid';
  const resultCode: FeedValidationPolicyResultCode = status === 'blocked' ? 'HEUREKA_FEED_BLOCKED' : status === 'warning' ? 'HEUREKA_FEED_VALID_WITH_WARNINGS' : 'HEUREKA_FEED_VALID';

  return {
    policyVersion: HEUREKA_FEED_VALIDATION_POLICY_VERSION,
    resultCode,
    status,
    decision: blockers.length ? 'reject' : 'persist_and_expose',
    maxSeverity: getMaxSeverity(findings.filter((item) => !item.passed)),
    canPersist: status !== 'blocked',
    canServe: status !== 'blocked',
    canHandoff: status !== 'blocked',
    policySnapshotHash: hashPolicyInput(input, generatedAt, shopItemCount),
    sourceSnapshotHash: input.sourceSnapshotHash,
    feedId: input.feedId,
    feedType: input.feedType,
    generatedAt,
    blockerCodes,
    findings,
    blockers,
    warnings,
    metrics: {
      shopItemCount,
      generationMs: input.generationMs,
      includedProductCount,
      zeroStockExcludedCount,
      zeroStockIncludedCount,
      failedFetchCount,
      eligibleProductCount: input.eligibleProductCount,
    },
  };
}

function finding(code: FeedValidationPolicyFindingCode, passed: boolean): FeedValidationPolicyFinding {
  const definition = FEED_VALIDATION_POLICY_FINDINGS[code];
  return { code, passed, ...definition };
}

function getMaxSeverity(findings: FeedValidationPolicyFinding[]): FeedValidationPolicySeverity {
  return findings.reduce<FeedValidationPolicySeverity>((maxSeverity, finding) => {
    return SEVERITY_RANK[finding.severity] > SEVERITY_RANK[maxSeverity] ? finding.severity : maxSeverity;
  }, 'info');
}

function hasValidXmlEnvelope(xml: string): boolean {
  const trimmed = (xml || '').trim();
  return trimmed.startsWith('<?xml') && /<SHOP(?:\s[^>]*)?>/.test(trimmed) && /<\/SHOP>\s*$/.test(trimmed);
}

function countShopItems(xml: string): number {
  return (xml.match(/<SHOPITEM(?:\s[^>]*)?>/g) || []).length;
}

function hasConsistentEligibilityEvidence(input: FeedValidationPolicyInput): boolean {
  if (!isValidCount(input.includedProductCount) || !isValidCount(input.failedFetchCount || 0) || !isValidCount(input.zeroStockIncludedCount || 0)) return false;
  if (typeof input.eligibleProductCount === 'number' && (!isValidCount(input.eligibleProductCount) || input.includedProductCount > input.eligibleProductCount)) return false;
  return true;
}

function isValidCount(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.floor(value) === value;
}

function normalizeCount(value: number | undefined): number {
  return isValidCount(value) ? Number(value) : 0;
}

function normalizeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : 'invalid-date';
}

function hashPolicyInput(input: FeedValidationPolicyInput, generatedAt: string, shopItemCount: number): string {
  const stablePayload = JSON.stringify({
    feedType: input.feedType,
    xml: input.xml,
    generatedAt,
    generationMs: input.generationMs,
    includedProductCount: input.includedProductCount,
    zeroStockExcludedCount: input.zeroStockExcludedCount,
    zeroStockIncludedCount: input.zeroStockIncludedCount || 0,
    failedFetchCount: input.failedFetchCount || 0,
    eligibleProductCount: input.eligibleProductCount,
    sourceSnapshotHash: input.sourceSnapshotHash,
    shopItemCount,
  });
  return `fnv1a:${fnv1a(stablePayload)}`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
