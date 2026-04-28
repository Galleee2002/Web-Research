# Paginacion incremental de Google Places (CTA Businesses)

## Objetivo

Este cambio reemplaza el uso del CTA de `Businesses` como paginacion local de
`GET /api/businesses` por un flujo de **paginacion real del proveedor Google
Places** con confirmacion explicita de costo.

Resultado esperado:

- cada click confirmado del CTA consume 1 request a Google Places;
- se crea un `search_run` nuevo por pagina del proveedor;
- los negocios se persisten en PostgreSQL con dedup (sin duplicar filas);
- la tabla de `Businesses` se refresca desde DB, no desde payload crudo de Google;
- `Scans` muestra una fila por pagina/run para trazabilidad.

## Alcance implementado

### 1) Rework del CTA en Businesses

Archivo principal:

- `apps/web/app/businesses/_components/businesses-page.tsx`

Comportamiento actual:

1. El CTA siempre abre modal de confirmacion.
2. El modal advierte gasto real: "consume 1 Google Places API request".
3. Al confirmar:
   - busca el ultimo `search_run` `completed` con `provider_next_page_available=true`;
   - llama `POST /api/search/{id}/next`;
   - bloquea doble click (`Requesting...`);
   - refresca `GET /api/businesses` desde PostgreSQL.
4. Si no hay run elegible, muestra error funcional sin llamar Google.

### 2) Nuevo endpoint de paginacion

Ruta:

- `POST /api/search/{id}/next`
- Implementacion: `apps/web/app/api/search/[id]/next/route.ts`

Reglas implementadas:

- `400 validation_error` si `id` no es UUID.
- `404 not_found` si run padre no existe.
- `409 conflict_error` si run padre no esta `completed`.
- `409 conflict_error` si no existe `provider_next_page_token` en el padre.
- `200` idempotente: si ya existe child para ese parent, se devuelve el child existente.
- `201` creado: si no existe child, se crea nuevo run `pending` con:
  - `parent_search_run_id = parent.id`
  - `page_number = parent.page_number + 1`
  - `provider_page_token = parent.provider_next_page_token`

### 3) Cambios de contrato compartido

Archivo:

- `packages/shared/types/search.ts`

`SearchRead` ahora incluye (aditivo):

- `parent_search_run_id: string | null`
- `page_number: number`
- `provider_next_page_available: boolean`

### 4) Cambios de base de datos

Migracion:

- `database/migrations/006_add_search_runs_pagination.sql`

Nuevas columnas en `search_runs`:

- `parent_search_run_id uuid null references search_runs(id)`
- `page_number integer not null default 1`
- `provider_page_token text null`
- `provider_next_page_token text null`

Indices y reglas:

- `check (page_number >= 1)`
- indice por `parent_search_run_id`
- indice unico parcial para idempotencia: 1 child por `parent_search_run_id`

### 5) Worker y proveedor Google

Archivos principales:

- `services/workers/src/ingestion/google_places/client.py`
- `services/workers/src/workers/pipeline.py`
- `services/workers/src/workers/repository.py`
- `services/workers/src/workers/models.py`

Comportamiento:

- request a Places API (New) usando `places:searchText`;
- si el run tiene `provider_page_token`, se envia como `pageToken`;
- se fuerza `pageSize=20`;
- al completar run, se guarda `provider_next_page_token` recibido;
- persiste/actualiza `businesses` con dedup existente;
- preserva campos manuales (`status`, `notes`, `opportunities.rating`).

## Flujo end-to-end

1. Usuario corre una busqueda inicial (`POST /api/search`).
2. Worker procesa run inicial y guarda `provider_next_page_token` si existe.
3. Usuario abre `Businesses` y confirma CTA.
4. Frontend llama `POST /api/search/{id}/next` sobre ultimo run elegible.
5. Worker procesa child run usando `provider_page_token`.
6. Nuevos resultados quedan en DB y `Businesses` refresca por API local.

## API de Google: URL y credenciales necesarias

### Endpoint proveedor usado

- URL: `https://places.googleapis.com/v1/places:searchText`
- Metodo: `POST`

### Headers requeridos

- `X-Goog-Api-Key: <GOOGLE_PLACES_API_KEY>`
- `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.primaryType,places.primaryTypeDisplayName,places.types,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,nextPageToken`

### Body usado por el worker

Pagina inicial o sin token:

```json
{
  "textQuery": "dentists in Buenos Aires",
  "pageSize": 20
}
```

Siguiente pagina:

```json
{
  "textQuery": "dentists in Buenos Aires",
  "pageSize": 20,
  "pageToken": "<token-del-run-padre>"
}
```

### Credenciales/env necesarias en el proyecto

- `GOOGLE_PLACES_API_KEY` (obligatoria para este flujo)
- `GOOGLE_REQUEST_TIMEOUT_SECONDS` (opcional, default 10)
- `GOOGLE_DAILY_REQUEST_LIMIT` (control de cuota local del worker)
- `GOOGLE_QUOTA_STATE_PATH` (estado local de cuota)

Opcional para geocoding (no bloquea paginacion de Places):

- `GOOGLE_GEOCODING_API_KEY` (si falta, se reutiliza `GOOGLE_PLACES_API_KEY`)

## Comandos de validacion usados

- `npm --workspace apps/web run test`
- `./scripts/dev/test-workers.sh`
- `npm run typecheck`

## Notas para frontend (trabajo futuro)

- No calcular ni persistir tokens de Google en UI; siempre usar API local.
- Mantener confirmacion obligatoria antes de consumir API externa.
- Tratar `200` de `POST /api/search/{id}/next` como idempotente (ya existia child).
- Tratar `409` como estado de negocio (sin next page o run no listo), no como error tecnico.
