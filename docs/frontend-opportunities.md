# Frontend Opportunities

## Objetivo

Este documento describe la UI implementada para la seccion `Opportunities` del
dashboard y su contrato actual con el backend.

La fuente de verdad sigue siendo la API de Next.js. La pantalla no calcula
ratings ni reglas comerciales por su cuenta; solo renderiza el estado recibido
y envia actualizaciones de puntuacion.

## Ubicacion

- Pantalla: `apps/web/app/opportunities/page.tsx`
- Estilos: `apps/web/styles/globals.scss`
- API consumida:
  - `GET /api/opportunities`
  - `PATCH /api/opportunities/{id}`

## Comportamiento Implementado

Al entrar en `/opportunities`, la pantalla:

- dispara `fetch("/api/opportunities")` con `cache: "no-store"`;
- carga la lista inicial ordenada por rating desde backend;
- muestra estado de carga mientras llega la respuesta;
- muestra estado vacio si la API responde sin items;
- muestra mensaje de error recuperable si la carga falla.

Cuando la lista tiene datos, la UI renderiza una tabla visual con cuatro
columnas:

- `Business`
- `Location`
- `Status`
- `Rating`

Cada fila muestra:

- nombre del negocio;
- categoria o `Uncategorized`;
- telefono o `No phone`;
- link `Open map` si existe `maps_url`;
- ciudad o `Unknown city`;
- direccion o `No address`;
- status del lead;
- control de 5 estrellas para editar `rating`.

## Rating de 5 Estrellas

El control visual usa 5 botones con icono `Star`.

Reglas implementadas:

- si `rating` es `null`, todas las estrellas se muestran vacias;
- si `rating` vale `1..5`, se pintan las estrellas hasta ese valor;
- click en una estrella distinta envia `PATCH` con ese valor;
- click en la misma estrella actual envia `PATCH` con `null` para limpiar la
  puntuacion;
- mientras el request esta pendiente, la fila deshabilita el control.

Payload enviado:

```json
{ "rating": 4 }
```

Para limpiar:

```json
{ "rating": null }
```

## Actualizacion de Estado en Pantalla

Despues de un `PATCH` exitoso:

- la pantalla usa la respuesta del backend como fuente de verdad;
- reemplaza el item actualizado dentro del estado local;
- reordena la lista en cliente con la misma prioridad visual:
  - `rating desc`
  - `created_at desc` como desempate

Si el request falla:

- no se asume persistencia;
- se muestra un mensaje de error en la parte superior del contenido;
- el usuario puede volver a intentar.

## Accesibilidad y Semantica

La implementacion actual incluye:

- `aria-labelledby` para el titulo de la seccion;
- `role="status"` y `aria-live="polite"` en estados de carga/vacio/error;
- `role="table"`, `rowgroup`, `row` y `cell` para la tabla visual;
- `role="radiogroup"` para el bloque de estrellas;
- `role="radio"` y `aria-checked` para cada estrella;
- etiquetas accesibles por negocio para cada accion de rating.

## Estilo Visual

La seccion reutiliza el shell existente del dashboard y agrega estilos propios
para:

- header con eyebrow `Commercial Prioritization`;
- meta superior con cantidad visible y criterio de orden;
- feedback de error;
- tarjetas/fila con grid;
- chips de status;
- pill de estrellas;
- comportamiento responsive para mobile.

En pantallas chicas:

- el header pasa a layout vertical;
- la grilla de filas colapsa a una sola columna;
- la fila de encabezados se oculta;
- el bloque de rating se alinea a la izquierda.

## Contrato de Datos Esperado

La UI actual espera `PaginatedResponse<OpportunityRead>` desde
`GET /api/opportunities`.

Campos usados por la pantalla:

- `id`
- `rating`
- `name`
- `category`
- `phone`
- `maps_url`
- `city`
- `address`
- `status`
- `created_at`

La UI no depende hoy de paginacion visible, filtros interactivos ni detalle de
opportunity, aunque el backend ya devuelve la forma paginada.

## Limites Actuales

La implementacion actual no incluye:

- filtros en la pantalla;
- paginacion visible en UI;
- ordenamiento manual desde frontend;
- detalle expandido de opportunity;
- edicion de otros campos comerciales;
- historial de cambios del rating.

## Regla de Mantenimiento

Si cambia el contrato de `OpportunityRead`, el orden por defecto, o la semantica
de `rating`, actualizar en conjunto:

- `apps/web/app/opportunities/page.tsx`
- `packages/shared`
- rutas `/api/opportunities`
- este documento
