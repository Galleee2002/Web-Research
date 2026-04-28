# Backend Audit and Modularization Report (2026-04-28)

## Scope
- `apps/web` API routes, services, and DB repositories.
- `services/workers` pipeline, normalization, deduplication, and persistence.
- `packages/shared` as backend contract source for API payload validation.
- `database/migrations` as persistence contract baseline.

## Baseline Findings (Prioritized)

### P0
- Worker deduplication logic was duplicated conceptually across:
  - `services/workers/src/workers/repository.py`
  - `services/workers/src/persistence/dedup.py`
- Google Place normalization behavior existed in two modules with overlapping responsibility:
  - `services/workers/src/workers/normalization.py`
  - `services/workers/src/normalization/business.py`

### P1
- SQL helper logic for `toIsoString` and `where` composition was repeated in web repositories:
  - `apps/web/lib/db/businesses.ts`
  - `apps/web/lib/db/opportunities.ts`
  - `apps/web/lib/db/searches.ts`

### P1 (Domain Hardening)
- Opportunities visibility needed explicit alignment with domain rule "only no-website leads":
  - enforced at query-builder level in `apps/web/lib/db/opportunities.ts`.

## Implemented Modularization (No Functional Regression)

### 1) Shared web DB helper module
- Added `apps/web/lib/db/shared-query.ts` with:
  - `toIsoString()`
  - `whereSql()`
- Refactored repositories to consume it:
  - `apps/web/lib/db/businesses.ts`
  - `apps/web/lib/db/opportunities.ts`
  - `apps/web/lib/db/searches.ts`

### 2) Worker normalization consolidation
- Converted `services/workers/src/workers/normalization.py` into a compatibility wrapper over canonical normalization:
  - canonical target: `services/workers/src/normalization/business.py`
- Preserved worker-facing error semantics by mapping `ValueError("name is required")` to `GoogleInvalidResponseError`.

### 3) Worker dedup consolidation
- Made `workers.repository.normalize_dedupe_text()` delegate to canonical dedup implementation from `persistence.dedup`.
- Standardized canonical dedup output to alphanumeric key behavior consistent with repository matching.

### 4) Opportunities domain hardening
- Added mandatory `businesses.has_website = false` baseline clause in opportunities list filtering:
  - `apps/web/lib/db/opportunities.ts`
- Guarded by query builder tests.

## Test Baseline and Validation Evidence

### Web (Next.js workspace)
- Command: `npm --workspace apps/web run test`
- Result: `21 passed | 1 skipped` test files, `65 passed | 5 skipped` tests.

### Workers (Python workspace)
- Command: `./scripts/dev/test-workers.sh`
- Result: `71 passed, 1 skipped`.

### Added/updated no-regression coverage
- `apps/web/lib/db/opportunities.test.ts`
  - Asserts explicit `businesses.has_website = false` clause.
- `services/workers/tests/test_business_dedup.py`
  - Validates canonical alphanumeric dedup key and fallback key normalization.
- `services/workers/tests/test_normalization.py`
  - Adds parity assertion between legacy normalization entrypoint and canonical worker entrypoint for valid payloads.

## Invariants Checklist (Verified)
- API and DB contracts preserved (`@shared` request/response shapes unchanged).
- Error envelope behavior untouched (`code`, `message`, `correlation_id`).
- Manual business and opportunity fields remain preserved by worker merge logic.
- Opportunity rating constraints unchanged.
- Worker no-website opportunity creation behavior unchanged.

## Residual Risk / Follow-up
- Two persistence paths still coexist in workers (`workers/repository.py` and `persistence/businesses.py` service-based flow). They are now better aligned, but final consolidation into a single runtime path is still recommended in a dedicated follow-up PR to keep blast radius low.
