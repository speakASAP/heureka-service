# Plan: heureka-service
> Coordinator-managed. Reflects current execution cycle. Planning must maximize safe parallel execution across separate sessions and agents while preserving IPS traceability.

## Active plan

Coordinator review on 2026-06-14 found the planned parallel contract lanes have been processed for documentation scope. `TASK-004` through `TASK-008` now have draft artifacts and validation evidence, but none is approved for runtime implementation. The next goals are review and integration gates, not additional uncoordinated coding.


## Published Runtime Contracts

| Source task | Contract | Published shape | Downstream consumers |
|---|---|---|---|
| TASK-002 | Governed feed lifecycle/status | `GET /feed/status?type=heureka_cz` returns `{ success, data }` with `feedType`, `status`, `latestFeedId`, `feedUrl`, `productCount`, `generatedAt`, `feedAgeSeconds`, `reason`, and `latestValidation`. XML feed responses expose `X-Heureka-Feed-Status`, `X-Heureka-Feed-Generation-Ms`, and `X-Heureka-Feed-Snapshot-Hash`. Statuses are `valid`, `invalid`, `stale`, `generating`, `failed`, and `missing`. Policy decisions are `persist_and_expose` and `block_publication`. | TASK-004, TASK-007, TASK-008 |

## Processed Planning Lanes

| Task | Current state | Evidence | Remaining gate |
|---|---|---|---|
| TASK-004 catalog feed readiness action | Contract-ready, runtime-blocked | `23_documentation_contracts/CATALOG_FEED_READINESS_CONTRACT.md`, `12_validation/VAL-TASK-004.md` | Approve execution plan and assign ownership for `feed.controller.ts`, `feed.service.ts`, and any catalog/readiness endpoint work. |
| TASK-005 AI feed optimization contract | Contract-defined, runtime-blocked | `23_documentation_contracts/AI_FEED_OPTIMIZATION_CONTRACT.md`, `12_validation/VAL-TASK-005.md` | Human review must approve any AI-influenced mutation path; schema/storage ownership must be assigned before coding. |
| TASK-006 stock/order/profit feedback loop | Boundary-prepared, external-contract-blocked | `16_operations/INTEGRATIONS.md`, `12_validation/VAL-TASK-006.md` | Warehouse, flipflop, orders, payments, and supplier owners must approve read-only contracts with redaction/replay rules. |
| TASK-007 growth analytics and demand loops | Event-taxonomy drafted, runtime-blocked | `23_documentation_contracts/TASK-007_EVENT_TAXONOMY.md`, `12_validation/VAL-TASK-007.md` | Reconcile final names after TASK-002/TASK-003/TASK-004 review; add contract tests before emission or marketing/leads writes. |
| TASK-008 operations trust and scale | Operations evidence drafted, runtime-blocked | `16_operations/OPS-TASK-008-operations-trust-and-scale.md`, `12_validation/VAL-TASK-008.md` | Approve probe cadence, rollback procedure, synthetic scale dataset sizes, and implementation prompt before runtime probes. |

## Next Goal Queue

| Order | Goal | Owner role | Parallel status | Allowed files | Forbidden files | Validation evidence | Handoff notes |
|---|---|---|---|---|---|---|---|
| 1 | Review and approve or reject `TASK-004` readiness implementation scope. | Integration owner plus Project Owner | Ready now | `21_execution_plans/EP-TASK-004-design-catalog-feed-readiness-action.md`, `23_documentation_contracts/CATALOG_FEED_READINESS_CONTRACT.md`, `12_validation/VAL-TASK-004.md` | `.env`, Kubernetes manifests, unrelated services, runtime files until ownership is assigned | Strict doc audit, pre-coding gate, deployment-readiness gate for TASK-004 | Decide whether the next implementation is endpoint-only, contract-only, or deferred. |
| 2 | Review `TASK-005` AI suggestion contract for human-review and storage boundaries. | AI/data-safety reviewer | Ready now and independent of TASK-004 runtime coding | `23_documentation_contracts/AI_FEED_OPTIMIZATION_CONTRACT.md`, `21_execution_plans/EP-TASK-005-define-ai-feed-optimization-contract.md`, `12_validation/VAL-TASK-005.md` | Public XML mutation paths, schemas, runtime services, production prompts | Contract marker checks plus gate rerun for TASK-005 | Keep AI output advisory only unless a later owner-approved prompt names schema and review-state files. |
| 3 | Resolve `TASK-006` external read-only contract blockers. | External service owners | Ready for review, dependency-gated for implementation | `16_operations/INTEGRATIONS.md`, `21_execution_plans/EP-TASK-006-plan-stock-order-profit-feedback-loop.md`, `12_validation/VAL-TASK-006.md` | Public XML, order/payment/supplier raw data, secrets, runtime code | Owner-approved synthetic examples, replay keys, redaction checks | No runtime implementation until every required source contract is approved or explicitly deferred. |
| 4 | Reconcile `TASK-007` event taxonomy with final readiness and policy vocabularies. | Analytics contract owner | Dependency-gated on TASK-004 vocabulary review | `23_documentation_contracts/TASK-007_EVENT_TAXONOMY.md`, `12_validation/VAL-TASK-007.md` | Marketing writes, leads writes, runtime event emission, raw PII/order data | Contract tests for forbidden fields, idempotency, and snapshot-hash replay | Keep event names provisional until upstream contract names are approved. |
| 5 | Convert `TASK-008` operations evidence into an implementation prompt. | Operations/integration owner | Dependency-gated on approved cadence and rollback procedure | `16_operations/OPS-TASK-008-operations-trust-and-scale.md`, `21_execution_plans/EP-TASK-008-plan-operations-trust-and-scale.md`, `12_validation/VAL-TASK-008.md` | Kubernetes, deployment scripts, secrets, runtime probes until prompt approval | Smoke checklist, alert payload fixture scan, scale timing evidence | Exact rollback command, public target URL, cadence, and synthetic dataset sizes are still missing. |

## Parallel Execution Section

- Ready now: `TASK-004` review, `TASK-005` AI/data-safety review, and `TASK-006` external contract review can run in parallel because they do not require edits to the same runtime files.
- Dependency-gated: `TASK-007` taxonomy finalization waits for approved TASK-004 readiness vocabulary and TASK-006 aggregate outcome decisions.
- Dependency-gated: `TASK-008` runtime probe implementation waits for approved public target URL, cadence, rollback procedure, and synthetic scale dataset sizes.
- Final integration: one integration owner must serialize edits to `services/heureka-service/src/heureka/feed/feed.controller.ts`, `services/heureka-service/src/heureka/feed/feed.service.ts`, `prisma/schema.prisma`, and shared status/validation report files.
- Merge order: TASK-004 readiness implementation first, TASK-005 storage/review-state only after human approval, TASK-007 event emission after vocabulary reconciliation, TASK-008 probes after runtime/status contracts are stable, TASK-006 feedback loop last unless external contracts arrive earlier.

## Current Blockers

- No active human-managed goal is listed in `GOALS.md`; agents must not edit that file.
- All execution plans for `TASK-004` through `TASK-008` remain `status: draft`; draft plans are not approval to code runtime behavior.
- Shared runtime files remain conflict points for future endpoint work: `services/heureka-service/src/heureka/feed/feed.service.ts`, `services/heureka-service/src/heureka/feed/feed.controller.ts`, and `prisma/schema.prisma`.
- External-service integrations are blocked until read-only ownership boundaries and data-safety rules are explicit.
- TASK-008 still has `[MISSING: ...]` and `[UNKNOWN: ...]` markers for rollback command, public target URL, cadence, synthetic dataset sizes, and submission evidence contract.

## Scope

The next cycle is review and integration preparation. Runtime changes must wait for approved execution plans, named file ownership, synthetic tests, and validation evidence that preserves TASK-002 lifecycle behavior and TASK-003 policy vocabulary.

## Last completed

TASK-003 feed validation policy engine.
