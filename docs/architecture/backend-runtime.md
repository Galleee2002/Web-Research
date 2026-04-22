# Backend Runtime Setup

## Objetivo

Este documento describe el scaffold ejecutable inicial de backend para Business
Lead Finder. La logica de negocio, migraciones, API CRUD y Google Places se
implementan en fases posteriores.

## Requisitos

- Node.js compatible con Next.js 15.
- npm para instalar workspaces.
- Python 3.11 o superior.
- PostgreSQL disponible cuando se quiera validar conectividad real.

## Variables de entorno

Copiar `.env.example` como `.env` en la raiz del repo y reemplazar placeholders
locales cuando corresponda.

Variables definidas:

- `APP_ENV`: entorno de ejecucion, default esperado `development`.
- `DATABASE_URL`: conexion PostgreSQL.
- `GOOGLE_PLACES_API_KEY`: API key de Google Places, no requerida para tests.
- `DEFAULT_PAGE_SIZE`: paginacion default.
- `MAX_PAGE_SIZE`: limite maximo de paginacion.
- `LOG_LEVEL`: nivel de logging.

Los secretos reales no deben versionarse.

## Comandos

Instalar dependencias Node:

```sh
npm install
```

Instalar workers Python en modo editable con dependencias de test:

```sh
python3 -m pip install -e 'services/workers[test]'
```

Arrancar Next.js:

```sh
./scripts/dev/start-web.sh
```

Ejecutar smoke del worker:

```sh
./scripts/dev/run-worker.sh
```

Ejecutar tests web:

```sh
npm --workspace apps/web run test
```

Ejecutar tests workers:

```sh
./scripts/dev/test-workers.sh
```

## Healthcheck

`GET /api/health` responde el estado de la app.

- Sin `DATABASE_URL`, responde `200` y marca la base como no configurada.
- Con `DATABASE_URL`, intenta `select 1`.
- Si PostgreSQL no responde, devuelve `503` y marca la base como no alcanzable.
