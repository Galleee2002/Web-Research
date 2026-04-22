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

- Consumir Google Places API.
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
4. obtener resultados crudos;
5. normalizar cada resultado;
6. detectar website propio;
7. deduplicar contra PostgreSQL;
8. insertar o actualizar negocios;
9. actualizar `search_runs.total_found`;
10. marcar `search_run` como `completed`;
11. si falla una dependencia externa, registrar error y marcar `failed`.

### Cliente Google Places

Responsabilidades:

- construir requests;
- inyectar `GOOGLE_PLACES_API_KEY`;
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
- aislar nombres de campos propios del proveedor;
- permitir sumar otro proveedor futuro sin cambiar API routes ni schema central.

Interfaz logica:

```txt
search_businesses(query, location) -> list[raw_business]
get_business_details(external_id) -> raw_business_details
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
- `DEFAULT_PAGE_SIZE`;
- `MAX_PAGE_SIZE`;
- `LOG_LEVEL`.

Entregables:

- manifiestos de dependencias;
- comandos de arranque;
- configuracion de entorno;
- healthcheck o ruta equivalente de estado para API.

Criterio de aceptacion:

- el proyecto puede instalar dependencias y arrancar localmente con una base
  PostgreSQL configurada.

### Fase 3 - Base de datos, migraciones y seeds

Objetivo:

- crear el schema persistente del MVP.

Tareas:

- crear migracion para `search_runs`;
- crear migracion para `businesses`;
- agregar indices minimos;
- agregar restricciones de estado;
- definir seed con negocios con y sin website;
- documentar comando para correr migraciones;
- documentar comando para cargar seeds.

Entregables:

- migraciones en `database/migrations`;
- seeds en `database/seeds`;
- notas de schema en `database/docs`.

Criterio de aceptacion:

- una base limpia puede recrear el schema completo y cargar datos de prueba.

### Fase 4 - Contratos compartidos y validaciones

Objetivo:

- evitar divergencias entre frontend, API routes y workers.

Tareas:

- definir enums compartidos;
- definir shape de requests y responses;
- definir valores default de paginacion;
- definir limites maximos de input;
- definir contrato de `NormalizedBusiness`;
- documentar equivalencias para Python si no se comparte codigo directamente.

Entregables:

- contratos en `packages/shared`;
- validaciones usadas por API routes;
- validaciones equivalentes en workers.

Criterio de aceptacion:

- un cambio de estado o filtro no requiere editar strings sueltos en varias capas.

### Fase 5 - API routes CRUD base

Objetivo:

- exponer operaciones backend basicas sobre datos persistidos localmente.

Tareas:

- implementar `POST /api/search`;
- implementar `GET /api/searches`;
- implementar `GET /api/businesses`;
- implementar `GET /api/businesses/{id}`;
- implementar `PATCH /api/businesses/{id}`;
- implementar `GET /api/export`;
- devolver errores HTTP coherentes;
- mantener handlers delgados.

Entregables:

- API routes funcionales;
- filtros basicos;
- paginacion;
- export CSV.

Criterio de aceptacion:

- con seeds cargados, el dashboard puede leer, filtrar, actualizar y exportar
  negocios sin depender de Google Places.

### Fase 6 - Servicios y repositorios

Objetivo:

- separar transporte HTTP, logica de negocio y acceso a datos.

Tareas:

- crear servicio de busquedas;
- crear servicio de negocios;
- crear repositorios de `search_runs` y `businesses`;
- mover queries complejas fuera de API routes;
- centralizar reglas de filtros y paginacion;
- centralizar actualizacion de estado y notas.

Entregables:

- endpoints delgados;
- servicios testeables;
- repositorios reutilizables.

Criterio de aceptacion:

- las reglas de negocio pueden probarse sin invocar HTTP.

### Fase 7 - Worker Python de Google Places

Objetivo:

- integrar el proveedor externo inicial.

Tareas:

- crear cliente Google Places;
- crear adaptador de respuesta;
- configurar timeouts;
- manejar rate limits;
- manejar errores de credenciales;
- mockear proveedor en tests;
- evitar llamadas reales en tests automatizados.

Entregables:

- cliente externo;
- adaptador;
- tests con payloads mock.

Criterio de aceptacion:

- el worker puede obtener resultados reales cuando hay API key, y los tests
  pueden correr sin red ni costo.

### Fase 8 - Normalizacion de datos externos

Objetivo:

- convertir payloads externos en estructura interna estable.

Tareas:

- implementar normalizador central;
- mapear campos minimos;
- preservar datos utiles aunque falten campos opcionales;
- cubrir casos de payload incompleto;
- validar shape resultante antes de persistir.

Entregables:

- normalizador;
- tests unitarios;
- fixtures de payload Google Places.

Criterio de aceptacion:

- el resto del sistema no depende de la forma exacta del payload de Google.

### Fase 9 - Deteccion de website propio

Objetivo:

- clasificar correctamente si un negocio tiene sitio web propio.

Tareas:

- implementar helper de deteccion;
- mantener lista inicial de dominios no validos;
- tratar redes sociales como no website;
- tratar URLs vacias o invalidas como no website;
- documentar limitaciones del MVP.

Entregables:

- funcion de deteccion;
- tests con website propio;
- tests con Instagram, Facebook, WhatsApp y directorios.

Criterio de aceptacion:

- `has_website` queda persistido de forma consistente para todos los negocios.

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
- mocks de Google Places.

Casos minimos:

- crear busqueda valida;
- rechazar busqueda invalida;
- listar negocios paginados;
- filtrar negocios sin website;
- actualizar estado del lead;
- exportar CSV;
- normalizar payload de Google Places;
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
- respuesta vacia;
- API key invalida;
- rate limit;
- timeout;
- payload incompleto.

Los tests automatizados no deben depender de red ni consumir cuota real de
Google Places.

## 11. Configuracion, seguridad operativa y despliegue

### Variables requeridas

```txt
APP_ENV=development
DATABASE_URL=postgres://user:password@localhost:5432/business_lead_finder
GOOGLE_PLACES_API_KEY=replace-me
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
LOG_LEVEL=info
```

### Reglas de configuracion

- Los secretos no se versionan.
- Los ejemplos deben usar placeholders.
- Los tests deben poder correr sin `GOOGLE_PLACES_API_KEY` real.
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

- Google Places puede cambiar costos, cuotas o shape de respuesta.
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
