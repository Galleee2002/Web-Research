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

### Decision pendiente - Manifiestos y comandos oficiales

Antes de implementar Fase 5 conviene versionar la configuracion minima de
desarrollo para que las API routes y sus tests sean reproducibles.

Pendiente recomendado:

- crear `package.json` en el alcance que se defina para el monorepo o
  `apps/web`;
- agregar scripts oficiales como `test`, `typecheck`, `dev` y `build`;
- definir manifiesto Python para workers con dependencias de runtime y test;
- documentar comandos equivalentes a:
  - `npm install`;
  - `npm test`;
  - `npm run typecheck`;
  - `pytest`;
- mantener secrets fuera del repo usando `.env.example` con placeholders.

Motivo:

- Fase 4 pudo validarse con comandos puntuales porque existen dependencias
  locales instaladas, pero esa situacion no garantiza que otro entorno pueda
  reproducir la instalacion y los tests desde cero.

Relacion con Fase 5:

- las API routes de Fase 5 deben nacer con tests reproducibles;
- los contratos de `packages/shared` deben poder typecheckearse desde un script
  oficial;
- los workers deben poder correr tests sin depender de configuracion manual no
  documentada.

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

Objetivo:

- evitar registros duplicados y permitir reprocesar busquedas.

Tareas:

- implementar busqueda por `external_id + source`;
- implementar fallback por `name + address`;
- normalizar claves de comparacion;
- definir politica de merge;
- preservar `status` y `notes` manuales;
- registrar duplicados detectados en logs.

Entregables:

- servicio de upsert idempotente;
- tests de duplicados;
- tests de merge de campos faltantes.

Criterio de aceptacion:

- correr dos veces la misma ingesta no duplica negocios.

### Fase 11 - Orquestacion search run -> worker -> persistencia

Objetivo:

- conectar busquedas creadas con procesamiento real.

Tareas:

- tomar `search_run` pendiente;
- marcar `processing`;
- consultar proveedor;
- normalizar resultados;
- deduplicar y persistir;
- actualizar `total_found`;
- marcar `completed`;
- marcar `failed` ante errores controlados;
- guardar `error_message` resumido.

Entregables:

- flujo end-to-end;
- estados actualizados;
- manejo de errores operativo.

Criterio de aceptacion:

- crear una busqueda termina generando negocios consultables por API.

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

Objetivo:

- hacer eficiente el consumo de datos por dashboard y exportacion.

Tareas:

- implementar filtros combinables;
- validar parametros de query;
- aplicar limite maximo de `page_size`;
- ordenar por campos permitidos;
- usar los mismos filtros en CSV;
- asegurar encoding CSV compatible con hojas de calculo.

Entregables:

- listado estable;
- exportacion CSV;
- tests de filtros y export.

Criterio de aceptacion:

- el usuario puede exportar el mismo conjunto que ve filtrado en el dashboard.

### Fase 13 - Errores, logs y observabilidad

Objetivo:

- hacer el backend diagnosticable.

Tareas:

- definir formato de error HTTP;
- loguear inicio y fin de busquedas;
- loguear errores de proveedor;
- loguear conteo de resultados;
- loguear duplicados;
- incluir `search_run_id` en logs de pipeline;
- preparar correlation id por request o ejecucion.

Entregables:

- errores consistentes;
- logs estructurados o semiestructurados;
- diagnostico basico por `search_run_id`.

Criterio de aceptacion:

- un fallo de proveedor puede rastrearse desde la API hasta el worker.

### Fase 14 - Testing backend

Objetivo:

- cubrir reglas criticas antes de ampliar el sistema.

Tareas:

- tests de API routes;
- tests de repositorios;
- tests de servicios;
- tests de normalizacion;
- tests de website detection;
- tests de deduplicacion;
- tests de export CSV;
- mocks de Google Places y Google Geocoding.

Casos minimos:

- crear busqueda valida;
- rechazar busqueda invalida;
- listar negocios paginados;
- filtrar negocios sin website;
- actualizar estado del lead;
- exportar CSV;
- normalizar payload de Google Places;
- enriquecer ubicacion con payload mock de Google Geocoding cuando falten datos
  normalizados;
- clasificar redes sociales como no website propio;
- evitar duplicados por `external_id + source`;
- evitar duplicados por `name + address`;
- manejar errores del proveedor externo sin romper la API.

Entregables:

- suite base de tests;
- fixtures;
- mocks de proveedor.

Criterio de aceptacion:

- las reglas centrales pueden cambiarse con feedback inmediato de tests.

### Fase 15 - Seguridad y configuracion operativa

Objetivo:

- preparar el backend para operar sin exponer secretos ni aceptar input riesgoso.

Tareas:

- cargar secretos desde variables de entorno;
- evitar hardcodear API keys;
- configurar CORS segun ambiente;
- limitar longitudes de `query`, `location`, `notes` y filtros;
- validar URLs;
- sanitizar parametros de ordenamiento;
- evitar interpolacion SQL manual.

Entregables:

- settings seguros;
- documentacion de `.env`;
- validaciones de input.

Criterio de aceptacion:

- el sistema puede correr en desarrollo y produccion con configuracion externa.

### Fase 16 - Preparacion para despliegue

Objetivo:

- dejar una forma reproducible de levantar backend y workers.

Tareas:

- documentar comandos de install;
- documentar comandos de build;
- documentar comandos de migracion;
- documentar comando de worker;
- documentar variables requeridas;
- agregar Dockerfile si se decide containerizar;
- agregar docker-compose local con PostgreSQL si se prioriza DX.

Entregables:

- README tecnico backend o seccion equivalente;
- scripts de bootstrap;
- migraciones listas para correr.

Criterio de aceptacion:

- un entorno nuevo puede levantar API, DB y worker siguiendo documentacion.

### Fase 17 - Criterios de cierre MVP

El backend MVP se considera listo cuando:

- registra busquedas;
- consulta Google Places desde worker;
- complementa ubicaciones con Google Geocoding cuando sea necesario;
- normaliza resultados;
- detecta negocios con y sin website propio;
- guarda negocios en PostgreSQL;
- evita duplicados basicos;
- expone negocios por API;
- filtra leads sin website;
- actualiza estado y notas;
- exporta CSV;
- tiene tests minimos sobre reglas criticas;
- documenta configuracion y despliegue basico.

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

## 12. Riesgos y decisiones futuras

### Riesgos principales

- Google Places y Google Geocoding pueden cambiar costos, cuotas o shape de
  respuesta.
- Datos incompletos pueden generar falsos positivos.
- Deteccion de website propio puede requerir reglas mas finas.
- Deduplicacion por `name + address` puede fallar ante direcciones parciales.
- Sin cola dedicada, el procesamiento inicial puede tener limites de volumen.

### Decisiones futuras

- agregar `lead_status` como historial;
- agregar Redis/RabbitMQ para procesamiento asincronico real;
- incorporar Celery o RQ;
- soportar mas proveedores;
- agregar validacion HTTP de dominios;
- agregar scoring de leads;
- agregar autenticacion y multiusuario;
- agregar auditoria de cambios.

## 13. Orden recomendado de implementacion real

Etapa 1:

- Fase 1;
- Fase 2;
- Fase 3;
- Fase 4.

Etapa 2:

- Fase 5;
- Fase 6.

Etapa 3:

- Fase 7;
- Fase 8;
- Fase 9;
- Fase 10;
- Fase 11.

Etapa 4:

- Fase 12;
- Fase 13;
- Fase 14.

Etapa 5:

- Fase 15;
- Fase 16;
- Fase 17.

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
