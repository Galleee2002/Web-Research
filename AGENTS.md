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

## Persistence Contract

- PostgreSQL is the source of truth for persisted MVP data.
- Frontend screens and dashboard flows must read and write through Next.js API routes, not direct database access from UI components.
- Mocks are allowed only in tests, fixtures, or explicit local development harnesses; they must not become the frontend data source of record.
- Frontend components must not duplicate backend business rules for website detection, deduplication, lead status persistence, or CSV generation.
- Shared statuses, filters, and request/response shapes should live in `packages/shared` once implemented to keep frontend, API routes, and workers aligned.

## MVP Boundaries

- The MVP includes business search, automated ingestion, website detection, lead dashboard, no-website filtering, lead status management, and CSV export.
- The MVP excludes outreach automation, multi-user support, CRM integrations, and advanced AI.
- Redis or RabbitMQ queues are future options; the initial worker structure only reserves `services/workers/src/jobs`.

## Current Scope

This repository now contains the initial executable scaffold for the web app and workers. The frontend includes a dashboard shell with Apple-inspired SCSS styling, Lucide-based sidebar navigation, a bottom theme toggle for dark/light mode, and contextual placeholder empty states with centered section icons for `Dashboard`, `Businesses`, `Opportunities`, `Scans`, `Alerts`, `Analytics`, `Reports`, `Integrations`, and `Settings`. Business logic, database migrations, Google Places ingestion, and CRUD API routes are still implemented in later backend phases.
