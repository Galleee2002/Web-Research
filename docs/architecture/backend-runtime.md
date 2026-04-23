# Backend Runtime Setup

## Objetivo

Este documento describe el runtime backend actual de Business Lead Finder.
El repositorio ya incluye migraciones PostgreSQL, API CRUD base, clientes
Google Places/Geocoding y un worker Python capaz de procesar `search_runs`
pendientes para persistir negocios en PostgreSQL con trazabilidad operativa
basica por `correlation_id`.

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

Ejecutar worker para procesar `search_runs` pendientes:

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
- El endpoint mantiene logging consistente con el resto de las API routes.

## Correlation ID y errores HTTP

Las API routes aceptan `X-Correlation-Id`. Si no llega, el backend genera uno.

Convenciones actuales:

- todas las respuestas de error incluyen `error.correlation_id`;
- `POST /api/search` persiste ese valor en `search_runs.correlation_id`;
- el worker reutiliza `search_runs.correlation_id` para continuar la
  trazabilidad de la corrida.

Codigos de error HTTP usados hoy:

- `validation_error`;
- `not_found`;
- `invalid_json`;
- `database_error`;
- `internal_error`.

Los contratos de exito no cambian por esta fase.

## Pipeline worker

El worker actual:

- reclama `search_runs` en estado `pending`;
- los marca `processing`;
- consulta Google Places;
- usa Google Geocoding como enriquecimiento por negocio;
- normaliza resultados;
- detecta website propio;
- deduplica y persiste `businesses`;
- actualiza `total_found`;
- marca `completed` o `failed`.

Ademas, `search_runs` ahora puede persistir metadata operativa adicional:

- `correlation_id`;
- `error_code`;
- `error_stage`;
- `observability` en `jsonb`.

La columna `observability` guarda un resumen acotado, por ejemplo:

- `request_method`;
- `request_path`;
- `provider`;
- `results_found`;
- `inserted_count`;
- `updated_count`;
- `deduped_count`;
- `geocoding_calls`;
- `duration_ms`;
- `started_at`;
- `finished_at`.

Los logs de API y worker se emiten en formato estructurado o
semiestructurado y `LOG_LEVEL` controla el nivel de salida.

Si falta `DATABASE_URL`, el worker falla con mensaje claro porque no puede
procesar corridas pendientes.
