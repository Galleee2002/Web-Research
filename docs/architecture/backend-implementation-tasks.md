# Documento de Tareas Backend - Business Lead Finder

## 1. Objetivo y alcance backend

Este documento define las tareas backend necesarias para construir el MVP de
Business Lead Finder. El objetivo es convertir el plan funcional en una guia
tecnica ejecutable, alineada con la arquitectura actual del repositorio:

- API backend: Next.js API routes en `apps/web/app/api`.
- Workers e ingesta: Python en `services/workers`.
- Base de datos: PostgreSQL en `database`.
- Contratos compartidos: `packages/shared`.
- Documentacion tecnica: `docs`.

El backend debe permitir:

- registrar busquedas por rubro y ubicacion;
- consultar Google Places API desde workers Python;
- complementar datos de ubicacion con Google Geocoding API cuando haga falta;
- normalizar negocios externos a un modelo interno estable;
- detectar negocios sin sitio web propio;
- persistir busquedas y negocios en PostgreSQL;
- evitar duplicados basicos;
- exponer negocios y busquedas mediante API routes;
- actualizar estado y notas de leads;
- exportar resultados en CSV;
- dejar el sistema preparado para colas futuras sin requerirlas en el MVP.

### Fuera de alcance para el MVP

- FastAPI como backend HTTP separado.
- autenticacion multiusuario;
- CRM integrado;
- outreach automatizado;
- scraping directo de Google;
- machine learning o scoring predictivo avanzado;
- sincronizacion en tiempo real;
- Redis, RabbitMQ, Celery o RQ como requisito inicial.

## 2. Arquitectura backend hibrida

La arquitectura oficial del repositorio es hibrida:

1. Next.js recibe requests HTTP desde el frontend mediante API routes.
2. Las API routes validan payloads, consultan PostgreSQL y exponen datos.
3. Los workers Python ejecutan la ingesta, normalizacion y enriquecimiento.
4. PostgreSQL es la fuente de verdad compartida entre API routes y workers.
5. Los contratos compartidos viven en `packages/shared` para evitar drift entre
   frontend, API routes y workers.

### Responsabilidades por subsistema

#### `apps/web`

- Definir API routes bajo `apps/web/app/api`.
- Implementar acceso a PostgreSQL para operaciones HTTP.
- Exponer endpoints de busquedas, negocios, actualizacion de leads y CSV.
- Convertir errores internos en respuestas HTTP consistentes.
- Consumir tipos y constantes compartidas desde `packages/shared`.

#### `services/workers`

- Consumir Google Places API como proveedor principal.
- Consumir Google Geocoding API como complemento para normalizar o enriquecer
  ubicaciones cuando Google Places no entregue datos suficientes.
- Normalizar respuestas externas.
- Detectar presencia real de website.
- Aplicar deduplicacion e idempotencia.
- Persistir resultados en PostgreSQL.
- Actualizar estados de `search_runs`.
- Reservar `services/workers/src/jobs` para ejecucion futura en background.

#### `database`

- Mantener migraciones PostgreSQL.
- Mantener seeds de desarrollo y pruebas.
- Documentar decisiones de schema cuando afecten integridad o rendimiento.

#### `packages/shared`

- Centralizar enums y contratos compartidos.
- Evitar strings duplicados para estados, fuentes y filtros.
- Servir como referencia comun entre Next.js y Python mediante contratos
  documentados, aunque cada runtime tenga su implementacion concreta.

## 3. Modelo de dominio

### Entidades principales del MVP

#### `search_runs`

Representa una ejecucion de busqueda creada por el usuario.

Responsabilidades:

- almacenar `query` y `location`;
- registrar proveedor utilizado;
- reflejar estado operativo de la busqueda;
- guardar conteo de resultados procesados;
- registrar timestamps de inicio, fin, creacion y actualizacion;
- permitir diagnosticar errores de proveedor o procesamiento.

Estados permitidos:

- `pending`: busqueda creada, aun no procesada;
- `processing`: busqueda en ejecucion;
- `completed`: busqueda procesada correctamente;
- `failed`: busqueda finalizada con error recuperable o proveedor fallido.

#### `businesses`

Representa un negocio detectado por el sistema.

Responsabilidades:

- almacenar datos normalizados del negocio;
- registrar trazabilidad del proveedor externo;
- clasificar si tiene sitio web propio;
- guardar estado operativo del lead;
- permitir filtros, paginacion y exportacion;
- evitar duplicados mediante claves estables o fallback por nombre y direccion.

Estados de lead permitidos:

- `new`;
- `reviewed`;
- `contacted`;
- `discarded`.

### Decision MVP sobre `lead_status`

El PRD menciona una tabla `lead_status`, pero para simplificar el MVP el estado
vive en `businesses.status` y las notas en `businesses.notes`.

La tabla `lead_status` queda como evolucion futura si se necesita:

- historial de cambios de estado;
- auditoria;
- multiples notas por negocio;
- usuarios responsables por cambio.

## 4. Modelo de datos PostgreSQL

### Tabla `search_runs`

Campos requeridos:

| Campo | Tipo sugerido | Reglas |
| --- | --- | --- |
| `id` | UUID o bigserial | Clave primaria |
| `query` | varchar/text | Requerido, no vacio |
| `location` | varchar/text | Requerido, no vacio |
| `source` | varchar | Default `google_places` |
| `status` | varchar o enum | `pending`, `processing`, `completed`, `failed` |
| `total_found` | integer | Default `0` |
| `error_message` | text nullable | Mensaje tecnico resumido |
| `started_at` | timestamptz nullable | Set al iniciar procesamiento |
| `finished_at` | timestamptz nullable | Set al completar o fallar |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Actualizado en cambios |

Indices minimos:

- `idx_search_runs_status`;
- `idx_search_runs_created_at`;
- `idx_search_runs_source`.

### Tabla `businesses`

Campos requeridos:

| Campo | Tipo sugerido | Reglas |
| --- | --- | --- |
| `id` | UUID o bigserial | Clave primaria |
| `search_run_id` | FK nullable | Referencia a `search_runs.id` |
| `external_id` | varchar nullable | ID estable del proveedor |
| `source` | varchar | Default `google_places` |
| `name` | varchar | Requerido |
| `category` | varchar nullable | Categoria principal |
| `address` | text nullable | Direccion normalizada |
| `city` | varchar nullable | Ciudad si puede derivarse |
| `region` | varchar nullable | Provincia, estado o region |
| `country` | varchar nullable | Pais |
| `lat` | numeric nullable | Latitud |
| `lng` | numeric nullable | Longitud |
| `phone` | varchar nullable | Telefono normalizado si existe |
| `website` | text nullable | URL aceptada como website propio |
| `has_website` | boolean | Requerido, default `false` |
| `maps_url` | text nullable | URL publica del mapa |
| `status` | varchar o enum | Default `new` |
| `notes` | text nullable | Notas internas |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Actualizado en cambios |

Indices minimos:

- `idx_businesses_external_id_source`;
- `idx_businesses_has_website`;
- `idx_businesses_status`;
- `idx_businesses_city`;
- `idx_businesses_category`;
- `idx_businesses_created_at`;
- `idx_businesses_name_address`.

Restricciones minimas:

- `status` debe pertenecer al enum de leads.
- `source` no debe ser nulo.
- `name` no debe estar vacio.
- si `website` es `null`, `has_website` debe ser `false`.
- unicidad parcial recomendada para `external_id + source` cuando
  `external_id` no sea `null`.

### Deduplicacion en base de datos

La base debe ayudar a la idempotencia, pero la politica completa vive en la
capa de servicios/workers.

Reglas:

1. Si existe `external_id`, buscar duplicado por `source + external_id`.
2. Si no existe `external_id`, buscar duplicado por `normalized_name + normalized_address`
   o por comparacion equivalente de `name + address`.
3. Si se encuentra duplicado, actualizar solo campos faltantes o mejores.
4. Si no se encuentra duplicado, insertar un negocio nuevo.

## 5. Contratos API

Todas las API routes viven bajo `apps/web/app/api`.

### `POST /api/search`

Responsabilidad:

- validar una nueva busqueda;
- crear un registro `search_run`;
- dejarlo en `pending` o disparar procesamiento inicial;
- devolver la busqueda creada.

Request:

```json
{
  "query": "dentistas",
  "location": "Buenos Aires, Argentina"
}
```

Response `201`:

```json
{
  "id": "search_run_id",
  "query": "dentistas",
  "location": "Buenos Aires, Argentina",
  "source": "google_places",
  "status": "pending",
  "total_found": 0,
  "created_at": "2026-04-22T12:00:00Z"
}
```

Errores:

- `400` si `query` o `location` estan vacios;
- `500` si falla la persistencia.

### `GET /api/searches`

Responsabilidad:

- listar ejecuciones de busqueda;
- permitir seguimiento operativo desde el dashboard.

Parametros:

- `page`;
- `page_size`;
- `status`;
- `source`.

Response:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

### `GET /api/businesses`

Responsabilidad:

- listar negocios persistidos;
- aplicar filtros;
- paginar resultados;
- ordenar de forma estable.

Filtros minimos:

- `has_website`;
- `status`;
- `city`;
- `category`;
- `query` para busqueda textual por nombre.

Paginacion:

- `page`, default `1`;
- `page_size`, default `20`;
- `page_size` maximo `100`.

Ordenamiento minimo:

- `created_at`;
- `name`;
- `city`.

Response:

```json
{
  "items": [
    {
      "id": "business_id",
      "name": "Clinica Demo",
      "category": "Dentist",
      "address": "Av. Siempre Viva 123",
      "city": "Buenos Aires",
      "phone": "+54 11 1234 5678",
      "website": null,
      "has_website": false,
      "status": "new",
      "maps_url": "https://maps.google.com/..."
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### `GET /api/businesses/{id}`

Responsabilidad:

- devolver el detalle completo de un negocio.

Errores:

- `404` si el negocio no existe.

### `PATCH /api/businesses/{id}`

Responsabilidad:

- actualizar `status`;
- actualizar `notes`;
- preservar el resto de campos normalizados.

Request:

```json
{
  "status": "reviewed",
  "notes": "Revisar propuesta de sitio institucional."
}
```

Errores:

- `400` si `status` no pertenece al enum;
- `404` si el negocio no existe.

### `GET /api/export`

Responsabilidad:

- exportar CSV usando los mismos filtros que `GET /api/businesses`.

Columnas minimas:

- `name`;
- `category`;
- `address`;
- `city`;
- `phone`;
- `website`;
- `has_website`;
- `status`;
- `maps_url`.

Headers esperados:

- `Content-Type: text/csv`;
- `Content-Disposition: attachment; filename="business-leads.csv"`.

## 6. Contratos compartidos

Los contratos deben tener una fuente clara en `packages/shared`.

### Enums

`LeadStatus`:

```txt
new
reviewed
contacted
discarded
```

`SearchRunStatus`:

```txt
pending
processing
completed
failed
```

`BusinessSource`:

```txt
google_places
```

### Esquemas logicos

`SearchCreate`:

- `query`;
- `location`.

`SearchRead`:

- `id`;
- `query`;
- `location`;
- `source`;
- `status`;
- `total_found`;
- `created_at`.

`BusinessRead`:

- `id`;
- `name`;
- `category`;
- `address`;
- `city`;
- `phone`;
- `website`;
- `has_website`;
- `status`;
- `maps_url`.

`BusinessStatusUpdate`:

- `status`;
- `notes` opcional.

`PaginatedResponse<T>`:

- `items`;
- `total`;
- `page`;
- `page_size`.

`NormalizedBusiness`:

- `external_id`;
- `source`;
- `name`;
- `category`;
- `address`;
- `city`;
- `region`;
- `country`;
- `lat`;
- `lng`;
- `phone`;
- `website`;
- `has_website`;
- `maps_url`.

## 7. Pipeline Python de ingesta

El worker Python debe implementar el flujo de ingestion sin exponer HTTP.

Flujo esperado:

1. recibir o leer un `search_run` en estado `pending`;
2. marcarlo como `processing`;
3. consultar Google Places API;
4. consultar Google Geocoding API solo si se necesita complementar ubicacion;
5. obtener resultados crudos;
6. normalizar cada resultado;
7. detectar website propio;
8. deduplicar contra PostgreSQL;
9. insertar o actualizar negocios;
10. actualizar `search_runs.total_found`;
11. marcar `search_run` como `completed`;
12. si falla una dependencia externa, registrar error y marcar `failed`.

### Clientes Google

Responsabilidades:

- construir requests;
- inyectar `GOOGLE_PLACES_API_KEY`;
- usar `GOOGLE_GEOCODING_API_KEY` solo si se decide separar credenciales; por
  defecto puede usarse la misma API key de Google Cloud con Places API y
  Geocoding API habilitadas;
- configurar timeouts;
- manejar errores 4xx, 5xx y rate limits;
- devolver payload crudo sin contaminar el modelo interno.

Errores contemplados:

- API key invalida;
- rate limit;
- respuesta vacia;
- timeout;
- error 4xx;
- error 5xx;
- payload incompleto.

### Adaptador de proveedor

Responsabilidades:

- mapear la respuesta de Google Places a `NormalizedBusiness`;
- usar Google Geocoding como complemento para completar ciudad, region, pais o
  coordenadas cuando sea necesario;
- aislar nombres de campos propios del proveedor;
- permitir sumar otro proveedor futuro sin cambiar API routes ni schema central.

Interfaz logica:

```txt
search_businesses(query, location) -> list[raw_business]
get_business_details(external_id) -> raw_business_details
geocode_location(address_or_location) -> raw_geocoding_result
normalize_external_business(raw_item) -> NormalizedBusiness
```

## 8. Normalizacion, website detection y deduplicacion

### Normalizacion

Reglas minimas:

- nombre externo -> `name`;
- direccion completa -> `address`;
- categoria principal -> `category`;
- telefono -> `phone`;
- website aceptado -> `website`;
- coordenadas -> `lat` y `lng`;
- URL de Google Maps -> `maps_url`;
- proveedor -> `source = google_places`.

Si Google Places no permite separar ciudad, region o pais de forma confiable en
la primera version, esos campos pueden quedar `null`, pero la direccion completa
debe preservarse.

### Website detection

Reglas MVP:

1. Si el proveedor no devuelve website, guardar `website = null` y
   `has_website = false`.
2. Si el proveedor devuelve dominio propio, guardar la URL y
   `has_website = true`.
3. Redes sociales no cuentan como website propio.
4. Directorios o agregadores no cuentan como website propio.

Dominios a tratar como no website propio en el MVP:

- `instagram.com`;
- `facebook.com`;
- `fb.com`;
- `wa.me`;
- `api.whatsapp.com`;
- `linktr.ee`;
- `beacons.ai`;
- `google.com`;
- `maps.google.com`;
- directorios locales o agregadores definidos por tests.

### Deduplicacion

Reglas MVP:

1. Preferir `external_id + source`.
2. Si no hay `external_id`, usar `name + address`.
3. Normalizar antes de comparar:
   - trim;
   - lowercase;
   - colapsar espacios repetidos;
   - evitar diferencias triviales de puntuacion cuando sea razonable.
4. En duplicados, no crear registro nuevo.
5. En duplicados, completar campos vacios con datos nuevos si son mejores:
   - `phone`;
   - `website`;
   - `maps_url`;
   - `category`;
   - `city`;
   - `region`;
   - `country`;
   - `lat`;
   - `lng`.

El estado manual del lead no debe degradarse durante una actualizacion de datos.
Por ejemplo, un lead `contacted` no debe volver a `new` por reingesta.

## 9. Fases de implementacion con tareas concretas

### Fase 1 - Base documental y decisiones de arquitectura

Objetivo:

- dejar claro que el MVP usa Next.js API routes, Python workers y PostgreSQL.

Tareas:

- documentar arquitectura hibrida;
- registrar que FastAPI queda fuera del MVP;
- definir entidades principales;
- definir estados de busqueda y lead;
- definir flujo end-to-end;
- registrar decisiones sobre `lead_status`.

Entregable:

- documento tecnico base en `docs/architecture`.

Criterio de aceptacion:

- cualquier implementador puede identificar donde vive cada responsabilidad.

### Fase 2 - Inicializacion de monorepo ejecutable

Estado:

- completada como scaffold inicial ejecutable;
- no incluye todavia migraciones, CRUD backend, contratos compartidos completos
  ni integracion real con Google Places.

Objetivo:

- convertir la estructura inicial en un monorepo ejecutable.

Tareas:

- inicializar Next.js dentro de `apps/web` respetando la estructura existente;
- definir dependencias de acceso a PostgreSQL para API routes;
- inicializar entorno Python en `services/workers`;
- definir dependencias Python para workers, tests, settings y HTTP client;
- crear scripts de desarrollo en `scripts/dev`;
- documentar variables de entorno requeridas;
- agregar configuracion local sin hardcodear secretos.

Variables minimas:

- `APP_ENV`;
- `DATABASE_URL`;
- `GOOGLE_PLACES_API_KEY`;
- `GOOGLE_GEOCODING_API_KEY` opcional si se separan credenciales de Google;
- `DEFAULT_PAGE_SIZE`;
- `MAX_PAGE_SIZE`;
- `LOG_LEVEL`.

Entregables:

- manifiestos de dependencias;
- `package.json` versionado para Next.js/API routes con scripts oficiales;
- manifiesto Python versionado para workers, como `pyproject.toml` o
  `requirements.txt`;
- comandos de arranque;
- comandos oficiales de test y typecheck;
- configuracion de entorno;
- healthcheck o ruta equivalente de estado para API.

Implementacion actual:

- Next.js con TypeScript, SCSS y npm workspaces en `apps/web`;
- ruta `GET /api/health` con validacion opcional de PostgreSQL;
- dependencia `pg` para acceso futuro a PostgreSQL desde API routes;
- entorno Python importable en `services/workers` con `pyproject.toml`;
- dependencias Python iniciales para HTTP, settings, PostgreSQL y tests;
- `.env.example` con placeholders sin secretos;
- scripts en `scripts/dev` para web, worker y tests;
- guia operativa en `docs/architecture/backend-runtime.md`.

Criterio de aceptacion:

- el proyecto puede instalar dependencias y arrancar localmente con una base
  PostgreSQL configurada.
- un entorno limpio puede reproducir los comandos de test y typecheck sin
  depender de `node_modules` o caches locales preexistentes.

### Nota de coherencia tras Fase 7

La configuracion minima de desarrollo y los comandos oficiales ya quedaron
materializados en el estado actual del repositorio.

Estado real:

- `package.json`, `package-lock.json`, `apps/web/package.json` y `tsconfig.json`
  ya cubren manifests y scripts base del monorepo;
- `services/workers/pyproject.toml` ya define runtime y extras de test para
  workers;
- `scripts/dev/start-web.sh`, `scripts/dev/run-worker.sh` y
  `scripts/dev/test-workers.sh` ya cubren arranque y validacion local;
- `.env.example` ya documenta variables requeridas sin versionar secretos;
- `docs/architecture/backend-runtime.md` ya documenta instalacion, test y
  ejecucion.

Conclusion:

- esta decision ya no es un pendiente previo a Fase 5;
- el foco actual del backend pasa a normalizacion, website detection,
  deduplicacion y orquestacion end-to-end.

### Fase 3 - Base de datos, migraciones y seeds

Estado:

- completada como schema persistente inicial del MVP;
- usa SQL plano versionado, sin framework de migraciones todavia;
- deja datos demo deterministas para desarrollo local y futuras API routes;
- aplicada y validada localmente contra PostgreSQL con `DATABASE_URL`.

Objetivo:

- crear el schema persistente del MVP.

Entregables:

- migracion `database/migrations/001_create_mvp_schema.sql`;
- seed `database/seeds/001_mvp_demo_data.sql`;
- notas de schema en `database/docs/mvp-schema.md`.

Implementacion actual:

- tablas `search_runs` y `businesses` con UUIDs generados por `pgcrypto`;
- constraints para estados, fuente, campos requeridos, conteos, coordenadas y
  coherencia entre `website` y `has_website`;
- indices minimos para filtros y ordenamiento de busquedas y negocios;
- unicidad parcial para `source + external_id` cuando existe ID de proveedor;
- indice no unico para apoyar fallback por `name + address`;
- seed con una busqueda demo y negocios con website, sin website y perfiles
  sociales tratados como leads sin website propio;
- comandos documentados para correr migracion y seed con `psql`.

Validacion local:

- conexion PostgreSQL confirmada con `select current_database()`, devolviendo
  `business_lead_finder`;
- migracion `001_create_mvp_schema.sql` aplicada correctamente;
- seed `001_mvp_demo_data.sql` aplicado correctamente;
- datos esperados tras seed: 1 registro en `search_runs` y 6 registros en
  `businesses`.

Criterio de aceptacion:

- una base limpia recrea el schema completo y carga datos de prueba.
- siguiente paso recomendado: Fase 4, contratos compartidos y validaciones.

### Fase 4 - Contratos compartidos y validaciones

Estado:

- completada como contratos compartidos iniciales del MVP;
- implementada sin agregar manifests ni dependencias nuevas al monorepo;
- mantiene contratos TypeScript para API routes/frontend y equivalentes Python
  para workers;
- validada con tests acotados de TypeScript y Python.

Objetivo:

- evitar divergencias entre frontend, API routes y workers.

Entregables:

- contratos TypeScript en `packages/shared`;
- validaciones reutilizables para futuras API routes;
- contratos Python equivalentes en `services/workers/src/contracts`;
- tests de contrato en `packages/shared/contracts.test.ts` y
  `services/workers/tests/test_contracts.py`.

Implementacion actual:

- enums y type guards para `LeadStatus`, `SearchRunStatus` y `BusinessSource`;
- defaults de paginacion `DEFAULT_PAGE_SIZE = 20` y `MAX_PAGE_SIZE = 100`;
- limites iniciales para `query`, `location`, `notes`, `city`, `category` y
  busqueda textual;
- tipos `SearchCreate`, `SearchRead`, `BusinessRead`,
  `BusinessStatusUpdate`, `NormalizedBusiness` y `PaginatedResponse<T>`;
- validadores puros para crear busquedas, actualizar estado/notas, paginar y
  filtrar busquedas o negocios;
- contrato Python independiente con `NormalizedBusiness` como dataclass y
  validadores equivalentes para estados, fuente, campos requeridos y coherencia
  `website`/`has_website`.

Validacion local:

- `npx vitest run packages/shared/contracts.test.ts` pasa 4 tests;
- `PYTHONPATH=services/workers/src pytest services/workers/tests/test_contracts.py -q`
  pasa 4 tests;
- los valores de estado y fuente coinciden con las constraints de
  `database/migrations/001_create_mvp_schema.sql`.

Criterio de aceptacion:

- un cambio de estado o filtro no requiere editar strings sueltos en varias capas.
- siguiente paso recomendado: Fase 5, API routes CRUD base.

### Fase 5 - API routes CRUD base

Estado:

- completada como API CRUD base del MVP sobre PostgreSQL;
- implementada con Next.js API routes bajo `apps/web/app/api`;
- usa contratos y validadores de `packages/shared`;
- usa SQL parametrizado con `pg`, sin ORM;
- no dispara workers ni llama Google Places todavia.

Objetivo:

- exponer operaciones backend basicas sobre datos persistidos localmente.

Entregables implementados:

- configuracion minima reproducible con `package.json`, `package-lock.json`,
  `tsconfig.json`, `apps/web/tsconfig.json`, `next.config.mjs` y
  `.env.example`;
- `POST /api/search` para crear `search_runs` en estado `pending`;
- `GET /api/searches` con filtros por `status`, `source` y paginacion;
- `GET /api/businesses` con filtros por `has_website`, `status`, `city`,
  `category`, `query`, paginacion y ordenamiento permitido;
- `GET /api/businesses/[id]` para detalle completo de negocio;
- `PATCH /api/businesses/[id]` para actualizar `status` y `notes`;
- `GET /api/export` para descargar CSV con los mismos filtros del listado;
- repositorios SQL en `apps/web/lib/db`;
- helpers HTTP y CSV en `apps/web/lib`;
- tests unitarios de filtros SQL, contratos y CSV;
- test de integracion de repositorio que se salta si `DATABASE_URL` no esta
  configurada.

Endpoints implementados:

- `POST /api/search`;
- `GET /api/searches`;
- `GET /api/businesses`;
- `GET /api/businesses/[id]`;
- `PATCH /api/businesses/[id]`;
- `GET /api/export`.

Validacion local:

- `npm test -- packages/shared/contracts.test.ts apps/web/lib/db/businesses.test.ts apps/web/lib/db/searches.test.ts apps/web/lib/db/integration.test.ts apps/web/lib/utils/csv.test.ts`
  pasa 8 tests y salta 2 tests de integracion cuando no hay `DATABASE_URL`;
- `npm run typecheck` pasa correctamente;
- `npm run web:build` compila la app y registra las rutas API dinamicas.

Notas operativas:

- para validar contra base real, exportar `DATABASE_URL`, aplicar
  `database/migrations/001_create_mvp_schema.sql` y
  `database/seeds/001_mvp_demo_data.sql`;
- las rutas devuelven errores JSON consistentes para validacion, recursos no
  encontrados y errores internos;
- `POST /api/search` solo persiste la busqueda pendiente. La ejecucion del
  worker queda para fases posteriores.

Criterio de aceptacion:

- con seeds cargados, el dashboard puede leer, filtrar, actualizar y exportar
  negocios sin depender de Google Places.
- siguiente paso recomendado: Fase 7 para workers de Google.

### Fase 6 - Servicios y repositorios

Estado:

- completada como separacion interna entre API routes, servicios y
  repositorios;
- mantiene los contratos HTTP y el schema PostgreSQL sin cambios;
- no introduce ORM ni dependencias nuevas.

Objetivo:

- separar API routes, servicios y repositorios sin cambiar contratos publicos.

Tareas:

- crear servicio de busquedas;
- crear servicio de negocios;
- crear repositorios de `search_runs` y `businesses`;
- mover queries complejas fuera de API routes;
- centralizar reglas de filtros y paginacion;
- centralizar actualizacion de estado y notas;
- mantener intactos los contratos de API existentes;
- evitar cambios de ORM o de schema en esta fase.

Entregables:

- endpoints delgados que dependen de `apps/web/lib/services`;
- servicios testeables en `apps/web/lib/services`;
- repositorios reutilizables en `apps/web/lib/db`;
- tests unitarios de servicios sin invocar HTTP.

Criterio de aceptacion:

- las reglas de negocio pueden probarse sin invocar HTTP;
- los contratos de API siguen iguales;
- no se requiere migracion de schema ni introduccion de ORM.

Validacion local ejecutada:

- `npm test`: pasa 17 tests y salta 2 tests de integracion cuando no hay
  `DATABASE_URL`;
- `npm run typecheck`: pasa correctamente;
- `PYTHONPATH=services/workers/src pytest services/workers/tests -q`: pasa 5
  tests.

Siguiente paso recomendado:

- Fase 7, Worker Python de Google Places y Geocoding.

### Fase 7 - Worker Python de Google Places y Geocoding

Estado:

- completada como clientes internos del worker para Google Places Text Search
  (New) y Google Geocoding;
- implementada sin exponer nuevos endpoints HTTP para frontend;
- no persiste negocios ni actualiza `search_runs` todavia;
- protege creditos con limite diario persistente combinado para Places y
  Geocoding.

Objetivo:

- integrar Google Places API como proveedor externo inicial y Google Geocoding
  API como complemento de ubicacion.

Tareas:

- crear cliente Google Places;
- crear cliente Google Geocoding;
- crear adaptador de respuesta;
- definir cuando usar Geocoding para completar ciudad, region, pais o
  coordenadas;
- configurar timeouts;
- manejar rate limits;
- manejar errores de credenciales;
- mockear proveedor en tests;
- evitar llamadas reales en tests automatizados;
- limitar consumo a 1000 requests diarios combinados por defecto.

Entregables:

- `services/workers/src/ingestion/google_places/client.py` con cliente
  `GooglePlacesClient` para `POST /v1/places:searchText`;
- `services/workers/src/ingestion/google_places/geocoding.py` con cliente
  `GoogleGeocodingClient` para Geocoding API;
- `services/workers/src/ingestion/google_places/quota.py` con contador diario
  persistente;
- `services/workers/src/ingestion/google_places/errors.py` con errores
  tipados de proveedor, credenciales, cuota, timeout, rate limit y payload;
- `services/workers/src/ingestion/google_places/adapter.py` con helpers para
  extraer payload crudo;
- settings de worker para API keys, timeout, limite diario y path de estado;
- tests con `httpx.MockTransport`, sin red ni costo.

Variables de entorno agregadas:

- `GOOGLE_GEOCODING_API_KEY`: opcional; si falta, se usa
  `GOOGLE_PLACES_API_KEY`;
- `GOOGLE_REQUEST_TIMEOUT_SECONDS`: default `10`;
- `GOOGLE_DAILY_REQUEST_LIMIT`: default `1000`;
- `GOOGLE_QUOTA_STATE_PATH`: default `.worker-state/google-api-quota.json`.

Field mask de Places Text Search (New):

```txt
places.id,
places.displayName,
places.formattedAddress,
places.primaryType,
places.primaryTypeDisplayName,
places.types,
places.location,
places.nationalPhoneNumber,
places.internationalPhoneNumber,
places.websiteUri,
places.googleMapsUri,
nextPageToken
```

Alcance explicito:

- Fase 7 obtiene payloads crudos del proveedor;
- Fase 8 normaliza hacia `NormalizedBusiness`;
- Fase 9 clasifica website propio;
- Fase 10 deduplica;
- Fase 11 orquesta `search_run -> worker -> persistencia`.

Validacion local:

- `PYTHONPATH=services/workers/src python3 -m pytest services/workers/tests -q`
  pasa tests de contratos, settings, cuota y clientes Google con mocks.

Criterio de aceptacion:

- el worker puede obtener resultados reales cuando las APIs de Google estan
  habilitadas y los tests pueden correr sin red ni costo.
- el contador diario bloquea nuevas requests al llegar al limite configurado y
  se reinicia automaticamente al cambiar el dia.

### Fase 8 - Normalizacion de datos externos

Estado:

- completada como capa pura de normalizacion de payloads externos;
- implementada en workers Python sin llamadas HTTP, PostgreSQL, cuotas ni
  endpoints nuevos;
- mantiene `adapter.py` limitado a extraccion de payload crudo;
- originalmente preservaba `websiteUri` como dato normalizado sin decidir si
  era website propio; desde Fase 9 esa URL queda clasificada antes de devolver
  `NormalizedBusiness`.
- completada como normalizacion inicial del pipeline de worker;
- convierte payloads de Google Places a `NormalizedBusiness`;
- usa Google Geocoding como complemento para ciudad, region, pais y fallback de
  coordenadas cuando hay respuesta disponible.

Objetivo:

- convertir payloads externos en estructura interna estable.

Alcance explicito:

- transformar payloads de Google Places Text Search New a `NormalizedBusiness`;
- complementar `city`, `region`, `country`, `lat` y `lng` desde payload
  disponible de Google Geocoding cuando corresponda;
- validar el shape normalizado antes de que fases posteriores persistan datos;
- no persistir negocios;
- no deduplicar;
- no actualizar `search_runs`.

Entregables implementados:

- `services/workers/src/normalization/business.py` con
  `normalize_google_place(raw_place, geocoding_result=None)`;
- `services/workers/src/normalization/__init__.py` para exportar el
  normalizador;
- `services/workers/src/workers/normalization.py` como fachada operativa del
  pipeline;
- fixtures de Google Places y Google Geocoding en
  `services/workers/tests/fixtures`;
- tests unitarios en `services/workers/tests/test_normalization.py`.

Mapeo implementado:

- `id` -> `external_id`;
- `displayName.text` -> `name`;
- `formattedAddress` -> `address`;
- `primaryTypeDisplayName.text` con fallback a `primaryType` -> `category`;
- `internationalPhoneNumber` con fallback a `nationalPhoneNumber` -> `phone`;
- `websiteUri` -> candidato de `website` clasificado por Fase 9;
- `googleMapsUri` -> `maps_url`;
- `location.latitude` y `location.longitude` -> `lat` y `lng`;
- `results[0].address_components` de Geocoding -> `city`, `region` y
  `country`;
- `results[0].geometry.location` de Geocoding -> fallback de coordenadas si
  Places no trae coordenadas.

Validacion local:

- `PYTHONPATH=services/workers/src python3 -m pytest services/workers/tests/test_normalization.py -q`
  pasa 8 tests;
- `PYTHONPATH=services/workers/src python3 -m pytest services/workers/tests -q`
  pasa la suite completa de workers.

Casos cubiertos:

- payload completo de Google Places produce `NormalizedBusiness`;
- payload parcial preserva campos disponibles y deja opcionales como `null`;
- payload sin nombre falla con error claro;
- categoria usa `primaryType` si falta `primaryTypeDisplayName.text`;
- Geocoding completa ciudad, region y pais desde `address_components`;
- coordenadas de Geocoding se usan solo como fallback;
- antes de Fase 9, `websiteUri` se preservaba y `has_website` quedaba en
  `false`.

Criterio de aceptacion:

- el resto del sistema no depende de la forma exacta del payload de Google.
- cambios futuros de shape del proveedor quedan aislados en
  `services/workers/src/normalization`.
- siguiente paso recomendado: Fase 9, deteccion de website propio.

### Fase 9 - Deteccion de website propio

Estado:

- completada como helper puro dentro de la capa de normalizacion Python;
- integrada en `normalize_google_place` para que `NormalizedBusiness.website`
  guarde solo URLs aceptadas como website propio;
- no agrega endpoints HTTP, migraciones, llamadas externas, cuotas ni acceso a
  PostgreSQL.
- completada como helper operativo dentro del worker;
- clasifica perfiles sociales, directorios y URLs invalidas como no website
  propio;
- mantiene coherencia con contratos y restricciones de base de datos.

Objetivo:

- clasificar correctamente si un negocio tiene sitio web propio.

Tareas completadas:

- implementar helper de deteccion;
- mantener lista inicial de dominios no validos;
- tratar redes sociales como no website;
- tratar URLs vacias o invalidas como no website;
- documentar limitaciones del MVP.

Entregables implementados:

- `services/workers/src/normalization/website_detection.py` con
  `detect_own_website(raw_url)`;
- `WebsiteDetection` como resultado tipado con `website` y `has_website`;
- integracion en `services/workers/src/normalization/business.py`;
- `services/workers/src/workers/website_detection.py` para la ruta operativa
  del worker;
- tests unitarios en `services/workers/tests/test_website_detection.py`;
- tests de integracion de normalizacion en
  `services/workers/tests/test_normalization.py`.

Reglas implementadas:

- URLs `None`, vacias, whitespace, invalidas, sin scheme HTTP/HTTPS o sin
  hostname se clasifican como `website = null` y `has_website = false`;
- dominios propios validos se preservan en `website` y devuelven
  `has_website = true`;
- el bloqueo de dominios usa hostname case-insensitive, dominio exacto o
  subdominio real, evitando falsos positivos por substring;
- redes sociales, WhatsApp, Google, Google Maps, Linktree, Beacons y
  directorios MVP se clasifican como no website propio.

Dominios no validos iniciales:

- `instagram.com`;
- `facebook.com`;
- `fb.com`;
- `wa.me`;
- `api.whatsapp.com`;
- `linktr.ee`;
- `beacons.ai`;
- `google.com`;
- `maps.google.com`;
- `yelp.com`;
- `tripadvisor.com`.

Semantica persistente:

- `website` representa una URL aceptada como website propio, no una URL cruda
  del proveedor;
- si el proveedor devuelve una red social, WhatsApp, Google Maps o directorio,
  la salida normalizada queda con `website = null` y `has_website = false`;
- si en el futuro se necesita auditar la URL cruda del proveedor, debe agregarse
  otro campo en vez de reutilizar `website`.

Validacion local:

- `PYTHONPATH=services/workers/src python3 -m pytest services/workers/tests/test_website_detection.py services/workers/tests/test_normalization.py -q`
  pasa 30 tests;
- `PYTHONPATH=services/workers/src python3 -m pytest services/workers/tests -q`
  pasa 47 tests;
- `npm --workspace apps/web run test -- --run` pasa 13 tests y deja 2 tests de
  integracion omitidos sin `DATABASE_URL`.

Criterio de aceptacion:

- `has_website` queda persistido de forma consistente para todos los negocios.
- el frontend filtra leads sin web por `has_website = false` y no replica reglas
  de clasificacion.
- siguiente paso recomendado: Fase 10, deduplicacion e idempotencia.

### Fase 10 - Deduplicacion e idempotencia

Estado actual:

- completada como capa worker-side en `services/workers/src/persistence`;
- no modifica `apps/web`, porque las API routes siguen siendo lectoras,
  exportadoras y actualizadoras de leads manuales;
- usa PostgreSQL como fuente de verdad y `psycopg` para la ruta real de
  persistencia.
- la ruta operativa nueva en `services/workers/src/workers/repository.py`
  mantiene la misma politica de merge para el pipeline actual.

Objetivo:

- evitar registros duplicados y permitir reprocesar busquedas.

Tareas:

- implementar busqueda por `external_id + source` en
  `BusinessRepository.find_by_external_id`;
- implementar fallback por `name + address` en
  `BusinessRepository.find_by_name_address`;
- normalizar claves de comparacion con `canonicalize_dedup_text`;
- definir politica de merge en `BusinessUpsertService`;
- preservar `status` y `notes` manuales en toda reingesta;
- registrar duplicados detectados con `logging.info`.

Entregables:

- `services/workers/src/persistence/dedup.py` con canonicalizacion de claves
  de deduplicacion;
- `services/workers/src/persistence/businesses.py` con
  `upsert_business`, `BusinessUpsertService`, `BusinessRepository`,
  `BusinessRecord` y `UpsertBusinessResult`;
- `services/workers/src/workers/repository.py` como implementacion usada por la
  orquestacion nueva;
- `services/workers/tests/test_business_dedup.py` para helpers puros;
- `services/workers/tests/test_business_upsert.py` para idempotencia,
  merge conservador y cobertura PostgreSQL skippeable con `DATABASE_URL`.

Reglas implementadas:

- si entra `external_id`, se intenta primero `source + external_id`;
- si no hay match por ID externo, se usa fallback `name + address` solo cuando
  ambos valores existen despues de canonicalizar;
- el fallback solo fusiona contra filas sin `external_id`, para no mezclar
  negocios con IDs de proveedor distintos;
- la canonicalizacion aplica trim, lowercase, colapso de espacios, remocion de
  puntuacion trivial y remocion de diacriticos;
- el merge completa campos vacios con datos entrantes para `phone`, `website`,
  `maps_url`, `category`, `city`, `region`, `country`, `lat`, `lng`,
  `external_id` y `search_run_id`;
- `status` y `notes` nunca se sobrescriben durante reingesta;
- `website` no se limpia por reingesta; solo se setea si estaba vacio y entra
  un website propio ya clasificado por Fase 9;
- `updated_at` cambia solo cuando hay campos mergeados.

Cobertura nueva:

- `services/workers/tests/test_repository.py` valida dedupe y merge de la ruta
  operativa del worker.

Criterio de aceptacion:

- correr dos veces la misma ingesta no duplica negocios.
- `PYTHONPATH=services/workers/src python3 -m pytest services/workers/tests -q`
  pasa la suite de workers.

Siguiente paso recomendado:

- Fase 11, orquestacion `search_run -> worker -> persistencia`, debe consumir
  `upsert_business` para persistir los `NormalizedBusiness` generados por
  Google Places y Geocoding.

### Fase 11 - Orquestacion search run -> worker -> persistencia

Estado:

- completada como flujo ejecutable del worker sobre la base de Fases 2 a 10;
- `POST /api/search` debe seguir creando `search_runs` en `pending` sin
  bloquear la request HTTP;
- la activacion actual del MVP es worker por ejecucion manual con
  `python -m workers` o `./scripts/dev/run-worker.sh`, procesando pendientes
  hasta vaciar la cola logica de `search_runs`;
- no introduce Redis, RabbitMQ ni otro sistema de colas.

Objetivo:

- conectar busquedas creadas con procesamiento real.

Implementacion actual:

- la API web sigue siendo delgada y solo crea la busqueda;
- el worker reclama `search_runs` pendientes y ejecuta el pipeline;
- el mecanismo actual de ejecucion es simple y observable:
  - `python -m workers` procesa uno o varios pendientes;
  - `./scripts/dev/run-worker.sh` envuelve esa ejecucion local;
- el reclamo de trabajo debe ser seguro ante concurrencia basica usando
  `for update skip locked`;
- `total_found` debe reflejar la cantidad de resultados externos procesados por
  la corrida, aunque algunos terminen resolviendo a merge sobre registros ya
  existentes;
- cuando un negocio duplicado ya existe, se actualizan solo campos faltantes o
  mejores sin degradar `status` ni `notes`;
- mientras el modelo siga usando un solo `businesses.search_run_id`, en
  duplicados conviene preservar el `search_run_id` original del registro ya
  existente para no perder trazabilidad del primer alta.

Componentes implementados:

1. Persistencia del worker
- repositorio Python para reclamar un `search_run` pendiente;
- actualizacion de `processing`, `completed` y `failed`;
- persistencia de `started_at`, `finished_at`, `total_found` y `error_message`;
- insercion o merge de `businesses` con SQL parametrizado.

2. Runner de corrida
- `WorkerPipeline.process_next_pending_search_run()` para modo batch simple;
- procesamiento en loop desde `services/workers/src/workers/__main__.py`;
- logs basicos por `search_run_id`.

3. Integracion con proveedor
- lectura de `query` y `location` desde `search_runs`;
- consulta a Google Places;
- consulta a Geocoding por direccion del negocio para enriquecer datos.

4. Pipeline por negocio
- extraccion de payload crudo;
- normalizacion a `NormalizedBusiness`;
- clasificacion de website propio;
- upsert idempotente preservando estado manual del lead.

5. Validacion implementada
- tests unitarios de normalizacion, pipeline, dedupe y merge;
- test de exito `pending -> processing -> completed`;
- test de error controlado `pending -> processing -> failed`.

Entregables:

- repositorios Python para `search_runs` y `businesses`;
- runner del worker para procesar pendientes;
- flujo end-to-end `search_run -> proveedor -> normalizacion -> deduplicacion -> persistencia`;
- estados `pending`, `processing`, `completed` y `failed` actualizados de forma
  consistente;
- logs minimos con `search_run_id`;
- tests de pipeline y errores operativos.

Criterio de aceptacion:

- crear una busqueda termina generando negocios consultables por API.
- reprocesar una misma busqueda no duplica negocios.
- un fallo del proveedor deja `search_runs.status = failed` con
  `error_message` resumido.
- el dashboard puede observar el avance de `search_runs` sin que la API cambie
  su contrato actual para crear busquedas.

Recomendacion operativa al completar la fase:

- validar primero el flujo real con un lote controlado de 10 a 20 busquedas;
- revisar resultados persistidos, estados de `search_runs`, errores de
  proveedor y consumo de cuota;
- ejecutar lotes grandes, como 1000 requests diarios a Google, solo despues de
  confirmar el flujo controlado y preferentemente con los logs y diagnostico de
  Fase 13 disponibles;
- ajustar `GOOGLE_DAILY_REQUEST_LIMIT` de forma explicita antes de pruebas de
  volumen y recordar que requests a Places y Geocoding comparten el presupuesto
  diario configurado.

### Fase 12 - Filtros, paginacion y CSV

Estado:

- implementada a nivel backend mediante API routes, contratos compartidos,
  repositorios SQL y utilidades CSV;
- cerrable como capacidad backend del MVP, aunque el dashboard todavia no la
  consuma directamente;
- la verificacion ampliada de routes e integracion queda como deuda explicita
  de la Fase 14.

Objetivo:

- consolidar y dejar documentado el estado real de filtros, paginacion y
  exportacion CSV ya disponibles en backend.

Tareas:

- confirmar que `GET /api/businesses` ya soporta filtros combinables por
  `has_website`, `status`, `city`, `category` y `query`;
- confirmar que la paginacion actual usa `page`, `page_size` y limite maximo
  compartido mediante `MAX_PAGE_SIZE`;
- confirmar que `order_by` sigue limitado a `created_at`, `name` y `city`;
- confirmar que `GET /api/export` reutiliza exactamente el mismo parsing y los
  mismos filtros que el listado paginado;
- dejar explicito que `page` y `page_size` hoy se normalizan a defaults o
  maximos y no generan `400` por si solos;
- dejar explicito que el CSV actual mantiene sus columnas y responde con
  `Content-Type: text/csv; charset=utf-8`;
- dejar explicito que la UI todavia no consume esta capacidad y que el alcance
  de la fase es backend;
- documentar que la cobertura actual es solida en contratos, repositorios SQL
  y utilidades CSV, pero no cierra aun tests de route-level.

Entregables:

- listado backend estable;
- exportacion CSV backend estable;
- contratos compartidos y SQL alineados con filters, orden y paginacion;
- documentacion actualizada del estado real de la fase.

Criterio de aceptacion:

- el backend puede devolver el mismo conjunto filtrado tanto en JSON paginado
  como en CSV;
- no hay drift entre contratos compartidos, repositorios SQL y API routes;
- la documentacion no promete consumo frontend activo ni validaciones mas
  estrictas que las hoy implementadas.

Nota de alcance:

- Fase 12 cubre capacidad backend; la integracion del dashboard sigue siendo
  trabajo frontend.

Mejoras futuras no bloqueantes:

- compatibilidad CSV mas fuerte con Excel o Sheets si mas adelante se agrega
  BOM UTF-8 u otra compatibilidad adicional;
- tests de routes para `/api/businesses`, `/api/searches` y `/api/export`;
- mejoras de performance para busqueda textual si el volumen de datos del MVP
  lo exige.

### Fase 13 - Errores, logs y observabilidad

Estado:

- implementada sobre la base ya existente de envelope HTTP, healthcheck y logs
  minimos del worker;
- cerrada como primera capa de observabilidad operativa del MVP, sin depender
  de proveedores externos;
- alineada con persistencia ampliada en `search_runs` para `correlation_id`,
  `error_code`, `error_stage` y `observability`.

Objetivo:

- hacer el backend diagnosticable desde la API hasta el worker usando
  trazabilidad persistida y logs estructurados.

Tareas:

- consolidar un formato de error HTTP con `error.code`,
  `error.message`, `error.details?` y `error.correlation_id`;
- generar o aceptar `X-Correlation-Id` en API routes;
- persistir `correlation_id` al crear `search_runs`;
- persistir `error_code`, `error_stage` y resumen de ejecucion en
  `search_runs.observability`;
- loguear inicio, exito y error de requests API con `route`, `method`,
  `status_code` y `duration_ms`;
- loguear inicio y resultado de pipeline, proveedor, geocoding, deduplicacion,
  inserciones y updates;
- incluir `search_run_id` y `correlation_id` en logs del worker;
- dejar explicito que Geocoding hoy se usa por `formattedAddress` para derivar
  ubicacion normalizada;
- dejar explicito que la deduplicacion actual preserva datos existentes y
  completa campos faltantes.

Entregables:

- errores HTTP consistentes con `correlation_id`;
- logs estructurados o semiestructurados en API, DB y worker;
- diagnostico basico por `search_run_id` y `correlation_id`;
- metadata operativa persistida por corrida en `search_runs.observability`.

Criterio de aceptacion:

- un fallo de proveedor puede rastrearse desde la API hasta el worker usando
  `correlation_id`, `search_run_id`, `error_code` y `error_stage`;
- `POST /api/search` persiste `correlation_id` en `search_runs`;
- `GET /api/health` mantiene su contrato funcional y adopta logging
  consistente;
- la documentacion frontend y backend describe el mismo contrato de error.

### Fase 14 - Testing backend

Estado:

- implementada como fase de hardening de cobertura;
- consolida la cobertura previa en contratos compartidos, servicios,
  repositorios, utilidades CSV, healthcheck, `POST /api/search`,
  normalizacion, website detection, clientes Google mockeados, deduplicacion y
  pipeline del worker;
- agrega cobertura route-level para los endpoints consumidos por frontend y
  fija invariantes de deduplicacion operativa del worker.

Objetivo:

- cubrir reglas criticas antes de ampliar seguridad, configuracion operativa y
  despliegue;
- fijar con tests los contratos HTTP que consume el dashboard;
- evitar regresiones en deduplicacion, website detection, CSV, errores con
  `correlation_id` y orquestacion worker -> PostgreSQL.

Cobertura ya existente:

- `packages/shared/contracts.test.ts` cubre contratos base compartidos;
- `apps/web/app/api/health/route.test.ts` cubre healthcheck y errores
  operativos basicos;
- `apps/web/app/api/search/route.test.ts` cubre validacion, JSON invalido y
  propagacion de `X-Correlation-Id` para crear busquedas;
- `apps/web/lib/db/businesses.test.ts` y `apps/web/lib/db/searches.test.ts`
  cubren builders SQL parametrizados;
- `apps/web/lib/services/business-service.test.ts` y
  `apps/web/lib/services/search-service.test.ts` cubren delegacion de servicios
  hacia repositorios;
- `apps/web/lib/utils/csv.test.ts` cubre serializacion CSV;
- `services/workers/tests/test_google_clients.py` cubre Google Places y
  Geocoding con `httpx.MockTransport`, sin red ni consumo de cuota;
- `services/workers/tests/test_normalization.py` cubre mapeo de Google Places y
  enriquecimiento con Geocoding;
- `services/workers/tests/test_website_detection.py` cubre redes sociales,
  directorios, URLs invalidas y dominios propios;
- `services/workers/tests/test_business_dedup.py`,
  `services/workers/tests/test_business_upsert.py`,
  `services/workers/tests/test_repository.py` y
  `services/workers/tests/test_pipeline.py` cubren deduplicacion, merge
  conservador, pipeline exitoso y fallos de proveedor.

Gaps cerrados:

1. API routes que consume el frontend:
   - `apps/web/app/api/searches/route.test.ts`;
   - `apps/web/app/api/businesses/route.test.ts`;
   - `apps/web/app/api/businesses/[id]/route.test.ts`;
   - `apps/web/app/api/export/route.test.ts`.
2. Contrato de errores:
   - se verifica `validation_error`, `not_found`, `invalid_json`,
     `database_error` o `internal_error` segun corresponda;
   - se verifica que los errores HTTP incluyan `error.correlation_id`;
   - se verifica que `X-Correlation-Id` entrante se respeta cuando se provee.
3. Contrato frontend:
   - se protege que `GET /api/businesses` devuelve `items`, `total`, `page` y
     `page_size`;
   - se protegen campos usados por UI en listado: `id`, `name`, `city`,
     `category`, `has_website`, `status`, `phone`, `website` y `maps_url`;
   - se protegen campos usados por UI en detalle: `notes`, `address`, `region`,
     `country`, `lat`, `lng`, `created_at` y `updated_at`;
   - se protege que el backend acepta solo
     `order_by = created_at | name | city`, aunque la UI pueda ordenar
     localmente por otros campos.
4. CSV:
   - se verifican headers `Content-Type: text/csv; charset=utf-8` y
     `Content-Disposition: attachment; filename="business-leads.csv"`;
   - se verifican columnas estables:
     `name,category,address,city,phone,website,has_website,status,maps_url`;
   - se verifica que exportacion reutiliza los filtros de `GET /api/businesses`
     y no genera CSV desde frontend.
5. Deduplicacion operativa del worker:
   - se agregan tests sobre `services/workers/src/workers/repository.py` para
     que el fallback `name + address` no fusione contra registros con
     `external_id` distinto;
   - se agrega test de normalizacion de dedupe con diacriticos en la ruta
     operativa del worker, alineada con la regla documentada de
     `name + address`.
6. Integracion PostgreSQL:
   - los tests unitarios se mantienen ejecutables sin `DATABASE_URL`;
   - se amplian tests opt-in con `DATABASE_URL` en
     `apps/web/lib/db/integration.test.ts` para validar contratos de
     repositorios sobre PostgreSQL real;
   - los tests automatizados por defecto no deben depender de Google real ni de
     una base externa.

Implementacion realizada:

1. Contratos compartidos:
   - `parseBusinessFilters` cubre `has_website=true|false`, filtros
     vacios omitidos, `city`, `category`, `query`, `page_size` capeado y
     `order_by` invalido;
   - `parseBusinessStatusUpdate` cubre `notes` omitido y `null`.
2. Route tests de Next.js:
   - los servicios se mockean para evitar depender de PostgreSQL;
   - se valida happy path y error path de `/api/searches`;
   - se valida happy path, filtros y errores de `/api/businesses`;
   - se valida `GET` y `PATCH` de `/api/businesses/[id]`, incluyendo UUID
     invalido, recurso inexistente, `notes: null` y JSON invalido;
   - se valida CSV y headers de `/api/export`.
3. Repositorios y servicios:
   - los tests de servicios se mantienen livianos, centrados en delegacion y
     semantica de `notes`;
   - los builders SQL aseguran que listado y export comparten
     filtros y que export no aplica `limit/offset`.
4. Worker:
   - se agregan tests unitarios al repositorio operativo del worker para reglas
     de deduplicacion documentadas;
   - la normalizacion operativa de dedupe ahora remueve diacriticos;
   - el fallback `name + address` ya no deduplica contra filas con
     `external_id` existente distinto.
5. Integracion opt-in con PostgreSQL:
   - `apps/web/lib/db/integration.test.ts` valida creacion/listado de
     `search_runs`;
   - valida actualizacion de lead preservando notas omitidas y limpiando
     `notes = null`;
   - se salta automaticamente cuando no existe `DATABASE_URL`.

Casos minimos:

- crear busqueda valida;
- rechazar busqueda invalida;
- listar busquedas paginadas;
- listar negocios paginados;
- filtrar negocios sin website;
- rechazar filtros invalidos y ordenamientos no soportados;
- obtener detalle de negocio;
- actualizar estado del lead;
- preservar notas cuando `notes` se omite y limpiarlas cuando `notes = null`;
- exportar CSV;
- normalizar payload de Google Places;
- enriquecer ubicacion con payload mock de Google Geocoding cuando falten datos
  normalizados;
- clasificar redes sociales como no website propio;
- evitar duplicados por `external_id + source`;
- evitar duplicados por `name + address`;
- evitar merge por `name + address` contra un registro existente con
  `external_id` distinto;
- manejar errores del proveedor externo sin romper la API.

Entregables:

- route tests para endpoints consumidos por frontend;
- tests adicionales de contratos compartidos;
- tests reforzados de repositorios SQL, integracion opt-in y CSV;
- tests reforzados del repositorio operativo del worker;
- fixtures y fakes de proveedor reutilizables;
- suite por defecto sin red ni Google real.

Criterio de aceptacion:

- `npm test -- --run` pasa sin requerir `DATABASE_URL` ni red externa;
- `./scripts/dev/test-workers.sh` pasa sin requerir credenciales reales de
  Google;
- `npm run typecheck` pasa;
- los tests opt-in con `DATABASE_URL` pueden validar contratos de repositorio
  sobre una base local con migraciones aplicadas;
- las reglas centrales pueden cambiarse con feedback inmediato de tests;
- el frontend queda protegido por tests backend de los contratos HTTP que
  consume, sin duplicar reglas de negocio en componentes UI.

Siguiente paso recomendado:

- continuar con Fase 15 para seguridad, configuracion operativa y
  endurecimiento de inputs;
- mantener la suite route-level como proteccion de contrato antes de integrar
  nuevos controles frontend;
- si se dispone de PostgreSQL local, ejecutar la suite con `DATABASE_URL`
  despues de aplicar migraciones y seeds para cubrir la ruta opt-in.

### Fase 15 - Seguridad y configuracion operativa

Estado:

- implementada como hardening operativo del backend web y workers;
- mantiene los contratos funcionales que consume el frontend;
- conserva CORS same-origin por defecto y agrega allowlist opcional mediante
  `ALLOWED_ORIGINS`;
- no agrega autenticacion porque multiusuario y control de acceso siguen fuera
  del MVP, pero queda documentado como decision previa a exposicion publica.

Objetivo:

- preparar el backend para operar sin exponer secretos ni aceptar input riesgoso.

Implementacion realizada:

1. Configuracion web:
   - se agrega `apps/web/lib/config/runtime.ts` para validar `APP_ENV`,
     `LOG_LEVEL`, `ALLOWED_ORIGINS`, limite de body JSON, pool PostgreSQL y
     `DB_SSL`;
   - en `production`, la app web requiere `DATABASE_URL` y
     `GOOGLE_PLACES_API_KEY`;
   - `.env.example` documenta los nuevos placeholders operativos.
2. API routes:
   - el envelope de error conserva `error.code`, `error.message`,
     `error.correlation_id` y `error.details`;
   - `X-Correlation-Id` se acepta solo con caracteres operativos y maximo 128
     caracteres;
   - requests JSON con `Content-Length` mayor a
     `API_JSON_BODY_LIMIT_BYTES` se rechazan antes de parsear;
   - CORS responde solo a origins configurados en `ALLOWED_ORIGINS`; sin esa
     variable, el backend queda same-origin;
   - se agregan preflight `OPTIONS` a las API routes actuales.
3. Headers y healthcheck:
   - `next.config.ts` define headers basicos: `X-Content-Type-Options`,
     `Referrer-Policy`, `X-Frame-Options` y CSP compatible con el dashboard y
     embeds de Google Maps;
   - `GET /api/health` ya no expone mensajes crudos de conexion PostgreSQL.
4. Validacion y persistencia:
   - filtros de negocios y busquedas rechazan `page` y `page_size` invalidos
     con `validation_error` en vez de coercion silenciosa;
   - `order_by` sigue sanitizado mediante allowlist;
   - SQL dinamico sigue limitado a builders parametrizados.
5. Workers:
   - `WorkerSettings` valida entorno, log level y rangos numericos;
   - en `production`, el worker requiere `DATABASE_URL` y
     `GOOGLE_PLACES_API_KEY`;
   - logs y errores persistidos redactan `DATABASE_URL`, API keys y parametros
     `key=`;
   - normalizacion operativa acepta solo URLs `http`/`https` para mapas y
     websites, y mantiene redes sociales/directorios como no website propio.
6. CSV:
   - exportacion neutraliza valores que podrian ejecutarse como formulas en
     planillas.

Entregables:

- settings seguros;
- documentacion de `.env`;
- validaciones de input.
- redaccion de logs;
- CORS same-origin con allowlist opcional;
- headers de seguridad basicos;
- tests de configuracion, hardening de API, CSV, normalizacion y workers.

Criterio de aceptacion:

- el sistema puede correr en desarrollo y produccion con configuracion externa;
- las API routes mantienen los contratos HTTP del frontend;
- los tests backend pasan sin requerir Google real ni base externa;
- errores publicos no filtran secretos ni mensajes crudos de PostgreSQL.

Siguiente paso recomendado:

- continuar con Fase 16 para documentar despliegue reproducible, bootstrap de
  entorno nuevo, migraciones, comandos de worker y checklist operativo por
  ambiente;
- antes de un deploy publico, decidir una puerta minima de acceso porque el MVP
  aun no incluye autenticacion ni multiusuario.

### Fase 16 - Preparacion para despliegue

Estado:

- fase de documentacion operativa y estandarizacion de bootstrap;
- no agrega nuevas reglas de negocio ni endpoints;
- no cambia contratos frontend/backend.

Objetivo:

- permitir que un entorno nuevo levante web, DB y worker siguiendo una
  secuencia unica y verificable.

Implementacion requerida:

1. Topologia y alcance operativo:
   - declarar `apps/web` como unidad desplegable del MVP para frontend y API
     routes same-origin;
   - dejar explicito que las API routes corren en runtime Node.js, no Edge;
   - documentar que PostgreSQL debe ser alcanzable desde la app web;
   - documentar que el worker Python es batch/one-shot, drena corridas
     pendientes y termina;
   - dejar definido que produccion usa `cron` o scheduler externo para el
     worker, no un daemon continuo;
   - registrar que Docker y `docker-compose` quedan como opcion futura no
     bloqueante.
2. Bootstrap reproducible:
   - declarar `npm` como package manager operativo del repo;
   - fijar prerequisitos minimos: Node compatible con Next.js 15, npm,
     Python 3.11+, PostgreSQL y `psql`;
   - documentar `.env` desde `.env.example`;
   - documentar `DATABASE_URL` y la necesidad de una base PostgreSQL
     modificable;
   - documentar instalacion oficial:
     - `npm install`;
     - `python3 -m pip install -e 'services/workers[test]'`.
3. Base de datos:
   - documentar migraciones en orden exacto:
     - `database/migrations/001_create_mvp_schema.sql`;
     - `database/migrations/002_add_search_run_observability.sql`;
   - documentar `database/seeds/001_mvp_demo_data.sql` solo para desarrollo y
     demos, no como requisito de produccion.
4. Ejecucion:
   - documentar arranque web en desarrollo con
     `./scripts/dev/start-web.sh`;
   - documentar arranque web en produccion con
     `npm --workspace apps/web run build` y
     `npm --workspace apps/web run start`;
   - documentar ejecucion del worker con:
     - `./scripts/dev/run-worker.sh`;
     - `python3 -m workers`.
5. Variables por proceso:
   - documentar para web:
     `APP_ENV`, `DATABASE_URL`, `GOOGLE_PLACES_API_KEY`, `DB_SSL`,
     `ALLOWED_ORIGINS`, `API_JSON_BODY_LIMIT_BYTES`, `DB_POOL_MAX`,
     `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS`,
     `DB_QUERY_TIMEOUT_MS`, `LOG_LEVEL`;
   - documentar para worker:
     `APP_ENV`, `DATABASE_URL`, `GOOGLE_PLACES_API_KEY`,
     `GOOGLE_GEOCODING_API_KEY`, `GOOGLE_REQUEST_TIMEOUT_SECONDS`,
     `GOOGLE_DAILY_REQUEST_LIMIT`, `GOOGLE_QUOTA_STATE_PATH`,
     `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `LOG_LEVEL`;
   - dejar explicito que `GOOGLE_PLACES_API_KEY` hoy es requisito de arranque
     en `production` para web y worker;
   - dejar explicito que `DATABASE_URL` es requisito practico para ejecutar el
     worker aunque settings lo tolere vacio;
   - dejar explicito que `GOOGLE_QUOTA_STATE_PATH` persiste estado local y en
     entornos efimeros puede reiniciarse.
6. Smoke checks operativos:
   - documentar verificacion de:
     - `GET /api/health`;
     - `GET /api/businesses`;
     - `GET /api/businesses/{id}`;
     - `PATCH /api/businesses/{id}`;
     - `POST /api/search` seguido de ejecucion de worker y validacion de
       persistencia en `search_runs`.
7. Coherencia con frontend:
   - dejar como invariante que el frontend consume rutas relativas `/api/...`;
   - documentar que no existe `API_BASE_URL` en el MVP actual;
   - documentar que la UI actual no cubre toda la superficie backend
     documentada;
   - documentar que el ordenamiento local de la pantalla de negocios no
     equivale al orden global del backend.

Entregables:

- Fase 16 reescrita con comandos exactos y alcance verificable;
- `docs/architecture/backend-runtime.md` alineado como runbook operativo;
- `.env.example` y referencias de entorno actualizadas;
- `README.md` raiz consistente con el estado real del repositorio;
- checklist operativo por ambiente y referencia cruzada al runtime actual;
- siguientes pasos logicos explicitados al cierre de la fase.

Criterio de aceptacion:

- un entorno limpio puede instalar dependencias, aplicar migraciones, sembrar
  datos de desarrollo, levantar web, ejecutar worker y validar contratos HTTP
  sin adivinar comandos;
- la documentacion distingue claramente que aplica solo a desarrollo y que
  aplica a produccion;
- el despliegue documentado no contradice la arquitectura frontend same-origin
  ni el modo batch real del worker.

Siguiente paso recomendado:

1. Ejecutar una verificacion completa de bootstrap en entorno limpio.
2. Cerrar Fase 17 con checklist de cierre MVP.
3. Definir puerta minima de acceso antes de exposicion publica.
4. Definir operacion real del worker en despliegue:
   `cron`, scheduler o proceso supervisado.
5. Resolver, si se necesita produccion duradera, la persistencia del estado de
   cuota de Google.
6. Evaluar recien despues containerizacion o CI/CD como mejora operativa, no
   como requisito del MVP actual.

### Fase 17 - Cierre MVP backend y sincronizacion con frontend

Objetivo:

- certificar que el backend del MVP puede declararse `MVP-ready` sobre
  evidencia de codigo, contratos compartidos, tests y documentacion;
- cerrar el backend como fuente de verdad contractual sin trasladar reglas de
  negocio al frontend;
- dejar explicitas las brechas entre cierre contractual backend y cierre
  funcional end-to-end del producto.

Tareas:

- auditar las capacidades backend ya implementadas contra codigo, contratos
  compartidos y tests automatizados;
- validar que la superficie publica del MVP siga limitada a
  `POST /api/search`, `GET /api/searches`, `GET /api/businesses`,
  `GET /api/businesses/{id}`, `PATCH /api/businesses/{id}` y
  `GET /api/export`;
- congelar documentalmente `BusinessFilters`, `LeadStatus`,
  `SearchRunStatus` y los envelopes de error con `correlation_id` segun
  `packages/shared`;
- contrastar el cierre backend con
  `docs/architecture/frontend-implementation-tasks.md`,
  `docs/architecture/frontend-backend-connection.md` y
  `docs/architecture/backend-runtime.md`;
- revisar que comandos, ejemplos HTTP, filtros y estados documentados coincidan
  con el toolchain y contratos vigentes;
- registrar en la documentacion que esta fase certifica coherencia
  contractual/documental, no cierre funcional end-to-end del producto.

Matriz de capacidades auditables:

- `POST /api/search` registra busquedas y persiste `correlation_id`.
  Evidencia esperada:
  codigo en `apps/web/app/api/search/route.ts`,
  `apps/web/lib/services/search-service.ts`,
  contratos compartidos en `packages/shared`,
  test de API en `apps/web/app/api/search/route.test.ts`.
- el worker procesa `search_runs` pendientes y consulta Google Places.
  Evidencia esperada:
  codigo en `services/workers/src/workers/pipeline.py`,
  configuracion runtime en `docs/architecture/backend-runtime.md`,
  tests en `services/workers/tests/test_pipeline.py` y
  `services/workers/tests/test_google_clients.py`.
- el worker usa Google Geocoding cuando faltan datos de ubicacion.
  Evidencia esperada:
  codigo en `services/workers/src/workers/pipeline.py`,
  cliente/adaptador en `services/workers/src/ingestion/google_places`,
  tests con mocks en `services/workers/tests/test_pipeline.py`.
- normalizacion, website detection y deduplicacion basica quedan cubiertas por
  codigo y tests.
  Evidencia esperada:
  implementacion en `services/workers/src/workers/normalization.py`,
  `services/workers/src/workers/website_detection.py` y
  `services/workers/src/workers/repository.py`,
  pruebas en `services/workers/tests/test_normalization.py`,
  `services/workers/tests/test_repository.py` y
  `services/workers/tests/test_contracts.py`.
- PostgreSQL sigue siendo la fuente de verdad para `businesses` y
  `search_runs`.
  Evidencia esperada:
  repositorios en `apps/web/lib/db` y `services/workers/src/workers/repository.py`,
  migraciones activas, tests de repositorio y de integracion disponibles.
- `GET /api/businesses`, `GET /api/businesses/{id}`,
  `PATCH /api/businesses/{id}` y `GET /api/export` siguen siendo la superficie
  funcional del MVP.
  Evidencia esperada:
  rutas en `apps/web/app/api`,
  servicios en `apps/web/lib/services`,
  contratos compartidos en `packages/shared`,
  documentacion sincronizada con frontend.
- logs, envelopes de error y runtime documentado siguen consistentes.
  Evidencia esperada:
  helpers en `apps/web/lib/api/http.ts`,
  runtime en `docs/architecture/backend-runtime.md`,
  documento de conexion frontend-backend alineado.

Subseccion obligatoria de coherencia frontend-backend:

- el frontend del MVP consume solo API routes de Next.js y no se conecta
  directo a PostgreSQL;
- `packages/shared` es la fuente de verdad para enums, filtros y request/response
  shapes consumidos por backend y frontend;
- el frontend no implementa website detection, deduplicacion, generacion CSV ni
  reglas de estado del lead;
- nombres de filtros, payloads y envelopes de error documentados en frontend
  deben coincidir exactamente con backend;
- cualquier discrepancia contractual detectada en esta fase se corrige primero
  en `packages/shared`, luego en API routes/servicios y finalmente en toda la
  documentacion consumidora;
- la coherencia certificada por esta fase es contractual y documental;
- no debe declararse cierre end-to-end del producto mientras
  `apps/web/app/page.tsx` y `apps/web/app/businesses/page.tsx` sigan
  renderizando placeholders y el frontend no haya cerrado su propia Fase 12.

Interfaces publicas congeladas para el MVP:

- endpoints vigentes:
  `POST /api/search`,
  `GET /api/searches`,
  `GET /api/businesses`,
  `GET /api/businesses/{id}`,
  `PATCH /api/businesses/{id}`,
  `GET /api/export`;
- `BusinessFilters`:
  `page`, `page_size`, `has_website`, `status`, `city`, `category`, `query`,
  `order_by`;
- `LeadStatus`:
  `new`, `reviewed`, `contacted`, `discarded`;
- `SearchRunStatus` y envelopes de error con `correlation_id`.

Entregables:

- Fase 17 expandida como checklist operativa de cierre;
- matriz de capacidades cerradas con evidencia esperada;
- referencias cruzadas actualizadas entre documentacion backend y frontend;
- criterio de cierre aclarando la diferencia entre readiness backend y cierre
  funcional total del producto.

Checklist de verificacion reproducible:

- ejecutar `npm --workspace apps/web run test`;
- ejecutar `pytest services/workers/tests -q`;
- revisar que los comandos documentados coincidan con el toolchain actual;
- revisar que ejemplos HTTP, filtros, estados y envelopes de error coincidan
  entre documentos;
- confirmar que `GET /api/export` siga concentrando la generacion CSV en
  backend;
- confirmar que `has_website` siga siendo clasificacion backend y no logica del
  frontend;
- confirmar que runtime, configuracion y despliegue documentados no contradigan
  el cierre MVP;
- documentar cualquier brecha visible del frontend como brecha de producto y no
  como incumplimiento contractual del backend.

Evidencia de cierre ejecutada en el repositorio:

- migraciones `001_create_mvp_schema.sql` y
  `002_add_search_run_observability.sql` aplicadas con exito sobre PostgreSQL
  temporal local;
- `database/seeds/001_mvp_demo_data.sql` aplicado con exito para validar datos
  iniciales del MVP;
- `npm --workspace apps/web run test` ejecutado con `DATABASE_URL` apuntando a
  PostgreSQL real: `8` archivos pasaron y `18` tests pasaron, incluyendo
  `apps/web/lib/db/integration.test.ts`;
- `pytest services/workers/tests -q` ejecutado con `DATABASE_URL` configurado:
  `24` tests pasaron;
- smoke test manual del pipeline ejecutado con `WorkerRepository` real y
  clientes fake: una `search_run` en `pending` paso a `completed`, persistio
  `total_found = 1` y genero un `business` normalizado en PostgreSQL;
- el cierre backend queda validado a nivel runtime, persistencia y contrato,
  sin depender de cuota real de Google para la verificacion final del MVP.

Nota operativa:

- el comando web valido para esta fase es `npm --workspace apps/web run test`;
- no debe documentarse `vitest --runInBand` como comando de cierre porque falla
  con la version actual del toolchain.

Criterio de aceptacion:

- el backend puede declararse `MVP-ready` cuando no existen contradicciones
  entre codigo, tests, runtime, contratos compartidos y documentacion;
- la documentacion backend y frontend describe exactamente la misma superficie
  contractual del MVP;
- no se introducen endpoints, campos ni reglas nuevas en esta fase;
- cualquier brecha restante queda explicitada como brecha de frontend o de
  producto, no como una regla pendiente del backend ya cerrado.

## 10. Testing requerido

### Unit tests

Cubrir:

- normalizacion;
- website detection;
- deduplicacion;
- validaciones de contratos;
- merge de duplicados.

### Integration tests

Cubrir:

- API routes principales;
- persistencia;
- filtros;
- paginacion;
- exportacion;
- actualizacion de estado.

### Provider tests

Cubrir con mocks:

- respuesta exitosa de Google Places;
- respuesta exitosa de Google Geocoding para enriquecer ubicacion;
- respuesta vacia;
- API key invalida;
- rate limit;
- timeout;
- payload incompleto.

Los tests automatizados no deben depender de red ni consumir cuota real de
Google Places ni Google Geocoding.

## 11. Configuracion, seguridad operativa y despliegue

### Variables requeridas

```txt
APP_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/business_lead_finder
GOOGLE_PLACES_API_KEY=replace-me
GOOGLE_GEOCODING_API_KEY=replace-me-optional
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
LOG_LEVEL=info
```

### Reglas de configuracion

- Los secretos no se versionan.
- Los ejemplos deben usar placeholders.
- Los tests deben poder correr sin `GOOGLE_PLACES_API_KEY` ni
  `GOOGLE_GEOCODING_API_KEY` reales.
- `GOOGLE_GEOCODING_API_KEY` puede omitirse si se usa una misma credencial de
  Google Cloud con Places API y Geocoding API habilitadas.
- El worker debe fallar con mensaje claro si falta configuracion requerida.
- Los comandos de migracion deben estar documentados antes de deploy.

### Despliegue

El primer despliegue debe contemplar:

- provisionar PostgreSQL;
- ejecutar migraciones;
- configurar variables de entorno;
- arrancar Next.js;
- arrancar worker Python cuando se habilite ingesta automatica;
- verificar `POST /api/search`;
- verificar `GET /api/businesses`;
- verificar logs de una busqueda completa.

## 12. Riesgos y features posteriores al MVP

### Riesgos principales

- Google Places y Google Geocoding pueden cambiar costos, cuotas o shape de
  respuesta.
- Datos incompletos pueden generar falsos positivos.
- Deteccion de website propio puede requerir reglas mas finas.
- Deduplicacion por `name + address` puede fallar ante direcciones parciales.
- Sin cola dedicada, el procesamiento inicial puede tener limites de volumen.

### Posibles features backend posteriores al MVP

- agregar historial de `lead_status` y notas con trazabilidad por cambio;
- agregar Redis o RabbitMQ para procesamiento asincronico real;
- incorporar un runner de jobs como Celery o RQ;
- soportar mas proveedores ademas de Google Places;
- agregar validacion HTTP real de dominios y redirects;
- enriquecer la deteccion de website propio con reglas mas finas;
- agregar scoring y priorizacion de leads;
- agregar autenticacion, multiusuario y permisos;
- agregar auditoria de cambios sobre leads y corridas;
- soportar exportaciones asincronicas para datasets grandes;
- agregar retries controlados y politicas de backoff por proveedor;
- incorporar metricas operativas y alertas sobre fallos del worker.

## 13. Orden recomendado de implementacion real

Estado actual del roadmap:

- Fase 1 a Fase 11 ya cuentan con implementacion o scaffold validado;
- Fase 12 ya esta cerrada en backend para listado, filtros, paginacion y CSV;
- Fase 13 ya quedo implementada con trazabilidad basica, logs estructurados y
  metadata operativa persistida;
- Fase 14 quedo cerrada con suites de API, servicios, repositorios, contratos y
  workers ejecutadas con exito;
- Fase 15 queda suficientemente cubierta para el MVP en validaciones de input,
  uso de variables de entorno y sanitizacion del acceso a datos;
- Fase 16 queda cerrada para el MVP con runtime, comandos y migraciones
  documentados;
- Fase 17 queda cerrada con validacion reproducible sobre PostgreSQL real y
  sincronizacion contractual con frontend.

Siguientes pasos logicos desde el estado actual:

1. ejecutar las posibles features posteriores al MVP segun prioridad de
   producto;
2. cerrar el frontend funcional contra las API routes reales del MVP;
3. preparar despliegue persistente con infraestructura y secretos reales.

Dependencias practicas:

- las features posteriores al MVP deben respetar `packages/shared` como fuente
  de verdad contractual;
- el cierre funcional del producto depende ahora mas del frontend y del
  entorno de despliegue que del backend base;
- cualquier nuevo proveedor o sistema de colas debe preservar la politica MVP
  de deduplicacion, website detection y persistencia en PostgreSQL.

## 14. Notas de mantenimiento

Este documento debe actualizarse cuando cambien:

- entidades principales;
- estados permitidos;
- proveedor externo;
- reglas de website detection;
- estrategia de deduplicacion;
- estrategia de workers o colas;
- endpoints publicos;
- modelo de despliegue.

La prioridad del backend es modelar correctamente el dominio, persistir datos de
forma confiable y permitir evolucionar el pipeline sin reescribir la aplicacion.
