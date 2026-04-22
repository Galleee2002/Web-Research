# PRD - Business Lead Finder (Arquitectura Hibrida)

## 1. Overview

- **Nombre del producto:** Business Lead Finder
- **Tipo:** Web App + Data Pipeline
- **Arquitectura:** Next.js + Python Workers + PostgreSQL

**Objetivo**

Detectar negocios locales sin pagina web y convertirlos en leads gestionables desde un dashboard.

## 2. Problema

Muchos negocios:

- No tienen sitio web.
- Dependen solo de redes sociales.
- No captan trafico organico.

Para agencias y developers, detectar estos negocios es:

- Manual.
- Lento.
- Poco escalable.

## 3. Solucion

Una plataforma que:

- Descubre negocios por ubicacion y rubro.
- Detecta si tienen web.
- Almacena y normaliza datos.
- Permite gestionar leads desde un panel.
- Escala mediante workers automaticos.

## 4. Arquitectura del sistema

### 4.1 App principal

- Next.js
- UI + API routes
- Dashboard de leads

### 4.2 Workers

- Python
- Scraping / API ingestion
- Enriquecimiento de datos

### 4.3 Base de datos

- PostgreSQL

### 4.4 UI stack

- Tailwind CSS
- shadcn/ui

## 5. Usuario objetivo

- Freelancers
- Agencias digitales
- Devs full stack
- Equipos de ventas B2B

## 6. Alcance (MVP)

### 6.1 Incluye

- Busqueda de negocios.
- Ingesta automatica de datos.
- Deteccion de web.
- Dashboard de leads.
- Filtro sin web.
- Estados de lead.
- Export CSV.

### 6.2 No incluye

- Automatizacion de outreach.
- Multiusuario.
- Integracion CRM.
- IA avanzada.

## 7. Flujo del sistema

1. Usuario crea busqueda.
2. Next.js registra `search_run`.
3. Worker Python procesa la busqueda.
4. Obtiene negocios desde APIs externas.
5. Enriquecimiento:
   - deteccion de website
6. Persistencia en DB.
7. Frontend consume datos.
8. Usuario gestiona leads.

## 8. Requisitos funcionales

### 8.1 Creacion de busqueda

- **Input:**
  - `keyword`
  - `ubicacion`
- **Output:**
  - Job en cola para procesamiento.

### 8.2 Ingesta de datos (Worker)

Debe:

- Consultar API externa.
- Normalizar datos.
- Evitar duplicados.
- Guardar resultados.

### 8.3 Deteccion de website

- Si no existe -> `has_website = false`
- Si existe -> `has_website = true`

### 8.4 Dashboard

El usuario puede:

- Visualizar negocios.
- Filtrar por:
  - sin web
  - ciudad
  - categoria
- Ordenar.
- Paginar.

### 8.5 Gestion de leads

Estados:

- `new`
- `reviewed`
- `contacted`
- `discarded`

### 8.6 Exportacion

- CSV descargable.

## 9. Logica de negocio

### 9.1 Lead valido

- `website == null` -> lead

### 9.2 Reglas

- Redes sociales != website.
- Evitar duplicados por `name + address`.
- Permitir revision manual.

## 10. Modelo de datos

### 10.1 Tabla `businesses`

- id
- external_id
- source
- name
- category
- address
- city
- lat
- lng
- phone
- website
- has_website
- maps_url
- created_at
- updated_at

### 10.2 Tabla `search_runs`

- id
- query
- location
- status
- total_found
- created_at

### 10.3 Tabla `lead_status`

- id
- business_id
- status
- notes
- updated_at

## 11. Arquitectura tecnica

### 11.1 Next.js

Responsable de:

- UI
- API routes
- Autenticacion (futuro)
- Consumo de DB

### 11.2 Python Workers

Responsable de:

- Ingestion
- Scraping / APIs
- Validacion de datos
- Enrichment

### 11.3 Comunicacion entre servicios

- DB compartida
- Queue (futuro):
  - Redis
  - RabbitMQ

## 12. API (Next.js)

| Caso de uso | Metodo | Endpoint |
| --- | --- | --- |
| Crear busqueda | POST | `/api/search` |
| Obtener negocios | GET | `/api/businesses` |
| Filtrar sin web | GET | `/api/businesses?has_website=false` |
| Actualizar estado | PATCH | `/api/businesses/:id` |
| Exportar CSV | GET | `/api/export` |

## 13. Metricas clave

- Leads detectados.
- Porcentaje sin web.
- Leads gestionados.
- Ratio de conversion.

## 14. Riesgos

- Dependencia de APIs externas.
- Rate limits.
- Datos incompletos.
- Falsos positivos.

## 15. Roadmap

### 15.1 MVP

- Pipeline basico.
- Dashboard.
- Filtros.
- Export.

### 15.2 V2

- Deteccion de redes sociales.
- Scoring de leads.
- Deduplicacion avanzada.

### 15.3 V3

- CRM interno.
- Automatizacion de contacto.
- Multiusuario.

## 16. Testing

- Validacion de ingestion.
- Test de endpoints.
- Test de duplicados.
- Test de UI.

## 17. Consideraciones legales

- No scraping directo de Google.
- Uso de APIs autorizadas.
- Cumplimiento de terminos.

## 18. Definicion de exito

El MVP es exitoso si:

- Detecta negocios sin web.
- Permite visualizarlos.
- Permite gestionarlos.
- Funciona end-to-end automaticamente.

## 19. Estructura del proyecto

```txt
lead-finder/
  apps/
    web/        # Next.js
  services/
    workers/    # Python
  packages/
    db/         # schema / prisma (opcional)
```

## 20. Notas finales

Este documento define:

- Arquitectura
- Logica de negocio
- Alcance
- Roadmap

Es la fuente unica de verdad del proyecto.