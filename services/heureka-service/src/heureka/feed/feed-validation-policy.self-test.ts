import { evaluateFeedValidationPolicy, HEUREKA_FEED_VALIDATION_POLICY_VERSION } from './feed-validation-policy';

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

const generatedAt = new Date('2026-06-13T10:00:00.000Z');
const validXml = `<?xml version="1.0" encoding="UTF-8"?>\n<SHOP>\n  <SHOPITEM>\n    <ITEM_ID>synthetic-product-1</ITEM_ID>\n    <PRODUCTNAME>Synthetic Lamp &amp; Shade</PRODUCTNAME>\n    <PRICE_VAT>100</PRICE_VAT>\n  </SHOPITEM>\n</SHOP>`;

const valid = evaluateFeedValidationPolicy({
  feedType: 'heureka_cz',
  xml: validXml,
  generatedAt,
  generationMs: 140,
  includedProductCount: 1,
  zeroStockExcludedCount: 2,
  failedFetchCount: 0,
  zeroStockIncludedCount: 0,
  eligibleProductCount: 1,
  feedId: 'feed-synthetic-1',
  sourceSnapshotHash: 'sha256:synthetic-feed-snapshot',
});
assertEqual(valid.policyVersion, HEUREKA_FEED_VALIDATION_POLICY_VERSION);
assertEqual(valid.resultCode, 'HEUREKA_FEED_VALID');
assertEqual(valid.status, 'valid');
assertEqual(valid.canServe, true);
assertEqual(valid.blockerCodes.length, 0);

const warning = evaluateFeedValidationPolicy({
  feedType: 'heureka_cz',
  xml: validXml,
  generatedAt: generatedAt.toISOString(),
  generationMs: 140,
  includedProductCount: 1,
  zeroStockExcludedCount: 2,
  failedFetchCount: 1,
  zeroStockIncludedCount: 0,
  eligibleProductCount: 1,
});
assertEqual(warning.resultCode, 'HEUREKA_FEED_VALID_WITH_WARNINGS');
assertEqual(warning.canHandoff, true);
assertIncludes(warning.warnings.map((finding) => finding.code), 'CATALOG_FETCH_PARTIAL');

const blockedInput = {
  feedType: 'heureka_cz',
  xml: validXml.replace('&amp;', '&').replace('</SHOPITEM>', '<INTERNAL_ONLY></INTERNAL_ONLY></SHOPITEM>'),
  generatedAt,
  generationMs: 60_001,
  includedProductCount: 2,
  zeroStockExcludedCount: 0,
  failedFetchCount: 0,
  zeroStockIncludedCount: 1,
  eligibleProductCount: 1,
};
const blocked = evaluateFeedValidationPolicy(blockedInput);
assertEqual(blocked.resultCode, 'HEUREKA_FEED_BLOCKED');
assertEqual(blocked.status, 'blocked');
assertEqual(blocked.maxSeverity, 'critical');
assertEqual(blocked.canPersist, false);
assertIncludes(blocked.blockerCodes, 'XML_TEXT_UNESCAPED');
assertIncludes(blocked.blockerCodes, 'SENSITIVE_FIELD_EXPOSED');
assertIncludes(blocked.blockerCodes, 'ZERO_STOCK_INCLUDED');
assertIncludes(blocked.blockerCodes, 'GENERATION_SLA_EXCEEDED');
assertIncludes(blocked.blockerCodes, 'PRODUCT_ELIGIBILITY_EVIDENCE_INVALID');

const repeated = evaluateFeedValidationPolicy(blockedInput);
assertEqual(JSON.stringify(blocked), JSON.stringify(repeated));
assertEqual(blocked.policySnapshotHash, repeated.policySnapshotHash);

console.log('PASS feed-validation-policy self-test');
