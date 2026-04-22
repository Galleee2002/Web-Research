# Schema PostgreSQL MVP

## Alcance

La Fase 3 crea el schema persistente del MVP de Business Lead Finder usando
archivos SQL planos. Todavia no requiere un framework de migraciones.

## Archivos

- `database/migrations/001_create_mvp_schema.sql`: crea las tablas, constraints
  e indices del MVP.
- `database/seeds/001_mvp_demo_data.sql`: inserta datos demo deterministas para
  desarrollo local y futuras pruebas de API.

## Ejecucion Local

Configurar `DATABASE_URL` apuntando a una base PostgreSQL modificable y correr:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_create_mvp_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/001_mvp_demo_data.sql
```

El seed usa UUIDs fijos y `on conflict (id) do update`, por lo que puede
reaplicarse durante el desarrollo contra la misma base local.

## Decisiones de Schema

- Los IDs usan `uuid primary key default gen_random_uuid()` de PostgreSQL
  `pgcrypto`.
- Los valores de estado y fuente usan `text` con constraints `check` en vez de
  enums PostgreSQL. Esto mantiene simples los cambios futuros del MVP sin
  perder validacion en base de datos.
- `search_runs` registra el estado operativo del proveedor con `pending`,
  `processing`, `completed` y `failed`.
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

## Validaciones

Los constraints principales fuerzan:

- `query`, `location` y `businesses.name` no vacios;
- fuentes y estados permitidos;
- `total_found` no negativo;
- rangos validos de latitud y longitud;
- `website is null` implica `has_website = false`.
