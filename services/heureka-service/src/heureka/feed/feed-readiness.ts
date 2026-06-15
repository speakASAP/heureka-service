export const CATALOG_FEED_READINESS_CONTRACT_VERSION = 'catalog-feed-readiness.v1';

export type CatalogFeedReadinessState = 'ready' | 'warning' | 'blocked' | 'unknown';
export type CatalogFeedReadinessSeverity = 'warning' | 'blocker';
export type CatalogFeedReadinessOwnerService =
  | 'catalog-service'
  | 'catalog-media-service'
  | 'catalog-pricing-service'
  | 'warehouse-service'
  | 'heureka-service'
  | 'source-owner';

export type CatalogFeedReadinessBlockerCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'MISSING_PRODUCT_NAME'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_CATEGORY'
  | 'MISSING_PRIMARY_IMAGE'
  | 'INVALID_IMAGE_URL'
  | 'PRICE_MISSING'
  | 'PRICE_NOT_POSITIVE'
  | 'ZERO_STOCK'
  | 'STOCK_UNKNOWN'
  | 'SETTINGS_INACTIVE'
  | 'XML_RENDER_INVALID'
  | 'SENSITIVE_FIELD_EXPOSURE'
  | 'GENERATION_SLA_RISK';

export interface CatalogFeedReadinessBlocker {
  code: CatalogFeedReadinessBlockerCode;
  severity: CatalogFeedReadinessSeverity;
  ownerService: CatalogFeedReadinessOwnerService;
  publicReason: string;
  remediationHint: string;
}

export interface CatalogFeedReadinessSnapshot {
  productId: string;
  productFound: boolean;
  productActive?: boolean;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  primaryImageUrl?: string | null;
  priceVat?: number | string | null;
  availableStock?: number | null;
  settingsActive?: boolean;
  renderableXml?: boolean;
  candidateFeedFields?: string[];
  generationEstimateMs?: number;
}

export interface CatalogFeedReadinessItem {
  productId: string;
  readiness: CatalogFeedReadinessState;
  blockers: CatalogFeedReadinessBlocker[];
  feedEligibility: {
    includedInDryRun: boolean;
    willMutateCatalog: false;
    willPublishFeed: false;
  };
}

export interface CatalogFeedReadinessResponse {
  contractVersion: typeof CATALOG_FEED_READINESS_CONTRACT_VERSION;
  feedType: string;
  snapshotHash: string;
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    blocked: number;
    warning: number;
    unknown: number;
  };
  items: CatalogFeedReadinessItem[];
}

const MAX_READINESS_BATCH_SIZE = 100;
const GENERATION_SLA_WARNING_MS = 60_000;
const SENSITIVE_FIELD_PATTERN = /(?:COST|MARGIN|PROFIT|SUPPLIER|WHOLESALE|PAYMENT_API_KEY|API_KEY|SECRET|TOKEN|PASSWORD|CUSTOMER)/i;

const BLOCKERS: Record<CatalogFeedReadinessBlockerCode, CatalogFeedReadinessBlocker> = Object.freeze({
  PRODUCT_NOT_FOUND: {
    code: 'PRODUCT_NOT_FOUND',
    severity: 'blocker',
    ownerService: 'catalog-service',
    publicReason: 'Catalog product was not found for the requested id.',
    remediationHint: 'Confirm the product exists and retry readiness with the catalog id.',
  },
  PRODUCT_INACTIVE: {
    code: 'PRODUCT_INACTIVE',
    severity: 'blocker',
    ownerService: 'catalog-service',
    publicReason: 'Product is not active for marketplace publication.',
    remediationHint: 'Activate the product in catalog when it is approved for public sale.',
  },
  MISSING_PRODUCT_NAME: {
    code: 'MISSING_PRODUCT_NAME',
    severity: 'blocker',
    ownerService: 'catalog-service',
    publicReason: 'Product has no public name for XML output.',
    remediationHint: 'Add a public product name in catalog.',
  },
  MISSING_DESCRIPTION: {
    code: 'MISSING_DESCRIPTION',
    severity: 'warning',
    ownerService: 'catalog-service',
    publicReason: 'Product has no public description.',
    remediationHint: 'Add a public-safe product description in catalog.',
  },
  MISSING_CATEGORY: {
    code: 'MISSING_CATEGORY',
    severity: 'blocker',
    ownerService: 'catalog-service',
    publicReason: 'Product has no public Heureka category text.',
    remediationHint: 'Map the product to a public category path in catalog.',
  },
  MISSING_PRIMARY_IMAGE: {
    code: 'MISSING_PRIMARY_IMAGE',
    severity: 'blocker',
    ownerService: 'catalog-media-service',
    publicReason: 'Product has no public primary image URL.',
    remediationHint: 'Attach a public primary image in catalog media.',
  },
  INVALID_IMAGE_URL: {
    code: 'INVALID_IMAGE_URL',
    severity: 'blocker',
    ownerService: 'catalog-media-service',
    publicReason: 'Product image URL is not usable in public XML.',
    remediationHint: 'Replace the image URL with a public HTTPS URL.',
  },
  PRICE_MISSING: {
    code: 'PRICE_MISSING',
    severity: 'blocker',
    ownerService: 'catalog-pricing-service',
    publicReason: 'Product has no public price.',
    remediationHint: 'Publish a current public VAT-inclusive price.',
  },
  PRICE_NOT_POSITIVE: {
    code: 'PRICE_NOT_POSITIVE',
    severity: 'blocker',
    ownerService: 'catalog-pricing-service',
    publicReason: 'Product price is zero or negative.',
    remediationHint: 'Correct the public selling price before feed inclusion.',
  },
  ZERO_STOCK: {
    code: 'ZERO_STOCK',
    severity: 'blocker',
    ownerService: 'warehouse-service',
    publicReason: 'Product has no available stock.',
    remediationHint: 'Replenish stock or keep the product excluded from the feed.',
  },
  STOCK_UNKNOWN: {
    code: 'STOCK_UNKNOWN',
    severity: 'blocker',
    ownerService: 'warehouse-service',
    publicReason: 'Available stock could not be determined.',
    remediationHint: 'Restore warehouse stock lookup or replay readiness with a complete snapshot.',
  },
  SETTINGS_INACTIVE: {
    code: 'SETTINGS_INACTIVE',
    severity: 'blocker',
    ownerService: 'heureka-service',
    publicReason: 'Feed settings are missing or inactive.',
    remediationHint: 'Activate the feed settings before running readiness.',
  },
  XML_RENDER_INVALID: {
    code: 'XML_RENDER_INVALID',
    severity: 'blocker',
    ownerService: 'heureka-service',
    publicReason: 'Product data would render invalid feed XML.',
    remediationHint: 'Fix the source public fields identified by validation and replay readiness.',
  },
  SENSITIVE_FIELD_EXPOSURE: {
    code: 'SENSITIVE_FIELD_EXPOSURE',
    severity: 'blocker',
    ownerService: 'source-owner',
    publicReason: 'Candidate feed data includes a non-public field.',
    remediationHint: 'Remove internal cost, margin, supplier-private, customer, or secret values from the source contract before feed use.',
  },
  GENERATION_SLA_RISK: {
    code: 'GENERATION_SLA_RISK',
    severity: 'warning',
    ownerService: 'heureka-service',
    publicReason: 'Synthetic dry-run indicates feed generation may exceed the 60 second SLA.',
    remediationHint: 'Reduce batch size, improve upstream latency, or run performance validation before release.',
  },
});

export function evaluateCatalogFeedReadiness(snapshot: CatalogFeedReadinessSnapshot): CatalogFeedReadinessItem {
  const blockers: CatalogFeedReadinessBlocker[] = [];

  if (!snapshot.productFound) {
    blockers.push(BLOCKERS.PRODUCT_NOT_FOUND);
    return buildItem(snapshot.productId, blockers, 'unknown');
  }

  if (snapshot.productActive === false) blockers.push(BLOCKERS.PRODUCT_INACTIVE);
  if (!hasText(snapshot.name)) blockers.push(BLOCKERS.MISSING_PRODUCT_NAME);
  if (!hasText(snapshot.description)) blockers.push(BLOCKERS.MISSING_DESCRIPTION);
  if (!hasText(snapshot.category)) blockers.push(BLOCKERS.MISSING_CATEGORY);
  if (!hasText(snapshot.primaryImageUrl)) blockers.push(BLOCKERS.MISSING_PRIMARY_IMAGE);
  if (hasText(snapshot.primaryImageUrl) && !isPublicHttpsUrl(String(snapshot.primaryImageUrl))) blockers.push(BLOCKERS.INVALID_IMAGE_URL);
  if (snapshot.priceVat === undefined || snapshot.priceVat === null || snapshot.priceVat === '') blockers.push(BLOCKERS.PRICE_MISSING);
  if (snapshot.priceVat !== undefined && snapshot.priceVat !== null && snapshot.priceVat !== '' && Number(snapshot.priceVat) <= 0) blockers.push(BLOCKERS.PRICE_NOT_POSITIVE);
  if (snapshot.availableStock === undefined || snapshot.availableStock === null || !Number.isFinite(Number(snapshot.availableStock))) blockers.push(BLOCKERS.STOCK_UNKNOWN);
  if (Number.isFinite(Number(snapshot.availableStock)) && Number(snapshot.availableStock) <= 0) blockers.push(BLOCKERS.ZERO_STOCK);
  if (snapshot.settingsActive === false) blockers.push(BLOCKERS.SETTINGS_INACTIVE);
  if (snapshot.renderableXml === false) blockers.push(BLOCKERS.XML_RENDER_INVALID);
  if ((snapshot.candidateFeedFields || []).some((field) => SENSITIVE_FIELD_PATTERN.test(field))) blockers.push(BLOCKERS.SENSITIVE_FIELD_EXPOSURE);
  if (Number(snapshot.generationEstimateMs || 0) > GENERATION_SLA_WARNING_MS) blockers.push(BLOCKERS.GENERATION_SLA_RISK);

  return buildItem(snapshot.productId, blockers);
}

export function buildCatalogFeedReadinessResponse(feedType: string, snapshots: CatalogFeedReadinessSnapshot[], generatedAt: Date = new Date()): CatalogFeedReadinessResponse {
  if (snapshots.length > MAX_READINESS_BATCH_SIZE) {
    throw new Error(`Catalog feed readiness supports at most ${MAX_READINESS_BATCH_SIZE} products per request.`);
  }

  const items = snapshots.map(evaluateCatalogFeedReadiness);
  const summary = items.reduce((acc, item) => {
    acc[item.readiness] += 1;
    acc.total += 1;
    return acc;
  }, { total: 0, ready: 0, blocked: 0, warning: 0, unknown: 0 });

  return {
    contractVersion: CATALOG_FEED_READINESS_CONTRACT_VERSION,
    feedType,
    snapshotHash: buildReadinessHash(feedType, snapshots, items),
    generatedAt: generatedAt.toISOString(),
    summary,
    items,
  };
}

function buildItem(productId: string, blockers: CatalogFeedReadinessBlocker[], forcedState?: CatalogFeedReadinessState): CatalogFeedReadinessItem {
  const hasBlockingIssue = blockers.some((blocker) => blocker.severity === 'blocker');
  const hasWarning = blockers.some((blocker) => blocker.severity === 'warning');
  const readiness = forcedState || (hasBlockingIssue ? 'blocked' : hasWarning ? 'warning' : 'ready');
  return {
    productId,
    readiness,
    blockers,
    feedEligibility: {
      includedInDryRun: readiness === 'ready' || readiness === 'warning',
      willMutateCatalog: false,
      willPublishFeed: false,
    },
  };
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function buildReadinessHash(feedType: string, snapshots: CatalogFeedReadinessSnapshot[], items: CatalogFeedReadinessItem[]): string {
  const stablePayload = JSON.stringify({
    feedType,
    snapshots: snapshots.map((snapshot) => ({
      productId: snapshot.productId,
      productFound: snapshot.productFound,
      productActive: snapshot.productActive,
      name: snapshot.name || '',
      description: snapshot.description || '',
      category: snapshot.category || '',
      primaryImageUrl: snapshot.primaryImageUrl || '',
      priceVat: snapshot.priceVat === undefined || snapshot.priceVat === null ? '' : String(snapshot.priceVat),
      availableStock: snapshot.availableStock === undefined || snapshot.availableStock === null ? null : Number(snapshot.availableStock),
      settingsActive: snapshot.settingsActive,
      renderableXml: snapshot.renderableXml,
      candidateFeedFields: [...(snapshot.candidateFeedFields || [])].sort(),
      generationEstimateMs: snapshot.generationEstimateMs || 0,
    })),
    results: items.map((item) => ({ productId: item.productId, readiness: item.readiness, blockerCodes: item.blockers.map((blocker) => blocker.code) })),
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
