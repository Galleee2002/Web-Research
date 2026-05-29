# leadScope

## Project Purpose

leadScope is a Next.js + Python monorepo for finding local businesses,
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
- `packages/shared`: shared constants, schemas, pagination contracts,
  business/search types, and dashboard to-do request/response contracts.
- `database`: SQL migrations, seeds, and schema notes.
- `docs`: architecture notes and implementation task documents.
- `scripts/dev`: local helper scripts for web and worker flows.

## Current Implemented State

The web app is executable end-to-end: UI talks to thin Next.js API routes,
services, PostgreSQL repositories, and (for ingestion) Python workers.

### Frontend (Next.js App Router, SCSS)

- **Shell and navigation** under `apps/web/app` and `apps/web/app/_components`.
- **`/`** — marketing/entry as implemented.
- **`/dashboard` (home)** — real data:
  - **To Do** card: loads and mutates persisted tasks via `/api/dashboard/todos`
    (create with title + business chosen from opportunities list, toggle
    `completed`, delete all completed). Client helpers in
    `apps/web/lib/api/dashboard-todos-client.ts`.
  - **Opportunities** preview: all pages of `/api/opportunities`, deep link to
    the board, optional notes modal, scroll hints.
- **`/opportunities`** — full board backed by `/api/opportunities` and
  `PATCH /api/opportunities/{id}`; manual 5-star `rating`; filters/categories
  via shared contracts and list APIs as implemented in the page.
- **`/businesses`** — list/detail UX driven by `/api/businesses` and related
  clients; lead status and opportunity selection flows as wired in
  `apps/web/app/businesses`.
- **`/scans`** — search-run history and drill-down using `/api/scans` and
  businesses APIs.
- **`/analytics`** — client-only chart bundle (`analytics-dynamic`) that
  aggregates from existing businesses/opportunities list clients.
- **`/settings`**, **`/profile`** — session-backed profile editing via auth
  client where implemented.
- **`/admin/users`** — admin-only user listing and role updates (guarded UI +
  admin API routes).
- **`(auth)/login`**, **`(auth)/register`** — align with cookie session and CSRF
  expectations for mutating APIs.
- Some nav destinations may still be thin or placeholder-like; confirm behavior
  in `apps/web/app/**` before assuming empty implementations.

### Backend (Next.js API, `runtime = "nodejs"`)

Routes stay thin: parse with `packages/shared`, call `apps/web/lib/services`,
persist via `apps/web/lib/db`, map errors with `correlation_id` preserved.

**Search and runs**

- `POST /api/search` — create search runs.
- `GET /api/searches` — list runs with filters/pagination.
- `GET /api/search/[id]/next` — continue paginated Google Places ingestion for a
  parent run where supported.

**Businesses and export**

- `GET /api/businesses`, `GET /api/businesses/{id}`, `PATCH /api/businesses/{id}`.
- `GET /api/export` — CSV export.

**Opportunities**

- `GET /api/opportunities`, `GET /api/opportunities/{id}`,
  `PATCH /api/opportunities/{id}`.
- `GET /api/opportunities/categories` — distinct category values for UI filters.
- `PATCH /api/opportunities/businesses/{businessId}` — `is_selected` (and related
  contract) for board inclusion rules.

**Dashboard to-dos** (`apps/web/lib/db/dashboard-todos.ts`,
`apps/web/lib/services/dashboard-todo-service.ts`)

- `GET /api/dashboard/todos` — list tasks joined to `businesses` for subtitle
  labels.
- `POST /api/dashboard/todos` — body
  `{ name, business_id, status?, start_date?, priority? }`; `404` if the
  business is missing. `status` defaults to `pending`, `priority` to `medium`,
  and `start_date` is optional (`YYYY-MM-DD` or `null`).
- `PATCH /api/dashboard/todos/{id}` — partial update accepting any of `name`,
  `status` (`pending` | `completed`), `start_date`, `priority`
  (`low` | `medium` | `high`); at least one field is required.
- `DELETE /api/dashboard/todos/completed` — delete rows with
  `status = 'completed'`; response includes `deleted` count.

**Scans**

- `GET /api/scans` — scan-oriented listing for the Scans screen.

**Auth and admin**

- `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`,
  `GET /api/auth/me`.
- `GET /api/admin/users`, `PATCH /api/admin/users/{id}/role`.

**Provider helper**

- `GET /api/google/places/search` — Places proxy for permitted callers.

**Health**

- `GET /api/health` — service health including database reachability.

### Workers (Python)

- Pipeline under `services/workers`: claim pending `search_runs`, Google Places,
  optional geocoding, normalization, website classification, dedup-aware upsert
  into `businesses` / `opportunities`, observability and failure tracking.
- Dashboard to-dos are **not** worker-owned; they are app-layer CRUD on
  PostgreSQL only.

### Tests and tooling

- Vitest coverage: `packages/shared`, `apps/web` (API routes, services, DB
  helpers, CSV), and worker unit tests.
- Commands: `npm run typecheck`, `npm test`, `npm --workspace apps/web run test`,
  `./scripts/dev/test-workers.sh`.

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
- `dashboard_todos` exists in PostgreSQL for the dashboard **To Do** list:
  `business_id` references `businesses` (`on delete cascade`), `name`,
  `status` (`pending` | `completed`), nullable `start_date`, `priority`
  (`low` | `medium` | `high`), timestamps. List APIs **join** `businesses`
  so the UI can show `business_name` and current lead `status` as the subtitle
  without storing duplicate label columns on the todo row.
- `users` (including session-version fields for invalidation) and
  `auth_rate_limits` support login/register and admin flows as migrated.
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

## Dashboard To Do Rules

- Persisted tasks are rows in `dashboard_todos`; task-level state covers
  `name`, `status` (`pending` | `completed`), `start_date`, and `priority`
  (`low` | `medium` | `high`). The dashboard checkbox toggles `status`.
- Subtitle text (`Business — lead status`) reflects **`businesses.status` at read
  time** via SQL join; changing lead status elsewhere updates the subtitle on
  the next list fetch.
- Workers do not create or update `dashboard_todos`; the Next.js service layer
  owns lifecycle for these rows.

## Frontend Guardrails

- The web app uses Next.js App Router and SCSS globals. Do not document or
  implement Tailwind/shadcn patterns as current repo reality.
- Route pages live under `apps/web/app`; shared layout/navigation lives in
  `apps/web/app/_components`.
- UI components must not import database repositories directly.
- The Opportunities screen consumes `/api/opportunities` and renders star
  controls; it must not own scoring rules beyond displaying backend state and
  sending `PATCH` requests.
- The dashboard **To Do** card must use `/api/dashboard/todos` (and related
  routes) via HTTP clients; it must not import database repositories from client
  components.
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

- Install JS dependencies: `corepack enable` then `pnpm install`
- Install worker dependencies: `python3 -m pip install -e 'services/workers[test]'`
- Apply SQL migrations (requires `DATABASE_URL`; loads `.env` then
  `.env.local`): `./scripts/dev/run-migrations.sh`
- Start the web app: `./scripts/dev/start-web.sh`
- Run the worker: `./scripts/dev/run-worker.sh`
- Run web tests: `pnpm run web:test`
- Run all JS tests: `pnpm test`
- Run typecheck: `pnpm run typecheck`
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

- Included in the repo today: search-run creation and continuation APIs, worker
  ingestion, normalization, website detection, dedup-aware persistence,
  business listing and detail, lead status updates, opportunity rating and
  selection, dashboard persisted **To Do** tasks, scans listing, CSV export,
  session auth (login/register/logout/me), admin user role APIs, analytics
  views built on existing list data, and health checks.
- Still not implemented as first-class persisted features: outreach automation,
  full multi-tenant productization beyond current auth/admin, CRM integrations,
  historical auditing, and advanced predictive scoring.
