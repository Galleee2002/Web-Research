# Documento de Tareas Frontend MVP - Business Lead Finder

## 1. Objetivo y alcance frontend MVP

Este documento define las tareas frontend necesarias para construir el MVP de
Business Lead Finder, en coherencia con el documento backend
`docs/architecture/backend-implementation-tasks.md`.

El foco de este documento es funcional. No define diseno visual, layout,
paleta, jerarquia visual, componentes esteticos ni criterios de presentacion
grafica. Esas decisiones quedan a cargo de la implementacion frontend.

El frontend MVP debe permitir:

- crear busquedas por rubro y ubicacion;
- visualizar el estado de las busquedas creadas;
- listar negocios procesados por el backend;
- filtrar leads por presencia de website, estado, ciudad, categoria y texto;
- paginar resultados;
- consultar el detalle basico de un negocio;
- actualizar estado y notas de un lead;
- exportar CSV usando los filtros activos;
- manejar estados de carga, vacio, exito y error.

### Fuera de alcance para el MVP

- autenticacion;
- multiusuario;
- roles y permisos;
- CRM integrado;
- outreach automatizado;
- scoring avanzado;
- realtime o WebSockets;
- definiciones de diseno visual o layout;
- reglas de negocio duplicadas que ya pertenecen al backend.

## 2. Relacion con el backend

La aplicacion frontend vive en `apps/web` y consume API routes definidas bajo
`apps/web/app/api`.

El frontend no debe conectarse directamente a PostgreSQL desde componentes de
UI. Toda lectura o mutacion del MVP debe pasar por los contratos HTTP definidos
por el backend.

### Fuente de verdad

- La persistencia y reglas de negocio viven en backend y workers.
- Los estados validos se consumen desde contratos compartidos.
- La clasificacion `has_website` viene calculada por backend.
- El campo `website` expuesto por API es un website propio aceptado, no una URL
  cruda del proveedor.
- La deduplicacion no se resuelve en frontend.
- La exportacion CSV se delega a `GET /api/export`.

### Dependencias funcionales

El frontend depende de estos contratos backend:

- `POST /api/search`;
- `GET /api/searches`;
- `GET /api/businesses`;
- `GET /api/businesses/{id}`;
- `PATCH /api/businesses/{id}`;
- `GET /api/export`.

`GET /api/health` existe como endpoint operativo para desarrollo,
diagnostico y smoke checks. No es parte de los flujos funcionales del MVP ni
debe ser requisito para renderizar pantallas.

### Alineacion de errores y trazabilidad

El frontend debe tratar los errores HTTP como contratos backend, no como
reglas locales.

Convenciones activas:

- las respuestas de error incluyen `error.code`;
- las respuestas de error incluyen `error.message`;
- las respuestas de error pueden incluir `error.details`;
- las respuestas de error incluyen `error.correlation_id`.

Reglas para frontend:

- no inventar taxonomias de error paralelas a las del backend;
- no duplicar clasificacion de errores operativos del worker o de la base;
- usar `error.correlation_id` solo para diagnostico, soporte o debug visible
  para el usuario cuando corresponda;
- no convertir `correlation_id` en estado de negocio ni en dependencia del
  flujo funcional principal.

### Relacion con Fase 7 backend

La Fase 7 backend agrega clientes internos del worker Python para Google
Places y Google Geocoding. Esa fase no agrega endpoints HTTP publicos para el
frontend.

Reglas para frontend:

- no consumir clientes ni payloads crudos del worker;
- no mostrar campos crudos de Google que no hayan sido persistidos y expuestos
  por API routes;
- esperar datos nuevos solo cuando fases posteriores normalicen y persistan
  negocios en PostgreSQL;
- mantener como fuente contractual las respuestas de `apps/web/app/api` y los
  tipos de `packages/shared`.

## 3. Pantallas y responsabilidades funcionales

Los nombres de pantallas son funcionales y no implican layout especifico.

### Busqueda

Responsabilidades:

- capturar `query`;
- capturar `location`;
- validar campos requeridos antes de enviar;
- enviar `POST /api/search`;
- mostrar resultado de creacion o error;
- permitir crear otra busqueda sin recargar la app completa.

Datos requeridos:

- `query`;
- `location`.

Estados a manejar:

- formulario inicial;
- envio en progreso;
- busqueda creada;
- error de validacion local;
- error de API.

Ante error de API:

- mostrar un mensaje simple y recuperable;
- conservar el estado del formulario;
- poder exponer `correlation_id` si se necesita soporte o debug.

### Historial de busquedas

Responsabilidades:

- consumir `GET /api/searches`;
- mostrar cada `search_run` con su estado;
- permitir distinguir `pending`, `processing`, `completed` y `failed`;
- mostrar `total_found` cuando este disponible;
- permitir refrescar la lista manualmente.

Estados a manejar:

- carga inicial;
- lista vacia;
- lista con resultados;
- error al cargar.

Si el backend responde `failed` en una busqueda:

- mostrar un estado claro de fallo operativo;
- no intentar reconstruir el error real desde frontend;
- si la API entrega `correlation_id`, permitir mostrarlo como referencia.

### Dashboard de negocios

Responsabilidades:

- consumir `GET /api/businesses`;
- mostrar negocios paginados;
- aplicar filtros compatibles con backend;
- mantener los filtros activos como estado de UI;
- recargar resultados cuando cambian filtros o pagina;
- permitir abrir detalle basico de negocio;
- permitir iniciar exportacion CSV con filtros activos.

Filtros MVP:

- `has_website`;
- `status`;
- `city`;
- `category`;
- `query`.

Paginacion:

- `page`;
- `page_size`.

Ordenamiento:

- consumir solo campos soportados por backend;
- no inventar ordenamientos locales que contradigan la paginacion backend.

### Detalle de negocio

Responsabilidades:

- consumir `GET /api/businesses/{id}`;
- mostrar datos completos disponibles para el MVP;
- permitir actualizar estado y notas;
- manejar negocio inexistente con estado de error claro.

Errores:

- si responde `404`, mostrar ausencia del recurso;
- si responde error backend, no perder el contexto del detalle ya cargado;
- permitir mostrar `correlation_id` como referencia tecnica.

Datos minimos a presentar:

- `name`;
- `category`;
- `address`;
- `city`;
- `phone`;
- `website`;
- `has_website`;
- `status`;
- `maps_url`;
- `notes`.

Datos adicionales disponibles en detalle:

- `search_run_id`;
- `external_id`;
- `source`;
- `region`;
- `country`;
- `lat`;
- `lng`;
- `created_at`;
- `updated_at`.

### Gestion de lead

Responsabilidades:

- permitir cambiar `status`;
- permitir editar `notes`;
- enviar `PATCH /api/businesses/{id}`;
- reflejar el resultado confirmado por backend;
- no modificar optimistamente estados invalidos;
- manejar errores sin perder el contexto actual.

Regla:

- el frontend no debe reinterpretar `database_error`, `internal_error` u otros
  codigos como nuevas reglas de negocio; solo debe mostrar feedback y permitir
  reintento.

Estados validos:

- `new`;
- `reviewed`;
- `contacted`;
- `discarded`.

### Exportacion CSV

Responsabilidades:

- construir una URL `GET /api/export` con los filtros actuales;
- iniciar descarga del archivo;
- no generar CSV manualmente en frontend;
- manejar error de descarga si la API falla.

Si falla la exportacion:

- conservar filtros activos;
- mostrar error recuperable;
- poder exponer `correlation_id` cuando la respuesta lo incluya.

Columnas esperadas por contrato backend:

- `name`;
- `category`;
- `address`;
- `city`;
- `phone`;
- `website`;
- `has_website`;
- `status`;
- `maps_url`.

## 4. Contratos consumidos por el frontend

Los contratos deben vivir en `packages/shared` cuando sean compartidos por mas
de una capa.

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

### Requests

`SearchCreate`:

```json
{
  "query": "dentistas",
  "location": "Buenos Aires, Argentina"
}
```

`BusinessStatusUpdate`:

```json
{
  "status": "reviewed",
  "notes": "Revisar propuesta de sitio institucional."
}
```

`notes` es opcional. Si se omite, el backend conserva las notas actuales. Si se
envia `null`, el backend limpia las notas del negocio.

### Responses

`SearchRead`:

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

`BusinessRead`:

```json
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
```

`BusinessListResponse`:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

`BusinessDetailRead`:

```json
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
  "maps_url": "https://maps.google.com/...",
  "search_run_id": "search_run_id",
  "external_id": "google_place_id",
  "source": "google_places",
  "region": "Ciudad Autonoma de Buenos Aires",
  "country": "Argentina",
  "lat": -34.6037,
  "lng": -58.3816,
  "notes": null,
  "created_at": "2026-04-22T12:00:00Z",
  "updated_at": "2026-04-22T12:00:00Z"
}
```

### Endpoints consumidos

#### `POST /api/search`

Request: `SearchCreate`.

Response `201`: `SearchRead`.

Errores esperados:

- `400` si `query` o `location` son invalidos;
- `500` si falla la persistencia.

#### `GET /api/searches`

Response: `PaginatedResponse<SearchRead>`.

Query params:

- `page`: numero positivo;
- `page_size`: numero positivo, limitado por backend;
- `status`: uno de `SearchRunStatus`;
- `source`: uno de `BusinessSource`, default `google_places`.

#### `GET /api/businesses`

Response: `PaginatedResponse<BusinessRead>`.

Query params:

- `page`: numero positivo;
- `page_size`: numero positivo, limitado por backend;
- `has_website`: booleano serializado como `true` o `false`;
- `status`: uno de `LeadStatus`;
- `city`: texto;
- `category`: texto;
- `query`: texto para busqueda por nombre;
- `order_by`: `created_at`, `name` o `city`.

#### `GET /api/businesses/{id}`

`id` debe ser UUID.

Response `200`: `BusinessDetailRead`.

Errores esperados:

- `400` si `id` no es UUID;
- `404` si el negocio no existe;
- `500` si falla la persistencia.

#### `PATCH /api/businesses/{id}`

`id` debe ser UUID.

Request: `BusinessStatusUpdate`.

Response `200`: `BusinessDetailRead`.

Errores esperados:

- `400` si `id`, `status` o `notes` son invalidos;
- `404` si el negocio no existe;
- `500` si falla la persistencia.

#### `GET /api/export`

Usa los mismos filtros que `GET /api/businesses`, incluyendo `order_by`.

Response `200`:

- `Content-Type: text/csv; charset=utf-8`;
- `Content-Disposition: attachment; filename="business-leads.csv"`.

Columnas CSV:

- `name`;
- `category`;
- `address`;
- `city`;
- `phone`;
- `website`;
- `has_website`;
- `status`;
- `maps_url`.

### Query params para negocios

`GET /api/businesses` debe ser consumido con estos parametros:

- `page`: numero positivo;
- `page_size`: numero positivo, limitado por backend;
- `has_website`: booleano serializado como `true` o `false`;
- `status`: uno de `LeadStatus`;
- `city`: texto;
- `category`: texto;
- `query`: texto para busqueda por nombre;
- `order_by`: `created_at`, `name` o `city`.

El frontend debe omitir parametros vacios para evitar filtros ambiguos.

### Errores HTTP

Los errores de API routes tienen una forma comun:

`400`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request",
    "details": ["status is not a valid lead status"]
  }
}
```

`404`:

```json
{
  "error": {
    "code": "not_found",
    "message": "Business not found"
  }
}
```

`500`:

```json
{
  "error": {
    "code": "internal_error",
    "message": "Internal server error"
  }
}
```

## 5. Estado de datos y flujo de interaccion

### Cliente API

Crear una capa de cliente API en `apps/web/lib/api` para:

- centralizar `fetch`;
- serializar query params;
- parsear JSON;
- detectar respuestas no exitosas;
- exponer funciones por caso de uso;
- evitar llamadas HTTP duplicadas directamente dentro de componentes.

Funciones minimas:

- `createSearch(payload)`;
- `listSearches(params)`;
- `listBusinesses(params)`;
- `getBusiness(id)`;
- `updateBusiness(id, payload)`;
- `buildExportUrl(params)`.

El cliente API debe modelar dos respuestas de negocio distintas:

- `BusinessRead` para listados, filtros y CSV;
- `BusinessDetailRead` para detalle y para la respuesta confirmada de
  `PATCH /api/businesses/{id}`.

La UI de listado puede usar `maps_url`, `website`, `phone`, `city`,
`category`, `has_website` y `status`. La UI de detalle puede sumar
`external_id`, `source`, `region`, `country`, coordenadas, notas y timestamps
si el flujo lo requiere.

El cliente no debe exponer al UI payloads crudos de Google Places o Geocoding.
Solo deben llegar a componentes los campos persistidos y publicados por las API
routes.

### Estado de busqueda

Flujo:

1. usuario completa `query` y `location`;
2. frontend valida campos requeridos;
3. frontend envia `POST /api/search`;
4. backend responde con `SearchRead`;
5. frontend muestra la busqueda creada;
6. frontend permite refrescar historial para observar cambios de estado.

El MVP no requiere realtime. Cualquier actualizacion automatica por polling debe
ser una mejora opcional y no una dependencia para cerrar el MVP.

### Estado de listado

Flujo:

1. frontend carga filtros iniciales;
2. frontend solicita `GET /api/businesses`;
3. backend devuelve `BusinessListResponse`;
4. frontend renderiza `items`;
5. al cambiar filtros, frontend vuelve a pagina `1`;
6. al cambiar pagina, frontend conserva filtros activos;
7. al actualizar un negocio, frontend refresca el item o la lista.

### Estado de exportacion

Flujo:

1. frontend toma filtros activos del listado;
2. frontend construye URL de exportacion;
3. frontend inicia descarga;
4. backend genera CSV;
5. frontend informa error si la descarga falla.

## 6. Validaciones y manejo de errores

### Validaciones locales

El frontend debe validar antes de enviar:

- `query` requerido;
- `location` requerido;
- `status` dentro de `LeadStatus`;
- `page` mayor o igual a `1`;
- `page_size` mayor o igual a `1`;
- filtros vacios no deben enviarse.

Las validaciones locales mejoran experiencia, pero no reemplazan validacion de
backend.

### Manejo de errores HTTP

Errores esperados:

- `400`: `validation_error`, input invalido;
- `404`: `not_found`, negocio inexistente;
- `500`: `internal_error`, error interno o persistencia fallida.

El frontend debe:

- mostrar mensaje recuperable;
- conservar filtros y formulario cuando corresponda;
- permitir reintentar cargas;
- no asumir que una mutacion fue exitosa si backend responde error.

Cuando `error.details` exista, puede usarse para mensajes de validacion. Si no
existe, el frontend debe usar `error.message`.

### Estados de UI funcionales

Cada flujo de datos debe contemplar:

- `idle`;
- `loading`;
- `success`;
- `empty`;
- `error`.

Estos estados describen comportamiento, no diseno visual.

## 7. Fases de implementacion frontend

### Fase 1 - Base de app Next.js y estructura frontend

Objetivo:

- preparar la app frontend del MVP dentro de `apps/web`.

Tareas:

- inicializar Next.js respetando la estructura existente;
- configurar TypeScript si se adopta como estandar del proyecto;
- configurar SCSS como sistema de estilos disponible;
- mantener carpetas funcionales existentes;
- definir rutas principales de MVP;
- documentar comandos de desarrollo.

Entregables:

- app ejecutable;
- estructura base en `apps/web`;
- scripts de desarrollo.

Criterio de aceptacion:

- la app puede arrancar localmente y renderizar una pagina inicial del MVP.

### Fase 2 - Contratos compartidos y cliente API

Objetivo:

- conectar frontend con contratos del backend sin duplicar reglas.

Tareas:

- definir o consumir enums compartidos;
- definir tipos para requests y responses;
- crear cliente API centralizado;
- crear helper de query params;
- crear manejo uniforme de errores HTTP.

Entregables:

- tipos compartidos;
- funciones API;
- manejo base de errores.

Criterio de aceptacion:

- los componentes no hacen `fetch` directo salvo excepciones justificadas.

### Fase 3 - Pantalla de busqueda

Objetivo:

- permitir crear `search_runs`.

Tareas:

- crear formulario con `query` y `location`;
- validar campos requeridos;
- enviar `POST /api/search`;
- mostrar estado de envio;
- mostrar resultado de creacion;
- manejar errores de API.

Entregables:

- flujo de creacion de busqueda;
- tests de validacion y submit.

Criterio de aceptacion:

- una busqueda valida se envia y su respuesta se refleja en pantalla.

### Fase 4 - Historial y estado de busquedas

Objetivo:

- permitir observar busquedas ejecutadas.

Tareas:

- consumir `GET /api/searches`;
- renderizar `query`, `location`, `status`, `total_found` y `created_at`;
- manejar lista vacia;
- manejar error de carga;
- permitir refresco manual.

Entregables:

- historial funcional de busquedas.

Criterio de aceptacion:

- el usuario puede confirmar si una busqueda esta pendiente, procesando,
  completada o fallida.

### Fase 5 - Dashboard/listado de negocios

Objetivo:

- mostrar resultados procesados por backend.

Tareas:

- consumir `GET /api/businesses`;
- renderizar `BusinessRead`;
- reservar `BusinessDetailRead` para detalle y mutaciones;
- mostrar paginacion desde `BusinessListResponse`;
- manejar `loading`, `empty` y `error`;
- permitir abrir detalle basico.

Entregables:

- listado de negocios funcional.

Criterio de aceptacion:

- con seeds o datos reales, el usuario puede ver negocios paginados.

### Fase 6 - Filtros, paginacion y ordenamiento

Objetivo:

- permitir navegar el dataset del MVP.

Tareas:

- implementar filtro `has_website`;
- implementar filtro `status`;
- implementar filtro `city`;
- implementar filtro `category`;
- implementar filtro textual `query`;
- implementar `order_by` solo con `created_at`, `name` o `city`;
- omitir filtros vacios;
- resetear a pagina `1` cuando cambian filtros;
- conservar filtros al cambiar pagina;
- consumir ordenamiento solo si backend lo soporta.

Entregables:

- filtros compatibles con backend;
- paginacion estable.

Criterio de aceptacion:

- `has_website=false` muestra leads sin web segun clasificacion backend.

### Fase 7 - Gestion de estado y notas del lead

Objetivo:

- permitir gestion manual basica del lead.

Tareas:

- permitir seleccionar `LeadStatus`;
- permitir editar `notes`;
- enviar `PATCH /api/businesses/{id}`;
- reflejar la respuesta `BusinessDetailRead` del backend;
- omitir `notes` cuando se quiera conservar el valor actual;
- enviar `notes: null` cuando se quiera limpiar el valor actual;
- manejar `400` y `404`;
- evitar estados no soportados.

Entregables:

- actualizacion funcional de estado y notas.

Criterio de aceptacion:

- un lead puede pasar entre `new`, `reviewed`, `contacted` y `discarded`.

### Fase 8 - Export CSV

Objetivo:

- descargar resultados filtrados.

Tareas:

- construir URL de `GET /api/export`;
- incluir filtros activos, incluido `order_by`;
- iniciar descarga desde frontend;
- no transformar datos manualmente a CSV;
- manejar error de descarga.

Entregables:

- accion de exportacion CSV.

Criterio de aceptacion:

- el CSV exportado corresponde al mismo conjunto filtrado del listado.

### Fase 9 - Estados de carga, vacio y error

Objetivo:

- hacer cada flujo operable en condiciones normales y fallidas.

Tareas:

- definir estados funcionales por request;
- mostrar estado vacio para listados sin resultados;
- mostrar errores recuperables;
- permitir reintento donde aplique;
- preservar input del usuario ante errores.

Entregables:

- manejo consistente de estados de datos.

Criterio de aceptacion:

- ninguna pantalla principal queda bloqueada o rota ante respuesta vacia o error.

### Fase 10 - Testing frontend MVP

Objetivo:

- cubrir comportamiento critico de usuario y contratos con API.

Tareas:

- testear formulario de busqueda;
- testear validaciones locales;
- mockear cliente API;
- testear filtros y query params;
- testear actualizacion de lead;
- testear estados vacios y errores;
- testear construccion de URL de exportacion.

Entregables:

- suite base de tests frontend.

Criterio de aceptacion:

- los flujos MVP tienen cobertura suficiente para detectar regresiones.

### Fase 11 - Preparacion para integracion backend

Objetivo:

- asegurar que frontend y backend se integren sin decisiones pendientes.

Tareas:

- validar nombres de campos contra contratos backend;
- probar con seeds backend;
- verificar errores `400`, `404` y `500`;
- verificar paginacion real;
- verificar descarga CSV real;
- revisar que no haya reglas de negocio duplicadas.

Entregables:

- checklist de integracion frontend-backend.

Criterio de aceptacion:

- frontend puede operar contra API routes reales del MVP.

### Fase 12 - Criterios de cierre MVP

El frontend MVP se considera listo cuando:

- permite crear busquedas;
- muestra historial de busquedas;
- lista negocios paginados;
- filtra leads sin web;
- filtra por estado, ciudad, categoria y texto;
- muestra detalle basico;
- actualiza estado y notas;
- exporta CSV con filtros activos;
- maneja carga, vacio y error;
- consume contratos compartidos;
- no duplica reglas de negocio del backend.

## 8. Testing requerido

### Tests unitarios

Cubrir:

- serializacion de query params;
- validacion local de formularios;
- construccion de URL de exportacion;
- manejo de errores del cliente API;
- mapeo de estados permitidos.

### Tests de componentes o flujos

Cubrir:

- renderizar formulario de busqueda;
- rechazar `query` vacio;
- rechazar `location` vacio;
- crear busqueda y reflejar respuesta;
- renderizar listado paginado;
- aplicar filtros compatibles con backend;
- mostrar solo leads sin web cuando `has_website=false`;
- actualizar `status` y `notes`;
- manejar `404` en detalle;
- manejar error de API en listado;
- mostrar estados vacios sin romper la pantalla.

### Tests de integracion frontend-backend

Cubrir cuando existan API routes reales:

- `POST /api/search` desde el formulario;
- `GET /api/businesses` con filtros combinados;
- `PATCH /api/businesses/{id}` desde gestion de lead;
- `GET /api/export` con filtros activos.

Los tests automatizados no deben depender de Google Places ni de datos externos.

## 9. Criterios de finalizacion del MVP

El frontend MVP esta completo cuando:

- todos los flujos principales consumen API routes reales o mocks contractuales;
- los contratos usados coinciden con el documento backend;
- los filtros enviados coinciden con los nombres esperados por backend;
- la exportacion usa `GET /api/export`;
- no hay dependencia de autenticacion;
- no hay dependencias de realtime;
- no hay reglas de deduplicacion ni website detection en frontend;
- existe cobertura de tests para flujos criticos;
- los errores recuperables permiten continuar usando la app.

## 10. Riesgos y decisiones futuras

### Riesgos principales

- cambios en contratos backend pueden romper filtros o mutaciones;
- datos incompletos pueden requerir placeholders funcionales;
- polling manual puede ser insuficiente si el volumen crece;
- exportaciones grandes pueden requerir manejo asincronico futuro;
- falta de autenticacion limita uso multiusuario.

### Decisiones futuras

- autenticacion y usuarios;
- permisos por rol;
- historial de cambios de estado;
- polling automatico o realtime;
- vistas guardadas de filtros;
- mejoras de busqueda avanzada;
- integraciones CRM;
- metricas del dashboard;
- scoring de leads.

## 11. Notas de mantenimiento

Este documento debe actualizarse cuando cambien:

- endpoints backend;
- nombres de parametros;
- modelos compartidos;
- estados permitidos;
- reglas de filtros;
- estrategia de exportacion;
- alcance funcional del MVP.

El frontend debe permanecer como consumidor de contratos y flujos del backend.
Las reglas de negocio criticas deben seguir centralizadas fuera de la capa de UI.
