# Business Lead Finder

> 🇪🇸 Plataforma web y pipeline de datos para encontrar negocios locales sin
> sitio web y convertirlos en leads gestionables.
>
> 🇺🇸 Web app and data pipeline for finding local businesses without their own
> website and turning them into manageable leads.

---

## 🇪🇸 Español

### 📌 Resumen del Producto

Business Lead Finder ayuda a agencias, freelancers y equipos comerciales B2B a
detectar negocios locales que todavía no tienen un sitio web propio.

Muchos negocios dependen solo de Google Business Profile, directorios o redes
sociales. Para quienes venden desarrollo web, SEO o marketing digital, esos
negocios representan oportunidades comerciales claras, pero encontrarlos de
forma manual es lento y difícil de escalar.

El producto automatiza ese proceso:

1. Buscar negocios por categoría y ubicación.
2. Obtener resultados desde Google Places.
3. Normalizar y deduplicar los negocios encontrados.
4. Detectar si cada negocio tiene un sitio web real.
5. Guardar los datos en PostgreSQL.
6. Gestionar los leads desde un dashboard.
7. Exportar listas filtradas en CSV.

### 🎯 Propuesta de Valor

- Identificar negocios sin sitio web a partir de datos de búsqueda local.
- Considerar redes sociales como perfiles, no como sitios web propios.
- Mantener una base de leads limpia mediante normalización y deduplicación.
- Dar al equipo comercial un dashboard para revisar, filtrar y actualizar
  estados de leads.
- Exportar listas accionables para trabajarlas en otros flujos comerciales.

### 🚀 Alcance del MVP

El MVP cubre el ciclo completo desde la búsqueda hasta la exportación.

Incluye:

- Búsqueda de negocios por keyword y ubicación.
- Ingesta automatizada mediante Google Places API.
- Detección de sitio web.
- Dashboard de leads.
- Filtro de negocios sin sitio web.
- Gestión de estados de lead.
- Exportación CSV.

No incluye:

- Automatización de outreach.
- Multiusuario.
- Integraciones con CRM.
- IA avanzada o scoring predictivo.
- Redis, RabbitMQ, Celery u otra infraestructura de colas obligatoria.

### 📏 Reglas de Negocio

- Un negocio sin `website` es un lead válido.
- Una red social no cuenta como sitio web.
- Los duplicados deben evitarse por `name + address`.
- Los estados válidos de lead son:
  - `new`
  - `reviewed`
  - `contacted`
  - `discarded`

### 🧱 Arquitectura

Business Lead Finder está pensado como un monorepo con responsabilidades
separadas entre aplicación web, workers, contratos compartidos y base de datos.

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Web app | Next.js | Dashboard, API routes y flujos de usuario |
| Workers | Python | Ingesta, normalización, enriquecimiento y persistencia |
| Base de datos | PostgreSQL | Búsquedas, negocios, estados de lead y datos exportables |
| Contratos compartidos | Shared package | Estados, esquemas, constantes y contratos entre capas |
| Estilos | SCSS | Estructura visual y estilos reutilizables |
| Datos externos | Google Places API | Fuente principal de negocios locales |

#### Flujo del Sistema

```txt
Búsqueda del usuario
  -> API route en Next.js
  -> search_run guardado en PostgreSQL
  -> worker Python procesa la búsqueda
  -> Google Places API devuelve negocios
  -> worker normaliza y enriquece registros
  -> se clasifica la presencia de website
  -> los negocios se guardan y deduplican
  -> el dashboard lista y filtra leads
  -> el usuario actualiza estados o exporta CSV
```

### 📁 Estructura del Repositorio

```txt
apps/
  web/
    app/          Rutas de Next.js y pantallas de la aplicación
    components/   Componentes de dashboard, leads, búsqueda, layout y UI
    lib/          Clientes API, acceso DB, tipos y utilidades
    styles/       Estructura SCSS

services/
  workers/
    src/          Ingesta, enriquecimiento, normalización y persistencia
    tests/        Tests de workers

packages/
  shared/         Constantes, esquemas y tipos compartidos

database/
  migrations/     Migraciones PostgreSQL
  seeds/          Datos seed para desarrollo y pruebas
  docs/           Notas de base de datos y decisiones de schema

docs/
  api/            Documentación de API
  architecture/   Planes de implementación backend y frontend
  product/        Notas de producto

scripts/
  db/             Utilidades de base de datos
  dev/            Helpers de desarrollo
  workers/        Scripts de workers

infra/
  docker/         Placeholders de Docker
  postgres/       Placeholders de infraestructura PostgreSQL
```

### 🗃️ Modelo de Dominio Planificado

#### `search_runs`

Registra cada búsqueda creada por el usuario.

Responsabilidades esperadas:

- Guardar query, ubicación, fuente y estado.
- Registrar el ciclo de procesamiento.
- Capturar conteos de resultados y detalles de error.

Estados esperados:

- `pending`
- `processing`
- `completed`
- `failed`

#### `businesses`

Guarda negocios normalizados descubiertos por el pipeline de ingesta.

Responsabilidades esperadas:

- Guardar nombre, dirección, categoría, teléfono, website, URL de mapa y
  ubicación.
- Indicar si el negocio tiene un sitio web real.
- Guardar estado de lead y notas.
- Soportar filtros, paginación y exportación CSV.

### 🔌 API Planificada

| Caso de uso | Método | Endpoint |
| --- | --- | --- |
| Crear búsqueda | `POST` | `/api/search` |
| Listar búsquedas | `GET` | `/api/searches` |
| Listar negocios | `GET` | `/api/businesses` |
| Ver detalle de negocio | `GET` | `/api/businesses/{id}` |
| Actualizar estado de lead | `PATCH` | `/api/businesses/{id}` |
| Exportar leads | `GET` | `/api/export` |

### 🧪 Estado Actual del Repositorio

Este repositorio está en una etapa inicial de arquitectura y scaffolding.

Existe actualmente:

- Definición de producto en `PRD.md`.
- Reglas de ingeniería en `RULES.md`.
- Estructura base de monorepo.
- Documentos de tareas backend y frontend en `docs/architecture`.
- Directorios placeholder para app, workers, database, scripts e
  infraestructura.

Todavía no existe:

- Configuración ejecutable de Next.js.
- Configuración de dependencias para workers Python.
- Migraciones PostgreSQL.
- Archivos de entorno runtime.
- Lógica de aplicación implementada.

Como todavía no se agregaron manifests de runtime, este README no documenta
comandos de instalación o ejecución. Esa sección debe agregarse cuando se
inicialicen la app Next.js, el paquete de workers Python y las migraciones de
base de datos.

### 📚 Documentación

- [Product Requirements](PRD.md)
- [Engineering Rules](RULES.md)
- [Backend Implementation Tasks](docs/architecture/backend-implementation-tasks.md)
- [Frontend Implementation Tasks](docs/architecture/frontend-implementation-tasks.md)

### 🛠️ Principios de Implementación

- Separar responsabilidades entre frontend, API routes, workers y base de
  datos.
- Centralizar estados, esquemas y constantes compartidas en `packages/shared`.
- Mantener el MVP simple: PostgreSQL es la fuente de verdad y las colas quedan
  como opción futura.
- Evitar duplicados usando IDs de proveedor cuando existan y `name + address`
  como fallback.
- Mantener las reglas de negocio fuera de la lógica de presentación.

### 🗺️ Roadmap

MVP:

- Inicializar la app Next.js en `apps/web`.
- Agregar schema y migraciones PostgreSQL.
- Implementar API routes para búsquedas, negocios, actualización de leads y
  exportación.
- Implementar workers Python para ingesta y normalización desde Google Places.
- Construir el dashboard de leads con filtros, gestión de estados y CSV.

Más adelante:

- Reglas mas finas de detección de perfiles sociales y directorios.
- Scoring de leads.
- Deduplicación avanzada sobre direcciones parciales, concurrencia y posibles
  proveedores multiples. La deduplicación básica del MVP ya usa IDs de
  proveedor y `name + address` como fallback.
- Flujos de outreach.
- Integraciones con CRM.
- Soporte multiusuario.

---

## 🇺🇸 English

### 📌 Product Summary

Business Lead Finder helps agencies, freelancers, and B2B sales teams discover
local businesses that do not have their own website yet.

Many local businesses rely only on Google Business Profiles, directories, or
social media pages. For teams selling websites, SEO, or digital marketing
services, those businesses are strong commercial opportunities, but finding
them manually is slow and difficult to scale.

The product automates that process:

1. Search businesses by category and location.
2. Ingest results from Google Places.
3. Normalize and deduplicate business records.
4. Detect whether each business has a real website.
5. Store the data in PostgreSQL.
6. Manage leads from a dashboard.
7. Export filtered lead lists to CSV.

### 🎯 Core Value

- Identify businesses without a website from local search data.
- Treat social media profiles as profiles, not owned websites.
- Keep a clean lead database through normalization and deduplication.
- Give sales teams a focused dashboard for reviewing, filtering, and updating
  lead status.
- Export actionable lists for external sales workflows.

### 🚀 MVP Scope

The MVP covers the full loop from search to export.

Included:

- Business search by keyword and location.
- Automated ingestion through Google Places API.
- Website detection.
- Lead dashboard.
- Filtering for businesses without a website.
- Lead status management.
- CSV export.

Excluded:

- Outreach automation.
- Multi-user accounts.
- CRM integrations.
- Advanced AI or predictive scoring.
- Redis, RabbitMQ, Celery, or other required queue infrastructure.

### 📏 Business Rules

- A business with no `website` is a valid lead.
- A social media profile does not count as a website.
- Duplicate businesses should be avoided by `name + address`.
- Valid lead statuses are:
  - `new`
  - `reviewed`
  - `contacted`
  - `discarded`

### 🧱 Architecture

Business Lead Finder is planned as a monorepo with separated responsibilities
for the web app, workers, shared contracts, and database assets.

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web app | Next.js | Dashboard, API routes, and user workflows |
| Workers | Python | Ingestion, normalization, enrichment, and persistence |
| Database | PostgreSQL | Searches, businesses, lead status, and exportable data |
| Shared contracts | Shared package | Status values, schemas, constants, and cross-layer contracts |
| Styles | SCSS | Visual structure and reusable styles |
| External data | Google Places API | Main source of local business data |

#### System Flow

```txt
User search
  -> Next.js API route
  -> search_run stored in PostgreSQL
  -> Python worker processes the search
  -> Google Places API returns businesses
  -> worker normalizes and enriches records
  -> website presence is classified
  -> businesses are persisted and deduplicated
  -> dashboard lists and filters leads
  -> user updates status or exports CSV
```

### 📁 Repository Layout

```txt
apps/
  web/
    app/          Next.js routes and application screens
    components/   Dashboard, lead, search, layout, and UI components
    lib/          API clients, DB access, types, and utilities
    styles/       SCSS structure

services/
  workers/
    src/          Ingestion, enrichment, normalization, and persistence
    tests/        Worker tests

packages/
  shared/         Shared constants, schemas, and types

database/
  migrations/     PostgreSQL migrations
  seeds/          Development and test seed data
  docs/           Database notes and schema decisions

docs/
  api/            API documentation
  architecture/   Backend and frontend implementation plans
  product/        Product notes

scripts/
  db/             Database utilities
  dev/            Development helpers
  workers/        Worker scripts

infra/
  docker/         Docker placeholders
  postgres/       PostgreSQL infrastructure placeholders
```

### 🗃️ Planned Domain Model

#### `search_runs`

Tracks each search created by the user.

Expected responsibilities:

- Store query, location, source, and status.
- Track the processing lifecycle.
- Capture result counts and error details.

Expected statuses:

- `pending`
- `processing`
- `completed`
- `failed`

#### `businesses`

Stores normalized businesses discovered by the ingestion pipeline.

Expected responsibilities:

- Store name, address, category, phone, website, map URL, and location data.
- Track whether the business has a real website.
- Store lead status and notes.
- Support filtering, pagination, and CSV export.

### 🔌 Planned API Surface

| Use case | Method | Endpoint |
| --- | --- | --- |
| Create a search | `POST` | `/api/search` |
| List searches | `GET` | `/api/searches` |
| List businesses | `GET` | `/api/businesses` |
| Get business detail | `GET` | `/api/businesses/{id}` |
| Update lead status | `PATCH` | `/api/businesses/{id}` |
| Export leads | `GET` | `/api/export` |

### 🧪 Current Repository Status

This repository is in the initial architecture and scaffolding stage.

Present today:

- Product definition in `PRD.md`.
- Engineering rules in `RULES.md`.
- Base monorepo structure.
- Backend and frontend task documents under `docs/architecture`.
- Placeholder directories for app, workers, database, scripts, and
  infrastructure.

Not present yet:

- Executable Next.js project configuration.
- Python worker dependency configuration.
- PostgreSQL migrations.
- Runtime environment files.
- Implemented application logic.

Because runtime manifests have not been added yet, this README does not
document setup or run commands. That section should be added once the Next.js
app, Python worker package, and database migrations are initialized.

### 📚 Documentation

- [Product Requirements](PRD.md)
- [Engineering Rules](RULES.md)
- [Backend Implementation Tasks](docs/architecture/backend-implementation-tasks.md)
- [Frontend Implementation Tasks](docs/architecture/frontend-implementation-tasks.md)

### 🛠️ Implementation Principles

- Keep frontend, API routes, workers, and database concerns separated.
- Centralize shared statuses, schemas, and constants in `packages/shared`.
- Keep the MVP simple: PostgreSQL is the source of truth, and queues remain a
  future option.
- Avoid duplicates using provider IDs when available and `name + address` as
  the fallback.
- Keep business rules out of presentation logic.

### 🗺️ Roadmap

MVP:

- Initialize the Next.js app in `apps/web`.
- Add PostgreSQL schema and migrations.
- Implement API routes for searches, businesses, lead updates, and export.
- Implement Python workers for Google Places ingestion and normalization.
- Build the lead dashboard with filters, status management, and CSV export.

Later:

- Finer social profile and directory detection rules.
- Lead scoring.
- Advanced duplicate resolution for partial addresses, concurrency, and future
  multi-provider ingestion. MVP basic deduplication already uses provider IDs
  and `name + address` as fallback.
- Outreach workflows.
- CRM integrations.
- Multi-user support.
