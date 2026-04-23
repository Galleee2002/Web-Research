# Conexion Frontend con Backend

## Objetivo

Este documento resume los pasos simples para que el frontend consuma los
endpoints backend del MVP. El frontend no debe conectarse directamente a
PostgreSQL; siempre debe usar las API routes de Next.js.

## Base recomendada

Crear un cliente en `apps/web/lib/api` que centralice `fetch`, arme query params
y maneje errores. Los componentes deberian llamar funciones de ese cliente, no
usar `fetch` suelto en cada pantalla.

Funciones minimas:

- `createSearch(payload)`;
- `listSearches(params)`;
- `listBusinesses(params)`;
- `getBusiness(id)`;
- `updateBusiness(id, payload)`;
- `buildExportUrl(params)`.

## Endpoints

### Crear busqueda

`POST /api/search`

Body:

```json
{
  "query": "dentistas",
  "location": "Buenos Aires, Argentina"
}
```

Uso frontend:

- validar que `query` y `location` no esten vacios;
- enviar JSON;
- guardar o mostrar la respuesta creada;
- refrescar historial de busquedas si corresponde.

### Listar busquedas

`GET /api/searches`

Params opcionales:

- `page`;
- `page_size`;
- `status`;
- `source`.

Uso frontend:

- mostrar historial operativo;
- permitir refresco manual;
- usar `status` para distinguir `pending`, `processing`, `completed` y
  `failed`.

### Listar negocios

`GET /api/businesses`

Params opcionales:

- `page`;
- `page_size`;
- `has_website`;
- `status`;
- `city`;
- `category`;
- `query`;
- `order_by`.

Uso frontend:

- serializar filtros con `URLSearchParams`;
- omitir filtros vacios;
- volver a `page = 1` cuando cambian filtros;
- usar la respuesta `items`, `total`, `page` y `page_size` para paginar.
- interpretar `has_website=false` como negocios sin website propio, incluyendo
  casos donde el proveedor devolvio una red social, WhatsApp, Google Maps,
  directorio o URL invalida rechazada por backend.
- no replicar en frontend la lista de dominios ni la decision de si una URL
  cuenta como website propio.

### Ver detalle de negocio

`GET /api/businesses/{id}`

Uso frontend:

- usarlo al abrir un detalle;
- si responde `404`, mostrar que el negocio no existe o fue eliminado.

### Actualizar lead

`PATCH /api/businesses/{id}`

Body:

```json
{
  "status": "reviewed",
  "notes": "Revisar propuesta de sitio institucional."
}
```

Uso frontend:

- permitir solo estados validos: `new`, `reviewed`, `contacted`, `discarded`;
- enviar `notes` solo si el usuario lo edita;
- usar la respuesta del backend como fuente de verdad;
- refrescar el item o la lista despues de guardar.

### Exportar CSV

`GET /api/export`

Uso frontend:

- reutilizar los filtros activos del listado;
- construir la URL con `URLSearchParams`;
- iniciar descarga desde el navegador;
- no generar CSV en frontend.

## Manejo basico de errores

Errores esperados:

- `400`: input invalido;
- `404`: negocio no encontrado;
- `500`: error interno o de persistencia.

El frontend deberia:

- mostrar un mensaje simple y recuperable;
- conservar filtros o formulario cuando haya error;
- permitir reintentar;
- no asumir que un cambio fue guardado si la API responde error.

## Ejemplo simple de helper

```ts
export function buildQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
```
