# Schema PostgreSQL MVP

## Alcance

La Fase 3 crea el schema persistente del MVP de Business Lead Finder usando
archivos SQL planos. Todavia no requiere un framework de migraciones.

## Archivos

- `database/migrations/001_create_mvp_schema.sql`: crea las tablas, constraints
  e indices del MVP.
- `database/migrations/002_add_search_run_observability.sql`: amplia
  `search_runs` con columnas operativas para trazabilidad.
- `database/seeds/001_mvp_demo_data.sql`: archivo intencionalmente vacio para
  evitar reinsertar datos demo/mock en la base.

## Ejecucion Local

Configurar `DATABASE_URL` apuntando a una base PostgreSQL modificable y correr:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_create_mvp_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_add_search_run_observability.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/001_mvp_demo_data.sql
```

El archivo de seed actual no inserta registros. Se conserva solo como punto de
entrada estable para flujos locales que esperan un archivo de seed, sin volver
a cargar datos ficticios.

## Decisiones de Schema

- Los IDs usan `uuid primary key default gen_random_uuid()` de PostgreSQL
  `pgcrypto`.
- Los valores de estado y fuente usan `text` con constraints `check` en vez de
  enums PostgreSQL. Esto mantiene simples los cambios futuros del MVP sin
  perder validacion en base de datos.
- `search_runs` registra el estado operativo del proveedor con `pending`,
  `processing`, `completed` y `failed`.
- `search_runs` ahora tambien puede persistir `correlation_id`, `error_code`,
  `error_stage` y un resumen `observability` en `jsonb` para diagnostico.
- `businesses.status` guarda el estado manual del lead con `new`, `reviewed`,
  `contacted` y `discarded`.
- `lead_status` no se crea para el MVP. El estado vive en `businesses`, y
  `businesses.notes` guarda la nota interna actual. Se puede agregar una tabla
  historica luego si auditoria o multiples usuarios entran en alcance.
- `updated_at` tiene default `now()`, pero esta fase no agrega un trigger para
  actualizarlo automaticamente. Las futuras rutas de escritura deben setearlo
  explicitamente al actualizar filas.

## Soporte de Deduplicacion

La base ayuda a deduplicar, pero no es dueña de toda la politica:

- Un indice unico parcial en `(source, external_id)` evita duplicados cuando
  existe ID de proveedor.
- Un indice de expresion no unico sobre `name + address` normalizados soporta
  el fallback MVP para filas sin `external_id`.
- La politica de merge queda en servicios/workers, porque solo esa capa puede
  decidir si los datos entrantes del proveedor son mejores que los datos
  manuales existentes del lead.
- La Fase 10 implementa esa politica en `services/workers/src/persistence`:
  primero busca por `(source, external_id)`, luego por `name + address`
  canonicalizados solo contra filas sin `external_id`, y preserva siempre
  `businesses.status` y `businesses.notes`.

## Validaciones

Los constraints principales fuerzan:

- `query`, `location` y `businesses.name` no vacios;
- fuentes y estados permitidos;
- `total_found` no negativo;
- rangos validos de latitud y longitud;
- `website is null` implica `has_website = false`.

La base solo fuerza esa coherencia minima. La clasificacion completa de
website propio vive en workers: redes sociales, WhatsApp, Google Maps,
directorios y URLs invalidas se normalizan como `website = null` y
`has_website = false` antes de persistir. Si mas adelante se necesita conservar
la URL cruda del proveedor, debe agregarse otro campo.

## Observabilidad MVP

La Fase 13 amplia `search_runs` para soportar trazabilidad operativa sin crear
tablas nuevas de auditoria.

Campos agregados:

- `correlation_id`: une request HTTP, registro persistido y worker;
- `error_code`: clasificacion corta del error;
- `error_stage`: etapa aproximada del fallo;
- `observability`: resumen JSON de request y ejecucion.

La metadata persiste solo un resumen operativo. No guarda payloads completos de
Google ni stack traces.
