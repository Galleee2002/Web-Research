# Business Lead Finder

## Project Purpose

Business Lead Finder is a web app and data pipeline for detecting local businesses without a website and turning them into manageable leads from a dashboard.

## Official Stack

- Frontend and API routes: Next.js
- Workers and ingestion pipeline: Python
- Database: PostgreSQL
- Styles: SCSS
- External search API: Google Places API

## Monorepo Layout

- `apps/web`: Next.js application, dashboard UI, API routes, frontend utilities, and SCSS styles.
- `services/workers`: Python workers for Google Places ingestion, normalization, enrichment, persistence, and background jobs.
- `packages/shared`: Shared schemas, constants, and types used across app and worker boundaries.
- `database`: PostgreSQL migrations, seeds, and database documentation.
- `docs`: Product, API, and architecture notes.
- `scripts`: Developer scripts grouped by app, database, and worker workflows.
- `infra`: Infrastructure placeholders for Docker and PostgreSQL setup.

## Domain Rules

- A business with no `website` is a valid lead.
- Social media profiles do not count as a website.
- Duplicate businesses should be avoided by `name + address`.
- Lead statuses are `new`, `reviewed`, `contacted`, and `discarded`.

## MVP Boundaries

- The MVP includes business search, automated ingestion, website detection, lead dashboard, no-website filtering, lead status management, and CSV export.
- The MVP excludes outreach automation, multi-user support, CRM integrations, and advanced AI.
- Redis or RabbitMQ queues are future options; the initial worker structure only reserves `services/workers/src/jobs`.

## Current Scope

This repository currently contains only the initial folder structure and project memory. No application logic, dependency manifests, runtime configuration, or executable scaffolding has been added yet.
