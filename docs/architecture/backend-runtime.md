# Backend Runtime Setup

## Objetivo

Este documento es el runbook operativo actual del backend MVP de Business Lead
Finder. Resume como levantar la aplicacion web, preparar PostgreSQL, ejecutar
el worker y validar que los contratos HTTP siguen consistentes con el frontend.

La topologia soportada hoy es:

- `apps/web` despliega frontend y API routes same-origin;
- las API routes corren en runtime Node.js, no Edge;
- PostgreSQL debe ser alcanzable desde la app web;
- el worker Python corre en modo batch, drena `search_runs` pendientes y
  termina;
- en produccion el worker debe invocarse desde cron o un scheduler externo,
  no como daemon continuo del repo;
- Docker o containerizacion no son requisito de esta fase.

## Requisitos

- Node.js compatible con Next.js 15.
- npm para instalar workspaces.
- Python 3.11 o superior.
- PostgreSQL disponible y una base modificable para aplicar migraciones.
- Cliente `psql` disponible para correr migraciones y seed.

## Variables de entorno

Copiar `.env.example` como `.env` en la raiz del repo y reemplazar placeholders
locales cuando corresponda.

Variables definidas:

- `APP_ENV`: entorno de ejecucion, default esperado `development`.
- `DATABASE_URL`: conexion PostgreSQL. Requerida en `production` para la web y
  requerida en la practica para ejecutar el worker.
- `GOOGLE_PLACES_API_KEY`: API key de Google Places. Requerida en
  `production` para web y worker.
- `GOOGLE_GEOCODING_API_KEY`: API key opcional para Geocoding. Si queda vacia,
  el worker usa `GOOGLE_PLACES_API_KEY`.
- `GOOGLE_REQUEST_TIMEOUT_SECONDS`: timeout por request a Google, default `10`.
- `GOOGLE_DAILY_REQUEST_LIMIT`: limite diario combinado para Places y
  Geocoding, default `1000`.
- `GOOGLE_QUOTA_STATE_PATH`: archivo local para persistir el contador diario,
  default `.worker-state/google-api-quota.json`.
- `DEFAULT_PAGE_SIZE`: paginacion default.
- `MAX_PAGE_SIZE`: limite maximo de paginacion.
- `LOG_LEVEL`: nivel de logging (`debug`, `info`, `warn`, `warning` o
  `error` en workers; `debug`, `info`, `warn` o `error` en web).
- `ALLOWED_ORIGINS`: lista separada por comas de origins permitidos para CORS.
  Vacio significa politica same-origin, que es el default del MVP.
- `API_JSON_BODY_LIMIT_BYTES`: limite maximo para requests JSON en API routes,
  default `1000000`.
- `DB_POOL_MAX`: conexiones maximas del pool web PostgreSQL, default `10`.
- `DB_IDLE_TIMEOUT_MS`: timeout idle del pool web, default `10000`.
- `DB_CONNECTION_TIMEOUT_MS`: timeout de conexion PostgreSQL, default `1500`.
- `DB_QUERY_TIMEOUT_MS`: timeout de query PostgreSQL, default `10000`.
- `DB_SSL`: `disable`/`false` o `require`/`true` para conexiones PostgreSQL
  desde la app web.

Los secretos reales no deben versionarse.

El directorio `.worker-state/` es local y no debe versionarse. Si se elimina,
el contador diario del worker se reinicia. En entornos con filesystem efimero,
ese estado tambien puede resetearse entre ejecuciones.

En `production`, la app web falla al cargar configuracion si faltan
`DATABASE_URL` o `GOOGLE_PLACES_API_KEY`. El worker aplica la misma regla en
produccion y mantiene defaults permisivos solo para desarrollo y tests.

## Variables minimas por proceso

### Web

- `APP_ENV`
- `DATABASE_URL`
- `GOOGLE_PLACES_API_KEY`
- `DB_SSL`
- `ALLOWED_ORIGINS`
- `API_JSON_BODY_LIMIT_BYTES`
- `DB_POOL_MAX`
- `DB_IDLE_TIMEOUT_MS`
- `DB_CONNECTION_TIMEOUT_MS`
- `DB_QUERY_TIMEOUT_MS`
- `LOG_LEVEL`

### Worker

- `APP_ENV`
- `DATABASE_URL`
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_GEOCODING_API_KEY`
- `GOOGLE_REQUEST_TIMEOUT_SECONDS`
- `GOOGLE_DAILY_REQUEST_LIMIT`
- `GOOGLE_QUOTA_STATE_PATH`
- `DEFAULT_PAGE_SIZE`
- `MAX_PAGE_SIZE`
- `LOG_LEVEL`

## Seguridad operativa

Las API routes son same-origin por defecto. Si `ALLOWED_ORIGINS` contiene
origins explicitos, las respuestas y preflight `OPTIONS` agregan CORS solo para
esos origins; origins no listados no reciben `Access-Control-Allow-Origin`.

Las rutas rechazan `X-Correlation-Id` con caracteres no operativos o mas de 128
caracteres y generan un correlation id nuevo para responder el error. Los
requests JSON con `Content-Length` superior a `API_JSON_BODY_LIMIT_BYTES` se
rechazan antes de parsear el body.

Los logs de API y worker redactan API keys, `DATABASE_URL` y parametros
sensibles `key=`. Los errores HTTP conservan el envelope publico con
`error.correlation_id`, pero no exponen detalles internos de PostgreSQL.

La exportacion CSV neutraliza valores que podrian ejecutarse como formulas en
planillas. La normalizacion de URLs acepta solo `http` y `https`; redes
sociales, Google Maps y directorios no cuentan como website propio.

## Bootstrap local

### 1. Instalar dependencias

Instalar dependencias Node:

```sh
npm install
```

Instalar workers Python en modo editable con dependencias de test:

```sh
python3 -m pip install -e 'services/workers[test]'
```

### 2. Crear y configurar `.env`

Copiar `.env.example` a `.env` y ajustar al menos:

- `APP_ENV`
- `DATABASE_URL`
- `GOOGLE_PLACES_API_KEY`
- `DB_SSL` si PostgreSQL requiere SSL
- `GOOGLE_GEOCODING_API_KEY` si se quiere separar esa credencial

### 3. Aplicar migraciones

Ejecutar en este orden:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_create_mvp_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_add_search_run_observability.sql
```

### 4. Seed de desarrollo

Actualmente el seed versionado no inserta datos demo. Se mantiene vacio para
no reintroducir registros ficticios en PostgreSQL:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/001_mvp_demo_data.sql
```

### 5. Levantar la web

Desarrollo:

```sh
./scripts/dev/start-web.sh
```

### 6. Ejecutar el worker

El worker procesa `search_runs` pendientes, persiste resultados y termina.

```sh
./scripts/dev/run-worker.sh
```

### 7. Ejecutar tests

Web:

```sh
npm --workspace apps/web run test
```

Workers:

```sh
./scripts/dev/test-workers.sh
```

## Arranque productivo

Build web:

```sh
npm --workspace apps/web run build
```

Start web:

```sh
npm --workspace apps/web run start
```

Worker batch:

```sh
python3 -m workers
```

El modo operativo esperado en produccion es disparar ese comando desde cron o
un scheduler externo. El repositorio no define hoy un servicio persistente para
el worker.

## Healthcheck operativo

`GET /api/health` responde el estado de la app.

- Sin `DATABASE_URL`, responde `200` y marca la base como no configurada.
- Con `DATABASE_URL`, intenta `select 1`.
- Si PostgreSQL no responde, devuelve `503`, marca la base como no alcanzable y
  responde un error generico sin filtrar el mensaje crudo de conexion.
- El endpoint mantiene logging consistente con el resto de las API routes.

Se usa como smoke check operativo, no como dependencia funcional del frontend.

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

## Checklist de smoke test de despliegue

1. `GET /api/health` responde correctamente desde el host desplegado.
2. `GET /api/businesses` devuelve `items`, `total`, `page` y `page_size`.
3. `GET /api/businesses/{id}` devuelve un negocio existente.
4. `PATCH /api/businesses/{id}` actualiza `status` y/o `notes` y persiste el
   cambio.
5. `POST /api/search` crea una corrida valida.
6. Ejecutar `python3 -m workers` o el comando equivalente del scheduler.
7. Verificar que la corrida actualiza `search_runs.status`, `total_found`,
   `correlation_id` y `observability`.
8. Ejecutar `npm test` y `npm run workers:test` como validacion final del
   entorno.

## Limitaciones relevantes del MVP actual

- El frontend consume rutas relativas `/api/...`, por lo que la topologia
  soportada en esta fase es same-origin.
- No existe `API_BASE_URL` para separar frontend y backend.
- La UI actual no expone toda la superficie documentada del backend.
- La pantalla de negocios aplica ordenamiento local sobre el resultado cargado;
  eso no equivale a un orden global del dataset backend.
