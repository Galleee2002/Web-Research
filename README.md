# Business Lead Finder

Business Lead Finder is a monorepo for finding local businesses without their
own website and turning them into manageable leads.

The current repository already includes:

- a Next.js web app in `apps/web` with dashboard UI and API routes;
- PostgreSQL migrations and database documentation in `database`;
- shared TypeScript contracts in `packages/shared`;
- Python workers in `services/workers` for Google Places ingestion,
  normalization, website detection, deduplication, and persistence;
- backend and frontend architecture docs under `docs/architecture`.

## Stack

- Web and API routes: Next.js
- Workers: Python 3.11+
- Database: PostgreSQL
- Shared contracts: TypeScript in `packages/shared`
- Styling: SCSS
- External provider: Google Places API

## Official Commands

Install Node dependencies:

```sh
npm install
```

Install Python worker dependencies:

```sh
python3 -m pip install -e 'services/workers[test]'
```

Start the web app in development:

```sh
npm run web:dev
```

Build the web app:

```sh
npm run web:build
```

Run the worker:

```sh
npm run workers:run
```

Run web tests:

```sh
npm test
```

Run worker tests:

```sh
npm run workers:test
```

## Repository Layout

```txt
apps/web              Next.js app, dashboard UI, API routes, frontend utilities
services/workers      Python worker runtime, ingestion pipeline, tests
packages/shared       Shared schemas, constants, and types
database              SQL migrations, seeds, and schema notes
docs                  Product and architecture documentation
scripts/dev           Development helper scripts
infra                 Infrastructure placeholders
```

## Runtime Notes

- The MVP runs as a same-origin Next.js deployment: frontend and `/api/...`
  routes are served from the same app.
- The web runtime uses Node.js and PostgreSQL connectivity. It is not designed
  for an Edge-only deployment.
- The worker runs in batch mode: it drains pending `search_runs` and exits.
  Production scheduling should use cron or another external scheduler.
- Docker and containerization are not required for the current MVP phase.

## Documentation

- [Backend Runtime](docs/architecture/backend-runtime.md)
- [Database Schema](database/docs/mvp-schema.md)
- [Backend Implementation Tasks](docs/architecture/backend-implementation-tasks.md)
- [Frontend Implementation Tasks](docs/architecture/frontend-implementation-tasks.md)
