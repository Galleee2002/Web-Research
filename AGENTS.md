# Business Lead Finder

## Project Purpose

Business Lead Finder is a Next.js + Python monorepo for finding local businesses,
classifying whether they have a real website, persisting leads in PostgreSQL,
and managing them from a dashboard and API.

## Official Stack

- Frontend and API routes: Next.js App Router
- Workers and ingestion pipeline: Python
- Database: PostgreSQL
- Shared contracts: TypeScript package plus mirrored Python contracts
- Styles: SCSS
- External providers: Google Places API and Google Geocoding

## Real Repo Layout

- `apps/web`: Next.js app, App Router pages, API routes, server-side services,
  repositories, HTTP helpers, CSV utilities, and SCSS.
- `services/workers`: Python ingestion clients, normalization, website
  detection, pipeline orchestration, repository persistence, and tests.
- `packages/shared`: shared constants, schemas, pagination contracts, and
  business/search types.
- `database`: SQL migrations, seeds, and schema notes.
- `docs`: architecture notes and implementation task documents.
- `scripts/dev`: local helper scripts for web and worker flows.

## Current Implemented State

- The web app is executable, not just scaffolded.
- The dashboard shell and section placeholder pages exist for `Dashboard`,
  `Businesses`, `Scans`, `Analytics`, and `Settings` (other areas use real screens
  where implemented).
- `/opportunities` is now a real screen backed by API data, with manual 5-star
  prioritization.
- Thin Next.js API routes exist for:
  - `POST /api/search`
  - `GET /api/searches`
  - `GET /api/businesses`
  - `GET /api/businesses/{id}`
  - `PATCH /api/businesses/{id}`
  - `GET /api/opportunities`
  - `GET /api/opportunities/{id}`
  - `PATCH /api/opportunities/{id}`
  - `GET /api/export`
  - `GET /api/health`
- `apps/web/lib/services` delegates to repository code in `apps/web/lib/db`.
- PostgreSQL migrations and deterministic seed data exist.
- The Python worker pipeline is implemented for:
  - claiming pending search runs;
  - calling Google Places;
  - optional geocoding enrichment;
  - normalization;
  - website classification;
  - persistence/upsert and dedup support;
  - search-run observability and failure tracking.
- Unit tests exist across shared contracts, API behavior, services,
  repositories, CSV helpers, and worker logic.

## Domain Rules

- A business with no `website` is a valid lead.
- Social media profiles do not count as a website.
- Website classification is backend-owned. Frontend code must consume
  `website` and `has_website`, not recalculate them.
- Duplicate businesses should be avoided by provider identity when available,
  with `name + address` as the fallback dedup key.
- Lead statuses are `new`, `reviewed`, `contacted`, and `discarded`.
- `opportunities.rating` is manual, nullable, and restricted to
  `1 | 2 | 3 | 4 | 5 | null`.

## Persistence Contract

- PostgreSQL is the source of truth for persisted application data.
- Frontend screens must read and write through Next.js API routes, not direct
  database access from UI components.
- API routes stay thin: validate/parse input, call services, map service errors
  to HTTP responses.
- Backend use cases in `apps/web` belong in `apps/web/lib/services`; data access
  belongs in `apps/web/lib/db`.
- Shared statuses, filters, and request/response shapes belong in
  `packages/shared`.
- Mocks are allowed only in tests or explicit local harnesses; they must not
  become the app data source of record.

## Data Model Reality

- `search_runs` exists in PostgreSQL with operational status
  `pending | processing | completed | failed` plus observability fields such as
  `correlation_id`, `error_code`, `error_stage`, and `observability`.
- `businesses` exists in PostgreSQL and is the current persisted lead entity.
  It stores normalized provider data, website presence, manual lead status, and
  notes.
- `opportunities` exists in PostgreSQL as a commercial 1:1 layer on top of
  `businesses`, with `business_id` unique and nullable `rating`.
- `GET /api/opportunities` always derives visible rows from
  `opportunities join businesses` and excludes businesses with
  `has_website = true`.
- `GET /api/businesses`, `PATCH /api/businesses/{id}`, and `GET /api/export`
  remain separate from opportunity rating behavior.

## Opportunities Rule Going Forward

- `opportunities` is a required domain entity with a 1:1 relationship to
  `businesses`.
- `opportunities.rating` is manual and nullable; `null` means “unrated”.
- Frontend code must read and write opportunity ratings only through the
  opportunity API routes.
- Workers must guarantee that businesses without a website have an
  `opportunities` row, but they must never overwrite or clear manual
  `opportunities.rating`.
- If a business later has `has_website = true`, the `opportunities` row is kept
  for future reuse, but it must stop appearing in `GET /api/opportunities`.
- Business and opportunity contracts must stay aligned across PostgreSQL,
  Next.js APIs, workers when relevant, and
  `packages/shared`.

## Frontend Guardrails

- The web app uses Next.js App Router and SCSS globals. Do not document or
  implement Tailwind/shadcn patterns as current repo reality.
- Route pages live under `apps/web/app`; shared layout/navigation lives in
  `apps/web/app/_components`.
- UI components must not import database repositories directly.
- The Opportunities screen consumes `/api/opportunities` and renders star
  controls; it must not own scoring rules beyond displaying backend state and
  sending `PATCH` requests.
- Placeholder sections should remain clearly labeled until they have real API
  backing.

## Backend Guardrails

- API routes run on `runtime = "nodejs"` and should keep validation in shared
  schemas from `packages/shared`.
- Repository code in `apps/web/lib/db` is responsible for SQL shape,
  parameterization, ordering, and persistence behavior.
- Services in `apps/web/lib/services` are the only orchestration layer called
  from routes.
- Error responses must preserve `correlation_id`.
- Schema changes must update migrations, seeds when needed, shared contracts,
  and tests together.

## Worker Guardrails

- Workers own provider calls, normalization, website classification, dedup, and
  persistence/upsert behavior.
- Worker merge logic must preserve manual business fields such as `status` and
  `notes`, and manual commercial fields such as `opportunities.rating`.
- Upsert behavior for opportunities is additive only: create missing rows for
  no-website businesses, never recalculate rating.

## Local Workflow

- Install JS dependencies: `npm install`
- Install worker dependencies: `python3 -m pip install -e 'services/workers[test]'`
- Start the web app: `./scripts/dev/start-web.sh`
- Run the worker: `./scripts/dev/run-worker.sh`
- Run web tests: `npm --workspace apps/web run test`
- Run all JS tests: `npm test`
- Run typecheck: `npm run typecheck`
- Run worker tests: `./scripts/dev/test-workers.sh`

## Environment Baseline

- Required for persisted local development: `DATABASE_URL`
- Required for real ingestion: `GOOGLE_PLACES_API_KEY`
- Optional provider override: `GOOGLE_GEOCODING_API_KEY`
- Operational settings used by the repo:
  - `APP_ENV`
  - `GOOGLE_REQUEST_TIMEOUT_SECONDS`
  - `GOOGLE_DAILY_REQUEST_LIMIT`
  - `GOOGLE_QUOTA_STATE_PATH`
  - `DEFAULT_PAGE_SIZE`
  - `MAX_PAGE_SIZE`
  - `LOG_LEVEL`

## MVP Boundaries

- Included in the repo today: search-run creation, worker ingestion,
  normalization, website detection, dedup-aware persistence, business listing,
  business detail, lead status updates, opportunity rating, CSV export, and
  health checks.
- Still not implemented as first-class persisted features: outreach automation,
  multi-user support, CRM integrations, historical auditing, and advanced
  predictive scoring.
