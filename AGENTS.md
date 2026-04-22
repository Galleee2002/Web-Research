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
- Next.js API routes should stay thin: parse/validate HTTP input, call services, and translate results/errors to HTTP responses.
- Backend use cases in `apps/web` should live in `apps/web/lib/services`; services call repositories in `apps/web/lib/db`.
- Mocks are allowed only in tests, fixtures, or explicit local development harnesses; they must not become the frontend data source of record.
- Frontend components must not duplicate backend business rules for website detection, deduplication, lead status persistence, or CSV generation.
- Shared statuses, filters, and request/response shapes live in `packages/shared` to keep frontend, API routes, and workers aligned.

## MVP Boundaries

- The MVP includes business search, automated ingestion, website detection, lead dashboard, no-website filtering, lead status management, and CSV export.
- The MVP excludes outreach automation, multi-user support, CRM integrations, and advanced AI.
- Redis or RabbitMQ queues are future options; the initial worker structure only reserves `services/workers/src/jobs`.

## Current Scope

This repository now contains an executable scaffold for the web app and workers. The frontend includes a dashboard shell with Apple-inspired SCSS styling, Lucide-based sidebar navigation, a bottom theme toggle for dark/light mode, and contextual placeholder empty states with centered section icons for `Dashboard`, `Businesses`, `Opportunities`, `Scans`, `Alerts`, `Analytics`, `Reports`, `Integrations`, and `Settings`.

The backend currently includes PostgreSQL migrations and seeds, shared TypeScript/Python contracts, CRUD-style Next.js API routes for searches and businesses, CSV export, repository-backed PostgreSQL access, a service layer between API routes and repositories, and unit tests around contracts, query builders, services, health checks, and CSV behavior. Google Places worker ingestion, external provider normalization, website detection, and deduplication orchestration are still later backend phases.
