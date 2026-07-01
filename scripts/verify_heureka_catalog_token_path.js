#!/usr/bin/env node
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const runtimeMode = process.argv.includes('--runtime');
const requireCatalogSource = process.argv.includes('--require-catalog-source');
const root = process.env.HEUREKA_SOURCE_ROOT || (__dirname === '/' ? process.cwd() : path.resolve(__dirname, '..'));
const catalogRoot = process.env.CATALOG_REPO_ROOT || path.resolve(root, '..', 'catalog-microservice');

function read(base, relativePath) {
  return fs.readFileSync(path.join(base, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function firstPresent(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return { key, length: String(value).length };
  }
  return null;
}

function envPresence(keys) {
  return Object.fromEntries(keys.map((key) => [key, {
    present: Boolean(process.env[key]),
    length: process.env[key] ? String(process.env[key]).length : 0,
  }]));
}

function verifyHeurekaSource() {
  const guard = read(root, 'services/heureka-service/src/heureka/feed/feed-mutation.guard.ts');
  const feedController = read(root, 'services/heureka-service/src/heureka/feed/feed.controller.ts');
  const productsController = read(root, 'services/heureka-service/src/heureka/feed/products.controller.ts');
  const deployment = read(root, 'k8s/deployment.yaml');
  const checklist = read(root, 'docs/orchestrator/TASK-010-channel-parity-checklist.md');

  assert.match(guard, /process\.env\.HEUREKA_INTERNAL_SERVICE_TOKEN/);
  assert.match(guard, /process\.env\.INTERNAL_SERVICE_TOKEN/);
  assert.match(guard, /process\.env\.JWT_TOKEN/);
  assert.match(guard, /request\.headers\['x-internal-service-token'\]/);
  assert.match(guard, /request\.headers\['x-service-name'\]/);
  assert.match(guard, /serviceName === 'catalog-microservice'/);
  assert.match(guard, /serviceName === 'heureka-service'/);
  assert.match(guard, /timingSafeEqual/);

  assert.match(feedController, /@Post\('regenerate'\)[\s\S]*@UseGuards\(HeurekaFeedMutationGuard\)/);
  assert.match(productsController, /@Post\(':productId\/include'\)[\s\S]*@UseGuards\(HeurekaFeedMutationGuard\)/);
  assert.match(productsController, /@Delete\(':productId\/exclude'\)[\s\S]*@UseGuards\(HeurekaFeedMutationGuard\)/);

  assert.match(deployment, /name: HEUREKA_INTERNAL_SERVICE_TOKEN[\s\S]*name: catalog-microservice-secret[\s\S]*key: CATALOG_INTERNAL_SERVICE_TOKEN/);
  assert.ok(checklist.includes('[RESOLVED: Catalog-to-Heureka internal service token source]'), 'TASK-010 checklist must record the resolved token-source decision');
}

function verifyCatalogSource(report) {
  const catalogService = path.join(catalogRoot, 'src/products/products.service.ts');
  const catalogExternalSecret = path.join(catalogRoot, 'k8s/external-secret.yaml');
  if (!fs.existsSync(catalogService) || !fs.existsSync(catalogExternalSecret)) {
    if (requireCatalogSource) {
      report.blockers.push(`[MISSING: Catalog source repo at ${catalogRoot}]`);
    }
    report.catalogSource = { checked: false, root: catalogRoot, reason: 'not available in this workspace' };
    return;
  }

  const service = read(catalogRoot, 'src/products/products.service.ts');
  const externalSecret = read(catalogRoot, 'k8s/external-secret.yaml');
  assert.match(service, /process\.env\.HEUREKA_INTERNAL_SERVICE_TOKEN/);
  assert.match(service, /process\.env\.HEUREKA_SERVICE_TOKEN/);
  assert.match(service, /process\.env\.INTERNAL_SERVICE_TOKEN/);
  assert.match(service, /process\.env\.CATALOG_INTERNAL_SERVICE_TOKEN/);
  assert.match(service, /'x-internal-service-token': token/);
  assert.match(service, /'x-service-name': 'catalog-microservice'/);
  assert.match(service, /\/heureka\/products\/\$\{encodeURIComponent\(id\)\}\/include/);
  assert.match(externalSecret, /secretKey: CATALOG_INTERNAL_SERVICE_TOKEN[\s\S]*key: secret\/prod\/auth-microservice[\s\S]*property: CATALOG_INTERNAL_SERVICE_TOKEN/);
  report.catalogSource = { checked: true, root: catalogRoot };
}

const report = {
  contractVersion: 'heureka-catalog-token-path.v1',
  readOnly: true,
  mode: runtimeMode ? 'runtime' : 'source',
  mutations: [],
  blockers: [],
  source: {
    guard: 'HeurekaFeedMutationGuard',
    acceptedServices: ['catalog-microservice', 'heureka-service'],
    acceptedTokenSources: ['HEUREKA_INTERNAL_SERVICE_TOKEN', 'INTERNAL_SERVICE_TOKEN', 'JWT_TOKEN'],
    manifestSource: 'catalog-microservice-secret/CATALOG_INTERNAL_SERVICE_TOKEN',
    catalogSourceRoot: catalogRoot,
  },
};

if (!runtimeMode) {
  verifyHeurekaSource();
  verifyCatalogSource(report);
}

if (runtimeMode) {
  const runtimeKeys = [
    'HEUREKA_INTERNAL_SERVICE_TOKEN',
    'INTERNAL_SERVICE_TOKEN',
    'JWT_TOKEN',
  ];
  const token = firstPresent(runtimeKeys);
  report.runtime = {
    envPresence: envPresence(runtimeKeys),
    resolvedHeurekaTokenSource: token?.key || null,
  };
  if (!token) report.blockers.push('[MISSING: Heureka internal service token runtime env]');
}

if (report.blockers.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
