# EP-TASK-004: Design Catalog Feed Readiness Action

```yaml
id: EP-TASK-004
status: draft
source_task: ../11_tasks/TASK-004-design-catalog-feed-readiness-action.md
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
vision:
  - ../01_vision/VISION.md
constitution:
  - ../00_constitution/CONSTITUTION.md
feature:
  - ../10_features/FEAT-004-catalog-feed-readiness-action.md
goal_impact:
  - ../22_goal_impact/GOAL-IMPACT-TASK-004.md
```

## Metadata

Draft execution plan for `TASK-004`. This plan is not approval to change runtime behavior until reviewed.

## Upstream Traceability

Vision `../01_vision/VISION.md`, business case `../02_business_case/BUSINESS_CASE.md`, roadmap `../08_roadmap/ROADMAP.md`, feature `../10_features/FEAT-004-catalog-feed-readiness-action.md`, task `../11_tasks/TASK-004-design-catalog-feed-readiness-action.md`, goal impact `../22_goal_impact/GOAL-IMPACT-TASK-004.md`.

## Goal Impact

Design the catalog-facing dry-run/readiness contract that explains why products can or cannot enter the Heureka feed.

## Project Invariants

Preserve INV-001 valid XML, INV-002 zero-stock exclusion, INV-003 sub-60-second generation, INV-004 public data safety, and INV-005 secret handling.

## Sensitive-Data Handling

Classification: synthetic. Prompts, examples, tests, logs, screenshots, and reports must avoid secrets, raw production data, customer identifiers, internal cost, margin, and supplier private values.

## Contract Validation Plan

Create or update contracts only when explicitly listed in a later coding plan. Contract examples must be synthetic and versioned.

## Replay/Determinism Plan

Deterministic validation and readiness outputs must be reproducible for a fixed input snapshot. Idempotency keys or snapshot hashes are required for lifecycle/status/event implementation.

## Scope

Single-product and bulk readiness, missing fields, category/media/price/stock blockers, owner service, and remediation hints.

## Non-Goals

No direct product editing in catalog, no automatic feed inclusion, no runtime write to external services.

## Parallel Goal Decomposition

This plan can start in parallel as a contract/readiness lane while TASK-002 and TASK-003 stabilize runtime and policy details.

- Contract lane: request/response shape for single-product and bulk readiness.
- Blocker mapping lane: missing field, category, media, price, and stock blockers mapped to owner service and remediation.
- Runtime endpoint lane: waits for policy vocabulary and shared file ownership.

## Parallel Execution Matrix

| Goal | Can start in parallel | Depends on | Blocks | Primary files | Agent handoff |
|---|---|---|---|---|---|
| Readiness contract | Yes | Catalog boundary and invariants | Catalog/client integration | Contract docs/tests | Define synthetic examples and no catalog mutation authority. |
| Blocker mapping | Yes | TASK-003 vocabulary draft | TASK-007 analytics payloads | Validation examples | Map every blocker to owner service, remediation hint, and public-safe reason. |
| Runtime endpoint | Conditional | TASK-002/TASK-003 interfaces | Completion | Controller/service files | Add endpoint only after policy vocabulary and file ownership are coordinated. |

## Blockers And Coordination

- Runtime work is blocked until TASK-003 policy result vocabulary is stable enough for readiness blockers.
- Heureka must not become catalog owner or perform product edits.
- Shared controller/service edits must be coordinated with TASK-002 and TASK-003 agents.

## Files to Inspect

- `../08_roadmap/ROADMAP.md`
- `../16_operations/INTEGRATIONS.md`
- `../17_governance/PROJECT_INVARIANTS.md`
- `../services/heureka-service/src/heureka/feed/feed.service.ts`
- `../services/heureka-service/src/heureka/feed/feed.controller.ts`
- `../prisma/schema.prisma`

## Files to Create

Task-specific tests, validation reports, and contract artifacts listed by the implementation plan.

## Files to Modify

Only files named by the reviewed implementation plan.

## Files That Must Not Be Modified

Secret files, `.env`, Kubernetes manifests, protected constitution/vision documents, and unrelated service code unless the plan explicitly approves them.

## Implementation Steps

1. Re-read required context and confirm git status.
2. Define exact contract/schema/runtime change set.
3. Add synthetic tests before or alongside implementation.
4. Implement the minimal scoped change.
5. Run gates and targeted tests.
6. Update validation evidence and task status.

## Test Plan

Strict documentation audit and pre-coding gate for planning. Runtime implementation requires targeted unit/contract/replay tests and deployment-readiness evidence.

## Validation Plan

Capture command output summaries in `12_validation/` or `reports/validation/` without secrets or production raw data.

## Gate Commands

```bash
python3 scripts/strict_doc_audit.py --format markdown --fail-on-issues
python3 scripts/pre_coding_gate.py --root .
python3 scripts/deployment_readiness_gate.py --root . --target TASK-004
```

## Documentation Updates

Update task, execution plan, goal impact, validation report, graph, and task tracker when the implementation proceeds.

## Rollback Plan

Revert only files changed by the scoped implementation. Preserve unrelated remote worktree changes.

## Agent Handoff Prompt

Implement `TASK-004` only after reviewing this plan. Preserve Heureka feed invariants, use synthetic evidence, avoid secrets and production raw data, and report validation results.

## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented
