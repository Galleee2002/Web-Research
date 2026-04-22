# Backend Runtime Setup

## Objetivo

Este documento describe el runtime backend actual de Business Lead Finder:
API routes Next.js, repositorios PostgreSQL, workers Python, clientes Google,
normalizacion externa y deteccion de website propio. La deduplicacion y la
orquestacion completa de ingesta quedan para fases posteriores.

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
- `GOOGLE_GEOCODING_API_KEY`: API key opcional para Geocoding. Si queda vacia,
  el worker usa `GOOGLE_PLACES_API_KEY`.
- `GOOGLE_REQUEST_TIMEOUT_SECONDS`: timeout por request a Google, default `10`.
- `GOOGLE_DAILY_REQUEST_LIMIT`: limite diario combinado para Places y
  Geocoding, default `1000`.
- `GOOGLE_QUOTA_STATE_PATH`: archivo local para persistir el contador diario,
  default `.worker-state/google-api-quota.json`.
- `DEFAULT_PAGE_SIZE`: paginacion default.
- `MAX_PAGE_SIZE`: limite maximo de paginacion.
- `LOG_LEVEL`: nivel de logging.

Los secretos reales no deben versionarse.

El directorio `.worker-state/` es local y no debe versionarse. Si se elimina,
el contador diario del worker se reinicia.

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
