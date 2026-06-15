import { summarizeFeedStatus, validateHeurekaFeed } from './feed-lifecycle';

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const generatedAt = new Date('2026-06-13T10:00:00.000Z');
const validXml = `<?xml version="1.0" encoding="UTF-8"?>\n<SHOP>\n  <SHOPITEM>\n    <ITEM_ID>p1</ITEM_ID>\n    <PRODUCTNAME>Valid &amp; Escaped</PRODUCTNAME>\n    <PRICE_VAT>100</PRICE_VAT>\n  </SHOPITEM>\n</SHOP>`;
const valid = validateHeurekaFeed({ feedId: 'feed-1', feedType: 'heureka_cz', xml: validXml, generatedAt, generationMs: 140, includedProductCount: 1, zeroStockExcludedCount: 2, failedFetchCount: 0 });
assertEqual(valid.status, 'valid');
assertEqual(valid.checks.validXmlEnvelope, true);
assertEqual(valid.checks.zeroStockExcluded, true);
assertEqual(valid.snapshotHash, validateHeurekaFeed({ feedId: 'feed-2', feedType: 'heureka_cz', xml: validXml, generatedAt: new Date('2026-06-13T11:00:00.000Z'), generationMs: 999, includedProductCount: 1, zeroStockExcludedCount: 2, failedFetchCount: 0 }).snapshotHash);
assertEqual(valid.idempotencyKey, `heureka_cz:${valid.snapshotHash}`);
assertEqual(valid.policy.policyVersion, 'heureka-feed-validation-policy.v1');
assertEqual(valid.policy.decision, 'persist_and_expose');
assertEqual(valid.policy.blockers.length, 0);
const invalidAmpersand = validateHeurekaFeed({ feedType: 'heureka_cz', xml: validXml.replace('&amp;', '&'), generatedAt, generationMs: 140, includedProductCount: 1, zeroStockExcludedCount: 0, failedFetchCount: 0 });
assertEqual(invalidAmpersand.status, 'invalid');
assertEqual(invalidAmpersand.checks.escapedXmlText, false);
assertEqual(invalidAmpersand.policy.blockers[0].code, 'XML_TEXT_UNESCAPED');
const productCountMismatch = validateHeurekaFeed({ feedType: 'heureka_cz', xml: validXml, generatedAt, generationMs: 140, includedProductCount: 2, zeroStockExcludedCount: 0, failedFetchCount: 0 });
assertEqual(productCountMismatch.status, 'invalid');
assertEqual(productCountMismatch.policy.blockers[0].code, 'PRODUCT_COUNT_MISMATCH');
const zeroStockIncluded = validateHeurekaFeed({ feedType: 'heureka_cz', xml: validXml, generatedAt, generationMs: 140, includedProductCount: 1, zeroStockExcludedCount: 0, zeroStockIncludedCount: 1, failedFetchCount: 0 });
assertEqual(zeroStockIncluded.status, 'invalid');
assertEqual(zeroStockIncluded.policy.blockers[0].code, 'ZERO_STOCK_INCLUDED');
const slow = validateHeurekaFeed({ feedType: 'heureka_cz', xml: validXml, generatedAt, generationMs: 60_001, includedProductCount: 1, zeroStockExcludedCount: 0, failedFetchCount: 0 });
assertEqual(slow.status, 'invalid');
assertEqual(slow.checks.generationWithinSla, false);
const sensitive = validateHeurekaFeed({ feedType: 'heureka_cz', xml: validXml.replace('</SHOPITEM>', '<SUPPLIER_COST>10</SUPPLIER_COST></SHOPITEM>'), generatedAt, generationMs: 140, includedProductCount: 1, zeroStockExcludedCount: 0, failedFetchCount: 0 });
assertEqual(sensitive.status, 'invalid');
assertEqual(sensitive.checks.sensitiveFieldsExcluded, false);
const partialCatalog = validateHeurekaFeed({ feedType: 'heureka_cz', xml: validXml, generatedAt, generationMs: 140, includedProductCount: 1, zeroStockExcludedCount: 0, failedFetchCount: 1 });
assertEqual(partialCatalog.status, 'valid');
assertEqual(partialCatalog.policy.warnings[0].code, 'CATALOG_FETCH_PARTIAL');
const replay = validateHeurekaFeed({ feedId: 'feed-1', feedType: 'heureka_cz', xml: validXml, generatedAt, generationMs: 140, includedProductCount: 1, zeroStockExcludedCount: 2, failedFetchCount: 0 });
assertEqual(replay.policy.snapshotHash, valid.policy.snapshotHash);
const fresh = summarizeFeedStatus('heureka_cz', { id: 'feed-1', status: 'completed', feedUrl: 'https://example.test/feed.xml', productCount: 1, generatedAt }, valid, new Date('2026-06-13T10:10:00.000Z'));
assertEqual(fresh.status, 'valid');
assertEqual(fresh.feedAgeSeconds, 600);
const stale = summarizeFeedStatus('heureka_cz', { id: 'feed-1', status: 'completed', feedUrl: 'https://example.test/feed.xml', productCount: 1, generatedAt }, valid, new Date('2026-06-13T12:00:01.000Z'));
assertEqual(stale.status, 'stale');
console.log('PASS feed-lifecycle self-test');
